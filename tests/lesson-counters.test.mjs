import {test} from 'node:test';import assert from 'node:assert/strict';import '../lesson-counters.js';
import {extractTurnProgress} from '../lib/lesson-turn-progress.js';
const context=[{role:'assistant',content:'문제 1/10 공급 변화'},{role:'user',content:'가격 상승, 거래량 증가'}];
test('wrong answer, two requested hints, discussion and advancement preserve separate current and total counters',()=>{
 const C=globalThis.GemLessonCounters,s=C.create();
 for(const event of ['incorrect','hint','hint','discussion'])C.apply(s,{event,question:1,currentQuestion:1});
 assert.equal(C.values(s).incorrect,1);assert.equal(C.values(s).hints,2);
 const result=extractTurnProgress('정답입니다.\n문제 2/10 인권\n[GEM_TURN]{"event":"correct","question":1}[/GEM_TURN]',context);
 assert.doesNotMatch(result.text,/GEM_TURN/);C.apply(s,result.progress);
 assert.deepEqual(C.values(s),{incorrect:0,hints:0,current:2,totalIncorrect:1,totalHints:2,uncertain:false});
});
test('invalid or absent metadata never invents a wrong-answer count or leaks into speech',()=>{
 for(const raw of ['설명을 확인해 보세요.','설명 [GEM_TURN]{broken','설명 [GEM_TURN]{"event":"incorrect","question":8}[/GEM_TURN]']){const result=extractTurnProgress(raw,context);assert.equal(result.progress,null);assert.doesNotMatch(result.text,/GEM_TURN/);}
});
test('structured teacher response supplies counters without exposing metadata',()=>{
 const result=extractTurnProgress(JSON.stringify({text:'일부 내용이 반대입니다. 다시 생각해 보세요.',progress:{event:'incorrect',question:1}}),context);
 assert.equal(result.progress.event,'incorrect');assert.equal(result.progress.currentQuestion,1);assert.equal(result.text,'일부 내용이 반대입니다. 다시 생각해 보세요.');
});

test('three wrong answers and repeated hints are counted per turn even with next-question metadata',()=>{
 const s=GemLessonCounters.create();let messages=[{role:'assistant',content:'문제 2/10 빛의 반사'}];
 for(const input of ['1','힌트','3','힌트','4']){const hint=input==='힌트';const last=input==='4';const text=hint?'힌트: 빛의 이동을 보세요.':last?'틀렸습니다. 정답은 2입니다. 문제 3/10 다음 문제':'다시 생각해 보세요.';messages.push({role:'user',content:input});const d=extractTurnProgress(JSON.stringify({text,progress:{event:hint?'discussion':'incorrect',question:last?3:2}}),messages);GemLessonCounters.apply(s,d.progress);messages.push({role:'assistant',content:d.text});}
 assert.equal(s.items[2].incorrect,3);assert.equal(s.items[2].hints,2);assert.equal(s.items[2].completed,true);assert.equal(s.current,3);
});
