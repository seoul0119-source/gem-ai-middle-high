import assert from "node:assert/strict";
import test from "node:test";
import speechHandler, {
  cleanText, generalSuneungSpeechInstructions, isGeneralSuneungSpeechCourse,
  normalizeGeneralSuneungSpeech, truncateSpeechText
} from "../api/speech.js";
import transcribeHandler, { generalSuneungTranscriptionConfig } from "../api/transcribe.js";
import { SUNEUNG_COURSES } from "../api/suneung-courses.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

const generalEntries = Object.entries(SUNEUNG_COURSES).filter(([, course]) => !["math", "science", "integrated-science"].includes(course.suneung.subject));
const generalIds = generalEntries.map(([id]) => id);
const labels = ["에이", "비", "씨", "디", "알파벳 이"];

function capture() {
  return { statusCode:200, payload:null,
    status(code) { this.statusCode = code; return this; }, setHeader() { return this; },
    end(value) { this.payload = JSON.parse(String(value)); }
  };
}

function requestFor(courseId, body = {}) {
  const courseRunId = "general-voice-test-run";
  const token = createSessionToken({ id:"R260001", name:"테스트", session:"general-voice-test", courseId,
    courseRunId, startedAt:new Date().toISOString(), endedAt:null });
  return { method:"POST", headers:{ cookie:`${SESSION_COOKIE}=${token}` },
    body:{ courseId, courseRunId, ...body } };
}

async function withProvider(provider, operation) {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "general-voice-test";
  globalThis.fetch = provider;
  try { await operation(); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
}

test("all 35 general courses preserve long passages, A–E choices and the final spoken question", () => {
  assert.equal(generalIds.length, 35);
  const passage = "긴 지문 내용을 빠짐없이 읽어야 합니다. ".repeat(140);
  const source = `문제 1/10 — 핵심 개념\n${passage}\nA) first choice\nB) second choice\nC) troisième choix\nD) 第四个选项\nE) 마지막 보기\n답: (________)`;
  for (const courseId of generalIds) {
    const spoken = cleanText(source, courseId);
    assert.ok(spoken.length > 1800, courseId);
    assert.ok(spoken.includes(passage.trim()), "the passage must not be silently shortened");
    let last = -1;
    for (const label of labels) {
      const next = spoken.indexOf(`${label} 선택지,`);
      assert.ok(next > last, `${courseId}: ${label} stays present and ordered`);
      last = next;
    }
    assert.match(spoken, /정답은 어느 보기인가요\?$/);
    assert.equal(truncateSpeechText(spoken, courseId), spoken);
    assert.equal(cleanText(spoken, courseId), spoken, "normalization is idempotent");
  }
});

test("general choice narration changes labels only, not dates, fractions or foreign language content", () => {
  const courseId = "suneung-2027-second-french";
  assert.equal(normalizeGeneralSuneungSpeech("D) Le 12/09/2026, 1/2 et x².\nE) Voilà une idée !", courseId),
    "디 선택지, Le 12/09/2026, 1/2 et x².\n알파벳 이 선택지, Voilà une idée !");
  assert.equal(cleanText("분자와 분모의 의미를 설명합니다.", courseId), "분자와 분모의 의미를 설명합니다.");
  assert.doesNotMatch(cleanText("힌트: 지문의 마지막 문장을 읽어 보세요.", courseId), /정답은/);
});

test("general voice changes exclude every math/science course and all established K–12 classes", () => {
  for (const [courseId, course] of Object.entries(SUNEUNG_COURSES)) {
    if (!["math", "science", "integrated-science"].includes(course.suneung.subject)) continue;
    assert.equal(isGeneralSuneungSpeechCourse(courseId), false);
    assert.equal(generalSuneungTranscriptionConfig(courseId), null);
    assert.equal(generalSuneungSpeechInstructions(courseId), "");
  }
  for (const courseId of ["m1-english", "h3-korean", "g2-math-en", "g2-math-fr", "toeic", "unknown"]) {
    assert.equal(isGeneralSuneungSpeechCourse(courseId), false);
    assert.equal(generalSuneungTranscriptionConfig(courseId), null);
  }
  assert.doesNotMatch(cleanText("A) apple\nB) pear\n답: (________)", "m1-english"), /apple|pear|정답은/);
});

test("speech API rejects oversized general segments explicitly without calling TTS or discarding D/E", async () => {
  await withProvider(async () => assert.fail("oversized segment must not call provider"), async () => {
    const response = capture();
    await speechHandler(requestFor("suneung-2027-korean-speech-writing", { text:`${"지문 ".repeat(700)}\nD) 네 번째\nE) 다섯 번째` }), response);
    assert.equal(response.statusCode, 413);
    assert.equal(response.payload.code, "speech_segment_too_long");
    assert.equal(response.payload.maxLength, 1800);
  });
});

test("bounded individual D/E speech calls and final prompt are forwarded exactly once in their target language", async () => {
  const inputs = [];
  await withProvider(async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/audio/speech");
    const data = JSON.parse(options.body);
    inputs.push(data.input);
    assert.ok(data.input.length <= 1800);
    assert.match(data.instructions, /natural French/);
    assert.match(data.instructions, /Speak Korean directions/);
    assert.match(data.instructions, /single choice segment contains only that choice/);
    return { ok:true, status:200, arrayBuffer:async () => new Uint8Array([1, 2, 3]).buffer };
  }, async () => {
    for (const text of ["D) Nous allons à l’école.", "E) Je suis prêt.", "정답은 어느 보기인가요?"]) {
      const response = capture();
      await speechHandler(requestFor("suneung-2028-second-french", { text }), response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.payload.mimeType, "audio/mpeg");
    }
  });
  assert.deepEqual(inputs, ["디 선택지, Nous allons à l’école.", "알파벳 이 선택지, Je suis prêt.", "정답은 어느 보기인가요?"]);
});

