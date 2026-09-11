import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const learnHtml = await readFile(new URL("../learn.html", import.meta.url), "utf8");

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} must have a closing brace`);
}

const completeQuestion = [
  "첫 번째 문제입니다.",
  "주머니에 빨간 공 3개와 파란 공 2개가 들어 있습니다.",
  "에이 선택지, 5분의 1.",
  "비 선택지, 5분의 2.",
  "씨 선택지, 5분의 3.",
  "디 선택지, 2분의 1.",
  "이 선택지, 3분의 2.",
  "정답은 어느 보기인가요?"
].join("\n");

const orderedTail = [
  "에이 선택지, 5분의 1.",
  "비 선택지, 5분의 2.",
  "씨 선택지, 5분의 3.",
  "디 선택지, 2분의 1.",
  "이 선택지, 3분의 2.",
  "정답은 어느 보기인가요?"
];

test("segments Suneung math into body through D, E, and the final answer request", () => {
  const context = {};
  runInNewContext(
    `${extractNamedFunction(learnHtml, "splitSuneungMathSpeechParts")}\nthis.splitSuneungMathSpeechParts = splitSuneungMathSpeechParts;`,
    context
  );

  const parts = Array.from(context.splitSuneungMathSpeechParts(completeQuestion));
  assert.equal(parts.length, 3, "use three reliable clips without creating six extra TTS requests");
  assert.match(parts[0], /^첫 번째 문제입니다\./);
  assert.match(parts[0], /에이 선택지, 5분의 1\.[\s\S]*디 선택지, 2분의 1\.$/);
  assert.equal(parts[1], "이 선택지, 3분의 2.", "E must have its own clip so the TTS model cannot omit it");
  assert.equal(parts[2], "정답은 어느 보기인가요?", "the answer request must be its own final clip");

  const recombined = parts.join("\n");
  let previous = -1;
  for (const expected of orderedTail) {
    assert.equal(recombined.split(expected).length - 1, 1, `${expected} must occur exactly once`);
    const position = recombined.indexOf(expected);
    assert.ok(position > previous, `${expected} must retain its visible order`);
    previous = position;
  }

  assert.match(
    learnHtml,
    /IS_SUNEUNG\s*&&\s*IS_MATH[\s\S]{0,320}splitSuneungMathSpeechParts\(clean\)/,
    "Suneung math must use the complete A-E speech segmentation path"
  );
});

test("a natural-voice failure sends the same complete A-E order to browser speech fallback", async () => {
  const fallbackCalls = [];
  const context = {
    COURSE_ID:"suneung-2028-math",
    COURSE:{ avatar:false, language:"ko" },
    IS_SUNEUNG:true,
    IS_MATH:true,
    activeSpeechId:0,
    currentAudio:null,
    currentSpeechResolve:null,
    teacherVolume:0.45,
    courseRunId:"speech-segmentation-test",
    cleanMathForSpeech:(value) => String(value),
    cleanLessonForSpeech:(value) => String(value),
    browserSpeak:async (value) => { fallbackCalls.push(String(value)); },
    addMessage() {},
    readJsonResponse:async () => ({ error:"simulated speech failure" }),
    fetch:async () => ({ ok:false }),
    Audio:class {},
    CustomEvent:class {},
    window:{ dispatchEvent() {} },
    console:{ warn() {} }
  };

  runInNewContext(`
    ${extractNamedFunction(learnHtml, "splitSuneungMathSpeechParts")}
    function cancelCurrentSpeech() { activeSpeechId += 1; }
    async ${extractNamedFunction(learnHtml, "speakText")}
    this.speakText = speakText;
  `, context);

  await context.speakText(completeQuestion);
  assert.deepEqual(fallbackCalls, [completeQuestion], "fallback must receive the complete normalized question once");

  let previous = -1;
  for (const expected of orderedTail) {
    const position = fallbackCalls[0].indexOf(expected);
    assert.ok(position > previous, `${expected} must remain in order in fallback speech`);
    previous = position;
  }
  assert.match(fallbackCalls[0], /이 선택지, 3분의 2\.\n정답은 어느 보기인가요\?$/);
});

test("successful natural speech requests and plays body, E, and final question in order", async () => {
  const requested = [];
  const audioInstances = [];
  const playedSources = [];
  const fallbackCalls = [];

  class FakeAudio {
    constructor(source) {
      this.source = source;
      this.listeners = new Map();
      audioInstances.push(this);
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    play() {
      playedSources.push(this.source);
      return Promise.resolve();
    }
    emit(type) { this.listeners.get(type)?.(); }
  }

  const context = {
    COURSE_ID:"suneung-2028-math",
    COURSE:{ avatar:false, language:"ko" },
    IS_SUNEUNG:true,
    IS_MATH:true,
    activeSpeechId:0,
    currentAudio:null,
    currentSpeechResolve:null,
    teacherVolume:0.45,
    courseRunId:"speech-success-test",
    cleanMathForSpeech:(value) => String(value),
    cleanLessonForSpeech:(value) => String(value),
    browserSpeak:async (value) => { fallbackCalls.push(String(value)); },
    addMessage() {},
    readJsonResponse:async (response) => response.payload,
    fetch:async (url, init) => {
      const body = JSON.parse(init.body);
      requested.push({ url, body });
      return {
        ok:true,
        payload:{ audio:`audio-part-${requested.length}`, mimeType:"audio/mpeg" }
      };
    },
    Audio:FakeAudio,
    CustomEvent:class {},
    window:{ dispatchEvent() {} },
    console:{ warn() {} }
  };

  runInNewContext(`
    ${extractNamedFunction(learnHtml, "splitSuneungMathSpeechParts")}
    function cancelCurrentSpeech() { activeSpeechId += 1; }
    async ${extractNamedFunction(learnHtml, "speakText")}
    this.speakText = speakText;
  `, context);

  const expectedParts = [
    completeQuestion.split("\n").slice(0, -2).join("\n"),
    "이 선택지, 3분의 2.",
    "정답은 어느 보기인가요?"
  ];
  const flushUntil = async (predicate, message) => {
    for (let attempt = 0; attempt < 20 && !predicate(); attempt += 1) await Promise.resolve();
    assert.ok(predicate(), message);
  };

  const speechFinished = context.speakText(completeQuestion);
  assert.deepEqual(
    requested.map(({ url, body }) => ({ url, text:body.text, courseId:body.courseId, courseRunId:body.courseRunId })),
    expectedParts.map((text) => ({
      url:"/api/speech",
      text,
      courseId:"suneung-2028-math",
      courseRunId:"speech-success-test"
    })),
    "all three speech requests must preserve the planned order"
  );

  await flushUntil(() => audioInstances.length === 1, "the first audio clip must start");
  assert.deepEqual(playedSources, ["data:audio/mpeg;base64,audio-part-1"]);
  audioInstances[0].emit("ended");

  await flushUntil(() => audioInstances.length === 2, "E audio must follow the body through D");
  assert.deepEqual(playedSources, [
    "data:audio/mpeg;base64,audio-part-1",
    "data:audio/mpeg;base64,audio-part-2"
  ]);
  audioInstances[1].emit("ended");

  await flushUntil(() => audioInstances.length === 3, "the final answer question must follow E");
  assert.deepEqual(playedSources, [
    "data:audio/mpeg;base64,audio-part-1",
    "data:audio/mpeg;base64,audio-part-2",
    "data:audio/mpeg;base64,audio-part-3"
  ]);
  audioInstances[2].emit("ended");
  await speechFinished;

  assert.deepEqual(fallbackCalls, [], "a successful natural voice sequence must not invoke fallback");
  assert.equal(context.currentAudio, null);
});

test("browser fallback continues to E and the final question after a D utterance error", async () => {
  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.listeners = new Map();
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.(); }
  }

  const utterances = [];
  const context = {
    COURSE:{ language:"ko" },
    IS_SUNEUNG:true,
    IS_MATH:true,
    activeSpeechId:9,
    currentSpeechResolve:null,
    teacherVolume:0.45,
    cleanLessonForSpeech:(value) => String(value),
    getVoice:() => null,
    SpeechSynthesisUtterance:FakeUtterance,
    window:{
      speechSynthesis:{
        getVoices:() => [],
        speak(utterance) { utterances.push(utterance); }
      }
    }
  };
  runInNewContext(
    `${extractNamedFunction(learnHtml, "browserSpeak")}\nthis.browserSpeak = browserSpeak;`,
    context
  );

  const finished = context.browserSpeak(completeQuestion, 9);
  const expectedLines = completeQuestion.split("\n");
  for (let index = 0; index < expectedLines.length; index += 1) {
    assert.equal(utterances.length, index + 1, `fallback line ${index + 1} must be queued`);
    assert.equal(utterances[index].text, expectedLines[index]);
    assert.equal(utterances[index].lang, "ko-KR");
    utterances[index].emit(expectedLines[index].startsWith("디 선택지,") ? "error" : "end");
    await Promise.resolve();
  }
  await finished;

  assert.equal(utterances.at(-2).text, "이 선택지, 3분의 2.");
  assert.equal(utterances.at(-1).text, "정답은 어느 보기인가요?");
});
