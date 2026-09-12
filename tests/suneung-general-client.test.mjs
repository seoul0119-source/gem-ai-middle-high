import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const html = await readFile(new URL("../learn.html", import.meta.url), "utf8");
function namedFunction(name) {
  const asyncStart = html.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : html.indexOf(`function ${name}`);
  assert.notEqual(start, -1, name);
  let depth = 0;
  for (let i = html.indexOf("{", start); i < html.length; i += 1) {
    if (html[i] === "{") depth += 1;
    if (html[i] === "}") depth -= 1;
    if (!depth) return html.slice(start, i + 1);
  }
  assert.fail(`Missing body for ${name}`);
}
const configContext = {};
runInNewContext(namedFunction("suneungGeneralClientConfigs"), configContext);
const configs = configContext.suneungGeneralClientConfigs();
const question = (number = 1, passage = "학생들에게 토양 관리 방법을 설명하려고 합니다.") => `문제 ${number}/10 · 핵심 개념 · 도전 1/3\n${passage}\n발표 방법으로 적절한 것은?\nA) 전문 용어를 설명하지 않는다.\nB) 핵심 내용은 생략한다.\nC) 쉬운 말과 사례를 사용한다.\nD) 다른 이야기를 한다.\nE) 전문가 자료를 그대로 읽는다.\n답: (________)`;
const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function element() {
  return {
    children: [], listeners: {}, hidden: false, disabled: false, value: "", textContent: "",
    appendChild(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; },
    addEventListener(type, fn) { this.listeners[type] = fn; }, setAttribute(name, value) { this[name] = value; },
    focus() {}, remove() { this.removed = true; }
  };
}
function harness(id = "suneung-2027-korean-speech-writing") {
  const nodes = new Map();
  const rendered = [], requests = [], pending = [];
  const context = {
    COURSE_ID: id, COURSE: configs[id], IS_SUNEUNG: true, IS_MATH: false, IS_KOREAN: true,
    IS_SOCIAL: false, IS_HISTORY: false, IS_SCIENCE: false, IS_ENGLISH: false, IS_GENERATIVE_LESSON: true,
    AVATAR_TEXT: {}, courseRunId: "run-A", lessonSeed: "seed-A", lessonManuallyEnded: false,
    scienceTurnState: { epoch: 0, revision: 0, busy: false, transcribing: false, restarting: false, question: 0, key: "" },
    sessionReady: Promise.resolve(true), sessionEnded: false, sessionEnding: false,
    messages: [], courseHistory: [], courseHistoryStorageKey: `test-${id}`, saved: [],
    input: element(), sendButton: element(), micButton: element(), connection: element(), chat: element(), endLessonButton: element(),
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); }, createElement: element, createTextNode: (text) => ({ textContent: text }) },
    FileReader: class { readAsDataURL() { this.result = "data:audio/webm;base64,QUJD"; this.onload(); } },
    fetch(url, options) { requests.push({ url, body: JSON.parse(options.body) }); const result = deferred(); pending.push(result); return result.promise; },
    readJsonResponse: async (response) => response.data,
    addMessage(role, text, type) { const node = element(); rendered.push({ role, text, type, node }); return node; },
    lastAssistantText: question(), currentQuestionNumber: 1, questionStartedAt: 0, voiceFailureNoticeShown: false,
    autoSpeak: false, mobileLessonMedia: { matches: false },
    cancelScienceRecording() {}, cancelCurrentSpeech() {}, scheduleRecording() {}, settleMobileLessonView() {},
    isLessonStartRequest: (text) => text === "시작", cleanForDisplay: String, ensureVisibleAnswerSlot: String,
    recordAssessment() {}, learningProfileForRequest: () => ({}), renderLearningProgress() {}, trackCurrentQuestion() {},
    hasCompletedCurrentSuneungLesson: () => false, finishLesson: async () => {},
    console: { error() {}, warn() {} }, crypto: { randomUUID: () => "seed-B" }
  };
  context.saveLocalJson = (key, value) => context.saved.push({ key, value: Array.from(value) });
  runInNewContext(["scienceTurnSnapshot", "isCurrentScienceTurn", "updateScienceAnswerControls", "setLoading", "rememberGeneratedProblem", "sendMessage", "transcribeRecording"].map(namedFunction).join("\n"), context);
  return { context, nodes, rendered, requests, pending };
}

