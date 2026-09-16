import {RECORD_CLASSROOMS} from './classroom-catalog.js';
import {isBlockedStudentId} from './student-session.js';
import crypto from 'node:crypto';
export const CLASSROOMS = {
 ...RECORD_CLASSROOMS,
 en: 'https://gem-english-middle-school-math.seoul0119.chatgpt.site',
 fr: 'https://gem-french-middle-school-math.seoul0119.chatgpt.site'
};
function signature(value) {
 if (!process.env.OPENAI_API_KEY) throw new Error('Session signing unavailable');
 return crypto.createHmac('sha256', `gem-classroom-pass-v1:${process.env.OPENAI_API_KEY}`).update(value).digest('base64url');
}
export function issueClassroomPass(student, classroom) {
 if (isBlockedStudentId(student?.id)) throw new Error('Student access revoked');
 if (!CLASSROOMS[classroom]) throw new Error('Unknown classroom');
 const now = Math.floor(Date.now()/1000);
 const payload = {purpose:'classroom-entry', id:student.id, aud:CLASSROOMS[classroom], jti:crypto.randomUUID(), authExp:student.exp, exp:Math.min(now+120,student.exp)};
 const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
 return `${encoded}.${signature(encoded)}`;
}
export function verifyClassroomPass(token, audience) {
 try {
 const parts = String(token).split('.');
 if(parts.length!==2 || token.length>2048) return null;
 const expected=Buffer.from(signature(parts[0])), actual=Buffer.from(parts[1]);
 if(expected.length!==actual.length || !crypto.timingSafeEqual(expected,actual))return null;
 const p=JSON.parse(Buffer.from(parts[0],'base64url'));
 if(p.purpose!=='classroom-entry'||p.aud!==audience||!Object.values(CLASSROOMS).includes(audience)||p.exp<=Date.now()/1000||!p.jti||!p.id)return null;
 if(isBlockedStudentId(p.id))return null;
 return p;
 }catch{return null;}
}

export function exchangeRecordPass(ticket,audience){
 const p=verifyClassroomPass(ticket,audience);if(!p)return null;
 const encoded=Buffer.from(JSON.stringify({purpose:'record-session',id:p.id,aud:p.aud,exp:p.authExp})).toString('base64url');
 return encoded+'.'+signature(encoded);
}
export function verifyRecordSession(token){
 try{const [body,sig,...rest]=String(token).split('.');if(rest.length||!body||!sig||token.length>2048)return null;
 const a=Buffer.from(sig),b=Buffer.from(signature(body));if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 const p=JSON.parse(Buffer.from(body,'base64url'));if(p.purpose!=='record-session'||typeof p.id!=='string'||!p.id||!Number.isFinite(p.exp)||p.exp<=Date.now()/1000||isBlockedStudentId(p.id)||!Object.values(RECORD_CLASSROOMS).includes(p.aud))return null;return p;
 }catch{return null;}
}
