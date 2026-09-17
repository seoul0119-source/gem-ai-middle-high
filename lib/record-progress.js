// Rebuild summaries from saved grading events, with conservative recovery for older transcripts.
export function recordProgress(messages,legacy={}){
 const state={current:1,items:{},uncertain:false};let current=1;
 const number=t=>{const m=[...String(t).matchAll(/(?:문제|활동|question|activity|exercice)\s*(10|[1-9])\s*\/\s*10\b/gi)];return m.length?Number(m.at(-1)[1]):null;};
 const empty=()=>({incorrect:0,hints:0,completed:false,result:'open',answers:[]});
 for(let i=0;i<messages.length;i++){
  const m=messages[i];if(m.role!=='assistant')continue;
  const input=messages[i-1]?.role==='user'?String(messages[i-1].content||''):'',body=String(m.content||''),next=number(body),p=m.progress;
  const a=m.assessment,assessment=a&&Number.isInteger(a.question)&&a.question>=1&&a.question<=10&&(['correct','incorrect'].includes(a.outcome)&&Number.isInteger(a.attempts)&&a.attempts>=1&&a.attempts<=3||a.outcome==='skipped'&&a.attempts===0)?a:null;
  const exhausted=/^(?:세\s*번의\s*도전을\s*마쳤습니다|3회\s*도전을\s*마쳤)/.test(body.trim());
  let event=assessment?.outcome||p?.event;
  if(!event){
   if(/힌트|\bhint\b|\bindice\b/i.test(input))event='hint';
   else if(/^현재 문제는 건너뛰기로 기록했습니다/.test(body.trim()))event='skipped';
   else if(exhausted||/^(?:아직\s*)?정답이\s*아닙니다|아쉽|틀렸|정답이 아니|일부.{0,15}맞|부분.{0,15}맞|다시\s*(?:생각|풀어)|incorrect|try again|pas correct/i.test(body))event='incorrect';
   else if(/^\s*(?:정답(?:입니다|이에요)|맞(?:았어요|습니다)|correct[!.]|bonne réponse)/i.test(body))event='correct';
   else if(!i||/^시작$|^start$|^다음|^next/i.test(input))event='question';
   else if(/문제\s*\d+\/10\s*·\s*(?:풀이 도움|개념|답안 재입력)/.test(body))event='discussion';
   else state.uncertain=true;
  }
  const qn=assessment?.question||p?.question||(event==='question'&&next?next:current),q=state.items[qn]||(state.items[qn]=empty());
  if(event==='incorrect')q.incorrect++;
  if(event==='hint')q.hints++;
  if(['correct','incorrect'].includes(event)&&input)q.answers.push(input);
  if(assessment)q.incorrect=Math.max(q.incorrect,assessment.attempts-(assessment.outcome==='correct'?1:0));
  if(exhausted)q.incorrect=Math.max(q.incorrect,3);
  if(event==='correct'){q.completed=true;q.result='correct';}
  if(event==='skipped'){q.completed=true;q.result='skipped';}
  if(assessment||p?.completed||q.incorrect>=3||(event==='incorrect'&&/정답은|정답\s*:|answer is|réponse est/i.test(body)&&! /정답은 아직 공개하지 않습니다/.test(body))||(next&&next>qn))q.completed=true;
  if(q.completed&&q.result==='open')q.result='revealed';
  current=p?.currentQuestion||next||assessment?.question||current;
 }
 for(const [n,q]of Object.entries(legacy.items||{})){const actual=state.items[n]||(state.items[n]=empty());actual.incorrect=Math.max(actual.incorrect,q.incorrect||0);actual.hints=Math.max(actual.hints,q.hints||0);actual.completed ||=!!q.completed;}
 state.current=current;
 return state;
}
export function resumePosition(record){const c=recordProgress(record.messages,record.counters);return {counters:c,next:Math.min(10,c.current+(c.items[c.current]?.completed?1:0)),complete:c.current===10&&!!c.items[10]?.completed,advance:!!c.items[c.current]?.completed&&c.current<10};}
export function recordScore(counters){const qs=Object.values(counters.items||{});return {correct:qs.filter(q=>q.result==='correct').length,completed:qs.filter(q=>q.completed).length,skipped:qs.filter(q=>q.result==='skipped').length,incorrect:qs.reduce((s,q)=>s+q.incorrect,0),hints:qs.reduce((s,q)=>s+q.hints,0)};}
