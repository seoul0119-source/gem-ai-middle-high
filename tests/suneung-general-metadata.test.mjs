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

test("every remaining 2028 classroom has an explicit integrated curriculum scope", () => {
  const direct = {
    "suneung-2028-korean":["독서와 작문", "문학", "화법과 언어"],
    "suneung-2028-english":["어휘와 문법", "빈칸 추론", "글의 순서", "장문 독해", "듣기", "대본과 음성", "학습용 연습"],
    "suneung-2028-history":["전근대", "개항기", "독립운동", "대한민국"],
    "suneung-2028-integrated-social":["통합사회1", "통합적 관점", "인간·사회·환경과 행복", "자연환경과 인간", "문화와 다양성", "생활공간과 사회", "통합사회2", "인권 보장과 헌법", "사회정의와 불평등", "시장경제와 지속가능발전", "세계화와 평화", "미래와 지속가능한 삶"]
  };
  for (const [id, terms] of Object.entries(direct)) {
    const prompt = SUNEUNG_COURSES[id].prompt;
    assert.match(prompt, /2028학년도 세부 학습 범위/);
    assert.match(prompt, /2022 개정 교육과정의 통합형 체제/);
    for (const term of terms) assert.match(prompt, new RegExp(term), `${id}: ${term}`);
  }
  for (const key of ["german", "french", "spanish", "chinese", "japanese", "russian", "arabic", "vietnamese"]) {
    const prompt = SUNEUNG_COURSES[`suneung-2028-second-${key}`].prompt;
    for (const term of ["어휘의 문맥 이해", "의사소통 기능", "문법과 문장 구조", "문화 이해"]) {
      assert.match(prompt, new RegExp(term), `${key}: ${term}`);
    }
  }
});

test("2028 Hanmun has a classical-language scope instead of modern foreign conversation", () => {
  const course = SUNEUNG_COURSES["suneung-2028-second-hanmun"];
  for (const term of ["한자의 음과 뜻", "한자 어휘와 짜임", "성어", "허사", "한문 문장 구조와 독해", "한국 한자음"]) {
    assert.ok(course.prompt.includes(term), term);
  }
  assert.doesNotMatch(course.prompt, /세부 학습 범위:.*의사소통 기능/);
  assert.doesNotMatch(course.greeting, /의사소통/);
});

test("2028 task clarity and independent content criteria do not alter 2027 prompts", () => {
  for (const [id, course] of general) {
    if (course.suneung.year === "2028") {
      for (const term of ["화자·소유자", "판단 기준", "의도적으로 틀린 문장", "성조", "실제 사료", "9개 과목 중 1개"]) {
        assert.ok(course.prompt.includes(term), `${id}: ${term}`);
      }
    } else assert.doesNotMatch(course.prompt, /발문·선택지·정답 검토/, id);
  }
  assert.doesNotMatch(SUNEUNG_COURSES["suneung-2028-korean"].prompt, /문법과 매체|화법과 작문의/);
});
