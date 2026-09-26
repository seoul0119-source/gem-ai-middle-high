import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validatedMembership} from '../lib/membership.js';
import {createSessionToken,readStudentSession,SESSION_COOKIE} from '../lib/student-session.js';
import {issueClassroomPass,verifyClassroomPass} from '../lib/classroom-pass.js';
const context=vm.createContext({Date,console,Number});
vm.runInContext(readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8'),context);
test('Korean calendar expiry includes anniversary and clamps month end',()=>{
 const cases=[['month1','2026-09-26T03:00:00Z','2026-10-26T15:00:00.000Z'],['month2','2026-09-26T03:00:00Z','2026-11-26T15:00:00.000Z'],['month3','2026-09-26T03:00:00Z','2026-12-26T15:00:00.000Z'],['month1','2027-01-31T03:00:00Z','2027-02-28T15:00:00.000Z'],['month1','2028-01-31T03:00:00Z','2028-02-29T15:00:00.000Z'],['month1','2026-09-26T16:00:00Z','2026-10-27T15:00:00.000Z'],['trial','2026-09-26T03:00:00Z','2026-09-27T03:00:00.000Z']];
 for(const [plan,start,end] of cases) assert.equal(context.gemExpiry_(plan,new Date(start)).toISOString(),end);
 assert.equal(context.gemExpiry_('lifetime',new Date()),null);
});
test('public issuance forbids representative and mismatched pledge amounts',()=>{
 const data={name:'회원',grade:'Grade 1',plan:'month1',amount:100000,pledgeConfirmed:'true',requestKey:'11111111-1111-4111-8111-111111111111'};
 assert.equal(context.gemValidateRegistration_(data).plan,'month1');
 for(const patch of [{plan:'representative'},{plan:'legacy'},{amount:1},{pledgeConfirmed:'false'},{requestKey:''},{name:'=IMPORTXML("x")'}])assert.throws(()=>context.gemValidateRegistration_({...data,...patch}));
});
test('membership expiry clamps login, refreshed cookies and classroom tickets',()=>{
 const previous=process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY='test-membership-key';
 const original=Date.now;const now=Date.parse('2026-10-26T14:59:59Z'); Date.now=()=>now;
 try{
 const membership={plan:'month1',startsAt:'2026-09-26T03:00:00Z',expiresAt:'2026-10-26T15:00:00Z'};
 const student={id:'M260123',name:'회원',session:'session',membership};
 const token=createSessionToken(student);assert.ok(token);
 const payload=readStudentSession({headers:{cookie:`${SESSION_COOKIE}=${token}`}});
 assert.equal(payload.exp,now/1000+1);
 const ticket=issueClassroomPass(payload,'en');const pass=verifyClassroomPass(ticket,'https://gem-english-middle-school-math.seoul0119.chatgpt.site');assert.equal(pass.authExp,payload.exp);
 assert.equal(JSON.parse(Buffer.from(createSessionToken(payload).split('.')[0],'base64url')).exp,payload.exp);
 Date.now=()=>now+1000;
 assert.equal(readStudentSession({headers:{cookie:`${SESSION_COOKIE}=${token}`}}),null);
 assert.equal(createSessionToken(student),null);
 assert.equal(verifyClassroomPass(ticket,'https://gem-english-middle-school-math.seoul0119.chatgpt.site'),null);
 assert.equal(createSessionToken({...student,membership:undefined}),null);
 assert.equal(validatedMembership('M260123',{...membership,plan:'lifetime',expiresAt:null}),null);
 assert.ok(createSessionToken({...student,id:'L260124',membership:{plan:'lifetime',startsAt:membership.startsAt,expiresAt:null}}));
 }finally{Date.now=original;if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});

test('only doGet and doPost are callable from the public Apps Script client',()=>{
 const source=readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
 const publicFunctions=[...source.matchAll(/function (\w+)\(/g)].map(x=>x[1]).filter(name=>!name.endsWith('_'));
 assert.deepEqual(publicFunctions,['doGet','doPost']);
});
