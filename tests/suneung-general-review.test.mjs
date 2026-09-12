import assert from "node:assert/strict";
import test from "node:test";
import chatHandler from "../api/chat-final.js";
import { SUNEUNG_COURSES } from "../api/suneung-courses.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";
import { GeneralSuneungReviewError, isReviewedGeneralSuneungCourse, reviewGeneralSuneungTurn,
  solveGeneralSuneungQuestion, verifiedGeneralGradeRejection } from "../lib/suneung-general-review.js";

const courseId = "suneung-2028-second-vietnamese";
const course = SUNEUNG_COURSES[courseId];
const questionReview = "general_2028_question_review";
const turnReview = "general_2028_turn_review";
const validTurn = { question_valid: true, feedback_valid: true, reason: "none" };
const solved = correct_choice => ({ valid: true, correct_choice, reason: "none" });
const question = (number = 1) => `문제 ${number}/10 — 개념 · 베트남어 · 의문문 어순 · 5지선다형
다음 중 '이것은 누구의 책입니까?'를 문법과 어순에 맞게 표현한 문장은?
A) Đây là sách của ai?
B) Đây của ai sách là?
C) Sách ai đây của là?
D) Ai sách là của đây?
E) Là sách đây ai của?
답: (________)`;
const record = (outcome = "correct", attempts = 1) => `[GEM_RECORD]{"question":1,"stage":"개념","topic":"의문문 어순","scope":"direct","outcome":"${outcome}","attempts":${attempts},"weakType":"의문문 어순"}[/GEM_RECORD]`;
const graded = (outcome = "correct", attempts = 1) => `${outcome === "correct" ? "정답입니다." : "세 번 도전했습니다."} 문장의 목적에 맞는 어순을 확인했습니다.\n${record(outcome, attempts)}\n\n${question(2)}`;

function room(id = courseId, initial = []) {
  const courseRunId = "quality-review-synthetic-run";
  const token = createSessionToken({ id: "REVIEW_TEST", name: "합성 검증", session: "review-test", courseId: id, courseRunId });
  const messages = [...initial];
  return { messages, async ask(content) {
    messages.push({ role: "user", content });
    const response = { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; },
      setHeader() {}, end(value) { this.payload = JSON.parse(value); } };
    await chatHandler({ method: "POST", headers: { cookie: `${SESSION_COOKIE}=${token}` },
      body: { courseId: id, courseRunId, lessonSeed: courseRunId, messages, inputMode: "text" } }, response);
    if (response.statusCode === 200) messages.push({ role: "assistant", content: response.payload.text });
    return response;
  } };
}

async function withProvider(queue, callback) {
  const savedFetch = globalThis.fetch, savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-review-test-key";
  const requests = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body), next = queue.shift();
    assert.ok(next, "unexpected model request");
    assert.equal(body.text?.format?.name || "generate", next.schema);
    requests.push({ body, signal: options.signal });
    return { ok: !next.status || next.status === 200, status: next.status || 200,
      json: async () => next.status && next.status !== 200 ? { error: { code: "rate_limit_exceeded" } }
        : { status: next.incomplete ? "incomplete" : "completed", ...(next.refusal
          ? { output: [{ content: [{ type: "refusal", refusal: "declined" }] }] }
          : { output_text: next.text ?? JSON.stringify(next.verdict) }) } };
  };
  try { await callback(requests); assert.equal(queue.length, 0); }
  finally { globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey; }
}

test("semantic review is scoped to all 13 2028 general classrooms, excluding every 2027/math/science course", async () => {
  const selected = Object.entries(SUNEUNG_COURSES).filter(([, value]) => isReviewedGeneralSuneungCourse(value));
  assert.equal(selected.length, 13);
  assert.ok(selected.every(([id]) => id.startsWith("suneung-2028-") && !/math|science/.test(id)));
  for (const [id, value] of Object.entries(SUNEUNG_COURSES)) {
    if (/2027|math|science/.test(id)) assert.equal(isReviewedGeneralSuneungCourse(value), false, id);
  }
  await withProvider([{ schema: "generate", text: question() }], async requests => {
    const response = await room("suneung-2027-second-vietnamese").ask("시작");
    assert.equal(response.statusCode, 200);
    assert.equal(requests.length, 1);
  });
});

test("independent solving withholds the student choice and prior teacher grading, and permits intentional word-order distractors", async () => {
  await withProvider([{ schema: questionReview, verdict: solved("A") }], async requests => {
    assert.equal(await solveGeneralSuneungQuestion({ course, questionText: question(), apiKey: "synthetic", signal: AbortSignal.timeout(1000) }), "A");
    const body = requests[0].body, context = JSON.parse(body.input[0].content);
    assert.deepEqual(Object.keys(context).sort(), ["course", "question"]);
    assert.equal(context.question, question());
    assert.match(body.instructions, /오답 보기는 의도적으로 틀린/);
    assert.match(body.instructions, /어순 배열/);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.additionalProperties, false);
  });
});