test("all 35 general CSAT courses have explicit subject routing and retain real question history", () => {
  assert.equal(Object.keys(configs).length, 35);
  const flagStart = html.indexOf("const IS_SUNEUNG =");
  const flagEnd = html.indexOf("const IS_VISUAL_LESSON", flagStart);
  for (const [id, course] of Object.entries(configs)) {
    const context = { COURSE: course, COURSE_ID: id };
    runInNewContext(`${html.slice(flagStart, flagEnd)}\nthis.generative = IS_GENERATIVE_LESSON; this.social = IS_SOCIAL;`, context);
    assert.equal(context.generative, true, id);
    const { context: lesson } = harness(id);
    lesson.rememberGeneratedProblem(question());
    lesson.rememberGeneratedProblem("문제 1/10 · AI 설명\n토양 관리는 식물이 잘 자라도록 흙의 상태를 돌보는 일입니다.");
    lesson.rememberGeneratedProblem(question().replace("도전 1/3", "도전 2/3"));
    assert.equal(lesson.courseHistory.length, 1, id);
    assert.match(lesson.courseHistory[0], /E\) 전문가/);
    assert.equal(lesson.saved[0].key, `test-${id}`);
    if (id.includes("-social-")) {
      assert.equal(context.social, true, id);
      assert.equal(course.entrance, `/suneung.html#year=2027&subject=social&track=${id.replace("suneung-2027-social-", "")}`);
    }
  }
  assert.equal(configs["suneung-2027-korean-speech-writing"].entrance, "/suneung.html#year=2027&subject=korean&track=speech-writing");
  assert.equal(configs["suneung-2028-integrated-social"].entrance, "/suneung.html#year=2028&subject=social");
});

test("every general course provides A–E buttons and keeps them through explanations", () => {
  for (const id of Object.keys(configs)) {
    const { context, nodes } = harness(id);
    const sent = [];
    context.sendMessage = (text) => sent.push(text);
    context.updateScienceAnswerControls(question());
    const oldButtons = nodes.get("science-answer-buttons").children;
    assert.deepEqual(oldButtons.map((button) => button.textContent), ["A (1)", "B (2)", "C (3)", "D (4)", "E (5)"], id);
    oldButtons[4].listeners.click();
    assert.deepEqual(sent, ["E"]);
    context.updateScienceAnswerControls("문제 1/10 · AI 설명\n토양 관리는 흙의 상태를 돌보는 것입니다.");
    assert.equal(nodes.get("science-answer-buttons").children.length, 5);
    context.updateScienceAnswerControls(question(2));
    oldButtons[4].listeners.click();
    assert.deepEqual(sent, ["E"], "old E must not answer the next question");
    assert.equal(nodes.get("science-skip-help").hidden, true, "unsupported skip must not be advertised");
    context.updateScienceAnswerControls("문제 3/10\n답을 직접 써 보세요.");
    assert.equal(nodes.get("science-answers").hidden, true, "new question without choices must retire old buttons");
  }
});

test("general submissions serialize, send retained history and reject late replies after restart", async () => {
  const { context, requests, pending, rendered } = harness();
  context.rememberGeneratedProblem(question());
  const first = context.sendMessage("답은 C입니다");
  await context.sendMessage("E");
  await flush();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.history.length, 1);
  context.scienceTurnState.epoch += 1;
  context.courseRunId = "run-B";
  context.scienceTurnState.busy = true;
  context.lastAssistantText = "새 수업";
  pending[0].resolve({ ok: true, data: { text: question(8) } });
  await first;
  assert.equal(context.lastAssistantText, "새 수업");
  assert.ok(!rendered.some(({ text }) => text === question(8)));
  assert.equal(context.scienceTurnState.busy, true);
});

