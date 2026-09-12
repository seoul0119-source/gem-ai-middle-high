import assert from "node:assert/strict";
import test from "node:test";
import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import chatHandler from "../api/chat-final.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

const courseId = "suneung-2028-integrated-science";
const labels = "ABCDE";

function engineWithFirstAnswer(answer) {
  for (let run = 0; run < 200; run += 1) {
    const engine = createScienceLessonEngine(`science-v2:voice-${run}`);
    if (engine.questions[0].answer === answer) return engine;
  }
  assert.fail(`No deterministic lesson with first answer ${answer}`);
}

function begin(engine, profile = { lessonRecords:[] }) {
  return engine.handleClosedSuneungScienceLesson({
    courseId,
    messages:[{ role:"user", content:"시작" }],
    learningProfile:profile
  });
}

function submit(engine, previous, content, inputMode = "voice", profile = { lessonRecords:[] }) {
  return engine.handleClosedSuneungScienceLesson({
    courseId,
    messages:[{ role:"assistant", content:previous.text }, { role:"user", content }],
    learningProfile:profile,
    inputMode
  });
}

function assertApproved(engine, result) {
  assert.equal(engine.isApprovedClosedSuneungScienceResponse(result.text), true, result.text);
  assert.equal(
    engine.isApprovedClosedSuneungScienceSpeechText(engine.projectClosedSuneungScienceSpeechText(result.text)),
    true,
    "The clarification or lesson response must also be available for normal voice playback"
  );
}

test("voice E/2 ambiguity never consumes an attempt, including the video's 2번입니다 transcript", () => {
  const engine = engineWithFirstAnswer("E");
  const transcripts = ["2", "2번", "2번입니다", "2번이요", "이번", "이", "이요", "이입니다", "정답은 2번입니다."];
  let current = begin(engine);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const transcript of transcripts) {
      let clarification = submit(engine, current, transcript);
      assert.equal(clarification.record, undefined, `${transcript} must not be graded`);
      assert.match(clarification.text, /문제 1\/10/);
      assert.match(clarification.text, new RegExp(`도전 ${attempt}/3`));
      assert.doesNotMatch(clarification.text, /아직 정답이 아닙니다|세 번의 도전을 마쳤습니다|정답입니다/);
      assertApproved(engine, clarification);

      // Repeated ambiguous audio must preserve the attempt even when only the
      // latest clarification survives in the conversation window.
      clarification = submit(engine, clarification, transcript);
      assert.equal(clarification.record, undefined);
      assert.match(clarification.text, new RegExp(`도전 ${attempt}/3`));
      const resolved = submit(engine, clarification, "알파벳 E");
      assert.equal(resolved.record?.outcome, "correct", transcript);
      assert.equal(resolved.record?.attempts, attempt, transcript);
      assert.equal(resolved.record?.question, 1);
    }
    if (attempt < 3) {
      current = submit(engine, current, "A");
      assert.equal(current.record, undefined);
      assert.match(current.text, new RegExp(`도전 ${attempt + 1}/3`));
    }
  }
});

test("explicit E aliases grade the displayed E while typed 2 and unambiguous spoken B keep their meanings", () => {
  const eEngine = engineWithFirstAnswer("E");
  const eStart = begin(eEngine);
  for (const answer of ["E", "E입니다", "E번", "알파벳 E", "알파벳 이", "알파벳 이요", "알파벳 이에요", "영어 이요", "E가 정답입니다", "오번", "5번"]) {
    const result = submit(eEngine, eStart, answer);
    assert.equal(result.record?.outcome, "correct", answer);
    assert.equal(result.record?.attempts, 1, answer);
    assertApproved(eEngine, result);
  }

  const bEngine = engineWithFirstAnswer("B");
  const bStart = begin(bEngine);
  for (const answer of ["2", "2번", "2번입니다"]) {
    const typed = submit(bEngine, bStart, answer, "text");
    assert.equal(typed.record?.outcome, "correct", `Typed ${answer} means B`);
    const voice = submit(bEngine, bStart, answer, "voice");
    assert.equal(voice.record, undefined, `Voice ${answer} is ambiguous even when B is correct`);
    assert.match(voice.text, /도전 1\/3/);
    assertApproved(bEngine, voice);
  }
  for (const answer of ["B", "비", "비번", "두번째", "두 번째"]) {
    const result = submit(bEngine, bStart, answer);
    assert.equal(result.record?.outcome, "correct", answer);
    assert.equal(result.record?.attempts, 1, answer);
  }
});

