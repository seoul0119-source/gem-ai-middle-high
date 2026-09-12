import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { CLOSED_SUNEUNG_SCIENCE_QUESTIONS, createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { scienceVariants, SCIENCE_VARIANT_PREFIX } from "../lib/suneung-science-variants.js";
import { containsExcludedSuneungScienceContent } from "../lib/suneung-science-safety.js";
const courseId = "suneung-2028-integrated-science";
const runSeed = run => `${SCIENCE_VARIANT_PREFIX}run-${run}`;
const correctChoice = q => q.choices["ABCDE".indexOf(q.answer)];

// Recalculate from the learner-visible data, so a shuffled but incorrect key
// cannot pass merely because the engine accepts its own answer.
function verifyVisibleAnswer(q) {
  const values = q.stem.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  const choice = correctChoice(q);
  let expected;
  switch (q.number) {
    case 1:
      if (q.stem.startsWith("측정기에")) expected = values[0] / 1000;
      else if (q.stem.startsWith("실험 기록")) expected = values[0] * 1000;
      else if (q.stem.includes("산술평균")) expected = values.reduce((a, b) => a + b) / 3;
      else if (q.stem.includes("양 끝")) expected = values[1] - values[0];
      else if (q.stem.includes("초(s)")) expected = values[0] * 60 + values[1];
      else if (q.stem.includes("작은 한 칸")) expected = values[0] / values[1];
      else assert.fail(`Unverified measurement: ${q.stem}`);
      break;
    case 2:
      if (q.stem.includes("센서의 역할")) {
        assert.match(choice, /정보를 전기 신호로 바꾼다$/);
        return;
      }
      if (q.stem.includes("초마다")) expected = values[1] / values[0];
      else expected = 2 ** Number(q.stem.match(/(\d+)자리 디지털/)[1]);
      break;
    case 3:
      if (q.stem.includes("양성자")) {
        const [, p, charge] = q.stem.match(/양성자 (\d+)개.*전하가 ([+-]\d+)/);
        expected = Number(p) - Number(charge);
      } else expected = values[0] * (q.stem.includes("잃었습니다") ? 1 : -1);
      break;
    case 4:
      expected = q.stem.includes("운동량의 크기는 얼마") ? values[0] * values[1] : values[1] / values[0];
      break;
    case 5:
      if (q.stem.includes("몇 배")) expected = 10 ** (values[1] - values[0]);
      else {
        assert.equal(choice, values[0] < values[1] ? "갑" : "을");
        return;
      }
      break;
    case 6:
      expected = q.stem.includes("결합한 산소의 질량") ? values[1] - values[0] : values[0] + values[1];
      break;
    case 7:
      expected = q.stem.includes("유용하게 출력") ? values[0] * values[1] / 100 : values[1] / values[0] * 100;
      break;
    case 8:
      if (q.stem.includes("몇 배")) {
        assert.equal(choice, `1/${values[1]}배`);
        return;
      }
      expected = values[0] / values[1];
      break;
    case 9:
      if (q.stem.includes("일치할 수 있는 pH")) {
        const selectedPh = Number(choice.match(/\d+/)[0]);
        assert.equal(q.stem.includes("파란 리트머스를 붉게") ? selectedPh < 7 : selectedPh > 7, true);
      } else {
        assert.equal(choice, values[1] < 7 ? "파란 리트머스를 붉게 바꾼다" : "붉은 리트머스를 파랗게 바꾼다");
      }
      return;
    case 10:
      expected = q.stem.includes("저장과 방전") ? values[0] * values[1] / 100 : values[0] - values[2];
      break;
    default: assert.fail(`Unverified question ${q.number}`);
  }
  assert.ok(Math.abs(parseFloat(choice) - expected) < 1e-6, `${q.stem}\nChosen: ${choice}, expected ${expected}`);
}

test("new runs vary the opening problem and preserve the complete 3/4/3 lesson flow", () => {
  const lessons = new Set();
  const openings = new Set();
  const openingTypes = new Set();
  for (let run = 0; run < 100; run += 1) {
    const engine = createScienceLessonEngine(runSeed(run));
    lessons.add(JSON.stringify(engine.questions.map(q => q.stem)));
    openings.add(engine.questions[0].stem);
    openingTypes.add(engine.questions[0].stem.split(" ")[0]);
    assert.deepEqual(engine.questions, createScienceLessonEngine(runSeed(run)).questions);
    assert.deepEqual(engine.questions.map(q => q.stage), ["개념", "개념", "개념", "자료 분석", "자료 분석", "자료 분석", "자료 분석", "통합형 실전", "통합형 실전", "통합형 실전"]);
    const profile = { lessonRecords: [] };
    let result = engine.handleClosedSuneungScienceLesson({ courseId, messages: [{ role: "user", content: "시작" }], learningProfile: profile });
    for (const q of engine.questions) {
      assert.equal(q.choices.length, 5);
      assert.equal(new Set(q.choices).size, 5);
      verifyVisibleAnswer(q);
      assert.equal(containsExcludedSuneungScienceContent(JSON.stringify(q)), false);
      assert.equal(engine.isApprovedClosedSuneungScienceResponse(result.text), true);
      const speech = engine.projectClosedSuneungScienceSpeechText(result.text);
      const parts = speech.split(/(?=^[ \t]*(?:[A-E][).:：][ \t]+|정답은 어느 보기인가요\?))/gm).map(p => p.trim()).filter(Boolean);
      assert.equal(parts.length, 7);
      for (const part of parts) {
        assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(part), true, part);
        assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(part + " 임의 추가 설명"), false);
      }
      const hint = engine.handleClosedSuneungScienceLesson({ courseId, messages: [{ role: "assistant", content: result.text }, { role: "user", content: "선생님 힌트 좀 알려 주세요." }], learningProfile: profile });
      assert.equal(hint.record, undefined);
      assert.match(hint.text, /힌트 1\/2.*도전 1\/3/);
      result = engine.handleClosedSuneungScienceLesson({ courseId, messages: [{ role: "assistant", content: hint.text }, { role: "user", content: q.answer }], learningProfile: profile });
      assert.equal(result.record?.outcome, "correct");
      assert.equal(result.record?.question, q.number);
      profile.lessonRecords.push(result.record);
    }
    assert.match(result.text, /이번 통합과학 수업을 마쳤습니다/);
    assert.equal(engine.isApprovedClosedSuneungScienceResponse(result.text), true);
  }
  assert.equal(lessons.size, 100);
  assert.ok(openings.size >= 98, `Only ${openings.size} distinct opening prompts`);
  assert.equal(openingTypes.size, 6);
});

