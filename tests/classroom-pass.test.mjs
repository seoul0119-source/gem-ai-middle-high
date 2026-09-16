import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueClassroomPass,verifyClassroomPass,CLASSROOMS} from '../lib/classroom-pass.js';
process.env.OPENAI_API_KEY='classroom-test-only';
test('classroom pass is bound to student, audience and absolute login expiry',()=>{
 const student={id:'T260123',exp:Math.floor(Date.now()/1000)+60};
 const token=issueClassroomPass(student,'en');
 const p=verifyClassroomPass(token,CLASSROOMS.en);
 assert.equal(p.id,student.id);assert.equal(p.authExp,student.exp);assert.equal(p.exp,student.exp);
 assert.equal(verifyClassroomPass(token,CLASSROOMS.fr),null);
 assert.equal(verifyClassroomPass(token+'bad',CLASSROOMS.en),null);
 assert.equal(verifyClassroomPass(issueClassroomPass({...student,exp:1},'en'),CLASSROOMS.en),null);
 assert.throws(()=>issueClassroomPass(student,'unknown'));
});

test('record sessions retain original student, classroom and expiry; entry passes cannot act as sessions',async()=>{
 const {exchangeRecordPass,verifyRecordSession}=await import('../lib/classroom-pass.js');
 const student={id:'T260123',exp:Math.floor(Date.now()/1000)+3600},key='gem-english-elementary-science';
 const entry=issueClassroomPass(student,key),token=exchangeRecordPass(entry,CLASSROOMS[key]);
 assert.deepEqual(verifyRecordSession(token),{purpose:'record-session',registrationType:'trial',registrationLabel:'체험 학생',isTrial:true,id:student.id,aud:CLASSROOMS[key],exp:student.exp});
 assert.equal(verifyRecordSession(entry),null);assert.equal(verifyRecordSession(token+'bad'),null);
 assert.equal(exchangeRecordPass(entry,CLASSROOMS.fr),null);
 assert.equal(exchangeRecordPass(issueClassroomPass({...student,exp:1},key),CLASSROOMS[key]),null);
 assert.throws(()=>issueClassroomPass({...student,id:'R260001'},key));
 assert.equal(CLASSROOMS['gem-english-bible-classroom'],undefined);
});
