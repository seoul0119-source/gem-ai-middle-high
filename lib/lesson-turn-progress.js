export const TURN_PROGRESS_RULE = `\n[Private display metadata]\nReturn the required JSON object with text containing the entire student-facing reply, and progress containing event and question. event must be question (new lesson or next-question command), incorrect (a submitted answer graded wrong, including partly wrong), correct (a submitted answer graded correct), hint (an explicitly requested hint supplied), or discussion (explanation, definition or conversation; never count as a wrong answer). question is the number 1–10 of the problem the student just answered/asked about, or 1 at the start. When grading question 1 and introducing question 2, metadata question must be 1. Automatic feedback after a wrong answer counts only as incorrect, not a requested hint. Keep metadata out of text; it is only for the counter display.`;
export const turnSchema={type:'object',additionalProperties:false,required:['text','progress'],properties:{text:{type:'string'},progress:{type:'object',additionalProperties:false,required:['event','question'],properties:{event:{type:'string',enum:['question','incorrect','correct','hint','discussion']},question:{type:'integer',minimum:1,maximum:10}}}}};
export function questionNumber(text){const matches=[...String(text||'').matchAll(/(?:문제|활동|과제|연습|question|problem|activity|activité|exercice)\s*(10|[1-9])\s*\/\s*10\b/gi)];return matches.length?Number(matches.at(-1)[1]):null;}
export function activeQuestion(messages){for(let i=messages.length-1;i>=0;i--)if(messages[i].role==='assistant'){const n=questionNumber(messages[i].content);if(n)return n;}return 1;}
export function extractTurnProgress(raw,messages){
 try{const value=JSON.parse(raw);if(typeof value.text==='string'&&value.progress)return extractTurnProgress(value.text+'\n[GEM_TURN]'+JSON.stringify(value.progress)+'[/GEM_TURN]',messages);}catch{}
 const match=String(raw).match(/\[GEM_TURN\]([\s\S]*?)\[\/GEM_TURN\]/i);
 const text=String(raw).replace(/\[GEM_TURN\][\s\S]*?(?:\[\/GEM_TURN\]|$)/gi,'').trim();
 let progress=null;
 try{const p=JSON.parse(match?.[1]||'null');if(p&&['question','incorrect','correct','hint','discussion'].includes(p.event)&&Number.isInteger(p.question)&&p.question>=1&&p.question<=10&&p.question===activeQuestion(messages))progress={event:p.event,question:p.question};}catch{}
 // A fresh question has no answer to grade. Other missing metadata stays unknown.
 if(!progress&&!messages.some(m=>m.role==='assistant')&&questionNumber(text)===1)progress={event:'question',question:1};
 return {text,progress:progress?{...progress,currentQuestion:questionNumber(text)||progress.question}:null};
}
