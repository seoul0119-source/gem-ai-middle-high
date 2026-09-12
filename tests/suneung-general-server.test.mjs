import assert from "node:assert/strict";
import test from "node:test";
import chatHandler from "../api/chat-final.js";
import { SUNEUNG_COURSES } from "../api/suneung-courses.js";
import { buildSuneungSessionPlan, sanitizeLearningProfile } from "../api/chat.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";
import { classifyGeneralSuneungInput, isGeneralSuneungCourse, normalizeGeneralProblem,
  normalizeGeneralSuneungDisplay, validateGeneralSuneungTurn } from "../lib/suneung-general-flow.js";

const generalCourses = Object.entries(SUNEUNG_COURSES).filter(([, course]) => isGeneralSuneungCourse(course));
const subjectTopics = {
  korean: "청중 분석과 발표 계획", english: "문맥을 통한 추론", history: "조선 후기 사회 변화",
  social: "시장 균형과 자원 배분", "second-language": "인사와 자기소개"
};
const stage = number => number <= 3 ? "개념" : number <= 7 ? "자료 분석" : "실전";
function question(number, topic = "청중 분석과 발표 계획", extra = "") {
  return `문제 ${number}/10 — ${stage(number)} · ${topic} · 5지선다형\n${extra}제시된 자료 ${number}에서 가장 적절한 판단은?\nA) 근거 없이 단정한다.\nB) 맥락을 무시한다.\nC) 자료와 맥락을 살핀다.\nD) 비교를 하지 않는다.\nE) 조건을 모두 생략한다.\n\n답: (________)`;
}
function graded(number, { topic = "청중 분석과 발표 계획", attempts = 1, outcome = "correct" } = {}) {
  const record = { question: number, stage: stage(number), topic, scope: "direct", attempts, outcome, weakType: attempts > 1 ? topic : "" };
  return `${outcome === "correct" ? "정답입니다." : "세 번째 시도를 마쳤습니다. 정답은 C입니다."} 자료와 맥락을 살피는 것이 중요합니다.\n[GEM_RECORD]${JSON.stringify(record)}[/GEM_RECORD]\n\n${number === 10 ? "이번 학습을 마쳤습니다. 핵심 내용을 복습해 보세요." : question(number + 1, topic)}`;
}
function responseCapture() {
  return { statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; }, setHeader() { return this; },
    end(value) { this.payload = JSON.parse(value); } };
}
async function withProvider(callback) {
  const savedFetch = globalThis.fetch;
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "general-csat-server-regression-key";
  const queue = [], requests = [], reviewRequests = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    // These tests exercise flow and formatting. Independent semantic judgments
    // are explicit model fixtures; adversarial verdicts are tested separately.
    const schema = body.text?.format?.name;
    if (schema === "general_2028_question_review" || schema === "general_2028_turn_review") {
      reviewRequests.push(body);
      const verdict = schema === "general_2028_question_review"
        ? { valid: true, correct_choice: "C", reason: "none" }
        : { question_valid: true, feedback_valid: true, reason: "none" };
      return { ok: true, status: 200, json: async () => ({ status: "completed", output_text: JSON.stringify(verdict) }) };
    }
    requests.push(body);
    assert.ok(queue.length, `unexpected extra AI call: ${body.input.at(-1)?.content}`);
    const reply = queue.shift();
    const status = reply.status || 200;
    return { ok: status === 200, status, json: async () => status === 200
      ? { status: reply.incomplete ? "incomplete" : "completed", ...(reply.nested
        ? { output: [{ type: "reasoning", summary: [] }, { type: "message", role: "assistant", content: [{ type: "output_text", text: reply.text }] }] }
        : { output_text: reply.text }) }
      : { error: { code: reply.code || "rate_limit_exceeded" } } };
  };
  try { await callback({ queue, requests, reviewRequests }); }
  finally { globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey; }
}
function classroom(courseId) {
  const courseRunId = "general-csat-regression-run";
  const token = createSessionToken({ id: "TEST", name: "회귀 검사", session: "test-session", courseId, courseRunId, startedAt: new Date().toISOString() });
  const messages = [], profile = { lessonRecords: [] }, history = [];
  return { messages, profile, history, async ask(content, inputMode = "text") {
    messages.push({ role: "user", content });
    const response = responseCapture();
    await chatHandler({ method: "POST", headers: { cookie: `${SESSION_COOKIE}=${token}` },
      body: { courseId, courseRunId, lessonSeed: courseRunId, messages, learningProfile: profile, history, inputMode } }, response);
    if (response.statusCode === 200) {
      messages.push({ role: "assistant", content: response.payload.text });
      if (response.payload.record) profile.lessonRecords.push(response.payload.record);
    }
    return response;
  } };
}

