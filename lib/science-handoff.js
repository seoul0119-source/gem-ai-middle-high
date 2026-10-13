import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {issueClassroomPass,verifyClassroomPass,CLASSROOMS} from './classroom-pass.js';
import {scienceLessonIssues} from './science-board-content.js';
import {validMaterial,hasExcludedTopic} from './materials-ai.js';
import {getBoardCourse} from '../whiteboard/board-courses.js';
import {normalizeBoardProgress} from '../whiteboard/board-progress.js';

export const SCIENCE_HANDOFF_AUDIENCE=CLASSROOMS.en;
export const SCIENCE_HANDOFF_ENTRY=SCIENCE_HANDOFF_AUDIENCE+'/api/learning/science-entry';
export const SCIENCE_HANDOFF_MAX_TOKEN=384*1024;
export const SCIENCE_HANDOFF_MAX_REQUEST=400*1024;
const TTL=120,verificationLimits=new Map();
const key=()=>{if(!process.env.OPENAI_API_KEY)throw Error('handoff_unavailable');return createHash('sha256').update('gem-science-handoff-v1:'+process.env.OPENAI_API_KEY).digest();};
const mac=value=>createHmac('sha256',key()).update(value).digest('base64url');
const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);

function stableWorksheetId(studentId,lessonId,material){
 const bytes=createHmac('sha256',key()).update(canonical({studentId,lessonId,material})).digest().subarray(0,16);
 // UUIDv8 permits a domain-specific deterministic digest; array order remains
 // part of that digest so a differently ordered quiz is a different worksheet.
 bytes[6]=(bytes[6]&0x0f)|0x80;bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=bytes.toString('hex');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function validHandoff(value){
 return value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
  &&getBoardCourse(value.courseId)&&value.courseId===value.lesson?.courseId&&value.topicId===value.lesson?.topicId
  &&(!getBoardCourse(value.courseId).worksheetOnly||value.source!==undefined)
  &&value.lesson?.complete===true&&!scienceLessonIssues(value.lesson,{allowIntro:false}).length
  &&validMaterial(value.material)&&!hasExcludedTopic(value.material)
  &&(value.source===undefined||value.source&&value.source.id===value.id&&Number.isSafeInteger(value.source.revision)&&value.source.revision>=1)
  &&(value.progress===undefined||normalizeBoardProgress(value.progress,value.material.questions))
  &&(value.cursor===undefined||Number.isInteger(value.cursor)&&value.cursor>=0&&value.cursor<10);
}

export function issueScienceHandoff(student,lesson,material,{now=Date.now,expiry=Infinity,source,progress,cursor}={}){
 const at=Math.floor(now()/1000);
 if(!student?.id||!Number.isSafeInteger(student.exp)||student.exp<=at)throw Error('handoff_unavailable');
 const handoff={id:source?.id||stableWorksheetId(student.id,lesson?.id,material),courseId:lesson?.courseId,topicId:lesson?.topicId,lesson,material,...(source?{source}:{}),...(progress?{progress}:{}),...(cursor!==undefined?{cursor}:{})};
 if(!validHandoff(handoff))throw Error('handoff_unavailable');
 const ticket=issueClassroomPass(student,'en'),pass=verifyClassroomPass(ticket,SCIENCE_HANDOFF_AUDIENCE);
 if(!pass||pass.id!==student.id)throw Error('handoff_unavailable');
 const exp=Math.min(at+TTL,student.exp,pass.exp,expiry);
 if(!Number.isSafeInteger(exp)||exp<=at)throw Error('handoff_unavailable');
 const payload={v:1,purpose:'science-worksheet-handoff',aud:SCIENCE_HANDOFF_AUDIENCE,studentId:student.id,ticketHash:digest(ticket),jti:pass.jti,iat:at,exp,handoff};
 const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url'),handoffToken=encoded+'.'+mac(encoded);
 if(handoffToken.length>SCIENCE_HANDOFF_MAX_TOKEN)throw Error('handoff_unavailable');
 return {ticket,handoffToken,entryUrl:SCIENCE_HANDOFF_ENTRY,worksheetId:handoff.id,courseId:handoff.courseId};
}

// The target calls this server verifier. No source browser cookie is required:
// both short-lived signed capabilities must match the same student and entry.
export function verifyScienceHandoff(ticket,handoffToken,audience,{now=Date.now}={}){
 try{
  if(audience!==SCIENCE_HANDOFF_AUDIENCE||typeof ticket!=='string'||ticket.length>2048||typeof handoffToken!=='string'||handoffToken.length>SCIENCE_HANDOFF_MAX_TOKEN)return null;
  const pass=verifyClassroomPass(ticket,audience);if(!pass)return null;
  const parts=handoffToken.split('.');
  if(parts.length!==2||!parts[0]||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]{43}$/.test(parts[1]))return null;
  const expected=Buffer.from(mac(parts[0])),actual=Buffer.from(parts[1]);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
  const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')),at=Math.floor(now()/1000);
  if(!payload||payload.v!==1||payload.purpose!=='science-worksheet-handoff'||payload.aud!==audience||payload.studentId!==pass.id||payload.jti!==pass.jti||payload.ticketHash!==digest(ticket)||!Number.isSafeInteger(payload.iat)||payload.iat>at||!Number.isSafeInteger(payload.exp)||payload.exp<=at||payload.exp<=payload.iat||payload.exp>payload.iat+TTL||payload.exp>pass.exp||payload.exp>pass.authExp||!validHandoff(payload.handoff))return null;
  if(!payload.handoff.source&&payload.handoff.id!==stableWorksheetId(pass.id,payload.handoff.lesson.id,payload.handoff.material))return null;
  return {pass,handoff:payload.handoff};
 }catch{return null;}
}

// Invalid tickets do not carry a trustworthy student ID. Limit verifier work
// per upstream client and bound the map even when invalid requests vary keys.
export function allowScienceHandoffVerification(request,now=Date.now){
 const at=now(),address=String(request.headers?.['x-real-ip']||request.headers?.['x-forwarded-for']||request.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,128);
 const id=digest(address)+':'+Math.floor(at/60000);
 for(const [k,v]of verificationLimits)if(v.until<=at)verificationLimits.delete(k);
 if(!verificationLimits.has(id)&&verificationLimits.size>=2048)verificationLimits.delete(verificationLimits.keys().next().value);
 const current=verificationLimits.get(id)||{count:0,until:at+60000};current.count++;verificationLimits.set(id,current);return current.count<=180;
}
