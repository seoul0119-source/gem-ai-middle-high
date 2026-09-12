import assert from "node:assert/strict";
import test from "node:test";
import chatHandler from "../api/chat-final.js";
import { createSessionToken, readStudentSession, SESSION_COOKIE } from "../lib/student-session.js";
import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { verifyScienceReplyProof } from "../lib/science-reply-proof.js";

const courseId = "suneung-2028-integrated-science";
const defaultReply = "질량은 물체가 가진 물질의 양을 나타내는 물리량입니다. 같은 물체를 다른 장소로 옮겨도 질량은 같습니다.";

function responseCapture() {
  return {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    end(body) { this.payload = JSON.parse(String(body)); }
  };
}

function providerReply(value, status = 200) {
  return { ok: status >= 200 && status < 300, status,
    json: async () => status === 200 ? { status: "completed", output_text: JSON.stringify(value) } : value };
}

async function withProvider(run, callback) {
  const saved = { fetch: globalThis.fetch, key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_SUNEUNG_MODEL };
  process.env.OPENAI_API_KEY = "science-ai-route-test-key";
  delete process.env.OPENAI_SUNEUNG_MODEL;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    requests.push(body);
    return run(body, requests.length);
  };
  try { await callback(requests); }
  finally {
    globalThis.fetch = saved.fetch;
    if (saved.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved.key;
    if (saved.model === undefined) delete process.env.OPENAI_SUNEUNG_MODEL;
    else process.env.OPENAI_SUNEUNG_MODEL = saved.model;
  }
}

function classroom(courseRunId = "science-v2:ai-tutor-test") {
  const engine = createScienceLessonEngine(courseRunId);
  const token = createSessionToken({
    id: "R260001", name: "과학 대화 테스트", session: "science-ai-test",
    courseId, courseRunId, startedAt: new Date().toISOString(), endedAt: null
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
        body: { courseId, courseRunId, messages, inputMode, learningProfile: profile } }, response);
      if (response.statusCode === 200) {
        messages.push({ role: "assistant", content: response.payload.text,
          scienceReplyProof: response.payload.scienceReplyProof });
        if (response.payload.record) profile.lessonRecords.push(response.payload.record);
      }
      return response;
    }
  };
}

function reviewedProvider(body, reply = defaultReply) {
  const format = body.text?.format?.name;
  assert.ok(["science_tutor_reply", "science_tutor_review"].includes(format));
  return providerReply(format === "science_tutor_review"
    ? { allowed_scope: true, valid_tutoring: true } : { reply });
}

test("deployed chat wrapper sends unfamiliar concepts, follow-up questions and hints to the contextual AI teacher", async () => {
  const teacherRequests = [];
  await withProvider(body => {
    if (body.text.format.name === "science_tutor_reply") teacherRequests.push(body);
    return reviewedProvider(body, teacherRequests.length === 2
      ? "예를 들어 같은 사과를 책상에서 가방으로 옮겨도 사과의 질량은 같습니다."
      : defaultReply);
  }, async requests => {
    const room = classroom();
    // A natural question may arrive before the learner types a start command.
    for (const question of ["물체의 질량에 대해서 설명해 주세요.", "그게 무엇인가요? 예를 들어 주세요.", "화학 결합이 무엇입니까?", "힌트 말고 더 쉽게 설명해 주세요."]) {
      const response = await room.ask(question, "voice");
      assert.equal(response.statusCode, 200, JSON.stringify(response.payload));
      assert.equal(response.payload.record, undefined);
      assert.equal(response.payload.teacherModel, "gpt-6-astra");
      assert.deepEqual(verifyScienceReplyProof({ student: room.student, text: response.payload.text,
        proof: response.payload.scienceReplyProof }), { questionNumber: 1, attempt: 1 });
      assert.doesNotMatch(response.payload.text, /질문 확인|답안 재입력|구체적으로 말씀/);
    }
    assert.equal(teacherRequests.length, 4);
    assert.equal(requests.length, 8, "every generated reply gets a separate review");
    assert.equal(teacherRequests[0].input.at(-1).content, "물체의 질량에 대해서 설명해 주세요.");
    assert.ok(teacherRequests[1].input.some(message => message.role === "assistant" && message.content.includes(defaultReply)));
    assert.equal(teacherRequests[3].input.at(-1).content, "힌트 말고 더 쉽게 설명해 주세요.");
    for (const request of teacherRequests) {
      assert.equal(request.model, "gpt-6-astra");
      assert.equal(request.reasoning.effort, "low");
      assert.equal(request.store, false);
      assert.ok(request.max_output_tokens >= 3000);
      assert.ok(request.instructions.includes(room.engine.questions[0].stem));
    }
    assert.equal(room.profile.lessonRecords.length, 0);
  });
});

