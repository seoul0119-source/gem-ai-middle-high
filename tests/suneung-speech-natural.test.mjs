import assert from "node:assert/strict";
import test from "node:test";

import speechHandler, {
  cleanText,
  hasSuneungMathChoices,
  isSuneungMathCourse,
  normalizeSuneungMathSpeech,
  prepareAnswerPromptForSpeech,
  truncateSpeechText
} from "../api/speech.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

const MULTIPLE_CHOICE_PROBLEM = `문제 1/10 — 개념 확인 · 확률과 통계 · 확률의 뜻 · 2점 · 5지선다형

주머니에 빨간 공 3개와 파란 공 2개가 들어 있다. 이 주머니에서 공 1개를 임의로 꺼낼 때, 빨간 공이 나올 확률은?

A) 1/5
B) 2/5
C) 3/5
D) 1/2
E) 2/3

답: (________)`;

function responseCapture() {
  return {
    statusCode:0,
    headers:{},
    payload:null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    end(value) {
      this.payload = JSON.parse(value);
      return this;
    }
  };
}

test("turns the recorded Suneung fraction question into complete natural Korean speech", () => {
  const spoken = cleanText(MULTIPLE_CHOICE_PROBLEM, "suneung-2028-math");

  assert.match(spoken, /^첫 번째 문제입니다\./);
  const orderedChoices = [
    "에이 선택지, 5분의 1.",
    "비 선택지, 5분의 2.",
    "씨 선택지, 5분의 3.",
    "디 선택지, 2분의 1.",
    "이 선택지, 3분의 2."
  ];
  let previousIndex = -1;
  for (const choice of orderedChoices) {
    const choiceIndex = spoken.indexOf(choice);
    assert.ok(choiceIndex > previousIndex, `${choice} must remain in its original order`);
    previousIndex = choiceIndex;
  }
  assert.match(spoken, /정답은 어느 보기인가요\?$/);
  assert.doesNotMatch(spoken, /\d+\s*\/\s*\d+/);
  assert.doesNotMatch(spoken, /답\s*:\s*\(\s*\)|_{3,}/);
});

test("asks a distinct final question for short-answer Suneung math", () => {
  const spoken = cleanText(
    "문제 2/10 — 단답형\n√9 + 4² + 2³의 값을 구하세요.\n답: (________)",
    "suneung-2027-math-probability"
  );

  assert.match(spoken, /9의 제곱근/);
  assert.match(spoken, /4의 제곱/);
  assert.match(spoken, /2의 세제곱/);
  assert.match(spoken, /정답은 무엇인가요\?$/);
  assert.doesNotMatch(spoken, /어느 보기/);
});

test("speaks a negative numeric fraction in natural Korean order", () => {
  const spoken = normalizeSuneungMathSpeech(
    "A) -1/2\nB) −3/4",
    "suneung-2028-math"
  );

  assert.match(spoken, /에이 선택지, 마이너스 2분의 1\./);
  assert.match(spoken, /비 선택지, 마이너스 4분의 3\./);
  assert.doesNotMatch(spoken, /분의\s*[-−]/);
});

test("repairs the old empty answer parentheses and is idempotent", () => {
  const damaged = MULTIPLE_CHOICE_PROBLEM.replace("답: (________)", "답: ()");
  const repaired = cleanText(damaged, "suneung-2028-math");

  assert.match(repaired, /정답은 어느 보기인가요\?$/);
  assert.doesNotMatch(repaired, /답\s*:\s*\(\s*\)/);
  assert.equal(cleanText(repaired, "suneung-2028-math"), repaired);

  const alreadyNormalized = [
    "첫 번째 문제입니다.",
    "에이 선택지, 5분의 1.",
    "비 선택지, 5분의 2.",
    "씨 선택지, 5분의 3.",
    "디 선택지, 2분의 1.",
    "이 선택지, 3분의 2.",
    "정답은 어느 보기인가요?"
  ].join("\n");
  assert.equal(cleanText(alreadyNormalized, "suneung-2028-math"), alreadyNormalized);
});

