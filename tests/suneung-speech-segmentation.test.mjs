import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { numericChoiceScript } from "../api/speech.js";

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

test("segments every choice independently, including D and E", () => {
  const context = {};
  runInNewContext(
    `${extractNamedFunction(learnHtml, "splitSuneungMathSpeechParts")}\nthis.splitSuneungMathSpeechParts = splitSuneungMathSpeechParts;`,
    context
  );

  const parts = Array.from(context.splitSuneungMathSpeechParts(completeQuestion));
  assert.equal(parts.length, 7);
  assert.match(parts[0], /^첫 번째 문제입니다\./);
  assert.deepEqual(parts.slice(1), orderedTail);

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
  assert.deepEqual(fallbackCalls, [completeQuestion.split("\n").slice(0, 2).join("\n"), ...orderedTail]);
  const fallbackText = fallbackCalls.join("\n");

  let previous = -1;
  for (const expected of orderedTail) {
    const position = fallbackText.indexOf(expected);
    assert.ok(position > previous, `${expected} must remain in order in fallback speech`);
    previous = position;
  }
  assert.match(fallbackText, /이 선택지, 3분의 2\.\n정답은 어느 보기인가요\?$/);
});

test("successful natural speech plays body, A-E and final question exactly once in order", async () => {
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
    completeQuestion.split("\n").slice(0, 2).join("\n"),
    ...orderedTail
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
    "all speech requests must preserve the planned order"
  );

  for (let index = 0; index < expectedParts.length; index += 1) {
    await flushUntil(() => audioInstances.length === index + 1, `clip ${index} must start only after its predecessor`);
    assert.equal(playedSources[index], `data:audio/mpeg;base64,audio-part-${index + 1}`);
    audioInstances[index].emit("ended");
  }
  await speechFinished;

  assert.deepEqual(fallbackCalls, [], "a successful natural voice sequence must not invoke fallback");
  assert.equal(context.currentAudio, null);
});

test("recorded numeric D/E choices have explicit Korean scripts", () => {
  const course = "suneung-2027-math-probability";
  for (const [input, expected] of [
    ["디 선택지, 12.", "디 선택지. 값은 십이입니다."],
    ["이 선택지, 14.", "이 선택지. 값은 십사입니다."],
    ["디 선택지, 0.75.", "디 선택지. 값은 영 점 칠 오입니다."],
    ["이 선택지, 1.35.", "이 선택지. 값은 일 점 삼 오입니다."],
    ["이 선택지, -0.05.", "이 선택지. 값은 마이너스 영 점 영 오입니다."]
  ]) assert.equal(numericChoiceScript(input, course), expected);
  assert.equal(numericChoiceScript("이 선택지, 1.35.", "toeic"), "이 선택지, 1.35.");
  assert.equal(numericChoiceScript("디 선택지, 2분의 1.", course), "디 선택지, 2분의 1.");
});

for (const failure of ["D generation", "E playback"]) {
  test(`${failure} falls back only for the failed clip without repeating earlier choices`, async () => {
    const played = [];
    const fallback = [];
    const paused = [];
    const parts = [completeQuestion.split("\n").slice(0, 2).join("\n"), ...orderedTail];
    let count = 0;
    class Clip {
      constructor(source) { this.index = Number(source.split(",").at(-1)); this.events = {}; }
      addEventListener(type, listener) { this.events[type] = listener; }
      pause() { paused.push(this.index); }
      play() {
        played.push(this.index);
        queueMicrotask(() => this.events[failure === "E playback" && this.index === 5 ? "error" : "ended"]());
        return Promise.resolve();
      }
    }
    const context = {
      COURSE_ID:"suneung-2027-math-probability", COURSE:{ avatar:false },
      IS_SUNEUNG:true, IS_MATH:true, activeSpeechId:0,
      currentAudio:null, currentSpeechResolve:null, teacherVolume:0.45, courseRunId:"test",
      cleanMathForSpeech:String, cleanLessonForSpeech:String,
      browserSpeak:async (text) => { fallback.push(text); },
      readJsonResponse:async (response) => response.payload,
      fetch:async () => {
        const index = count++;
        if (failure === "D generation" && index === 4) throw new Error("test network error");
        return { ok:true, payload:{ audio:String(index), mimeType:"audio/mpeg" } };
      },
      Audio:Clip, CustomEvent:class {}, window:{ dispatchEvent() {} }, console:{ warn() {} }
    };
    runInNewContext(`
      ${extractNamedFunction(learnHtml, "splitSuneungMathSpeechParts")}
      function cancelCurrentSpeech() { activeSpeechId += 1; }
      async ${extractNamedFunction(learnHtml, "speakText")}
      this.speakText = speakText;
    `, context);
    await context.speakText(completeQuestion);
    assert.deepEqual(fallback, [parts[failure === "D generation" ? 4 : 5]]);
    assert.deepEqual(played, failure === "D generation" ? [0,1,2,3,5,6] : [0,1,2,3,4,5,6]);
    assert.deepEqual(paused, failure === "E playback" ? [5] : []);
  });
}

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
