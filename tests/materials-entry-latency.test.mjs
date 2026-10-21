import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {serveStudentPage} from '../lib/student-page.js';
import {createSessionToken,SESSION_COOKIE} from '../lib/student-session.js';
import {verifyClassroomPass} from '../lib/classroom-pass.js';

const audience='https://gem-english-middle-school-math.seoul0119.chatgpt.site';
const source=readFileSync(new URL('../materials.html',import.meta.url),'utf8');
function response(){return {headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(body=''){this.body=body;}};}

test('materials page issues a short-lived pass only after one fresh authoritative approval',async()=>{
 const originalKey=process.env.OPENAI_API_KEY,originalFetch=globalThis.fetch;
 process.env.OPENAI_API_KEY='offline-materials-entry-test';
 const student={id:'L269991',session:'materials-entry-test',membership:{plan:'lifetime',startsAt:'2026-01-01T00:00:00Z',expiresAt:null,approvalStatus:'approved',accessPolicyVersion:1}};
 const token=createSessionToken(student);
 assert.ok(token);
 const req={method:'GET',headers:{cookie:`${SESSION_COOKIE}=${token}`},query:{page:'materials'}};
 let calls=0,approved=true;
 globalThis.fetch=async()=>{calls++;return Response.json(approved?{success:true,id:student.id,membership:student.membership}:{success:false,message:'Membership revoked'});};
 try{
  const res=response();await serveStudentPage(req,res);
  assert.equal(res.code,200);assert.equal(calls,1);
  assert.match(res.headers['Cache-Control'],/private, no-store/);
  assert.equal(res.headers.Vary,'Cookie');
  const data=JSON.parse(res.body.match(/<script type="application\/json" id="gem-entry-pass">([^<]+)<\/script>/)[1]);
  const pass=verifyClassroomPass(data.ticket,audience);
  assert.equal(pass.id,student.id);assert.equal(pass.accessSession,student.session);
  assert.equal(pass.authExp,JSON.parse(Buffer.from(token.split('.')[0],'base64url')).exp);
  assert.ok(pass.exp<=Math.floor(Date.now()/1000)+120);
  assert.ok(pass.jti);
  // A subsequent request rechecks revocation; the prior approval is never cached.
  approved=false;const revoked=response();await serveStudentPage(req,revoked);
  assert.equal(calls,2);assert.equal(revoked.code,403);assert.doesNotMatch(revoked.body,/gem-entry-pass/);
  const forged=response();await serveStudentPage({...req,headers:{cookie:`${SESSION_COOKIE}=forged.signature`}},forged);
  assert.equal(forged.code,303);assert.equal(calls,2);assert.equal(forged.body,'');
 }finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;}
});

test('handoff uses the server-checked pass once and retries with a freshly checked pass',async()=>{
 let entry={textContent:JSON.stringify({ticket:'server-checked-pass'}),remove(){entry=null;}},requests=0,submits=0;
 const inputs=[];
 const document={getElementById(id){return id==='gem-entry-pass'?entry:{disabled:false,textContent:''};},body:{append(){}},createElement(tag){return tag==='form'?{append(input){inputs.push(input);},submit(){submits++;if(submits===1)throw Error('Temporary navigation failure');}}:{};}};
 const context={document,location:{search:'?course=m2-math&language=ko&classroom=1'},URLSearchParams,GEMEntrance:{async requestSession(body){requests++;assert.equal(body.action,'classroom-pass');return {ticket:'fresh-checked-pass'};}}};
 const script=source.match(/<script>\s*(let entering=[\s\S]+?)<\/script>/)[1];
 await vm.runInNewContext(script,context);
 assert.equal(requests,0);assert.equal(inputs.find(x=>x.name==='ticket').value,'server-checked-pass');
 await vm.runInNewContext('enter()',context);
 assert.equal(requests,1);assert.equal(submits,2);
 assert.equal(inputs.filter(x=>x.name==='ticket').at(-1).value,'fresh-checked-pass');
});

test('browser accepts a response after the full 30.75-second membership retry budget',async()=>{
 let current=0,nextId=0,finish;
 const timers=new Map();
 const context={URLSearchParams,AbortController,setTimeout(fn,ms){const id=++nextId;timers.set(id,{fn,at:current+ms});return id;},clearTimeout(id){timers.delete(id);},fetch(_url,options){return new Promise((resolve,reject)=>{finish=()=>resolve({ok:true,json:async()=>({ticket:'valid'})});options.signal.addEventListener('abort',()=>reject(Error('aborted')));});}};
 vm.runInNewContext(readFileSync(new URL('../entrance-catalog.js',import.meta.url),'utf8'),context);
 const request=context.GEMEntrance.requestSession({action:'classroom-pass',classroom:'en'});
 current=30750;
 for(const [id,timer] of timers)if(timer.at<=current){timers.delete(id);timer.fn();}
 finish();assert.equal((await request).ticket,'valid');assert.equal(timers.size,0);
 // A hung request still ends at the bounded browser deadline.
 const hung=context.GEMEntrance.requestSession({action:'classroom-pass',classroom:'en'});
 const failure=assert.rejects(hung,/입장 확인 시간이 길어지고/);
 current+=45000;
 for(const [id,timer] of timers)if(timer.at<=current){timers.delete(id);timer.fn();}
 await failure;
});
