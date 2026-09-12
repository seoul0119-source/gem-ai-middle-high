import assert from "node:assert/strict";
import test from "node:test";
import chatHandler from "../api/chat-final.js";
import transcribeHandler from "../api/transcribe.js";
import speechHandler from "../api/speech.js";
import { providerAiServiceError } from "../lib/ai-service-error.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

const courseId = "suneung-2028-english";
const courseRunId = "service-error-regression";
const question = `문제 1/10 — 개념 · 문맥 속 어휘 · 5지선다형
다음 문장에서 quiet의 뜻으로 가장 적절한 것을 고르세요.
The library was quiet, so I could concentrate on my book.
A) 시끄러운
B) 조용한
C) 위험한
D) 복잡한
E) 더러운
답: (________)`;
const sensitiveMessage = "provider internal message and credential must not be exposed";
const unavailable = code => ({ status: 429, data: { error: { code, message: sensitiveMessage, param: sensitiveMessage } } });
const generated = { status: 200, data: { status: "completed", output_text: question } };

function request(extra = {}) {
  const token = createSessionToken({ id: "SERVICE_TEST", name: "합성 검증", session: "service-regression", courseId, courseRunId });
  return { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${token}` }, body: {
    courseId, courseRunId, lessonSeed: courseRunId, inputMode: "text",
    messages: [{ role: "user", content: "시작" }], ...extra
  } };
}
function response() {
  return { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; },
    setHeader() { return this; }, end(value) { this.payload = JSON.parse(value); } };
}
async function withProvider(replies, run) {
  const savedFetch = globalThis.fetch, savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-service-regression-key";
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const next = replies.shift();
    assert.ok(next, "must not retry a billing failure or fall back to a second model");
    return { ok: next.status === 200, status: next.status, json: async () => next.data };
  };
  try { await run(calls); assert.equal(replies.length, 0); }
  finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey;
  }
}
function assertCreditError(result) {
  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.code, "ai_credit_exhausted");
  assert.equal(result.payload.retryable, false);
  assert.equal(result.payload.pauseVoice, true);
  assert.match(result.payload.error, /선생님/);
  assert.doesNotMatch(JSON.stringify(result.payload), /understand|recognize|알아듣|정답|provider internal|credential/);
  assert.deepEqual(Object.keys(result.payload).sort(), ["code", "error", "pauseVoice", "retryable"]);
}

test("allowlisted billing errors take priority over rate limits and never expose provider details", () => {
  for (const code of ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"]) {
    const result = providerAiServiceError(429, { error: { code, type: "rate_limit_exceeded", message: sensitiveMessage } });
    assertCreditError({ statusCode: result.status, payload: result.payload });
  }
  assert.equal(providerAiServiceError(200, unavailable("credit_balance_exhausted").data), null);
  assert.equal(providerAiServiceError(429, { error: { code: sensitiveMessage } }), null);
});

test("transcription credit exhaustion stops after one call, without model fallback or pronunciation blame", async () => {
  for (const status of [429, 403]) await withProvider([{ ...unavailable("credit_balance_exhausted"), status }], async calls => {
    const result = response();
    await transcribeHandler(request({ audio: Buffer.from("synthetic audio").toString("base64") }), result);
    assertCreditError(result);
    assert.equal(calls.length, 1);
  });
});

test("a genuine rate limit remains retryable but pauses voice, with one provider call", async () => {
  await withProvider([unavailable("rate_limit_exceeded")], async calls => {
    const result = response();
    await transcribeHandler(request({ audio: Buffer.from("synthetic audio").toString("base64") }), result);
    assert.equal(result.statusCode, 429);
    assert.equal(result.payload.code, "ai_rate_limited");
    assert.equal(result.payload.retryable, true);
    assert.equal(result.payload.pauseVoice, true);
    assert.equal(calls.length, 1);
  });
});

test("successful empty transcripts still use recognition feedback after one compatibility fallback", async () => {
  await withProvider([{ status: 200, data: { text: " " } }, { status: 200, data: { text: "" } }], async calls => {
    const result = response();
    await transcribeHandler(request({ audio: Buffer.from("synthetic audio").toString("base64") }), result);
    assert.equal(result.statusCode, 422);
    assert.match(result.payload.error, /understand|알아듣/);
    assert.equal(result.payload.pauseVoice, undefined);
    assert.equal(calls.length, 2);
  });
});

test("a transcription provider outage is not reported as a student recognition error", async () => {
  await withProvider([{ status: 500, data: { error: { message: sensitiveMessage } } }], async calls => {
    const result = response();
    await transcribeHandler(request({ audio: Buffer.from("synthetic audio").toString("base64") }), result);
    assert.equal(result.statusCode, 503);
    assert.equal(result.payload.code, "ai_service_unavailable");
    assert.doesNotMatch(result.payload.error, /understand|알아듣|provider internal/);
    assert.equal(calls.length, 1);
  });
});

test("English lesson startup returns the credit condition without retrying or publishing a question", async () => {
  await withProvider([unavailable("credit_balance_exhausted")], async calls => {
    const result = response();
    await chatHandler(request(), result);
    assertCreditError(result);
    assert.equal(calls.length, 1);
  });
});

test("credit exhaustion during the new-question review preserves the service condition without publishing its draft", async () => {
  await withProvider([generated, unavailable("credit_balance_exhausted")], async calls => {
    const result = response();
    await chatHandler(request(), result);
    assertCreditError(result);
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].options.body).text.format.name, "general_2028_turn_review");
  });
});

test("credit exhaustion during independent grading cannot consume an attempt or advance the question", async () => {
  await withProvider([unavailable("insufficient_quota")], async calls => {
    const result = response();
    await chatHandler(request({ messages: [{ role: "assistant", content: question }, { role: "user", content: "B" }] }), result);
    assertCreditError(result);
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].options.body).text.format.name, "general_2028_question_review");
  });
});

test("speech synthesis exposes the same pausable credit condition and makes no fallback call", async () => {
  await withProvider([unavailable("credit_balance_exhausted")], async calls => {
    const result = response();
    await speechHandler(request({ text: "문장을 읽어 보세요." }), result);
    assertCreditError(result);
    assert.equal(calls.length, 1);
  });
});

test("billing handling preserves the student-session guard and makes no unauthenticated provider call", async () => {
  await withProvider([], async calls => {
    const result = response();
    await chatHandler({ ...request(), headers: {} }, result);
    assert.equal(result.statusCode, 401);
    assert.equal(calls.length, 0);
  });
});
