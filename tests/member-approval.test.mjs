import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createSessionToken,assertStudentAccess,requireStudentSession,SESSION_COOKIE} from '../lib/student-session.js';
import {validatedMembership} from '../lib/membership.js';

function setup(){
 const rows=[['등록일','ID','이름','학년','구분','상태','','','']],props=new Map(),cache=new Map(),messages=[];
 const sheet={getLastColumn:()=>rows[0].length,getLastRow:()=>rows.length,getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),appendRow:r=>rows.push([...r]),getRange(r,c,n=1,w=1){return {getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(rows[r-1+i]?.[c-1+j]||''))),getValue:()=>rows[r-1]?.[c-1]||'',setValue:v=>{rows[r-1] ||= [];rows[r-1][c-1]=v;}};}};
 let active='owner@example.com';
 const context=vm.createContext({Date,console,Number,Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},Utilities:{getUuid:randomUUID,formatDate:()=> '26'},CacheService:{getScriptCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>messages.push(m)},ScriptApp:{getService:()=>({getUrl:()=> 'https://script.google.com/macros/s/test/exec'})},HtmlService:{createHtmlOutput:s=>s},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})}});
 vm.runInContext(readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8'),context);
 const issue=(patch={})=>context.gemIssue_({name:'승인 테스트',grade:'Grade 3',plan:'month1',amount:100000,pledgeConfirmed:'true',requestKey:randomUUID(),...patch});
 const action=(id,command,patch={})=>context.gemAdminAction_({id,command,csrf:context.gemCsrf_(),...patch});
 return {context,rows,sheet,messages,issue,action,setActive:v=>active=v};
}
test('new paid IDs wait for approval; approval starts period once and duplicate action cannot extend it',()=>{
 const f=setup(),issued=f.issue();assert.equal(issued.membership.approvalStatus,'pending');
 assert.throws(()=>f.context.gemRequireActive_(f.context.gemFindStudent_(issued.studentId)),/후원 확인/);
 const cols=f.context.gemColumns_(f.sheet,false);f.rows[1][cols[1]]='2020-01-01T00:00:00.000Z';f.rows[1][cols[2]]='2020-02-01T00:00:00.000Z';
 f.action(issued.studentId,'approve');const approved=f.context.gemFindStudent_(issued.studentId).membership;
 assert.equal(approved.approvalStatus,'approved');assert.ok(Date.parse(approved.startsAt)>Date.now()-5000);assert.ok(Date.parse(approved.expiresAt)>Date.now()+27*86400000);
 f.action(issued.studentId,'approve');assert.equal(f.context.gemFindStudent_(issued.studentId).membership.startsAt,approved.startsAt);
 f.action(issued.studentId,'block',{confirmed:'yes'});assert.throws(()=>f.context.gemRequireActive_(f.context.gemFindStudent_(issued.studentId)),/중지/);
 f.action(issued.studentId,'restore');assert.equal(f.context.gemFindStudent_(issued.studentId).membership.expiresAt,approved.expiresAt);
});
test('approval email is sent once; unknown sends are not resent by registration retry',()=>{
 const f=setup(),id=f.issue().studentId;
 f.context.gemApprovalMail_(id);f.context.gemApprovalMail_(id);assert.equal(f.messages.length,1);assert.equal(f.messages[0].to,'gemissions@gmail.com');assert.match(f.messages[0].body,/action=member-admin/);
 const second=f.issue().studentId;f.context.MailApp.sendEmail=()=>{throw Error('unknown result')};f.context.gemApprovalMail_(second);f.context.MailApp.sendEmail=m=>f.messages.push(m);f.context.gemApprovalMail_(second);assert.equal(f.messages.length,1);
});
test('public free issuance and forged admin posts fail; owner can issue free ID and classify existing ID without resetting its period',()=>{
 const f=setup();assert.throws(()=>f.issue({plan:'free1',amount:0}));
 const id=f.issue().studentId;const token=f.context.gemCsrf_();f.setActive('visitor@example.com');
 assert.throws(()=>f.context.gemAdminAction_({id,command:'approve',csrf:token}),/소유자/);
 f.setActive('owner@example.com');assert.throws(()=>f.context.gemAdminAction_({id,command:'approve',csrf:'forged'}),/만료/);
 f.action(id,'approve');const before=f.context.gemFindStudent_(id).membership;f.action(id,'speaking-block');const after=f.context.gemFindStudent_(id).membership;
 assert.equal(after.startsAt,before.startsAt);assert.equal(after.expiresAt,before.expiresAt);assert.equal(after.speakingAllowed,false);
 f.action('','free',{name:'무료 학생',grade:'Grade 1',requestKey:randomUUID()});const free=f.rows.find(r=>String(r[1]).startsWith('F'));assert.ok(free);const m=f.context.gemFindStudent_(free[1]).membership;
 assert.equal(m.approvalStatus,'approved');assert.equal(m.plan,'free1');assert.equal(m.speakingAllowed,false);assert.throws(()=>f.action(free[1],'speaking-allow'),/변경할 수 없습니다/);
});
test('existing members remain approved; unsafe or pending metadata cannot issue a session',()=>{
 const f=setup();f.rows.push([new Date(),'R260002','기존 회원','Grade 2','정규','등록']);assert.equal(f.context.gemFindStudent_('R260002').membership.approvalStatus,'approved');
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='approval-test-only';try{
 const issued=f.issue();assert.equal(createSessionToken({id:issued.studentId,session:randomUUID(),membership:issued.membership}),null);
 const m=validatedMembership(issued.studentId,{...issued.membership,approvalStatus:'client-invented'});assert.equal(m.approvalStatus,'blocked');
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
test('signed policy sessions recheck status and fail closed on a revoked member or unavailable authority',async()=>{
 const membership={accessPolicyVersion:1,approvalStatus:'approved',plan:'month1',startsAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()},s={id:'M260003',session:randomUUID(),membership};let calls=0;
 await assertStudentAccess(s,async u=>{calls++;assert.equal(new URL(u).searchParams.get('session'),s.session);return Response.json({success:true,id:s.id,membership});});assert.equal(calls,1);
 await assert.rejects(()=>assertStudentAccess(s,async()=>Response.json({success:false,message:'이용이 중지된 회원 ID입니다.'})),/중지/);
 await assert.rejects(()=>assertStudentAccess(s,async()=>{throw Error('offline')}),/확인하지 못했습니다/);
 const old=process.env.OPENAI_API_KEY,original=globalThis.fetch;process.env.OPENAI_API_KEY='approval-test';
 try{const token=createSessionToken(s);globalThis.fetch=async()=>Response.json({success:false,message:'중지'});const r={status(n){this.code=n;return this},setHeader(){return this},end(v){this.body=v}};assert.equal(await requireStudentSession({headers:{cookie:`${SESSION_COOKIE}=${token}`}},r),null);assert.equal(r.code,403);}
 finally{globalThis.fetch=original;if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