test("all 35 general CSAT classrooms complete the deployed wrapper flow: start, repeated help, wrong answers, correct-next, 10 records", async () => {
  assert.equal(generalCourses.length, 35);
  await withProvider(async ({ queue, requests }) => {
    for (const [courseId, course] of generalCourses) {
      const topic = subjectTopics[course.suneung.subject] || "지역의 공간적 특징";
      const room = classroom(courseId);
      const ask = async (input, output, expectedRecord = false) => {
        queue.push({ text: output });
        const before = requests.length;
        const response = await room.ask(input);
        assert.equal(response.statusCode, 200, `${courseId}: ${JSON.stringify(response.payload)}`);
        assert.equal(requests.length, before + 1, `${courseId}: no hidden wrapper retries`);
        assert.equal(Boolean(response.payload.record), expectedRecord);
        return response;
      };
      await ask("시작", question(1, topic));
      for (const [input, output] of [
        ["힌트 주세요.", "자료를 읽는 대상이 어떤 지식을 갖고 있는지 먼저 생각해 보세요."],
        ["토양 관리라는 게 무엇인가요?", "토양 관리는 식물이 잘 자라도록 흙의 물과 양분 상태를 돌보는 일입니다."],
        ["다시 더 쉽게 설명해 주세요.", "화분의 흙이 말랐는지 살피고 필요한 만큼 물을 주는 모습을 떠올려 보세요."]
      ]) await ask(input, output);
      await ask("A", "도전 1/3\n자료에 있는 단서를 먼저 찾아보세요.\n답: (________)");
      await ask("왜 그런가요?", "판단의 근거가 자료에 실제로 있는지 비교하는 연습이 필요하기 때문이에요.");
      await ask("B", "도전 2/3\n자료와 상황을 함께 확인해 보세요.\n답: (________)");
      await ask("힌트 하나 더 주세요.", "질문에 주어진 상황과 선택지의 행동이 서로 어울리는지 확인해 보세요.");
      const q1 = await ask("답은 c 입니다", graded(1, { topic, attempts: 3 }), true);
      assert.match(q1.payload.text, /문제 2\/10/);
      assert.equal(q1.payload.record.attempts, 3);
      await ask("A", "도전 1/3\n자료의 핵심 단서를 확인해 보세요.\n답: (________)");
      await ask("B", "도전 2/3\n선택지와 조건을 함께 살펴보세요.\n답: (________)");
      const q2 = await ask("D", graded(2, { topic, attempts: 3, outcome: "incorrect" }), true);
      assert.equal(q2.payload.record.outcome, "incorrect");
      for (let number = 3; number <= 10; number += 1) await ask("C입니다", graded(number, { topic }), true);
      assert.equal(room.profile.lessonRecords.length, 10, courseId);
      assert.deepEqual(room.profile.lessonRecords.map(record => record.question), [1,2,3,4,5,6,7,8,9,10]);
      const completed = await room.ask("C");
      assert.equal(completed.statusCode, 200);
      assert.match(completed.payload.text, /10문제를 모두 마쳤/);
      assert.equal(completed.payload.record, undefined);
      const normalized = sanitizeLearningProfile(room.profile, buildSuneungSessionPlan(course, "test"), course);
      assert.equal(normalized.lessonRecords.length, 10, `${courseId}: subtopic records survive`);
      assert.equal(normalized.lessonRecords[0].topic, topic);
    }
    assert.equal(queue.length, 0);
  });
});

