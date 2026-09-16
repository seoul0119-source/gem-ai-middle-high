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
 for(const raw of ['다시 생각해 보세요.','설명 [GEM_TURN]{broken','설명 [GEM_TURN]{"event":"incorrect","question":8}[/GEM_TURN]']){const result=extractTurnProgress(raw,context);assert.equal(result.progress,null);assert.doesNotMatch(result.text,/GEM_TURN/);}
});
test('structured teacher response supplies counters without exposing metadata',()=>{
 const result=extractTurnProgress(JSON.stringify({text:'일부 내용이 반대입니다. 다시 생각해 보세요.',progress:{event:'incorrect',question:1}}),context);
 assert.equal(result.progress.event,'incorrect');assert.equal(result.progress.currentQuestion,1);assert.equal(result.text,'일부 내용이 반대입니다. 다시 생각해 보세요.');
});
