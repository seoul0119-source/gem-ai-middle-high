import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const classHtml = await readFile(new URL("../class.html", import.meta.url), "utf8");
const suneungHtml = await readFile(new URL("../suneung.html", import.meta.url), "utf8");

test("places the Suneung hall between Grade 12 Korean and the English hub", () => {
  const koreanIndex = classHtml.indexOf('data-href="/learn.html?course=h3-korean"');
  const suneungIndex = classHtml.indexOf('data-href="/suneung.html"');
  const englishIndex = classHtml.indexOf('data-href="/english.html"');

  assert.ok(koreanIndex >= 0, "Grade 12 Korean entrance must remain");
  assert.ok(suneungIndex > koreanIndex, "Suneung hall must follow Grade 12 Korean");
  assert.ok(englishIndex > suneungIndex, "English hub must follow the Suneung hall");
  assert.equal(classHtml.split('data-href="/suneung.html"').length - 1, 1);
  assert.match(classHtml, /\.subject\.suneung-route\{[\s\S]*?grid-column:1 \/ -1;/);
});

test("keeps every existing classroom destination", () => {
  const originalDestinations = [
    "/learn.html?course=m1-korean", "/learn.html?course=m2-korean", "/learn.html?course=m3-korean",
    "/learn.html?course=h1-korean", "/learn.html?course=h2-korean", "/learn.html?course=h3-korean",
    "/english.html",
    "/learn.html?course=m1-math", "/learn.html?course=m2-math", "/learn.html?course=m3-math",
    "/learn.html?course=h1-math", "/learn.html?course=h2-math", "/learn.html?course=h3-math",
    "/learn.html?course=m1-history", "/learn.html?course=m2-history", "/learn.html?course=m3-history",
    "/learn.html?course=h1-history", "/learn.html?course=h2-history", "/learn.html?course=h3-history",
    "/learn.html?course=m1-social", "/learn.html?course=m2-social", "/learn.html?course=m3-social",
    "/learn.html?course=h1-social", "/learn.html?course=h2-social", "/learn.html?course=h3-social",
    "/learn.html?course=m1-science", "/learn.html?course=m2-science", "/learn.html?course=m3-science",
    "/learn.html?course=h1-science", "/learn.html?course=h2-science", "/learn.html?course=h3-science",
  ];

  for (const destination of originalDestinations) {
    const token = `data-href="${destination}"`;
    assert.equal(classHtml.split(token).length - 1, 1, `${destination} must remain exactly once`);
  }

  const elementaryEntrance = 'href="https://sites.google.com/view/gem-ai-school/home"';
  assert.equal(classHtml.split(elementaryEntrance).length - 1, 1, "Elementary entrance must remain exactly once");
});

test("offers 2027 and 2028 exam-year choices before the subjects", () => {
  const yearSectionIndex = suneungHtml.indexOf('id="exam-year-title"');
  const subjectSectionIndex = suneungHtml.indexOf('id="subject-title"');

  assert.ok(yearSectionIndex >= 0, "exam-year selector must exist");
  assert.ok(subjectSectionIndex > yearSectionIndex, "exam year must be selected before a subject");
  assert.equal(suneungHtml.split('class="year-choice"').length - 1, 2);
  assert.equal(suneungHtml.split('type="button" data-year="2027"').length - 1, 1);
  assert.equal(suneungHtml.split('type="button" data-year="2028"').length - 1, 1);
  assert.match(suneungHtml, /<strong>2027학년도<\/strong><span>2026년 시행 · 현행 체제<\/span>/);
  assert.match(suneungHtml, /<strong>2028학년도<\/strong><span>2027년 시행 · 통합형 개편<\/span>/);
  assert.match(suneungHtml, /yearButtons\.forEach\(\(item\) => item\.setAttribute\("aria-pressed", String\(item === button\)\)\)/);
  assert.match(suneungHtml, /const yearChanged = selectedYear !== button\.dataset\.year;/);
  assert.match(suneungHtml, /if \(yearChanged\)[\s\S]*?selectedSubjectButton = null;[\s\S]*?setAttribute\("aria-pressed", "false"\)/);
  assert.match(suneungHtml, /applyExamPlan\(\);[\s\S]*?updateSelectionStatus\(\)/);
  assert.match(suneungHtml, /new URLSearchParams\(location\.hash\.slice\(1\)\)/);
  assert.match(suneungHtml, /selection\.set\("year", selectedYear\)/);
  assert.match(suneungHtml, /selection\.set\("subject", selectedSubjectButton\.dataset\.key\)/);
  assert.match(suneungHtml, /savedYearButton[\s\S]*?selectYear\(savedYearButton, false\)[\s\S]*?savedSubjectButton[\s\S]*?selectSubject\(savedSubjectButton, false\)/);
  assert.match(suneungHtml, /\.year-choice:focus-visible[\s\S]*?outline:3px solid var\(--navy-light\)/);
  assert.match(suneungHtml, /@media \(max-width:420px\)[\s\S]*?\.year-options \{ grid-template-columns:1fr; \}/);
});

test("changes the subject guidance to match the selected exam year", () => {
  assert.match(suneungHtml, /"2027": \{[\s\S]*?2015 개정 교육과정[\s\S]*?각 영역별 선택과목 1개[\s\S]*?17개 과목 중 최대 2개/);
  assert.match(suneungHtml, /korean:\{ label:"수능 국어", detail:"독서·문학 공통 \+ 화법과 작문·언어와 매체 중 1개" \}/);
  assert.match(suneungHtml, /math:\{ label:"수능 수학", detail:"수학Ⅰ·수학Ⅱ 공통 \+ 확률과 통계·미적분·기하 중 1개" \}/);
  assert.match(suneungHtml, /social:\{ label:"수능 사회탐구", detail:"사회 9개 과목 중 선택 · 탐구 전체 최대 2개" \}/);
  assert.match(suneungHtml, /science:\{ label:"수능 과학탐구", detail:"과학 8개 과목 중 선택 · 탐구 전체 최대 2개" \}/);

  assert.match(suneungHtml, /"2028": \{[\s\S]*?2022 개정 교육과정[\s\S]*?국어·수학 선택과목이 폐지/);
  assert.match(suneungHtml, /korean:\{ label:"수능 국어", detail:"화법과 언어·독서와 작문·문학 공통" \}/);
  assert.match(suneungHtml, /math:\{ label:"수능 수학", detail:"대수·미적분Ⅰ·확률과 통계 공통" \}/);
  assert.match(suneungHtml, /policy:"2022 개정 교육과정 · 국어·수학 선택과목이 폐지되며, 사회·과학탐구 선택자는 통합사회와 통합과학을 모두 응시합니다\."/);
  assert.match(suneungHtml, /social:\{ label:"수능 통합사회", detail:"사회·과학탐구 선택자는 통합과학과 함께 응시" \}/);
  assert.match(suneungHtml, /science:\{ label:"수능 통합과학", detail:"사회·과학탐구 선택자는 통합사회와 함께 응시" \}/);
  assert.doesNotMatch(suneungHtml, /모든 수험생(?:이|은) 통합사회/);

  assert.match(suneungHtml, /button\.dataset\.subject = subject\.label;/);
  assert.match(suneungHtml, /button\.querySelector\("strong"\)\.textContent = subject\.label;/);
  assert.match(suneungHtml, /button\.querySelector\("small"\)\.textContent = subject\.detail;/);
  assert.match(suneungHtml, /yearPolicy\.textContent = plan\.policy;/);
  assert.match(suneungHtml, /id="year-policy" class="year-policy" aria-live="polite" aria-atomic="true"/);
});

test("offers the seven requested Suneung subject groups behind the student session gate", () => {
  for (const label of [
    "수능 국어",
    "수능 수학",
    "수능 영어",
    "수능 한국사",
    "수능 사회탐구",
    "수능 과학탐구",
    "수능 제2외국어/한문",
  ]) {
    assert.equal(suneungHtml.split(`data-subject="${label}"`).length - 1, 1, `${label} must be selectable exactly once`);
  }

  assert.equal(suneungHtml.split('class="exam-subject"').length - 1, 7);
  assert.equal(suneungHtml.split('type="button" data-subject=').length - 1, 7);
  assert.equal(suneungHtml.split('aria-pressed="false" disabled').length - 1, 7);
  assert.doesNotMatch(suneungHtml, /learn\.html\?course=(?:csat|suneung)-/);
  assert.match(suneungHtml, /<body class="auth-pending">/);
  assert.match(suneungHtml, /fetch\("\/api\/session"/);
  assert.match(suneungHtml, /cache:\s*"no-store"/);
  assert.match(suneungHtml, /document\.body\.classList\.remove\("auth-pending"\)/);
  assert.match(suneungHtml, /location\.replace\("\/"\)/);
  assert.match(suneungHtml, /method:\s*"POST"/);
  assert.match(suneungHtml, /JSON\.stringify\(\{ action:\s*"logout" \}\)/);
  assert.match(suneungHtml, /href="\/class\.html"/);
  assert.match(suneungHtml, /role="status" aria-live="polite"/);
  assert.match(suneungHtml, /subjectButtons\.forEach\(\(item\) => item\.setAttribute\("aria-pressed", String\(item === button\)\)\)/);
  assert.match(suneungHtml, /if \(!selectedYear\) return;/);
  assert.match(suneungHtml, /@media \(max-width:680px\)[\s\S]*?\.subjects \{ grid-template-columns:1fr; \}/);
  assert.match(suneungHtml, /\.exam-subject:focus-visible[\s\S]*?outline:3px solid var\(--navy-light\)/);
});