test("voice E/2 ambiguity never grades while explicit A-E and Korean polite submissions are recognized", async () => {
  for (const value of ["E", "답은 E입니다", "알파벳 이", "5번입니다", "오번입니다", "정답은 오 번입니다", "답은 E일 것 같아요"]) {
    assert.deepEqual(classifyGeneralSuneungInput(value, { inputMode: "voice" }), { intent: "answer", choice: "E" });
  }
  for (const value of ["삼번", "정답은 씨라고 생각합니다"]) {
    assert.deepEqual(classifyGeneralSuneungInput(value, { inputMode: "voice" }), { intent: "answer", choice: "C" });
  }
  assert.deepEqual(classifyGeneralSuneungInput("2", { inputMode: "text" }), { intent: "answer", choice: "B" });
  for (const value of ["C는 무슨 뜻인가요?", "E를 설명해 주세요", "힌트 주세요"]) {
    assert.equal(classifyGeneralSuneungInput(value).intent, "help");
  }
  assert.deepEqual(classifyGeneralSuneungInput("설명의 의미를 파악한다.", {
    questionText: question(1).replace("자료와 맥락을 살핀다.", "설명의 의미를 파악한다.")
  }), { intent: "answer", choice: "C" }, "a complete choice is an answer even when it contains a help keyword");
  assert.deepEqual(classifyGeneralSuneungInput("답은 존댓말입니다.", {
    questionText: question(1).replace("자료와 맥락을 살핀다.", "존댓말입니다.")
  }), { intent: "answer", choice: "C" });
  await withProvider(async ({ queue, requests }) => {
    const room = classroom(generalCourses[0][0]);
    queue.push({ text: question(1) });
    await room.ask("시작");
    for (const content of ["2", "이", "2번입니다", "답은 이입니다"]) {
      const response = await room.ask(content, "voice");
      assert.equal(response.payload.pendingChoice, true);
      assert.equal(response.payload.record, undefined);
    }
    assert.equal(requests.length, 1);
    queue.push({ text: graded(1) });
    const response = await room.ask("알파벳 이", "voice");
    assert.equal(response.payload.record?.attempts, 1);
    assert.match(requests.at(-1).instructions, /명확히 선택한 답은 E/);
  });
});

test("long general passages preserve D/E and repeated explanations preserve the question and prior attempts", async () => {
  await withProvider(async ({ queue, requests }) => {
    const room = classroom("suneung-2027-korean-speech-writing");
    const longQuestion = question(1, "청중 분석과 발표 계획", "지문의 맥락을 확인합니다. ".repeat(320));
    queue.push({ text: longQuestion });
    await room.ask("시작");
    queue.push({ text: "도전 1/3\n상황을 다시 비교해 보세요.\n답: (________)" });
    await room.ask("A");
    for (let index = 0; index < 24; index += 1) {
      queue.push({ text: `자료를 읽을 때 ${index + 1}번째 관점을 생각해 볼게요. 서로 다른 조건을 하나씩 살펴보세요.` });
      assert.equal((await room.ask("조금 더 쉽게 설명해 주세요.")).statusCode, 200);
    }
    queue.push({ text: graded(1, { attempts: 2 }) });
    const answer = await room.ask("C");
    assert.equal(answer.payload.record?.attempts, 2);
    assert.ok(requests.at(-1).input.some(message => message.content === longQuestion));
    assert.ok(requests.at(-1).input.some(message => /도전 1\/3/.test(message.content)));
  });
});