test("1000 generated sets have unique choices and mathematically correct shuffled answers", () => {
  const labels = new Set();
  for (let run = 0; run < 1000; run += 1) {
    const questions = scienceVariants(CLOSED_SUNEUNG_SCIENCE_QUESTIONS, runSeed(`data-${run}`));
    for (const q of questions) {
      assert.equal(new Set(q.choices).size, 5, q.stem);
      assert.equal(containsExcludedSuneungScienceContent(JSON.stringify(q)), false);
      verifyVisibleAnswer(q);
      labels.add(q.answer);
    }
  }
  assert.deepEqual([...labels].sort(), ["A", "B", "C", "D", "E"]);
});

test("existing unversioned sessions retain the exact original bank and answer keys", () => {
  const questions = scienceVariants(CLOSED_SUNEUNG_SCIENCE_QUESTIONS, "already-issued-course-run");
  assert.equal(createHash("sha256").update(JSON.stringify(questions)).digest("hex"), "61e31b90301599e999b644be98ce7d7d857f2df458a4c58ee88b3848d013d512");
  assert.equal(scienceVariants(CLOSED_SUNEUNG_SCIENCE_QUESTIONS, ""), CLOSED_SUNEUNG_SCIENCE_QUESTIONS);
});

test("term explanation and repeated reading preserve the current attempt", () => {
  // Select a resistance conversion so the term actually occurs in the problem.
  const seed = Array.from({ length: 100 }, (_, i) => runSeed(i)).find(value =>
    scienceVariants(CLOSED_SUNEUNG_SCIENCE_QUESTIONS, value)[0].choices.some(choice => choice.includes("옴")));
  assert.ok(seed);
  const engine = createScienceLessonEngine(seed);
  const call = messages => engine.handleClosedSuneungScienceLesson({ courseId, messages, learningProfile: { lessonRecords: [] } });
  const start = call([{ role: "user", content: "시작" }]);
  const meaning = call([{ role: "assistant", content: start.text }, { role: "user", content: "옴의 뜻이 무엇인가요?" }]);
  assert.match(meaning.text, /전기 저항의 단위/);
  assert.equal(meaning.record, undefined);
  assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(engine.projectClosedSuneungScienceSpeechText(meaning.text)), true);
  const repeat = call([{ role: "assistant", content: meaning.text }, { role: "user", content: "문제를 다시 읽어 주세요" }]);
  assert.equal(repeat.text, start.text);
});
