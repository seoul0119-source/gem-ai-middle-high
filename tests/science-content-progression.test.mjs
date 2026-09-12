import assert from "node:assert/strict";
import test from "node:test";
import chatHandler from "../api/chat-final.js";
import { createSessionToken, readStudentSession, SESSION_COOKIE } from "../lib/student-session.js";
import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { verifyScienceReplyProof } from "../lib/science-reply-proof.js";

const COURSE_ID = "suneung-2028-integrated-science";
// Reproduces the learner's reported 2.9 cm to 9.3 cm ruler question exactly.
const RULER_RUN = "science-v2:numeric-content-1448123";
const EXPLANATION = "물체의 길이는 양 끝 사이의 거리입니다. 자의 큰 눈금값에서 작은 눈금값을 빼서 구할 수 있어요. 길이를 쓸 때에는 문제에 주어진 단위도 함께 적어 주세요.";

function responseCapture() {
  return {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    end(body) { this.payload = JSON.parse(String(body)); }
  };
}

async function withTeacher(callback) {
  const saved = { fetch: globalThis.fetch, key: process.env.OPENAI_API_KEY };
  process.env.OPENAI_API_KEY = "science-content-progression-test-key";
  const requests = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    requests.push(body);
    const format = body.text?.format?.name;
    assert.ok(["science_tutor_reply", "science_tutor_review"].includes(format));
    const value = format === "science_tutor_reply"
      ? { reply: EXPLANATION } : { allowed_scope: true, valid_tutoring: true };
    return { ok: true, status: 200,
      json: async () => ({ status: "completed", output_text: JSON.stringify(value) }) };
  };
  try { await callback(requests); }
  finally {
    globalThis.fetch = saved.fetch;
    if (saved.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved.key;
  }
}

function classroom(courseRunId = RULER_RUN) {
  const engine = createScienceLessonEngine(courseRunId);
  const token = createSessionToken({
    id: "CONTENT_TEST", name: "수치 답안 테스트", session: "science-content-test",
    courseId: COURSE_ID, courseRunId, startedAt: new Date().toISOString(), endedAt: null
  });
  const headers = { cookie: `${SESSION_COOKIE}=${token}` };
  const student = readStudentSession({ headers });
  const messages = [];
  const profile = { lessonRecords: [] };
  return { engine, student, messages, profile,
    async ask(content, inputMode = "text") {
      messages.push({ role: "user", content });
      const response = responseCapture();
      await chatHandler({ method: "POST", headers,
        body: { courseId: COURSE_ID, courseRunId, messages, inputMode, learningProfile: profile }
      }, response);
      assert.equal(response.statusCode, 200, JSON.stringify(response.payload));
      messages.push({ role: "assistant", content: response.payload.text,
        scienceReplyProof: response.payload.scienceReplyProof });
      if (response.payload.record) profile.lessonRecords.push(response.payload.record);
      return response.payload;
    }
  };
}

function assertPosition(room, reply, questionNumber, attempt) {
  assert.deepEqual(verifyScienceReplyProof({ student: room.student, text: reply.text,
    proof: reply.scienceReplyProof }), { questionNumber, attempt });
  assert.equal(reply.record, undefined);
}

test("a spoken numeric answer after signed AI help grades question one and displays question two", async () => {
  await withTeacher(async requests => {
    const room = classroom();
    assert.match(room.engine.questions[0].stem, /2\.9 cm[\s\S]*9\.3 cm/);
    assert.equal(room.engine.questions[0].choices[0], "6.4 cm");
    const first = await room.ask("시작");
    assert.match(first.text, /문제 1\/10/);
    assert.equal(requests.length, 0);

    const help = await room.ask("물체의 길이를 어떻게 구하나요?", "voice");
    assertPosition(room, help, 1, 1);
    assert.equal(requests.length, 2, "the explanation and its review use the AI teacher");

    const answered = await room.ask("정답은 6.4cm입니다.", "voice");
    assert.equal(answered.record?.outcome, "correct");
    assert.equal(answered.record?.question, 1);
    assert.equal(answered.record?.attempts, 1);
    assert.match(answered.text, /문제 2\/10/);
    assert.equal(room.profile.lessonRecords.length, 1);
    assert.equal(requests.length, 2, "grading must not be sent back to the explanation-only AI");

    const next = await room.ask(room.engine.questions[1].answer);
    assert.equal(next.record?.question, 2);
    assert.equal(next.record?.outcome, "correct");
    assert.match(next.text, /문제 3\/10/);
    assert.equal(requests.length, 2);
  });
});