test("shuffled answer keys grade every displayed letter and E at every question position", () => {
  const correctLetters = new Set();
  const eQuestionNumbers = new Set();
  for (let run = 0; run < 150; run += 1) {
    const engine = createScienceLessonEngine(`science-v2:voice-keys-${run}`);
    const profile = { lessonRecords:[] };
    let current = begin(engine, profile);
    for (const question of engine.questions) {
      assert.equal(question.choices.length, 5);
      assert.equal(new Set(question.choices).size, 5);
      for (const [index, choice] of question.choices.entries()) {
        assert.ok(current.text.includes(`${labels[index]}) ${choice}`));
      }
      const graded = submit(engine, current, question.answer, "voice", profile);
      assert.equal(graded.record?.outcome, "correct", `Run ${run}, question ${question.number}: ${question.answer}`);
      assert.equal(graded.record?.question, question.number);
      assert.equal(graded.record?.attempts, 1);
      correctLetters.add(question.answer);
      if (question.answer === "E") eQuestionNumbers.add(question.number);
      profile.lessonRecords.push(graded.record);
      current = graded;
    }
    assertApproved(engine, current);
    if (correctLetters.size === 5 && eQuestionNumbers.size === 10) break;
  }
  assert.deepEqual([...correctLetters].sort(), [...labels]);
  assert.deepEqual([...eQuestionNumbers].sort((left, right) => left - right), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("new-question requests advance with a skipped record and do not grade the skipped answer", () => {
  const engine = createScienceLessonEngine("science-v2:voice-skip");
  const profile = { lessonRecords:[] };
  let current = begin(engine, profile);
  for (const [index, command] of ["새 문제", "다른 문제 주세요"].entries()) {
    const question = engine.questions[index];
    const next = submit(engine, current, command, "voice", profile);
    assert.deepEqual(next.record, {
      question:question.number,
      stage:question.stage,
      topic:question.topic,
      scope:"direct",
      outcome:"skipped",
      attempts:0,
      weakType:""
    });
    assert.equal(engine.isValidClosedScienceRecord(next.record), true);
    assert.match(next.text, new RegExp(`문제 ${question.number + 1}/10`));
    assert.doesNotMatch(next.text, /아직 정답이 아닙니다|세 번의 도전을 마쳤습니다|정답입니다/);
    assertApproved(engine, next);
    profile.lessonRecords.push(next.record);
    current = next;
  }

  const third = submit(engine, current, engine.questions[2].answer, "voice", profile);
  assert.equal(third.record?.question, 3, "Skipped profile records must preserve progression");
  assert.equal(third.record?.outcome, "correct");
  assert.equal(third.record?.attempts, 1);
});

test("ten new-question requests finish without adding correct or incorrect assessments", () => {
  const engine = createScienceLessonEngine("science-v2:voice-skip-all");
  const profile = { lessonRecords:[] };
  let current = begin(engine, profile);
  for (let number = 1; number <= 10; number += 1) {
    current = submit(engine, current, "새 문제", "text", profile);
    assert.equal(current.record?.question, number);
    assert.equal(current.record?.outcome, "skipped");
    assert.equal(current.record?.attempts, 0);
    assert.equal(engine.isValidClosedScienceRecord(current.record), true);
    profile.lessonRecords.push(current.record);
  }
  assert.match(current.text, /이번 통합과학 수업을 마쳤습니다/);
  assert.match(current.text, /정답 0문제/);
  assert.match(current.text, /오답 0문제/);
  assertApproved(engine, current);
});

test("signed deployed chat route preserves voice clarification, E grading and skipped progression without generation", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "science-voice-integration-signing-key";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Protected science must not call external generation");
  };

  try {
    let engine;
    let courseRunId;
    for (let run = 0; run < 200; run += 1) {
      const candidate = `science-v2:voice-route-${run}`;
      const candidateEngine = createScienceLessonEngine(candidate);
      if (candidateEngine.questions[0].answer === "E") {
        engine = candidateEngine;
        courseRunId = candidate;
        break;
      }
    }
    assert.ok(engine);
    const token = createSessionToken({
      id:"R260001",
      name:"음성 테스트 학생",
      session:"science-voice-route-test",
      courseId,
      courseRunId,
      startedAt:new Date().toISOString(),
      endedAt:null
    });
    assert.ok(token);
    const messages = [];
    const profile = { lessonRecords:[] };

    async function chat(content, inputMode = "voice") {
      messages.push({ role:"user", content });
      const response = {
        statusCode:200,
        headers:{},
        payload:null,
        status(code) { this.statusCode = code; return this; },
        setHeader(name, value) { this.headers[name] = value; return this; },
        end(body) { this.payload = JSON.parse(String(body)); }
      };
      await chatHandler({
        method:"POST",
        headers:{ cookie:`${SESSION_COOKIE}=${token}` },
        body:{ courseId, courseRunId, inputMode, messages, learningProfile:profile }
      }, response);
      assert.equal(response.statusCode, 200, JSON.stringify(response.payload));
      assert.equal(fetchCalls, 0);
      assertApproved(engine, response.payload);
      messages.push({ role:"assistant", content:response.payload.text });
      return response.payload;
    }

    const start = await chat("시작", "text");
    assert.match(start.text, /문제 1\/10/);
    const ambiguous = await chat("2번입니다");
    assert.equal(ambiguous.record, undefined);
    assert.match(ambiguous.text, /음성 답안 확인/);
    assert.match(ambiguous.text, /도전 1\/3/);

    const resolved = await chat("알파벳 E");
    assert.equal(resolved.record?.question, 1);
    assert.equal(resolved.record?.outcome, "correct");
    assert.equal(resolved.record?.attempts, 1);
    profile.lessonRecords.push(resolved.record);
    assert.match(resolved.text, /문제 2\/10/);

    const skipped = await chat("다른 문제 주세요");
    assert.equal(skipped.record?.question, 2);
    assert.equal(skipped.record?.outcome, "skipped");
    assert.equal(skipped.record?.attempts, 0);
    assert.match(skipped.text, /문제 3\/10/);
    profile.lessonRecords.push(skipped.record);

    const third = await chat(engine.questions[2].answer);
    assert.equal(third.record?.question, 3);
    assert.equal(third.record?.outcome, "correct");
    assert.equal(third.record?.attempts, 1);
    assert.match(third.text, /문제 4\/10/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
