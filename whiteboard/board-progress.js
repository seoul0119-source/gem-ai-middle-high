// The portable ledger records real attempts, never a caller-supplied score.
export const emptyBoardProgress = () => ({items:Array.from({length:10},()=>({attempts:[],hints:0,result:'open'})),events:[]});

export function normalizeBoardProgress(value,questions){
 if(!value||!Array.isArray(questions)||questions.length!==10||!Array.isArray(value.items)||value.items.length!==10||!Array.isArray(value.events)||value.events.length>1000)return null;
 if(value.events.some(id=>typeof id!=='string'||!id||id.length>160))return null;
 const items=[];
 for(let i=0;i<10;i++){
  const item=value.items[i],q=questions[i];
  if(!item||!Array.isArray(item.attempts)||item.attempts.length>3||!Number.isInteger(item.hints)||item.hints<0||item.hints>2||!['open','correct','revealed'].includes(item.result))return null;
  if(item.attempts.some(n=>!Number.isInteger(n)||n<0||n>=q.choices.length))return null;
  const correctAt=item.attempts.indexOf(q.answerIndex);
  if(correctAt>=0&&correctAt!==item.attempts.length-1)return null;
  const result=correctAt>=0?'correct':item.attempts.length===3||item.result==='revealed'?'revealed':'open';
  if(item.result!==result)return null;
  items.push({attempts:[...item.attempts],hints:item.hints,result});
 }
 return {items,events:[...new Set(value.events)]};
}

export function mergeBoardProgress(saved,incoming,questions){
 const base=normalizeBoardProgress(saved,questions),next=normalizeBoardProgress(incoming,questions);
 if(!base||!next)return null;
 for(let i=0;i<10;i++){
  const a=base.items[i],b=next.items[i];
  const compatible=a.attempts.every((n,j)=>b.attempts[j]===n);
  // Preserve terminal answers and any newer or conflicting canonical work.
  if(a.result==='open'&&compatible){a.attempts=b.attempts;a.result=b.result;}
  a.hints=Math.max(a.hints,b.hints);
 }
 base.events=[...new Set([...base.events,...next.events])].slice(-1000);
 return base;
}
