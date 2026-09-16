export const TURN_PROGRESS_RULE = `\n[Private display metadata]\nReturn JSON with text and progress. Classify this ONE student turn, never cumulative totals. Every submitted answer that is wrong OR incomplete is incorrect (even when part is praised). A repeated wrong answer is another incorrect event. Every explicit hint request you answer is hint, including the second request. Definitions and conceptual questions are discussion. correct means a fully accepted answer. question means start/next. question is the problem just answered, NOT the next problem shown. Keep metadata out of text.`;
export const turnSchema={type:'object',additionalProperties:false,required:['text','progress'],properties:{text:{type:'string'},progress:{type:'object',additionalProperties:false,required:['event','question'],properties:{event:{type:'string',enum:['question','incorrect','correct','hint','discussion']},question:{type:'integer',minimum:1,maximum:10}}}}};
export function questionNumber(text){const matches=[...String(text||'').matchAll(/(?:문제|활동|과제|연습|question|problem|activity|activité|exercice)\s*(10|[1-9])\s*\/\s*10\b/gi)];return matches.length?Number(matches.at(-1)[1]):null;}
export function activeQuestion(messages){for(let i=messages.length-1;i>=0;i--)if(messages[i].role==='assistant'){const n=questionNumber(messages[i].content);if(n)return n;}return 1;}
export function extractTurnProgress(raw,messages){
 let text=String(raw),p=null;
 try{const value=JSON.parse(raw);if(typeof value.text==='string'){text=value.text;p=value.progress;}}catch{}
 const match=text.match(/\[GEM_TURN\]([\s\S]*?)\[\/GEM_TURN\]/i);try{if(match)p=JSON.parse(match[1]);}catch{}
 text=text.replace(/\[GEM_TURN\][\s\S]*?(?:\[\/GEM_TURN\]|$)/gi,'').trim();
 const question=activeQuestion(messages),input=String(messages.at(-1)?.content||'').trim();
 let event=['question','incorrect','correct','hint','discussion'].includes(p?.event)&&(p.question===question||(p.question===question+1&&questionNumber(text)===question+1))?p.event:null;
 // Intent and the visible grading text take precedence over inconsistent model metadata.
 const hint=/^(?:힌트(?:\s*\d+)?|hint|indice)(?:\s|[!.?]|$)/i.test(input)||/힌트.{0,12}(?:주세요|부탁|한번|한 번)/.test(input);
 const partial=/(?:일부|부분|반은).{0,20}(?:맞|정답)|(?:잘 설명|잘 말|맞았).{0,35}(?:지만|다만)|아쉽|정답이 아니|틀렸|다시\s*(?:생각|풀어|도전)|not (?:quite|correct)|incorrect|try again|pas (?:tout à fait|correct)/i.test(text);
 if(hint)event='hint';else if(partial&&!/[?？]|무엇|뜻|설명해|설명해\s*주|what|why|how|pourquoi|comment/i.test(input))event='incorrect';
 if(!messages.some(m=>m.role==='assistant')&&questionNumber(text)===1)event='question';
 // Question ownership comes from the previous displayed question, never the model's next-question number.
 return {text,progress:event?{event,question,currentQuestion:questionNumber(text)||question,completed:event==='correct'||((questionNumber(text)||question)>question)}:null};
}
