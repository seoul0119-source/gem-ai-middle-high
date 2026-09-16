// Rebuild from individual turns. Historical ambiguity is reported, not silently graded.
export function recordProgress(messages,legacy={}){
 const state={current:1,items:{},uncertain:false};let current=1;
 const number=t=>{const m=[...String(t).matchAll(/(?:문제|활동|question|activity|exercice)\s*(10|[1-9])\s*\/\s*10\b/gi)];return m.length?Number(m.at(-1)[1]):null;};
 for(let i=0;i<messages.length;i++){
  const m=messages[i];if(m.role!=='assistant')continue;
  const input=String(messages[i-1]?.content||''),next=number(m.content),p=m.progress;
  let event=p?.event;
  if(!event){
   if(/힌트|\bhint\b|\bindice\b/i.test(input))event='hint';
   else if(/아쉽|틀렸|정답이 아니|일부.{0,15}맞|부분.{0,15}맞|다시\s*(?:생각|풀어)|incorrect|try again|pas correct/i.test(m.content))event='incorrect';
   else if(/정답(?:입니다|이에요)|맞(?:았어요|습니다)|\bcorrect[!.]|bonne réponse/i.test(m.content))event='correct';
   else if(!i||/^시작$|^start$|^다음|^next/i.test(input))event='question';
   else state.uncertain=true;
  }
  const qn=p?.question||current,q=state.items[qn]||(state.items[qn]={incorrect:0,hints:0,completed:false});
  if(event==='incorrect')q.incorrect++;
  if(event==='hint')q.hints++;
  if(event==='correct'||p?.completed||q.incorrect>=3||(event==='incorrect'&&/정답은|정답\s*:|answer is|réponse est/i.test(m.content))||(next&&next>qn))q.completed=true;
  current=p?.currentQuestion||next||current;
 }
 for(const [n,q]of Object.entries(legacy.items||{})){const actual=state.items[n]||(state.items[n]={incorrect:0,hints:0,completed:false});actual.incorrect=Math.max(actual.incorrect,q.incorrect||0);actual.hints=Math.max(actual.hints,q.hints||0);actual.completed ||=!!q.completed;}
 state.current=current;state.uncertain ||=!!legacy.uncertain;
 return state;
}
export function resumePosition(record){const c=recordProgress(record.messages,record.counters);return {counters:c,next:Math.min(10,c.current+(c.items[c.current]?.completed?1:0)),complete:c.current===10&&!!c.items[10]?.completed,advance:!!c.items[c.current]?.completed&&c.current<10};}
