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
