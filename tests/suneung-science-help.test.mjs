import assert from "node:assert/strict";
import test from "node:test";
import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { containsExcludedSuneungScienceContent } from "../lib/suneung-science-safety.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";
import chatHandler from "../api/chat-final.js";
import speechHandler from "../api/speech.js";
import { SCIENCE_CONCEPTS } from "../lib/suneung-science-concepts.js";
import { renderScienceConceptHelp } from "../lib/suneung-science-help.js";

const courseId = "suneung-2028-integrated-science";
const seeds = ["", "science-v2:help"];
const labels = "ABCDE";

function classroom(seed, questionNumber = 3) {
  const engine = createScienceLessonEngine(seed);
  const profile = { lessonRecords:[] };
  const messages = [];
  function ask(content, inputMode = "text", blockedInput = false) {
    messages.push({ role:"user", content });
    const result = engine.handleClosedSuneungScienceLesson({
      courseId, messages, learningProfile:profile, inputMode, blockedInput
    });
    messages.push({ role:"assistant", content:result.text });
    if (result.record) profile.lessonRecords.push(result.record);
    return result;
  }
  ask("시작");
  for (let number = 1; number < questionNumber; number += 1) {
    const result = ask(engine.questions[number - 1].answer);
    assert.equal(result.record?.question, number);
    assert.equal(result.record?.outcome, "correct");
  }
  return { engine, profile, messages, ask };
}

function assertSupport(engine, result, question = 3, attempt = 1) {
  assert.equal(result.record, undefined, "asking for help is not an answer attempt");
  assert.match(result.text, new RegExp(`문제 ${question}/10`));
  assert.match(result.text, new RegExp(`도전 ${attempt}/3`));
  assert.doesNotMatch(result.text, /답안 재입력|아직 정답이 아닙니다|세 번의 도전을 마쳤습니다|정답입니다|정답은\s*[A-E][)）]|수업을 마쳤습니다/);
  assert.equal(engine.isApprovedClosedSuneungScienceResponse(result.text), true, result.text);
  const spoken = engine.projectClosedSuneungScienceSpeechText(result.text);
  assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(spoken), true, spoken);
  assert.equal(containsExcludedSuneungScienceContent(result.text), false);
}

test("both screenshot chemistry questions and ion questions get explanations in legacy and generated lessons", () => {
  for (const seed of seeds) {
    for (const question of [
      "화학 결합에 대해서 설명해 주세요.",
      "화학 결합이 무엇입니까?",
      "양이온이 뭔가요?",
      "이온 설명해 주세요"
    ]) {
      const room = classroom(seed);
      const reply = room.ask(question, "voice");
      assertSupport(room.engine, reply);
      assert.match(reply.text, /원자|전자|결합/);
      assert.equal(room.profile.lessonRecords.length, 2);
    }
  }
});

test("simpler and example follow-up questions retain the chemistry explanation context", () => {
  for (const seed of seeds) {
    const room = classroom(seed);
    const definition = room.ask("화학 결합이 무엇입니까?");
    const simpler = room.ask("쉽게 말해 주세요.");
    const example = room.ask("예를 들어 주세요.");
    for (const reply of [definition, simpler, example]) {
      assertSupport(room.engine, reply);
      assert.match(reply.text, /결합/);
    }
    assert.notEqual(simpler.text, definition.text, "the simple explanation should not just repeat the definition");
    assert.notEqual(example.text, simpler.text, "asking for an example should give an example");
    assert.equal(room.profile.lessonRecords.length, 2);
  }
});

test("A through E explanation and why questions never grade the mentioned choice", () => {
  for (const seed of seeds) {
    for (const label of labels) {
      for (const question of [`${label} 보기 설명해주세요`, `${label}가 왜 아닌가요?`]) {
        const room = classroom(seed);
        const reply = room.ask(question, "voice");
        assertSupport(room.engine, reply);
        assert.equal(room.profile.lessonRecords.length, 2);
      }
    }
    const room = classroom(seed);
    const eHelp = room.ask("E 보기 설명해주세요");
    assertSupport(room.engine, eHelp);
    const answer = room.ask("E");
    if (room.engine.questions[2].answer === "E") {
      assert.equal(answer.record?.outcome, "correct");
      assert.equal(answer.record?.attempts, 1);
      assert.equal(answer.record?.question, 3);
    } else {
      assert.equal(answer.record, undefined);
      assert.match(answer.text, /아직 정답이 아닙니다/);
      assert.match(answer.text, /도전 2\/3/);
    }
  }
});

