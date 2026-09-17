import {recordProgress} from './record-progress.js';
import crypto from 'node:crypto';
const AUDIENCE='https://gem-english-middle-school-math.seoul0119.chatgpt.site';
function sign(value){if(!process.env.OPENAI_API_KEY)throw Error('Record signing unavailable');return crypto.createHmac('sha256','gem-class-record-v1:'+process.env.OPENAI_API_KEY).update(value).digest('base64url');}
function token(payload){const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return encoded+'.'+sign(encoded);}
function verify(value,purpose){try{const [encoded,sig,...extra]=String(value).split('.');if(extra.length||!encoded||!sig||value.length>3000)return null;const a=Buffer.from(sig),b=Buffer.from(sign(encoded));if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(encoded,'base64url'));return p.purpose===purpose&&p.exp>Date.now()/1000?p:null;}catch{return null;}}
export function issueRecordPermit(student){return token({purpose:'record-run',student:student.id,course:student.courseId,id:student.courseRunId,started:student.startedAt,lease:student.recordLease||"",exp:Math.floor(Date.now()/1000)+7*86400});}
export function recordFromRequest(student,body){
 const p=verify(body.permit,'record-run');
 if(!p||p.student!==student.id){const e=Error('학습 기록의 학생 정보가 일치하지 않거나 저장 기한이 지났습니다.');e.status=403;throw e;}
 const r=body.record;
 if(!r||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>10000||!['studying','stopped'].includes(r.status)||!Array.isArray(r.messages)||r.messages.length<2||r.messages.length>400)throw Error('올바르지 않은 수업 기록입니다.');
 const messages=r.messages.map(m=>{if(!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>16000)throw Error('올바르지 않은 대화입니다.');const a=m.assessment;const assessment=m.role==='assistant'&&a&&Number.isInteger(a.question)&&a.question>=1&&a.question<=10&&(['correct','incorrect'].includes(a.outcome)&&Number.isInteger(a.attempts)&&a.attempts>=1&&a.attempts<=3||a.outcome==='skipped'&&a.attempts===0)?{question:a.question,outcome:a.outcome,attempts:a.attempts}:null;return {role:m.role,content:m.content,...(assessment?{assessment}:{}),...(m.progress&&["incorrect","hint","correct","question","discussion"].includes(m.progress.event)?{progress:{event:m.progress.event,question:Math.max(1,Math.min(10,Number(m.progress.question)||1)),currentQuestion:Math.max(1,Math.min(10,Number(m.progress.currentQuestion)||1)),completed:!!m.progress.completed}}:{})};});
 const counters={current:Math.max(1,Math.min(10,Number(r.counters?.current)||1)),uncertain:!!r.counters?.uncertain,items:{}};
 for(let i=1;i<=10;i++){const q=r.counters?.items?.[i];if(q)counters.items[i]={incorrect:Math.max(0,Math.min(400,Number(q.incorrect)||0)),hints:Math.max(0,Math.min(400,Number(q.hints)||0)),completed:!!q.completed};}
 const record={id:p.id,student:p.student,course:p.course,started:p.started,revision:r.revision,status:r.status,lessonSeed:String(r.lessonSeed||'').slice(0,160),messages,counters:recordProgress(messages,counters),lease:p.lease||""};
 if(Buffer.byteLength(JSON.stringify(record))>240000)throw Error('수업 기록 용량을 초과했습니다.');
 return record;
}
const digest=data=>crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
export function signRecord(record){return token({purpose:'record-transfer',aud:AUDIENCE,digest:digest(record),exp:Math.floor(Date.now()/1000)+120});}
export function verifyRecordTransfer(ticket,record){const p=verify(ticket,'record-transfer');return !!p&&p.aud===AUDIENCE&&p.digest===digest(record);}
export async function saveClassRecord(student,body){const record=recordFromRequest(student,body);const response=await fetch(AUDIENCE+'/api/class-records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:signRecord(record),record}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('자료실 저장을 재시도하고 있습니다. 이 기기의 임시 기록은 유지됩니다.');return response.json();}

export async function resumeClassRecord(student,id){
 const payload={operation:'resume',student:student.id,id:String(id||'').slice(0,100)};
 const response=await fetch(AUDIENCE+'/api/class-records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:signRecord(payload),record:payload}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok||!data.record)throw Error(data.error||'이 학생의 수업 기록을 이어오지 못했습니다.');return data.record;
}
