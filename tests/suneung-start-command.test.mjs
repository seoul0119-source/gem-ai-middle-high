import assert from "node:assert/strict";
import test from "node:test";

import chatHandler, {
  isKoreanLessonStartRequest,
  latestAssistantSuneungQuestionContent
} from "../api/chat.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

function responseCapture() {
  return {
    statusCode:0,
    payload:null,
    headers:new Map(),
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); return this; },
    end(value = "") { this.payload = value ? JSON.parse(String(value)) : {}; return this; }
  };
}

test("recognizes natural Korean lesson-start voice commands without matching incidental words", () => {
  for (const command of [
    "시작",
    "시작하기!",
    "시작해 주세요.",
    "안녕하세요. 시작해 주세요.",
    "선생님, 수업 시작 부탁드립니다.",
    "수학 시작해 줘",
    "수능 수학을 시작해 주십시오.",
    "새 수업",
    "새 수업 시작해 주세요.",
    "처음부터",
    "START"
  ]) {
    assert.equal(isKoreanLessonStartRequest(command), true, command);
  }

  for (const statement of [
    "함수의 시작점은 2입니다",
    "시작값 3",
    "문제의 시작 부분을 읽어 주세요",
    "수업은 이미 시작했습니다",
    "A번입니다"
  ]) {
    assert.equal(isKoreanLessonStartRequest(statement), false, statement);
  }
});

test("extracts only the active Suneung question and removes private learning records", () => {
  const result = latestAssistantSuneungQuestionContent([
    {
      role:"assistant",
      content:`정답입니다. 4² = 16으로 가장 큽니다.\n\n문제 2/10 — 개념 확인 · 수학Ⅱ · 함수의 극한\n함수 f(x)가 x가 2에 가까워질 때 5에 가까워진다는 것을 나타내는 식은?\nA) lim(x→5) f(x) = 2\nB) lim(x→2) f(x) = 5\nC) lim(x→2) f(x) = 0\nD) lim(x→5) f(x) = 0\nE) f(5) = 2\n답: (________)\n[GEM_RECORD]{"question":1,"stage":"개념","topic":"지수함수","scope":"common","outcome":"correct","attempts":1,"weakType":""}[/GEM_RECORD]`
    }
  ], 2);

  assert.equal(result?.question, 2);
  assert.match(result?.text || "", /^문제 2\/10/);
  assert.match(result?.text || "", /B\) lim\(x→2\) f\(x\) = 5/);
  assert.match(result?.text || "", /답: \(________\)$/);
  assert.doesNotMatch(result?.text || "", /정답입니다|GEM_RECORD/);
});

test("an in-progress Suneung start request repeats the current question without OpenAI", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "suneung-start-command-test-key";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("an active-question repeat must not call OpenAI");
  };

  try {
    const courseId = "suneung-2027-math-probability";
    const courseRunId = "voice-repeat-run";
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
    await chatHandler({
      method:"POST",
      headers:{ cookie:`${SESSION_COOKIE}=${token}` },
      body:{
        courseId,
        courseRunId,
        inputMode:"voice",
        lessonSeed:"voice-repeat-seed",
        messages:[
          {
            role:"assistant",
            content:"문제 2/10 — 개념 확인 · 수학Ⅱ · 함수의 극한\n함수 f(x)가 x가 2에 가까워질 때 5에 가까워진다는 것을 나타내는 식은?\nA) lim(x→5) f(x) = 2\nB) lim(x→2) f(x) = 5\nC) lim(x→2) f(x) = 0\nD) lim(x→5) f(x) = 0\nE) f(5) = 2\n답: (________)"
          },
          { role:"user", content:"안녕하세요. 시작해 주세요." }
        ],
        learningProfile:{
          lessonRecords:[
            {
              question:1,
              stage:"개념",
              topic:"수열",
              scope:"common",
              outcome:"correct",
              attempts:1,
              weakType:""
            }
          ]
        }
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.match(response.payload.text, /^2번 문제가 진행 중입니다\. 문제를 다시 읽어드릴게요\./);
    assert.match(response.payload.text, /문제 2\/10[\s\S]*B\) lim\(x→2\) f\(x\) = 5/);
    assert.match(response.payload.text, /답: \(________\)$/);
    assert.doesNotMatch(response.payload.text, /문제 1\/10|GEM_RECORD/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