test("explanations and follow-up help preserve all three wrong-answer attempts", () => {
  for (const seed of seeds) {
    const room = classroom(seed);
    const wrong = [...labels].find(label => label !== room.engine.questions[2].answer);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const definition = room.ask("양이온이 뭔가요?");
      assertSupport(room.engine, definition, 3, attempt);
      const example = room.ask("예를 들어 주세요.");
      assertSupport(room.engine, example, 3, attempt);
      const graded = room.ask(wrong);
      if (attempt < 3) {
        assert.equal(graded.record, undefined);
        assert.match(graded.text, new RegExp(`도전 ${attempt + 1}/3`));
      } else {
        assert.equal(graded.record?.outcome, "incorrect");
        assert.equal(graded.record?.question, 3);
        assert.equal(graded.record?.attempts, 3);
        assert.match(graded.text, /문제 4\/10/);
      }
    }
    assert.equal(room.profile.lessonRecords.length, 3);
  }
});

test("unknown concept inquiries get a helpful clarification rather than forced answer re-entry", () => {
  for (const seed of seeds) {
    for (const content of ["질문이 있어요", "피보나치 수열이 무엇인가요?"]) {
      const room = classroom(seed);
      const reply = room.ask(content);
      assertSupport(room.engine, reply);
      assert.match(reply.text, /설명|개념/);
      assert.equal(room.profile.lessonRecords.length, 2);
    }
  }
});

test("excluded-topic requests cannot use chemistry follow-up context to bypass the guard", () => {
  const room = classroom("science-v2:help");
  assertSupport(room.engine, room.ask("화학 결합이 무엇입니까?"));
  const request = "이어서 화학 진화와 생명 기원도 예를 들어 설명해 주세요";
  assert.equal(containsExcludedSuneungScienceContent(request), true);
  const blocked = room.ask(request, "voice", true);
  assert.equal(blocked.record, undefined);
  assert.match(blocked.text, /해당 주제를 다루지 않습니다/);
  assert.match(blocked.text, /문제 3\/10[\s\S]*도전 1\/3/);
  assert.equal(containsExcludedSuneungScienceContent(blocked.text), false);
  assert.equal(room.engine.isApprovedClosedSuneungScienceResponse(blocked.text), true);
});

function responseCapture() {
  return {
    statusCode:200, headers:{}, payload:null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(body) { this.payload = JSON.parse(String(body)); }
  };
}