test("general voice E locks competing answers then advances once; stale ASR cannot answer a new run", async () => {
  const { context, nodes, requests, pending } = harness();
  context.updateScienceAnswerControls(question());
  const asr = context.transcribeRecording({ type: "audio/webm" });
  await flush();
  assert.ok(nodes.get("science-answer-buttons").children.every((button) => button.disabled));
  await context.sendMessage("A");
  assert.equal(requests.length, 1);
  pending[0].resolve({ ok: true, data: { text: "E" } });
  await flush();
  assert.equal(requests[1].body.inputMode, "voice");
  assert.equal(requests[1].body.messages.at(-1).content, "E");
  pending[1].resolve({ ok: true, data: { text: question(2) } });
  await asr;
  assert.equal(context.scienceTurnState.question, 2);
  assert.equal(context.input.value, "");
  const lateAsr = context.transcribeRecording({ type: "audio/webm" });
  await flush();
  context.scienceTurnState.epoch += 1;
  context.courseRunId = "run-B";
  context.scienceTurnState.busy = true;
  pending[2].resolve({ ok: true, data: { text: "2" } });
  await lateAsr;
  assert.equal(requests.length, 3);
  assert.equal(context.scienceTurnState.busy, true);
});

function servicePauseHarness() {
  const lesson = harness("suneung-2028-english");
  const { context } = lesson;
  const scheduled = [];
  let released = 0;
  context.document.body = { classList: { remove() {}, toggle() {} } };
  Object.assign(context, {
    conversationMode: true, autoSpeak: true, discardRecording: false,
    nextRecordingTimer: 17, clearTimeout() {},
    setTimeout(fn) { scheduled.push(fn); return scheduled.length; },
    recorder: null,
    resetMic(release) { if (release) released++; context.micButton.textContent = "🎙 음성 대화 시작"; },
    startRecording() { scheduled.push("manual-start"); }
  });
  runInNewContext(["cancelScienceRecording", "pauseVoiceForServiceError", "scheduleRecording", "toggleConversation"].map(namedFunction).join("\n"), context);
  return { ...lesson, scheduled, released: () => released };
}

