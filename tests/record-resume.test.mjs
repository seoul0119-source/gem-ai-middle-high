import test from 'node:test';import assert from 'node:assert/strict';import {recordProgress,resumePosition} from '../lib/record-progress.js';
test('restore completed question two resumes question three with exact prior transcript',()=>{
 const messages=[{role:'assistant',content:'문제 2/10 빛의 반사'}];for(const event of ['incorrect','hint','incorrect','hint','incorrect']){messages.push({role:'user',content:event==='hint'?'힌트':'1'},{role:'assistant',content:'기존 응답',progress:{event,question:2,currentQuestion:2,completed:event==='incorrect'&&messages.length>7}});}
 const snapshot=JSON.stringify(messages),counters=recordProgress(messages);assert.equal(counters.items[2].incorrect,3);assert.equal(counters.items[2].hints,2);const position=resumePosition({messages,counters});assert.equal(position.next,3);assert.equal(position.advance,true);assert.equal(JSON.stringify(messages),snapshot);
});
