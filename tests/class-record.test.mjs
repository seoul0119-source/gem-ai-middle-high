import test from 'node:test';
import assert from 'node:assert/strict';
import {issueRecordPermit,recordFromRequest,signRecord,verifyRecordTransfer} from '../lib/class-record.js';
process.env.OPENAI_API_KEY='test-record-key';
const student={id:'TEST_A',courseId:'m2-math',courseRunId:'test-run',startedAt:'2026-09-16T00:00:00Z'};
const questions=['분수 7/12를 소수로 나타낼 때, 순환마디를 쓰고 순환소수로 나타내세요.','5/6을 순환소수로 나타내고, 순환마디를 쓰세요.'];
test('preserves exact Korean prompts and answers, scoped to authenticated owner',()=>{
 const permit=issueRecordPermit(student),body={permit,record:{revision:3,status:'stopped',messages:[{role:'assistant',content:questions[0]},{role:'user',content:'0.58333… 순환마디 3'},{role:'assistant',content:questions[1]},{role:'user',content:'0.8333… 순환마디 3'}],counters:{current:2,items:{1:{incorrect:2,hints:2}},uncertain:false}}};
 const record=recordFromRequest(student,body);assert.deepEqual(record.messages,body.record.messages);assert.equal(record.counters.items[1].hints,2);assert.equal(record.course,'m2-math');
 assert.throws(()=>recordFromRequest({...student,id:'TEST_B'},body));
 const ticket=signRecord(record);assert.equal(verifyRecordTransfer(ticket,record),true);assert.equal(verifyRecordTransfer(ticket,{...record,student:'TEST_B'}),false);assert.equal(verifyRecordTransfer(ticket,{...record,revision:999}),false);
});