test("credit exhaustion during English voice start pauses retries and can be resumed manually", async () => {
  const { context, requests, pending, rendered, scheduled, released } = servicePauseHarness();
  context.messages = [];
  const asr = context.transcribeRecording({ type: "audio/webm" });
  await flush();
  pending[0].resolve({ ok: false, data: {
    error: "AI 서비스 이용 한도로 수업이 잠시 중지되었습니다. 선생님에게 알려 주세요.",
    code: "ai_credit_exhausted", retryable: false, pauseVoice: true
  } });
  await asr;
  assert.equal(requests.length, 1);
  assert.equal(context.conversationMode, false);
  assert.equal(context.autoSpeak, false);
  assert.equal(context.nextRecordingTimer, null);
  assert.equal(released(), 1);
  assert.deepEqual(scheduled, []);
  assert.equal(context.messages.length, 0);
  assert.equal(context.scienceTurnState.transcribing, false);
  assert.equal(context.input.disabled, false);
  assert.equal(context.micButton.disabled, false);
  assert.match(context.connection.innerHTML, /AI 서비스 확인 필요/);
  assert.ok(rendered.some(({text}) => /이용 한도/.test(text)));
  assert.ok(!rendered.some(({text}) => /알아듣지|couldn't understand/i.test(text)));
  await context.toggleConversation();
  assert.equal(context.conversationMode, true);
  assert.equal(context.connection.servicePaused, false);
  assert.deepEqual(scheduled, ["manual-start"]);
});

test("a rejected English answer preserves the current question and retries without a phantom attempt", async () => {
  const { context, nodes, requests, pending, scheduled } = servicePauseHarness();
  const originalQuestion = question();
  context.messages = [{ role: "assistant", content: originalQuestion }];
  context.updateScienceAnswerControls(originalQuestion);
  let assessments = 0;
  context.recordAssessment = () => { assessments++; };
  const failed = context.sendMessage("C", "voice");
  await flush();
  pending[0].resolve({ ok: false, data: { error: "서비스 이용 한도를 확인해 주세요.", code: "ai_credit_exhausted", pauseVoice: true } });
  await failed;
  assert.equal(context.messages.length, 1);
  assert.equal(context.messages[0].content, originalQuestion);
  assert.equal(context.lastAssistantText, originalQuestion);
  assert.equal(assessments, 0);
  assert.equal(context.scienceTurnState.question, 1);
  assert.equal(nodes.get("science-answer-buttons").children.length, 5);
  assert.deepEqual(scheduled, []);
  const retry = context.sendMessage("C");
  await flush();
  assert.equal(requests[1].body.messages.filter(message => message.role === "user").length, 1);
  pending[1].resolve({ ok: true, data: { text: question(2) } });
  await retry;
  assert.equal(context.connection.servicePaused, false);
  assert.equal(context.scienceTurnState.question, 2);
  assert.equal(assessments, 1);
});

test("successful Korean voice start in English reaches the teacher once and displays complete question one", async () => {
  const { context, requests, pending } = harness("suneung-2028-english");
  context.messages = [];
  context.currentQuestionNumber = 0;
  const start = context.transcribeRecording({ type: "audio/webm" });
  await flush();
  pending[0].resolve({ ok: true, data: { text: "안녕하세요. 영어 수업 시작해 주세요." } });
  await flush();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.inputMode, "voice");
  assert.equal(requests[1].body.messages.at(-1).content, "안녕하세요. 영어 수업 시작해 주세요.");
  pending[1].resolve({ ok: true, data: { text: question() } });
  await start;
  assert.equal(context.scienceTurnState.question, 1);
  assert.match(context.lastAssistantText, /E\)/);
  assert.equal(context.input.disabled, false);
});

test("a TTS billing failure pauses voice without replaying the question or discarding the accepted lesson", async () => {
  const { context, rendered, scheduled } = servicePauseHarness();
  const acceptedQuestion = question();
  context.messages = [{ role: "assistant", content: acceptedQuestion }];
  Object.assign(context, {
    activeSpeechId: 0, currentAudio: null, currentSpeechResolve: null,
    teacherVolume: 0.65, CustomEvent: class {}, window: { dispatchEvent() {} },
    browserSpeak: async () => { assert.fail("billing failure must not start fallback audio"); },
    fetch: async () => ({ ok: false, data: { error: "AI 서비스 이용 한도를 확인해 주세요.", pauseVoice: true } })
  });
  runInNewContext(["cleanLessonForSpeech", "splitSuneungGeneralSpeechParts", "speakText"].map(namedFunction).join("\n"), context);
  await context.speakText(acceptedQuestion);
  assert.equal(context.conversationMode, false);
  assert.equal(context.autoSpeak, false);
  assert.equal(context.messages[0].content, acceptedQuestion);
  assert.equal(context.messages.length, 1);
  assert.equal(rendered.filter(({text}) => /이용 한도/.test(text)).length, 1);
  assert.deepEqual(scheduled, []);
  assert.match(context.connection.innerHTML, /AI 서비스 확인 필요/);
});

test("general restart automatically starts one new lesson and invalidates the prior run", async () => {
  const { context, nodes, requests, pending } = harness();
  context.sessionRequest = async () => ({ courseRunId: "run-B" });
  const start = html.indexOf('document.getElementById("restart").addEventListener("click", async () => {');
  const end = html.indexOf("\n\n    speakButton.addEventListener", start);
  runInNewContext(html.slice(start, end), context);
  const restart = nodes.get("restart").listeners.click();
  await flush();
  assert.equal(context.courseRunId, "run-B");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.messages.at(-1).content, "시작");
  pending[0].resolve({ ok: true, data: { text: question() } });
  await restart;
  assert.equal(context.scienceTurnState.question, 1);
  assert.equal(context.input.disabled, false);
});

