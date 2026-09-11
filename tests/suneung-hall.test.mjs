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
  assert.equal(suneungHtml.split('aria-pressed="false"').length - 1, 7);
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
  assert.match(suneungHtml, /@media \(max-width:680px\)[\s\S]*?\.subjects \{ grid-template-columns:1fr; \}/);
  assert.match(suneungHtml, /\.exam-subject:focus-visible[\s\S]*?outline:3px solid var\(--navy-light\)/);
});
