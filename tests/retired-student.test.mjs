import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.OPENAI_API_KEY ||= 'retired-student-test';
const {default:handler}=await import('../api/session.js');
const {createSessionToken,readStudentSession,SESSION_COOKIE}=await import('../lib/student-session.js');
test('retired ID is rejected before contacting the student sheet',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('must not contact sheet');};
 try {const r={status(n){this.code=n;return this;},setHeader(){return this;},end(s){this.body=JSON.parse(s);}};
 await handler({method:'POST',body:{action:'login',studentId:' r260001 '}},r);
 assert.equal(r.code,403);assert.match(r.body.error,/사용이 종료/);
 }finally{globalThis.fetch=old;}
});
test('previously issued signed cookies are revoked without deleting history',()=>{
 const now=Math.floor(Date.now()/1000);
 const payload=Buffer.from(JSON.stringify({id:'R260001',session:'old',iat:now,exp:now+300})).toString('base64url');
 const key=crypto.createHash('sha256').update(`gem-student-session-v1:${process.env.OPENAI_API_KEY}`).digest();
 const sig=crypto.createHmac('sha256',key).update(payload).digest('base64url');
 assert.equal(readStudentSession({headers:{cookie:`${SESSION_COOKIE}=${payload}.${sig}`}}),null);
 assert.equal(createSessionToken({id:'R260001',session:'old'}),null);
 assert.ok(createSessionToken({id:'T260123',session:'valid',membership:{plan:'trial',startsAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}}));
});