test("a validated tenth record ends every general course regardless of completion wording", async () => {
  const closingTexts = ["10문제를 모두 풀었습니다. 수고하셨습니다!", "이번 수업을 마쳤습니다."];
  for (const [index, id] of Object.keys(configs).entries()) {
    const { context, nodes, pending } = harness(id);
    let endCalls = 0;
    Object.assign(context, {
      progressStorageKey: "completion-test", learningRecords: [], currentQuestionNumber: 10,
      conversationMode: true, discardRecording: false, nextRecordingTimer: null,
      recordingTimer: null, recordingCountdownTimer: null, audioLevelTimer: null,
      recorder: null, recordingStream: null, clearTimeout() {}, clearInterval() {}, resetMic() {},
      endCourseTracking: async () => { endCalls += 1; }
    });
    runInNewContext(["safeProgressTopic", "recordAssessment", "hasCompletedCurrentSuneungLesson", "stopLessonMedia", "finishLesson"].map(namedFunction).join("\n"), context);
    for (let number = 1; number < 10; number += 1) {
      context.recordAssessment({ question: number, attempts: 1, outcome: "correct", topic: "개념" }, Date.now());
    }
    context.updateScienceAnswerControls(question(10));
    const answer = context.sendMessage("답은 C입니다");
    await flush();
    pending[0].resolve({ ok: true, data: {
      text: closingTexts[index % closingTexts.length],
      record: { question: 10, attempts: 1, outcome: "correct", topic: "개념" }
    } });
    await answer;
    assert.equal(context.hasCompletedCurrentSuneungLesson(), true, id);
    assert.equal(context.lessonManuallyEnded, true, id);
    assert.equal(context.conversationMode, false, id);
    assert.equal(context.input.disabled, true, id);
    assert.equal(context.micButton.disabled, true, id);
    assert.equal(nodes.get("science-answers").hidden, true, id);
    assert.equal(nodes.get("science-answer-buttons").children.length, 0, id);
    assert.equal(endCalls, 1, id);
  }
});

test("completion wording alone or an invalid tenth assessment never ends a general lesson", async () => {
  for (const record of [undefined, { question: 10, attempts: 0, outcome: "correct" }, { question: 10, attempts: 1, outcome: "unknown" }]) {
    const { context, pending } = harness();
    let endCalls = 0;
    Object.assign(context, { progressStorageKey: "completion-test", learningRecords: [], finishLesson: async () => { endCalls += 1; } });
    runInNewContext(["safeProgressTopic", "recordAssessment", "hasCompletedCurrentSuneungLesson"].map(namedFunction).join("\n"), context);
    const answer = context.sendMessage("답은 C입니다");
    await flush();
    pending[0].resolve({ ok: true, data: { text: "수업 종료. 10문제를 모두 풀었습니다.", record } });
    await answer;
    assert.equal(context.hasCompletedCurrentSuneungLesson(), false);
    assert.equal(context.input.disabled, false);
    assert.equal(endCalls, 0);
  }
});

function speechHarness(course) {
  const context = { COURSE: course, COURSE_ID: "suneung-2027-korean-speech-writing", cleanForDisplay: String };
  runInNewContext(["cleanLessonForSpeech", "splitSuneungGeneralSpeechParts", "generalSuneungBrowserParts"].map(namedFunction).join("\n"), context);
  return context;
}