test("help cannot consume records and correct feedback cannot strand the student on the same problem", async () => {
  await withProvider(async ({ queue, requests }) => {
    const room = classroom("suneung-2028-english");
    queue.push({ text: question(1) });
    await room.ask("시작");
    queue.push({ text: graded(1) }, { text: "이 문맥에서는 먼저 앞뒤 문장의 관계를 살펴보면 도움이 됩니다." });
    const help = await room.ask("이 단어는 무슨 뜻인가요?");
    assert.equal(help.statusCode, 200);
    assert.equal(help.payload.record, undefined);
    assert.doesNotMatch(help.payload.text, /답: \(/);
    assert.match(requests.at(-1).instructions, /help_changed_question/);
    queue.push({ text: "정답입니다. 잘했습니다." }, { text: graded(1) });
    const answer = await room.ask("C");
    assert.equal(answer.statusCode, 200);
    assert.equal(answer.payload.record?.question, 1);
    assert.match(answer.payload.text, /문제 2\/10/);
    assert.equal(requests.length, 5);
    assert.match(requests.at(-1).instructions, /correct_without_record/);
  });
});

test("rereading the same question and no-answer hint requests preserve attempted answers", async () => {
  await withProvider(async ({ queue, requests }) => {
    const room = classroom("suneung-2027-english");
    queue.push({ text: question(1) });
    await room.ask("시작");
    queue.push({ text: "도전 1/3\n상황을 다시 비교해 보세요.\n답: (________)" });
    await room.ask("A");
    const reread = await room.ask("시작해 주세요");
    assert.match(reread.payload.text, /문제 1\/10/);
    assert.equal(requests.length, 2, "rereading does not generate another question");
    queue.push({ text: "정답은 말하지 않을게요. 앞 문장과 뒤 문장의 관계를 먼저 생각해 보세요." });
    const hint = await room.ask("정답 말하지 말고 힌트만 주세요");
    assert.equal(requests.length, 3, "contextual no-answer hint still reaches the AI");
    assert.match(hint.payload.text, /앞 문장과 뒤 문장/);
    queue.push({ text: graded(1, { attempts: 2 }) });
    assert.equal((await room.ask("C")).payload.record?.attempts, 2);
  });
});

test("only new questions use deduplication, stripping previous-question feedback and retaining non-Latin scripts", async () => {
  const chinese1 = question(2, "의사소통").replace("제시된 자료 2에서 가장 적절한 판단은?", "甲方今天正在学习中文。");
  const chinese2 = chinese1.replace("甲方今天正在学习中文。", "乙方明天将要乘坐火车。");
  assert.notEqual(normalizeGeneralProblem(chinese1), normalizeGeneralProblem(chinese2));
  assert.equal(normalizeGeneralProblem(`정답입니다.\n\n${chinese1}`), normalizeGeneralProblem(chinese1));
  await withProvider(async ({ queue, requests }) => {
    const room = classroom("suneung-2028-second-chinese");
    queue.push({ text: question(1) });
    await room.ask("시작");
    room.history.push(chinese1);
    queue.push({ text: graded(1).replace(question(2), chinese1) }, { text: graded(1).replace(question(2), chinese2) });
    const next = await room.ask("C");
    assert.equal(next.statusCode, 200);
    assert.match(next.payload.text, /乙方明天/);
    assert.match(requests.at(-1).instructions, /duplicate_question/);
  });
});

test("long client history detects a repeated passage while different endings and partial-choice explanations remain valid", async () => {
  await withProvider(async ({ queue, requests }) => {
    const room = classroom("suneung-2027-korean-speech-writing");
    queue.push({ text: question(1) });
    await room.ask("시작");
    const oldQuestion = question(2, "청중 분석과 발표 계획", "발표자는 청중의 사전 지식을 확인했습니다. ".repeat(160));
    const newQuestion = oldQuestion.replace("제시된 자료 2에서 가장 적절한 판단은?", "논증의 전제와 결론 사이의 관계를 고르시오.");
    assert.ok(oldQuestion.length > 3000);
    room.history.push(oldQuestion);
    queue.push({ text: graded(1).replace(question(2), oldQuestion) }, { text: graded(1).replace(question(2), newQuestion) });
    const next = await room.ask("C");
    assert.equal(next.statusCode, 200);
    assert.match(next.payload.text, /논증의 전제/);
    assert.match(requests.at(-1).instructions, /duplicate_question/);
    queue.push({ text: "D) 이 선택지는 비교 과정을 생략하는 행동을 나타내요.\nE) 이 선택지는 조건 자체를 생략한다는 뜻이에요. 두 행동의 차이를 생각해 보세요." });
    const help = await room.ask("D와 E는 무슨 뜻인가요?");
    assert.equal(help.statusCode, 200);
    assert.equal(help.payload.record, undefined);
    assert.equal(room.profile.lessonRecords.length, 1);
    queue.push({ text: "B) 이 선택지의 ‘문맥’은 앞뒤 내용과 상황을 뜻해요.\n발표의 목적을 생각하고 다시 골라 보세요." });
    assert.equal((await room.ask("B의 문맥은 무슨 뜻인가요?")).statusCode, 200);
  });
});

test("provider failures and incomplete choices fail honestly without discarding the lesson", async () => {
  await withProvider(async ({ queue, requests }) => {
    const room = classroom("suneung-2028-history");
    queue.push({ text: question(1) });
    await room.ask("시작");
    queue.push({ status: 429 });
    const response = await room.ask("힌트 주세요");
    assert.equal(response.statusCode, 429);
    assert.equal(response.payload.code, "ai_rate_limited");
    assert.equal(requests.length, 2);
    assert.equal(room.profile.lessonRecords.length, 0);
    queue.push({ text: question(1), incomplete: true }, { text: "자료의 시기를 확인해 보세요." });
    assert.equal((await room.ask("힌트 주세요")).statusCode, 200);
    assert.equal(room.profile.lessonRecords.length, 0);
  });
});

test("2028 math can explain a concept naturally without changing grading or consuming a record", async () => {
  await withProvider(async ({ queue }) => {
    const room = classroom("suneung-2028-math");
    room.messages.push({ role: "assistant", content: "문제 1/10 — 개념 · 대수 · 5지선다형\n지수가 뜻하는 것은?\nA) 합\nB) 차\nC) 곱의 반복\nD) 몫\nE) 평균\n답: (________)" });
    queue.push({ text: "지수는 같은 수를 몇 번 곱하는지 나타내는 수입니다. 작은 위첨자로 표시해요." });
    const response = await room.ask("지수란 무엇인가요?");
    assert.equal(response.statusCode, 200);
    assert.match(response.payload.text, /같은 수를 몇 번 곱/);
    assert.equal(response.payload.record, undefined);
  });
});

test("real-model Markdown headings, bold A–E labels and fenced replies normalize before history and progression validation", async () => {
  const markdown = text => `\`\`\`markdown\n${text
    .replace(/^(문제[^\n]+)$/gm, "### **$1**")
    .replace(/^([A-E]\))/gm, "- **$1**")}\n\`\`\``;
  assert.equal(normalizeGeneralSuneungDisplay(markdown(question(1))), question(1));
  assert.equal(normalizeGeneralSuneungDisplay("__단어__ 뜻과 빈칸 ________을 읽습니다."), "단어 뜻과 빈칸 ________을 읽습니다.");
  await withProvider(async ({ queue, requests }) => {
    const room = classroom("suneung-2027-korean-speech-writing");
    // Emulate an assistant turn from an earlier deployment that still has raw Markdown.
    room.messages.push({ role: "assistant", content: markdown(question(1)) });
    queue.push({ text: "**문맥**은 앞뒤 내용과 상황을 뜻합니다.", nested: true });
    assert.equal((await room.ask("문맥은 무엇인가요?")).statusCode, 200);
    assert.ok(requests.at(-1).input.some(message => message.content === question(1)));
    queue.push({ text: markdown(graded(1)), nested: true });
    const next = await room.ask("답은 C입니다");
    assert.equal(next.statusCode, 200);
    assert.equal(next.payload.record?.question, 1);
    assert.match(next.payload.text, /문제 2\/10 —/);
    assert.match(next.payload.text, /^E\) 조건을 모두 생략한다\.$/m);
    assert.doesNotMatch(next.payload.text, /\*\*|```|###/);
    assert.equal(requests.length, 2, "format-only differences do not spend provider retries");
  });
});

test("display normalization never invents missing choices or repairs wrong/multiple next-question numbers", async () => {
  const args = { record: { question: 1, attempts: 1, outcome: "correct" }, intent: "answer", currentQuestion: 1, previousAttempts: 0 };
  assert.equal(validateGeneralSuneungTurn({ ...args, text: "정답입니다." }), "missing_next_question_header");
  assert.equal(validateGeneralSuneungTurn({ ...args, text: question(3) }), "wrong_next_question_number");
  assert.equal(validateGeneralSuneungTurn({ ...args, text: `${question(2)}\n${question(3)}` }), "multiple_next_question_headers");
  for (const broken of [question(2).replace(/^E\)[^\n]*\n/m, ""), `${question(2)}\nA) 중복 보기`]) {
    assert.equal(validateGeneralSuneungTurn({ ...args, text: normalizeGeneralSuneungDisplay(`**${broken}**`) }), "next_question_choices_incomplete");
  }
  await withProvider(async ({ queue }) => {
    const room = classroom("suneung-2028-english");
    room.messages.push({ role: "assistant", content: question(1) });
    const noE = graded(1).replace(/^E\)[^\n]*\n/m, "");
    queue.push({ text: noE }, { text: noE }, { text: noE });
    const result = await room.ask("C");
    assert.equal(result.statusCode, 502);
    assert.equal(result.payload.record, undefined);
    assert.equal(room.profile.lessonRecords.length, 0);
  });
});