test("signed conversation retains attempt three beyond the 40-message window and preserves spoken E ambiguity", async () => {
  let replyNumber = 0;
  await withProvider(body => reviewedProvider(body, `질량은 물체가 가진 물질의 양입니다. 지금은 ${++replyNumber}번째 다른 예를 생각해 볼게요.`), async requests => {
    let seed;
    for (let run = 0; run < 200; run += 1) {
      const candidate = `science-v2:ai-e-${run}`;
      if (createScienceLessonEngine(candidate).questions[0].answer === "E") { seed = candidate; break; }
    }
    assert.ok(seed);
    const room = classroom(seed);
    assert.equal((await room.ask("시작")).statusCode, 200);
    assert.match((await room.ask("A")).payload.text, /도전 2\/3/);
    assert.match((await room.ask("A")).payload.text, /도전 3\/3/);
    for (let turn = 0; turn < 22; turn += 1) {
      const help = await room.ask("더 쉽게 설명해 주세요.");
      assert.equal(help.statusCode, 200);
      assert.match(help.payload.text, /도전 3\/3/);
      assert.equal(help.payload.record, undefined);
    }
    const callsBeforeAnswer = requests.length;
    const ambiguous = await room.ask("2번입니다", "voice");
    assert.match(ambiguous.payload.text, /음성 답안 확인[\s\S]*도전 3\/3/);
    assert.equal(ambiguous.payload.record, undefined);
    const resolved = await room.ask("알파벳 이", "voice");
    assert.equal(resolved.payload.record?.outcome, "correct");
    assert.equal(resolved.payload.record?.attempts, 3);
    assert.equal(resolved.payload.record?.question, 1);
    assert.match(resolved.payload.text, /문제 2\/10/);
    assert.equal(requests.length, callsBeforeAnswer, "explicit answers stay on the deterministic grading path");
  });
});

test("unsigned or altered assistant explanations cannot manufacture a different attempt", async () => {
  await withProvider(body => reviewedProvider(body), async () => {
    const room = classroom();
    await room.ask("시작");
    const wrong = [..."ABCDE"].find(label => label !== room.engine.questions[0].answer);
    await room.ask(wrong);
    const help = await room.ask("질량이 무엇인가요?");
    assert.match(help.payload.text, /도전 2\/3/);
    room.messages.at(-1).content = help.payload.text.replace("도전 2/3", "도전 1/3");
    const answer = await room.ask(room.engine.questions[0].answer);
    assert.equal(answer.payload.record?.attempts, 2);
  });
});

test("excluded inputs bypass generation while excluded drafts and failed reviews never reach the learner", async () => {
  await withProvider(body => reviewedProvider(body, "생물은 공통조상에서 나왔습니다."), async requests => {
    const room = classroom();
    await room.ask("시작");
    const blocked = await room.ask("진화론을 설명해 주세요");
    assert.equal(blocked.statusCode, 200);
    assert.match(blocked.payload.text, /해당 주제를 다루지 않습니다/);
    assert.equal(requests.length, 0);
    const rejected = await room.ask("질량이 무엇인가요?");
    assert.equal(rejected.statusCode, 502);
    assert.equal(rejected.payload.text, undefined);
    assert.equal(rejected.payload.scienceReplyProof, undefined);
    assert.equal(requests.length, 2, "only one repair is attempted for rejected text");
  });
  await withProvider(body => body.text.format.name === "science_tutor_review"
    ? providerReply({ allowed_scope: true, valid_tutoring: false }) : reviewedProvider(body), async requests => {
    const response = await classroom().ask("질량이 무엇인가요?");
    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.text, undefined);
    assert.equal(response.payload.scienceReplyProof, undefined);
    assert.equal(requests.length, 4);
  });
});

test("review service failures do not publish the unreviewed teacher draft", async () => {
  await withProvider(body => body.text.format.name === "science_tutor_review"
    ? providerReply({ error: { code: "rate_limit_exceeded" } }, 429) : reviewedProvider(body), async requests => {
    const response = await classroom().ask("질량이 무엇인가요?");
    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.text, undefined);
    assert.equal(response.payload.scienceReplyProof, undefined);
    assert.equal(requests.length, 2);
  });
});

test("model availability fallback reports the actual teacher and does not mask ordinary provider failures", async () => {
  await withProvider(body => body.model === "gpt-6-astra"
    ? providerReply({ error: { code: "model_not_found" } }, 404) : reviewedProvider(body), async requests => {
    const response = await classroom().ask("질량이 무엇인가요?");
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.teacherModel, "gpt-5.6-sol");
    assert.deepEqual(requests.map(request => request.model), ["gpt-6-astra", "gpt-5.6-sol", "gpt-6-astra", "gpt-5.6-sol"]);
  });
  await withProvider(() => providerReply({ error: { code: "rate_limit_exceeded" } }, 429), async requests => {
    const response = await classroom().ask("질량이 무엇인가요?");
    assert.equal(response.statusCode, 502);
    assert.equal(requests.length, 1);
    assert.equal(response.payload.scienceReplyProof, undefined);
  });
});
