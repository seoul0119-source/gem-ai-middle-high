import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createScienceLessonEngine} from '../lib/suneung-science-bank.js';
import {recordProgress,recordScore} from '../lib/record-progress.js';
import {issueRecordPermit,recordFromRequest} from '../lib/class-record.js';
const courseId='suneung-2027-biology-1';
function lesson(){
 const engine=createScienceLessonEngine('science-v2:00000000-0000-4000-8000-000000000001',courseId),messages=[],records=[];
 const turn=input=>{messages.push({role:'user',content:input});const r=engine.handleClosedSuneungScienceLesson({courseId,messages,learningProfile:{lessonRecords:records}});messages.push({role:'assistant',content:r.text,...(r.record?{assessment:r.record}:{})});if(r.record)records.push(r.record);};
 turn('시작');turn('힌트');
 for(let n=0;n<10;n++){const q=engine.questions[n],wrong=q.answer==='A'?'B':'A';if(n===0)turn(wrong);if(n===1){turn(wrong);turn(wrong);turn(wrong);}else turn(q.answer);}
 assert.equal(records.length,10);return messages;
}
test('real 2027 science grading survives authenticated save and old transcript recovery',()=>{
 process.env.OPENAI_API_KEY='score-test-only';const messages=lesson(),student={id:'T260082',courseId,courseRunId:'science-test',startedAt:new Date().toISOString()};
 const record=recordFromRequest(student,{permit:issueRecordPermit(student),record:{revision:1,status:'stopped',messages,counters:{}}});
 assert.equal(record.messages.filter(m=>m.assessment).length,10);
 for(const turns of [record.messages,messages.map(({assessment,...m})=>m)]){
 const counters=recordProgress(turns);assert.deepEqual(recordScore(counters),{correct:9,completed:10,skipped:0,incorrect:4,hints:1});
 assert.equal(counters.items[1].answers.length,2);assert.equal(counters.items[2].result,'revealed');assert.equal(counters.uncertain,false);
 assert.deepEqual(recordProgress(turns,counters),counters,'repeated reads do not double-count');
 }
});
test('skip and an explanation mentioning correct answers never count as correct',()=>{
 const messages=[{role:'assistant',content:'문제 1/10'}, {role:'user',content:'다음 문제'},{role:'assistant',content:'현재 문제는 건너뛰기로 기록했습니다.\n문제 2/10',assessment:{question:1,outcome:'skipped',attempts:0}}, {role:'user',content:'설명해 주세요'},{role:'assistant',content:'문제 2/10 · 풀이 도움 · 도전 1/3\n정답입니다라는 표현은 채점 후 나옵니다.'}];
 const c=recordProgress(messages);assert.equal(recordScore(c).correct,0);assert.equal(recordScore(c).skipped,1);assert.equal(c.items[2].completed,false);
});
test('browser snapshot and accepted response both retain assessment metadata',()=>{
 const html=readFileSync('learn.html','utf8');assert.match(html,/IS_SUNEUNG&&data\.record\?\{assessment:data\.record\}/);assert.match(html,/m\.assessment\?\{assessment:m\.assessment\}/);
});
