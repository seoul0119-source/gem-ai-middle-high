import test from "node:test";
import assert from "node:assert/strict";
import { SUNEUNG_COURSES } from "../api/suneung-courses.js";

const general = Object.entries(SUNEUNG_COURSES).filter(([, course]) =>
  !["math", "science"].includes(course.kind));

test("all 35 general courses specify the question, conversation and direct-record contracts", () => {
  assert.equal(general.length, 35);
  for (const [id, course] of general) {
    assert.match(course.prompt, /문제 n\/10 — 개념 · 과목 · 단원 · 5지선다형/, id);
    assert.match(course.prompt, /자료 분석/, id);
    assert.match(course.prompt, /GEM_RECORD도 쓰지 않습니다/, id);
    assert.match(course.prompt, /모든 기록 scope는 direct/, id);
    assert.doesNotMatch(course.prompt, /"scope":"common"|"topic":"지수와 로그"/, id);
  }
});

test("geography and history electives remain social inquiry, not Korean or Korean history", () => {
  for (const key of ["korean-geography", "east-asian-history", "world-history"]) {
    const course = SUNEUNG_COURSES[`suneung-2027-social-${key}`];
    assert.equal(course.kind, "social");
    assert.equal(course.suneung.subject, "social");
  }
});

test("both exam years define native target locales without changing Korean instruction language", () => {
  const locales = { german:"de-DE", french:"fr-FR", spanish:"es-ES", chinese:"zh-CN", japanese:"ja-JP",
    russian:"ru-RU", arabic:"ar-SA", vietnamese:"vi-VN", hanmun:"ko-KR" };
  for (const year of ["2027", "2028"]) {
    for (const [key, locale] of Object.entries(locales)) {
      const course = SUNEUNG_COURSES[`suneung-${year}-second-${key}`];
      assert.equal(course.targetLanguage, locale);
      assert.equal(course.suneung.subject, "second-language");
      assert.notEqual(course.language, "en");
      assert.notEqual(course.language, "fr");
    }
    assert.equal(SUNEUNG_COURSES[`suneung-${year}-english`].targetLanguage, "en-US");
  }
});
