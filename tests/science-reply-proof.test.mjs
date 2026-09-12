import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  createScienceReplyProof, verifyScienceReplyProof, isApprovedScienceReplySpeech
} from "../lib/science-reply-proof.js";
import { projectClosedSuneungScienceSpeechText } from "../lib/suneung-science-bank.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";
import speechHandler from "../api/speech.js";

const courseId = "suneung-2028-integrated-science";
const text = "문제 1/10 · AI 설명 · 도전 2/3\n\n질량은 물체가 가진 물질의 양을 나타내는 물리량이에요. 국제단위계의 기본 단위는 킬로그램입니다.\n\n같은 물체를 달에 가져가도 질량은 같지만, 무게는 달의 중력에 따라 달라져요.\n\n답: (________)";
const student = { id:"R260001", session:"proof-test-session", courseId, courseRunId:"science-v2:proof-test-run", endedAt:null };
const html = await readFile(new URL("../learn.html", import.meta.url), "utf8");

function namedFunction(name) {
  const asyncStart = html.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : html.indexOf(`function ${name}`);
  assert.notEqual(start, -1, name);
  let depth = 0;
  for (let index = html.indexOf("{", start); index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  assert.fail(`Missing body for ${name}`);
}

function withKey(fn) {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "science-reply-proof-test-key";
  try { return fn(); }
  finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
}

function create(extra = {}) {
  return createScienceReplyProof({ student, text, questionNumber:1, attempt:2, ...extra });
}

test("dynamic reply proofs bind the exact text, student, login, course, run, and attempt", () => withKey(() => {
  const proof = create();
  assert.ok(proof);
  assert.deepEqual(verifyScienceReplyProof({ student, text, proof }), { questionNumber:1, attempt:2 });
  for (const alteredText of [text + "추가 문장", text.replace("도전 2/3", "도전 1/3"), text.replace("질량", "밀도"), "질량은 물리량입니다."]) {
    assert.equal(verifyScienceReplyProof({ student, text:alteredText, proof }), null);
  }
  for (const patch of [
    { id:"R260002" }, { session:"another-login" }, { courseId:"suneung-2027-math-probability" },
    { courseRunId:"science-v2:another-run" }, { endedAt:new Date().toISOString() }
  ]) {
    assert.equal(verifyScienceReplyProof({ student:{ ...student, ...patch }, text, proof }), null);
    assert.equal(isApprovedScienceReplySpeech({ student:{ ...student, ...patch }, text:projectClosedSuneungScienceSpeechText(text), proof }), false);
  }
}));

test("proofs expire within two hours and never outlive the signed student session", () => withKey(() => {
  const now = Date.now();
  const proof = create({ now });
  assert.ok(verifyScienceReplyProof({ student, text, proof, now:now + 1000 }));
  assert.equal(verifyScienceReplyProof({ student, text, proof, now:now + 2 * 60 * 60 * 1000 }), null);
  assert.equal(verifyScienceReplyProof({ student, text, proof, now:now - 1000 }), null);
  const expiringStudent = { ...student, exp:Math.floor(now / 1000) + 30 };
  const expiring = create({ student:expiringStudent, now });
  assert.ok(verifyScienceReplyProof({ student:expiringStudent, text, proof:expiring, now:now + 1000 }));
  assert.equal(verifyScienceReplyProof({ student:expiringStudent, text, proof:expiring, now:now + 31000 }), null);
  assert.equal(create({ student:{ ...student, exp:Math.floor(now / 1000) }, now }), null);
}));

test("forged payloads, invalid positions, key rotation, and missing signing keys fail closed", () => withKey(() => {
  const proof = create();
  const [encoded, signature] = proof.split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  payload.attempt = 1;
  const tampered = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
  for (const invalid of [tampered, `${proof}.extra`, "", "x".repeat(4096), proof.slice(0, -2)]) {
    assert.equal(verifyScienceReplyProof({ student, text, proof:invalid }), null);
  }
  for (const position of [{ questionNumber:0 }, { questionNumber:11 }, { attempt:0 }, { attempt:4 }, { attempt:1.5 }]) {
    assert.equal(create(position), null);
  }
  assert.equal(create({ text:"" }), null);
  assert.equal(create({ text:"긴".repeat(1801) }), null);
  process.env.OPENAI_API_KEY = "rotated-key";
  assert.equal(verifyScienceReplyProof({ student, text, proof }), null);
  delete process.env.OPENAI_API_KEY;
  assert.equal(create(), null);
  assert.equal(verifyScienceReplyProof({ student, text, proof }), null);
}));

test("only the complete client speech projection is approved; fragments and added text are rejected", () => withKey(() => {
  const proof = create();
  const context = { COURSE:{ avatar:false, language:"ko" } };
  runInNewContext(["cleanForDisplay", "cleanLessonForSpeech"].map(namedFunction).join("\n"), context);
  const spoken = context.cleanLessonForSpeech(text);
  assert.equal(spoken, projectClosedSuneungScienceSpeechText(text));
  assert.equal(isApprovedScienceReplySpeech({ student, text:spoken, proof }), true);
  for (const invalid of [text, spoken + " 다른 내용입니다.", spoken.split("\n")[0], "임의의 설명입니다.", spoken.replace("킬로그램", "미터")]) {
    assert.equal(isApprovedScienceReplySpeech({ student, text:invalid, proof }), false, invalid);
  }
}));

test("the client forwards matching reply proofs to speech, keeps dynamic explanations intact, and blocks altered playback", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "science-reply-proof-speech-key";
  const ttsRequests = [];
  globalThis.fetch = async (url, options) => {
    ttsRequests.push({ url, body:JSON.parse(options.body) });
    return { ok:true, arrayBuffer:async () => Uint8Array.from([71, 69, 77]).buffer };
  };
  try {
    const proof = create();
    const token = createSessionToken(student);
    const requests = [];
    let browserFallbackCalls = 0;
    const context = {
      COURSE_ID:courseId, COURSE:{ avatar:false, language:"ko" }, courseRunId:student.courseRunId,
      IS_MATH:false, IS_SUNEUNG:true, currentQuestionNumber:1, questionStartedAt:0,
      lastAssistantText:text, lastAssistantProof:proof, activeSpeechId:0,
      currentAudio:null, currentSpeechResolve:null, teacherVolume:0.5,
      window:{ dispatchEvent() {} }, CustomEvent:class {},
      console:{ warn() {} },
      Audio:class {
        constructor() { this.listeners = {}; }
        addEventListener(type, fn) { this.listeners[type] = fn; }
        pause() {}
        play() { queueMicrotask(() => this.listeners.ended()); return Promise.resolve(); }
      },
      cancelCurrentSpeech() { context.activeSpeechId += 1; },
      browserSpeak:async () => { browserFallbackCalls += 1; },
      readJsonResponse:async response => response.data,
      fetch:async (url, options) => {
        const body = JSON.parse(options.body);
        requests.push({ url, body });
        const response = {
          statusCode:200, data:null,
          status(code) { this.statusCode = code; return this; },
          setHeader() { return this; },
          end(value) { this.data = JSON.parse(value); }
        };
        await speechHandler({ method:"POST", headers:{ cookie:`${SESSION_COOKIE}=${token}` }, body }, response);
        return { ok:response.statusCode === 200, data:response.data };
      }
    };
    runInNewContext(["cleanForDisplay", "cleanLessonForSpeech", "speakText", "speakWithoutCountingQuestionTime"].map(namedFunction).join("\n"), context);
    await context.speakWithoutCountingQuestionTime(text);
    assert.equal(requests.length, 1, "A signed explanation must be sent as one complete, bounded clip");
    assert.equal(requests[0].body.scienceReplyProof, proof);
    assert.equal(requests[0].body.text, projectClosedSuneungScienceSpeechText(text));
    assert.equal(ttsRequests.length, 1);
    assert.match(ttsRequests[0].body.input, /질량은 물체/);
    assert.doesNotMatch(ttsRequests[0].body.input, /AI 설명|도전 2|답:/);

    context.lastAssistantText = "다음 대화의 설명입니다.";
    await context.speakWithoutCountingQuestionTime(text);
    assert.equal(requests[1].body.scienceReplyProof, undefined, "An older reply cannot borrow the current reply proof");
    assert.equal(ttsRequests.length, 1);

    context.lastAssistantText = text + " 임의 문장";
    await context.speakWithoutCountingQuestionTime(context.lastAssistantText);
    assert.equal(requests[2].body.scienceReplyProof, proof);
    assert.equal(ttsRequests.length, 1, "Server verification rejects client text altered after approval");
    assert.equal(browserFallbackCalls, 0, "Rejected science text must not bypass verification through browser TTS");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