test("a clear answer-confirmation phrase is graded after the AI explanation", async () => {
  await withTeacher(async requests => {
    const room = classroom();
    await room.ask("시작");
    assertPosition(room, await room.ask("자의 눈금이 무엇인가요?"), 1, 1);
    const callsBeforeAnswer = requests.length;
    const result = await room.ask("6.4cm가 맞습니까?", "voice");
    assert.equal(result.record?.outcome, "correct");
    assert.equal(result.record?.attempts, 1);
    assert.equal(result.record?.question, 1);
    assert.match(result.text, /문제 2\/10/);
    assert.equal(requests.length, callsBeforeAnswer);
  });
});

test("numeric wrong answers outside the choices count attempts while AI help preserves the attempt", async () => {
  await withTeacher(async requests => {
    const room = classroom();
    await room.ask("시작");
    const firstWrong = await room.ask("정답은 999cm입니다.", "voice");
    assert.match(firstWrong.text, /도전 2\/3/);
    assert.equal(firstWrong.record, undefined);
    assert.equal(requests.length, 0);

    assertPosition(room, await room.ask("힌트 주세요.", "voice"), 1, 2);
    const callsBeforeAnswer = requests.length;
    const secondWrong = await room.ask("988 cm입니다");
    assert.match(secondWrong.text, /도전 3\/3/);
    assert.equal(secondWrong.record, undefined);

    assertPosition(room, await room.ask("더 쉽게 설명해 주세요."), 1, 3);
    const finalWrong = await room.ask("정답은 277cm입니다.");
    assert.equal(finalWrong.record?.question, 1);
    assert.equal(finalWrong.record?.outcome, "incorrect");
    assert.equal(finalWrong.record?.attempts, 3);
    assert.match(finalWrong.text, /문제 2\/10/);
    assert.equal(requests.length, callsBeforeAnswer + 2, "only the second explanation requests AI again");
  });
});

test("a number mentioned within a conceptual question remains conversation instead of an answer", async () => {
  await withTeacher(async requests => {
    const room = classroom();
    await room.ask("시작");
    const questions = [
      "6.4cm는 몇 mm인가요?",
      "6.4cm를 구하는 방법을 설명해 주세요.",
      "6.4cm가 정답인 이유를 설명해 주세요."
    ];
    for (const question of questions) assertPosition(room, await room.ask(question, "voice"), 1, 1);
    assert.equal(room.profile.lessonRecords.length, 0);
    assert.equal(requests.length, questions.length * 2);
    assert.deepEqual(requests.filter(request => request.text.format.name === "science_tutor_reply")
      .map(request => request.input.at(-1).content), questions);
  });
});

test("a mismatched unit is a wrong answer, not a correct number or an AI-only conversation", async () => {
  await withTeacher(async requests => {
    const room = classroom();
    await room.ask("시작");
    const result = await room.ask("정답은 6.4kg입니다.");
    assert.equal(result.record, undefined);
    assert.match(result.text, /도전 2\/3/);
    assert.equal(requests.length, 0);
  });
});

test("explicit E aliases still grade normally and ambiguous spoken two does not consume an attempt", async () => {
  await withTeacher(async requests => {
    let seed;
    for (let run = 0; run < 200; run += 1) {
      const candidate = `science-v2:content-e-${run}`;
      if (createScienceLessonEngine(candidate).questions[0].answer === "E") { seed = candidate; break; }
    }
    assert.ok(seed);
    for (const answer of ["알파벳 이", "5번입니다"]) {
      const room = classroom(seed);
      await room.ask("시작");
      const ambiguous = await room.ask("2번입니다", "voice");
      assert.equal(ambiguous.record, undefined);
      assert.match(ambiguous.text, /음성 답안 확인[\s\S]*도전 1\/3/);
      const result = await room.ask(answer, "voice");
      assert.equal(result.record?.question, 1);
      assert.equal(result.record?.outcome, "correct");
      assert.equal(result.record?.attempts, 1);
      assert.match(result.text, /문제 2\/10/);
    }
    assert.equal(requests.length, 0);
  });
});