test("all general courses preserve long passages, A–E order and final answer prompt without math rewrites", () => {
  const passage = "3/1에 발표한 자료입니다. a+b 기호는 원문입니다. ".repeat(120);
  for (const course of Object.values(configs)) {
    const context = speechHarness(course);
    const spoken = context.cleanLessonForSpeech(question(1, passage));
    assert.equal(context.cleanLessonForSpeech(`${question(1, passage)}\n정답은 어느 보기인가요?`), spoken, "only one final answer prompt");
    assert.equal(context.cleanLessonForSpeech(spoken), spoken, "speech normalization is idempotent");
    const parts = Array.from(context.splitSuneungGeneralSpeechParts(spoken));
    assert.ok(parts.every((part) => part.length <= 1200));
    assert.match(parts.join("\n"), /3\/1/);
    assert.match(parts.join("\n"), /a\+b/);
    const choices = parts.filter((part) => /^[A-E]\)/.test(part));
    assert.deepEqual(choices.map((part) => part[0]), ["A", "B", "C", "D", "E"]);
    assert.equal(parts.at(-1), "정답은 어느 보기인가요?");
    assert.equal(parts.join("").replace(/\s/g, ""), spoken.replace(/\s/g, ""), "no passage/option text may disappear");
    const withoutE = context.cleanLessonForSpeech(question().replace(/^E\).+\n/m, ""));
    assert.ok(!context.splitSuneungGeneralSpeechParts(withoutE).some((part) => /^E\)/.test(part)), "never invent E");
  }
});

test("all second-language fallbacks keep Korean narration and native choice language", () => {
  const examples = { german: "Guten Morgen", french: "Bonjour", spanish: "Buenos días", chinese: "你好", japanese: "こんにちは", russian: "Здравствуйте", arabic: "مرحبا", vietnamese: "Xin chào", hanmun: "學而時習之" };
  for (const year of ["2027", "2028"]) for (const [language, value] of Object.entries(examples)) {
    const course = configs[`suneung-${year}-second-${language}`];
    const context = speechHarness(course);
    const parts = Array.from(context.generalSuneungBrowserParts(`알맞은 인사를 고르세요.\nE) ${value}\n정답은 어느 보기인가요?`));
    assert.equal(parts[0].language, "ko-KR");
    assert.equal(parts[1].text, "알파벳 이 선택지.");
    assert.equal(parts[1].language, "ko-KR");
    assert.equal(parts[2].language, course.targetLanguage, language);
    assert.equal(parts[3].language, "ko-KR");
  }
});

test("general D generation and E playback failures recover only the affected clip", async () => {
  for (const fail of ["D", "E"]) {
    const course = configs["suneung-2027-korean-speech-writing"];
    const context = speechHarness(course);
    const requested = [], played = [], fallback = [];
    Object.assign(context, {
      IS_SUNEUNG: true, IS_MATH: false, activeSpeechId: 0, currentAudio: null, currentSpeechResolve: null,
      teacherVolume: 0.65, courseRunId: "voice-test", CustomEvent: class {}, window: { dispatchEvent() {} }, console: { warn() {} },
      cancelCurrentSpeech() { context.activeSpeechId += 1; }, browserSpeak: async (text) => { fallback.push(text); },
      readJsonResponse: async (response) => response.data,
      fetch: async (_url, options) => {
        const part = JSON.parse(options.body).text;
        requested.push(part);
        return { ok: !(fail === "D" && /^D\)/.test(part)), data: { audio: String(requested.length - 1), mimeType: "audio/mpeg" } };
      },
      Audio: class {
        constructor(source) { this.index = Number(source.split(",").at(-1)); this.events = {}; }
        addEventListener(name, fn) { this.events[name] = fn; }
        pause() {}
        play() { played.push(this.index); queueMicrotask(() => this.events[fail === "E" && /^E\)/.test(requested[this.index]) ? "error" : "ended"]()); return Promise.resolve(); }
      }
    });
    runInNewContext(namedFunction("speakText"), context);
    await context.speakText(question());
    assert.equal(fallback.length, 1);
    assert.match(fallback[0], new RegExp(`^${fail}\\)`));
    assert.equal(new Set(played).size, played.length, "earlier audio must not replay");
    assert.equal(requested.at(-1), "정답은 어느 보기인가요?");
    assert.ok(played.includes(requested.length - 1), "answer prompt follows E even after fallback");
  }
});
