import {randomUUID} from 'node:crypto';
import {signRecord} from './class-record.js';
import {handleMaterials,validMaterial,hasExcludedTopic} from './materials-ai.js';
import {createGedQuestions} from './ged-bank.js';
import {repeatedGedQuestions} from './ged-novelty.js';
const endpoint='https://gem-english-middle-school-math.seoul0119.chatgpt.site/api/class-records';
async function store(record){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:signRecord(record),record}),signal:AbortSignal.timeout(25000)});
 const d=await r.json();if(!r.ok){const e=Error(d.error||'문제 저장소에 연결하지 못했습니다. 같은 수업에서 다시 시도해 주세요.');e.code=d.code;throw e;}return d;
}
export function legacyGedPrompts(courseId){
 if(!['ged-high-korean','ged-high-math','ged-high-english'].includes(courseId))return [];
 return [...new Set(Array.from({length:12},(_,i)=>createGedQuestions(courseId,'legacy-exclude-'+i)).flat().map(q=>q.prompt))];
}
export function materialGedQuestions(material){return material.questions.map(q=>({topic:material.title,prompt:q.prompt,choices:q.choices,hint:q.hints.join(' '),explanation:q.explanation,answer:'ABCD'[q.answerIndex]}));}
export async function loadGeneratedGed(student,allowGenerate){
 const base={student:student.id,id:student.courseRunId,course:student.courseId};
 let data=await store({...base,operation:'ged-read'});
 if(data.material)return materialGedQuestions(data.material);
 if(!allowGenerate)throw Error('저장된 문제를 찾지 못했습니다. 문제를 바꾸지 않고 중단합니다. 담당 선생님에게 확인해 주세요.');
 const lease=randomUUID(),claim=await store({...base,operation:'ged-claim',lease});
 if(claim.material)return materialGedQuestions(claim.material);
 const history=[...legacyGedPrompts(student.courseId),...(claim.history||[])];
 const deadline=Date.now()+240000;
 try{
  for(let attempt=0;attempt<2;attempt++){
   const result=await handleMaterials({mode:'generate',courseId:student.courseId,topic:'단원별 기초 개념과 적용을 고르게 연습',noveltyHistory:history.slice(-90),variation:student.courseRunId+':'+attempt,deadline});
   if(!validMaterial(result.material)||hasExcludedTopic(result.material))throw Error('검토를 통과하지 못했습니다. 같은 수업에서 다시 시도해 주세요.');
   if(repeatedGedQuestions(result.material.questions,history).length){history.push(...result.material.questions.map(q=>q.prompt));continue;}
   try{data=await store({...base,operation:'ged-commit',lease,material:result.material});return materialGedQuestions(data.material);}catch(e){if(e.code!=='ged_duplicate')throw e;history.push(...result.material.questions.map(q=>q.prompt));}
  }
  throw Error('중복 없는 문제의 검토가 지연되고 있습니다. 이전 문제로 대체하지 않았습니다. 같은 수업에서 다시 시도해 주세요.');
 }finally{await store({...base,operation:'ged-release',lease}).catch(()=>{});}
}