test("a question rejected for missing context, ambiguity, false facts or language mistakes is regenerated before display", async () => {
  for (const reason of ["missing_context", "ambiguous_answer", "no_correct_answer", "factual_error", "language_error"]) {
    const broken = question().replace("의문문 어순", `검토 오류 ${reason}`);
    await withProvider([
      { schema: "generate", text: broken },
      { schema: turnReview, verdict: { question_valid: false, feedback_valid: true, reason } },
      { schema: "generate", text: question() },
      { schema: turnReview, verdict: validTurn }
    ], async requests => {
      const response = await room().ask("시작");
      assert.equal(response.statusCode, 200);
      assert.equal(response.payload.text, question());
      assert.equal(response.payload.record, undefined);
      assert.match(requests[2].body.instructions, new RegExp(reason));
      assert.ok(requests.every(request => request.signal === requests[0].signal), "one deadline bounds all retries/reviews");
    });
  }
});

test("factual or unresponsive help is reviewed against full question and actual learner request without consuming an attempt", async () => {
  await withProvider([
    { schema: "generate", text: "ai는 책이라는 뜻입니다." },
    { schema: turnReview, verdict: { question_valid: true, feedback_valid: false, reason: "incorrect_explanation" } },
    { schema: "generate", text: "ai는 사람을 물을 때 쓰는 말로, 한국어의 ‘누구’에 해당해요." },
    { schema: turnReview, verdict: validTurn }
  ], async requests => {
    const response = await room(courseId, [{ role: "assistant", content: question() }]).ask("ai는 무슨 뜻인가요?");
    assert.equal(response.statusCode, 200);
    assert.match(response.payload.text, /누구/);
    assert.equal(response.payload.record, undefined);
    const context = JSON.parse(requests[1].body.input[0].content);
    assert.equal(context.current_question, question());
    assert.equal(context.conversation.at(-1).content, "ai는 무슨 뜻인가요?");
    assert.equal(context.new_question, null);
    assert.equal(context.record, null);
  });
});

test("independently verified E cannot be marked wrong; correct grading advances only after the new question is reviewed", async () => {
  await withProvider([
    { schema: questionReview, verdict: solved("E") },
    { schema: "generate", text: "도전 1/3\n어순을 다시 살펴보세요.\n답: (________)" },
    { schema: "generate", text: graded() },
    { schema: turnReview, verdict: validTurn }
  ], async requests => {
    const correctE = question().replace("A) Đây là sách của ai?", "A) Là sách đây ai của?")
      .replace("E) Là sách đây ai của?", "E) Đây là sách của ai?");
    const response = await room(courseId, [{ role: "assistant", content: correctE }]).ask("E");
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.record.outcome, "correct");
    assert.match(response.payload.text, /문제 2\/10/);
    assert.match(requests[2].body.instructions, /incorrect_grade/);
    assert.equal(response.payload.correct_choice, undefined);
    const context = JSON.parse(requests[3].body.input[0].content);
    assert.equal(context.correct_choice, "E");
    assert.equal(context.new_question, question(2));
    assert.doesNotMatch(context.feedback, /문제 2\/10/);
  });
});

test("wrong answers cannot acquire correct records and third attempts must finalize incorrect", async () => {
  for (const previousAttempts of [0, 2]) {
    const initial = [{ role: "assistant", content: question() }];
    if (previousAttempts) initial.push({ role: "assistant", content: "도전 2/3\n문장 구조를 살펴보세요." });
    const fixed = previousAttempts ? graded("incorrect", 3) : "도전 1/3\n의문사가 어느 자리에 오는지 생각해 보세요.\n답: (________)";
    await withProvider([
      { schema: questionReview, verdict: solved("A") },
      { schema: "generate", text: graded("correct", previousAttempts + 1) },
      { schema: "generate", text: fixed },
      { schema: turnReview, verdict: validTurn }
    ], async () => {
      const response = await room(courseId, initial).ask("E");
      assert.equal(response.statusCode, 200);
      assert.equal(response.payload.record?.outcome, previousAttempts ? "incorrect" : undefined);
      if (!previousAttempts) assert.doesNotMatch(response.payload.text, /문제 2\/10/);
    });
  }
});

test("a reviewer outage never releases the unreviewed draft or a learning record", async () => {
  await withProvider([{ schema: "generate", text: question() }, { schema: turnReview, status: 429 }], async () => {
    const response = await room().ask("시작");
    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.text, undefined);
    assert.equal(response.payload.record, undefined);
    assert.match(response.payload.error, /정확성/);
  });
});

test("malformed, incomplete, refusal and inconsistent verdicts fail closed", async () => {
  for (const result of [
    { verdict: { ...solved("A"), unexpected: true } }, { verdict: { valid: "true", correct_choice: "A", reason: "none" } },
    { text: "not json" }, { verdict: solved("A"), incomplete: true }, { refusal: true },
    { verdict: solved("none") }, { verdict: { valid: false, correct_choice: "A", reason: "ambiguous_answer" } }
  ]) await withProvider([{ schema: questionReview, ...result }], async () => {
    await assert.rejects(solveGeneralSuneungQuestion({ course, questionText: question(), apiKey: "synthetic" }), GeneralSuneungReviewError);
  });
  await withProvider([{ schema: turnReview, verdict: { question_valid: true, feedback_valid: false, reason: "none" } }], async () => {
    assert.equal(await reviewGeneralSuneungTurn({ course, currentQuestion: question(), messages: [], text: "설명", intent: "help", previousAttempts: 0, apiKey: "synthetic" }), "incorrect_explanation");
  });
  assert.equal(verifiedGeneralGradeRejection({ intent: "answer", choice: "A", correctChoice: null }), "independent_answer_missing");
});
