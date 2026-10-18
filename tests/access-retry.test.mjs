import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStudentAccess} from '../lib/student-session.js';
const student={id:'M269991',session:'access-retry-test',accessPolicyVersion:1};
const approved=()=>Response.json({success:true,id:student.id,membership:{approvalStatus:'approved'}});
test('transient transport and malformed responses recover within three attempts',async()=>{
 let calls=0;
 await assertStudentAccess(student,async()=>{calls++;if(calls===1)return new Response('unavailable',{status:503});if(calls===2)return new Response('<html>');return approved()});
 assert.equal(calls,3);
});
test('concurrent checks share only the in-flight request and next request rechecks revocation',async()=>{
 let calls=0,release;
 const gate=new Promise(resolve=>release=resolve);
 const transport=async()=>{calls++;await gate;return calls===1?approved():Response.json({success:false,message:'blocked'})};
 const first=assertStudentAccess(student,transport),second=assertStudentAccess(student,transport);
 release();await Promise.all([first,second]);assert.equal(calls,1);
 await assert.rejects(()=>assertStudentAccess(student,transport),{status:403});assert.equal(calls,2);
});
test('unavailable authority is bounded and never admits the student',async()=>{
 let calls=0;await assert.rejects(()=>assertStudentAccess(student,async()=>{calls++;throw Error('offline')}),{status:503});assert.equal(calls,3);
});
test('mismatched IDs and expired memberships deny without retry',async()=>{
 for(const data of [{success:true,id:'M269992',membership:{approvalStatus:'approved'}},{success:true,id:student.id,membership:{approvalStatus:'approved',expiresAt:'2020-01-01'}}]){
 let calls=0;await assert.rejects(()=>assertStudentAccess(student,async()=>{calls++;return Response.json(data)}),{status:403});assert.equal(calls,1);
 }
});
