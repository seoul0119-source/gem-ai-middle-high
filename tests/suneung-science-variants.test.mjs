import assert from "node:assert/strict";
import test from "node:test";
import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { containsExcludedSuneungScienceContent } from "../lib/suneung-science-safety.js";
const courseId="suneung-2028-integrated-science";

test("100 distinct runs vary real problem data, preserve keys and complete all ten questions", () => {
  const lessons=new Set();
  for(let run=0;run<100;run++) {
    const engine=createScienceLessonEngine(`run-${run}`);
    lessons.add(JSON.stringify(engine.questions.map(q=>q.stem)));
    assert.deepEqual(engine.questions,createScienceLessonEngine(`run-${run}`).questions);
    const profile={lessonRecords:[]};
    let result=engine.handleClosedSuneungScienceLesson({courseId,messages:[{role:"user",content:"시작"}],learningProfile:profile});
    for(const q of engine.questions) {
      assert.equal(q.choices.length,5);
      assert.equal(new Set(q.choices).size,5);
      assert.equal(containsExcludedSuneungScienceContent(JSON.stringify(q)),false);
      assert.equal(engine.isApprovedClosedSuneungScienceResponse(result.text),true);
      const speech=engine.projectClosedSuneungScienceSpeechText(result.text);
      const parts=speech.split(/(?=^[ \t]*(?:[A-E][).:：][ \t]+|정답은 어느 보기인가요\?))/gm).map(p=>p.trim()).filter(Boolean);
      assert.equal(parts.length,7);
      for(const part of parts) {
        assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(part),true,part);
        assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(part+" 임의 추가 설명"),false);
      }
      if(q.number===4) {
        const values=q.stem.match(/\d+/g).map(Number);
        assert.equal(q.choices["ABCDE".indexOf(q.answer)],`${values[0]*values[1]} kg·m/s`);
      }
      const hint=engine.handleClosedSuneungScienceLesson({courseId,messages:[{role:"assistant",content:result.text},{role:"user",content:"선생님 힌트 좀 알려 주세요."}],learningProfile:profile});
      assert.equal(hint.record,undefined);
      assert.match(hint.text,/힌트 1\/2.*도전 1\/3/);
      result=engine.handleClosedSuneungScienceLesson({courseId,messages:[{role:"assistant",content:hint.text},{role:"user",content:q.answer}],learningProfile:profile});
      assert.equal(result.record?.outcome,"correct");
      assert.equal(result.record?.question,q.number);
      profile.lessonRecords.push(result.record);
    }
    assert.match(result.text,/이번 통합과학 수업을 마쳤습니다/);
    assert.equal(engine.isApprovedClosedSuneungScienceResponse(result.text),true);
  }
  assert.equal(lessons.size,100);
});

test("term explanation and repeated reading preserve the current attempt", () => {
  const engine=createScienceLessonEngine("term-run");
  const call=messages=>engine.handleClosedSuneungScienceLesson({courseId,messages,learningProfile:{lessonRecords:[]}});
  const start=call([{role:"user",content:"시작"}]);
  const meaning=call([{role:"assistant",content:start.text},{role:"user",content:"옴의 뜻이 무엇인가요?"}]);
  assert.match(meaning.text,/전기 저항의 단위/);
  assert.equal(meaning.record,undefined);
  assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(engine.projectClosedSuneungScienceSpeechText(meaning.text)),true);
  const repeat=call([{role:"assistant",content:meaning.text},{role:"user",content:"문제를 다시 읽어 주세요"}]);
  assert.equal(repeat.text,start.text);
});
