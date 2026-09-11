import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const learnHtml = await readFile(new URL("../learn.html", import.meta.url), "utf8");

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} must have a closing brace`);
}

const speechContext = {
  COURSE:{ language:"ko", avatar:false },
  IS_SUNEUNG:true,
  cleanForDisplay(value) { return String(value || ""); }
};
runInNewContext(`
  ${extractNamedFunction(learnHtml, "normalizeKoreanSuneungMathSpeech")}
  ${extractNamedFunction(learnHtml, "cleanMathForSpeech")}
  ${extractNamedFunction(learnHtml, "isLessonStartRequest")}
  this.cleanMathForSpeech = cleanMathForSpeech;
  this.isLessonStartRequest = isLessonStartRequest;
`, speechContext);

test("prepares the complete video question for natural Korean Suneung math speech", () => {
  const spoken = speechContext.cleanMathForSpeech([
    "문제 1/10 — 개념 확인 · 확률과 통계 · 확률의 뜻 · 2점 · 5지선다형",
    "",
    "주머니에 빨간 공 3개와 파란 공 2개가 들어 있다. 이 주머니에서 공 1개를 임의로 꺼낼 때, 빨간 공이 나올 확률은?",
    "",
    "A) 1/5",
    "B) 2/5",
    "C) 3/5",
    "D) 1/2",
    "E) 2/3",
    "",
    "답: (________)"
  ].join("\n"));

  assert.match(spoken, /^문제 1\/10/);
  assert.match(spoken, /5지선다형\n\n주머니에/);
  const choices = [
    "에이 선택지, 5분의 1",
    "비 선택지, 5분의 2",
    "씨 선택지, 5분의 3",
    "디 선택지, 2분의 1",
    "이 선택지, 3분의 2"
  ];
  for (const choice of choices) assert.match(spoken, new RegExp(choice));
  assert.deepEqual(
    choices.map((choice) => spoken.indexOf(choice)),
    [...choices].map((choice) => spoken.indexOf(choice)).sort((left, right) => left - right),
    "A–E choices must remain in their visible order"
  );
  for (const line of spoken.split("\n").filter((line) => /선택지,/.test(line))) {
    assert.match(line, /\.$/, `choice needs a reliable spoken pause: ${line}`);
  }
  assert.match(spoken, /정답은 어느 보기인가요\?$/);
  assert.doesNotMatch(spoken, /답\s*:\s*\(|\(\)|^[A-E]\s*[).]/m);
  assert.equal(speechContext.cleanMathForSpeech(spoken), spoken, "speech normalization must be idempotent");
});

test("asks naturally for a Suneung short answer and speaks safe math symbols", () => {
  const spoken = speechContext.cleanMathForSpeech([
    "문제 4/10 — 대표 유형 · 대수 · 단답형",
    "-1/2 + √4 ≤ π이고 x² + y³ = 10일 때 값을 구하세요.",
    "답: (________)"
  ].join("\n"));

  assert.match(spoken, /^문제 4\/10/);
  assert.match(spoken, /마이너스 2분의 1 더하기 루트 4 이하 파이/);
  assert.match(spoken, /x의 제곱 더하기 y의 세제곱/);
  assert.doesNotMatch(spoken, /x²|y³/);
  assert.doesNotMatch(spoken, /-2분의|2분의 -1/);
  assert.match(spoken, /정답은 무엇인가요\?$/);
  assert.doesNotMatch(spoken, /정답은 어느 보기/);
  assert.equal(speechContext.cleanMathForSpeech(spoken), spoken, "short-answer normalization must be idempotent");
});

test("keeps one final answer question and never speaks attempt counters as fractions", () => {
  const spoken = speechContext.cleanMathForSpeech([
    "문제 3/10 — 대표 유형 · 도전 2/3",
    "A) 1/3",
    "B) 2/3",
    "C) 1",
    "D) 2",
    "E) 3",
    "답 1: (________)",
    "답 2: (________)",
    "정답은 어느 보기인가요?"
  ].join("\n"));

  assert.equal((spoken.match(/정답은 어느 보기인가요\?/g) || []).length, 1);
  assert.doesNotMatch(spoken, /도전|3분의 2\s*$/m);
  assert.match(spoken, /에이 선택지, 3분의 1\./);
  assert.match(spoken, /비 선택지, 3분의 2\./);
});

test("classifies polite Korean voice commands as lesson starts", () => {
  for (const command of [
    "시작해 주세요.",
    "안녕하세요. 시작해 주세요.",
    "선생님, 수학 수업 시작 부탁드립니다.",
    "새 수업",
    "START",
    "Commencer"
  ]) {
    assert.equal(speechContext.isLessonStartRequest(command), true, command);
  }

  for (const statement of [
    "함수의 시작점은 2입니다.",
    "시작값은 3입니다.",
    "C번입니다."
  ]) {
    assert.equal(speechContext.isLessonStartRequest(statement), false, statement);
  }

  assert.match(learnHtml, /const isStarting = isLessonStartRequest\(text\);/);
});
