import test from "node:test";
import assert from "node:assert/strict";
import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { containsExcludedSuneungScienceContent, SUNEUNG_2027_SCIENCE_COURSES } from "../lib/suneung-science-safety.js";
import { SUNEUNG_COURSES } from "../api/suneung-courses.js";

for (const [courseId, name] of Object.entries(SUNEUNG_2027_SCIENCE_COURSES)) {
  test(`2027 ${name} has a safe complete ten-question lesson`, () => {
    const engine = createScienceLessonEngine("science-v2:2027-test", courseId);
    assert.equal(engine.questions.length, 10);
    assert.deepEqual(engine.questions.map(q => q.stage), ["개념","개념","개념","자료 분석","자료 분석","자료 분석","자료 분석","실전","실전","실전"]);
    for (const question of engine.questions) {
      assert.equal(question.choices.length, 5);
      assert.match(question.answer, /^[A-E]$/);
      assert.equal(containsExcludedSuneungScienceContent(JSON.stringify(question)), false);
    }
    assert.equal(SUNEUNG_COURSES[courseId].suneung.elective, name);
    const first = engine.handleClosedSuneungScienceLesson({ courseId, messages:[{role:"user",content:"시작"}] });
    assert.match(first.text, /문제 1\/10/);
    assert.match(first.text, /A\)[\s\S]*B\)[\s\S]*C\)[\s\S]*D\)[\s\S]*E\)/);
  });
}

test("2027 science runs change the opening presentation without changing correctness", () => {
  const id = "suneung-2027-physics-1";
  const signatures = new Set(Array.from({length:20}, (_,i) => {
    const q = createScienceLessonEngine(`science-v2:fresh-${i}`, id).questions[0];
    return JSON.stringify([q.stem,q.choices]);
  }));
  assert.ok(signatures.size > 10);
});