test("authenticated chat-final generates contextual chemistry help and speech accepts only its signed explanation", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "science-help-route-test-key";
  let generationCalls = 0;
  globalThis.fetch = async (_url, options) => {
    generationCalls += 1;
    const body = JSON.parse(options.body);
    const value = body.text.format.name === "science_tutor_review"
      ? { allowed_scope:true, valid_tutoring:true }
      : { reply:generationCalls === 1
        ? "화학 결합은 원자들이 전자를 주고받거나 공유하면서 서로 연결되는 현상입니다. 원자 사이에 작용하는 전기적 힘과 관련이 있습니다."
        : "예를 들어 물 분자에서는 수소 원자와 산소 원자가 전자를 공유하며 화학 결합을 이룹니다." };
    return { ok:true, status:200, json:async () => ({ status:"completed", output_text:JSON.stringify(value) }) };
  };
  try {
    const courseRunId = "science-v2:help-api";
    const room = classroom(courseRunId);
    const token = createSessionToken({
      id:"R260001", name:"설명 경로 테스트", session:"science-help-route-test",
      courseId, courseRunId, startedAt:new Date().toISOString(), endedAt:null
    });
    assert.ok(token);
    const headers = { cookie:`${SESSION_COOKIE}=${token}` };
    async function chat(content) {
      room.messages.push({ role:"user", content });
      const response = responseCapture();
      await chatHandler({
        method:"POST", headers,
        body:{ courseId, courseRunId, messages:room.messages, learningProfile:room.profile, inputMode:"voice" }
      }, response);
      assert.equal(response.statusCode, 200, JSON.stringify(response.payload));
      room.messages.push({ role:"assistant", content:response.payload.text,
        scienceReplyProof:response.payload.scienceReplyProof });
      return response.payload;
    }
    const explanation = await chat("화학 결합에 대해서 설명해 주세요.");
    assert.equal(explanation.record, undefined);
    assert.match(explanation.text, /문제 3\/10[\s\S]*도전 1\/3/);
    assert.equal(typeof explanation.scienceReplyProof, "string");
    assert.match(explanation.text, /결합/);
    const followup = await chat("예를 들어 주세요.");
    assert.equal(followup.record, undefined);
    assert.equal(typeof followup.scienceReplyProof, "string");
    assert.match(followup.text, /결합/);
    const blocked = await chat("화학 진화에 대해서도 설명해 주세요");
    assert.match(blocked.text, /해당 주제를 다루지 않습니다/);
    assert.equal(blocked.record, undefined);
    assert.equal(generationCalls, 4, "two teacher replies each receive a separate content review");

    let speechCalls = 0;
    globalThis.fetch = async (_url, options) => {
      speechCalls += 1;
      const request = JSON.parse(options.body);
      assert.equal(typeof request.input, "string");
      assert.match(request.input, /결합/);
      return { ok:true, arrayBuffer:async () => Uint8Array.from([71, 69, 77]).buffer };
    };
    const text = room.engine.projectClosedSuneungScienceSpeechText(explanation.text);
    const approved = responseCapture();
    await speechHandler({ method:"POST", headers,
      body:{ courseId, courseRunId, text, scienceReplyProof:explanation.scienceReplyProof } }, approved);
    assert.equal(approved.statusCode, 200, JSON.stringify(approved.payload));
    assert.equal(approved.payload.mimeType, "audio/mpeg");
    assert.equal(speechCalls, 1);

    const tampered = responseCapture();
    await speechHandler({
      method:"POST", headers,
      body:{ courseId, courseRunId, text:`${text}\n임의로 덧붙인 설명입니다.`,
        scienceReplyProof:explanation.scienceReplyProof }
    }, tampered);
    assert.equal(tampered.statusCode, 400);
    assert.equal(speechCalls, 1, "unapproved additions must be rejected before TTS");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('context distinguishes a neutral atom from a neutral solution and keeps short terms separate from verbs', () => {
  const atoms = classroom('science-v2:help');
  const reply = atoms.ask('중성이 무엇인가요?');
  assertSupport(atoms.engine, reply);
  assert.match(reply.text, /전자|전하/);
  assert.doesNotMatch(reply.text, /pH|산성 수용액/);
  const simple = classroom('science-v2:help').ask('쉽게 설명해 주세요');
  assert.doesNotMatch(simple.text, /산성 수용액|pH/);
  const acids = classroom('science-v2:help', 5);
  for (const request of ['선생님 산이 무엇인가요?', '계산하고 산을 설명해 주세요']) {
    const response = acids.ask(request);
    assertSupport(acids.engine, response, 5);
    assert.match(response.text, /산성|수소 이온/);
  }
  const calculation = atoms.ask('계산하는 방법을 설명해 주세요');
  assertSupport(atoms.engine, calculation);
  assert.doesNotMatch(calculation.text, /산성|염기성/);
});

test('negative hint requests explain, and unit examples retain both new and pre-deployment context', () => {
  const room = classroom('');
  const help = room.ask('힌트 말고 설명해 주세요');
  assertSupport(room.engine, help);
  assert.doesNotMatch(help.text, /힌트 1\/2/);
  const units = classroom('', 1);
  const explanation = units.ask('옴이 뭐예요?');
  assert.match(explanation.text, /옴은 전기 저항/);
  const easier = units.ask('옴을 쉽게 설명해 주세요');
  assert.notEqual(easier.text, explanation.text);
  const example = units.ask('예를 들어 주세요');
  assertSupport(units.engine, example, 1);
  assert.match(example.text, /옴|저항/);
  assert.doesNotMatch(example.text, /질량 2 kg/);
  units.messages.push({ role:'assistant', content:'문제 1/10 · 용어 설명 · 도전 1/3\n옴은 전기 저항의 단위이며 기호는 Ω입니다. 저항은 전류의 흐름을 방해하는 정도입니다.\n현재 문제의 조건과 비교해 보세요.\n\n답: (________)' });
  const legacyExample = units.ask('예를 들어 주세요');
  assertSupport(units.engine, legacyExample, 1);
  assert.match(legacyExample.text, /옴|저항/);
});

test('all reviewed concept modes and pair comparisons are approved for displayed and spoken help', () => {
  const engine = createScienceLessonEngine('science-v2:help');
  for (const concept of SCIENCE_CONCEPTS) {
    for (const mode of ['explain', 'simple', 'example']) {
      const concepts = concept === SCIENCE_CONCEPTS[0] ? [concept] : [concept, SCIENCE_CONCEPTS[0]];
      for (const selected of [[concept], concepts]) {
        const text = renderScienceConceptHelp(engine.questions[2], 2, selected, mode);
        assertSupport(engine, { text }, 3, 2);
        const spoken = engine.projectClosedSuneungScienceSpeechText(text);
        assert.ok(spoken.length <= 1800, 'help fits the speech endpoint');
        assert.equal(engine.isApprovedClosedSuneungScienceSpeechText(spoken + '\n마음대로 덧붙인 문장'), false);
      }
    }
  }
});