test("all 18 second-language courses retain Korean and target language STT hints; Hanmun uses Korean readings", () => {
  const languages = generalEntries.filter(([, course]) => course.suneung.subject === "second-language");
  assert.equal(languages.length, 18);
  for (const [courseId, course] of languages) {
    const config = generalSuneungTranscriptionConfig(courseId);
    assert.deepEqual(config.languages, [...new Set(["ko", course.targetLanguage.split("-")[0]])]);
    assert.match(config.prompt, /질문과 문장을 끝까지 그대로 받아쓰세요/);
    assert.match(config.prompt, /질문을 답안으로 줄이지 마세요/);
    assert.match(config.prompt, /E\(알파벳 이\)/);
    assert.doesNotMatch(config.prompt, /repeating one English word/);
    assert.equal(config.fallbackLanguage, course.targetLanguage === "ko-KR" ? "ko" : null);
  }
  assert.match(generalSuneungSpeechInstructions("suneung-2027-second-hanmun"), /Korean Hanja readings, not Mandarin/);
  assert.deepEqual(generalSuneungTranscriptionConfig("suneung-2027-english").languages, ["ko", "en"]);
});

test("transcription sends bilingual hints and preserves real concept questions and E/2 as heard", async () => {
  let transcript = "";
  await withProvider(async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    assert.deepEqual(options.body.getAll("languages[]"), ["ko", "fr"]);
    assert.equal(options.body.get("language"), null);
    assert.match(options.body.get("prompt"), /질문과 문장을 끝까지 그대로 받아쓰세요/);
    assert.ok(options.body.getAll("keywords[]").includes("알파벳 E"));
    return { ok:true, status:200, json:async () => ({ text:transcript }) };
  }, async () => {
    for (const text of ["토양 관리라는 게 무엇인가요?", "답은 C입니다.", "알파벳 이", "2번입니다", "Pourquoi est-ce correct ?", "감사합니다."]) {
      transcript = text;
      const response = capture();
      await transcribeHandler(requestFor("suneung-2027-second-french", { audio:Buffer.from("mock audio").toString("base64"), context:"문제 1/10 — 프랑스어" }), response);
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.payload, { text });
    }
  });
});

test("bilingual fallback omits a single forced language and still preserves a Korean follow-up", async () => {
  const models = [];
  await withProvider(async (_url, options) => {
    models.push(options.body.get("model"));
    if (models.length === 1) return { ok:false, status:400, json:async () => ({ error:{ code:"unsupported_model" } }) };
    assert.equal(options.body.get("language"), null);
    assert.equal(options.body.get("languages[]"), null);
    return { ok:true, status:200, json:async () => ({ text:"이 프랑스어 단어는 무슨 뜻인가요?" }) };
  }, async () => {
    const response = capture();
    await transcribeHandler(requestFor("suneung-2028-second-french", { audio:Buffer.from("mock audio").toString("base64") }), response);
    assert.equal(response.statusCode, 200);
    assert.match(response.payload.text, /무슨 뜻/);
  });
  assert.deepEqual(models, ["gpt-transcribe", "gpt-4o-transcribe"]);
});