test("preserves the final Suneung answer question when long speech is truncated", () => {
  const prompt = "정답은 어느 보기인가요?";
  const longSpeech = `${"긴 문제 설명입니다. ".repeat(180)}\n\n${prompt}`;
  const truncated = truncateSpeechText(longSpeech, "suneung-2028-math");

  assert.ok(truncated.length <= 1800);
  assert.match(truncated, /정답은 어느 보기인가요\?$/);
  assert.equal(truncateSpeechText(truncated, "suneung-2028-math"), truncated);
});

test("does not pronounce a visual attempt counter as a mathematical fraction", () => {
  const spoken = cleanText(
    "도전 2/3 · 힌트: 전체 경우의 수를 먼저 세어 보세요.",
    "suneung-2028-math"
  );

  assert.doesNotMatch(spoken, /도전|3분의 2/);
  assert.equal(spoken, "힌트: 전체 경우의 수를 먼저 세어 보세요.");
  assert.doesNotMatch(spoken, /정답은 (?:어느 보기|무엇)인가요/);
});

test("keeps ordinary-course answer boxes silent", () => {
  for (const answerBox of ["답: (________)", "답: ()", "Answer: (________)"]) {
    const spoken = cleanText(`활동 1/10\n문제를 푸세요.\n${answerBox}`, "m1-math");
    assert.doesNotMatch(spoken, /답\s*:|Answer|\(\s*\)|정답은 (?:어느 보기|무엇)인가요/);
  }
});

test("exports narrow helpers without changing non-Suneung text", () => {
  assert.equal(isSuneungMathCourse("suneung-2028-math"), true);
  assert.equal(isSuneungMathCourse("suneung-2027-math-calculus"), true);
  assert.equal(isSuneungMathCourse("suneung-2028-integrated-science"), false);
  assert.equal(hasSuneungMathChoices(MULTIPLE_CHOICE_PROBLEM), true);
  assert.equal(hasSuneungMathChoices("문제 1/10\n값을 구하세요."), false);
  assert.equal(
    normalizeSuneungMathSpeech("A) 1/5", "h3-math"),
    "A) 1/5"
  );
  assert.equal(
    prepareAnswerPromptForSpeech("답: (________)", "h3-math"),
    ""
  );
});

test("sends the normalized choices and final question to the TTS provider", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "suneung-speech-test-key";
  let providerRequest;
  globalThis.fetch = async (url, init) => {
    providerRequest = { url, body:JSON.parse(init.body) };
    return {
      ok:true,
      arrayBuffer:async () => Uint8Array.from([71, 69, 77]).buffer
    };
  };

  try {
    const courseId = "suneung-2028-math";
    const courseRunId = "natural-speech-run";
    const token = createSessionToken({
      id:"R260001",
      name:"테스트 학생",
      session:"sheet-session",
      courseId,
      courseRunId,
      startedAt:new Date().toISOString(),
      endedAt:null
    });
    const response = responseCapture();

    await speechHandler({
      method:"POST",
      headers:{ cookie:`${SESSION_COOKIE}=${token}` },
      body:{ courseId, courseRunId, text:MULTIPLE_CHOICE_PROBLEM }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(providerRequest.url, "https://api.openai.com/v1/audio/speech");
    assert.match(providerRequest.body.input, /에이 선택지, 5분의 1\./);
    assert.match(providerRequest.body.input, /이 선택지, 3분의 2\./);
    assert.match(providerRequest.body.input, /정답은 어느 보기인가요\?$/);
    assert.doesNotMatch(providerRequest.body.input, /답\s*:\s*\(\s*\)|_{3,}/);
    assert.match(providerRequest.body.instructions, /read that final answer-request question exactly as written/i);
    assert.match(providerRequest.body.instructions, /Do not add either question when it is absent/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
