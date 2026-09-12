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
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function element() {
  return {
    children: [], listeners: {}, hidden: false, disabled: false, value: "", textContent: "",
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(name, value) { this[name] = value; },
    focus() {}, remove() { this.removed = true; }
  };
}
const question = (number) => `문제 ${number}/10 — 개념 확인 · 도전 1/3\n서로 다른 실험 ${number}의 값은?\nA) 줄\nB) 옴\nC) 와트\nD) 암페어\nE) 볼트\n정답은 어느 보기인가요?\n답: (________)`;
function harness() {
  const nodes = new Map();
  const rendered = [];
  const requests = [];
  const pending = [];
  const context = {
    COURSE_ID: "suneung-2028-integrated-science", COURSE: { avatar: false, voice: false, greeting: "시작해 주세요." },
    IS_SUNEUNG: true, IS_MATH: false, IS_KOREAN: false, IS_SOCIAL: false, IS_HISTORY: false, IS_SCIENCE: true, IS_ENGLISH: false,
    IS_GENERATIVE_LESSON: true, AVATAR_TEXT: {}, courseRunId: "run-A", lessonSeed: "seed-A", lessonManuallyEnded: false,
    scienceTurnState: { epoch: 0, revision: 0, busy: false, transcribing: false, restarting: false, question: 0, key: "" },
    sessionReady: Promise.resolve(true), sessionEnded: false, sessionEnding: false,
    messages: [], courseHistory: [], input: element(), sendButton: element(), micButton: element(), connection: element(), chat: element(), endLessonButton: element(),
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); }, createElement: element, createTextNode: (text) => ({ textContent: text }) },
    FileReader: class { readAsDataURL() { this.result = "data:audio/webm;base64,QUJD"; this.onload(); } },
    fetch(url, options) { const request = { url, body: JSON.parse(options.body) }; requests.push(request); const response = deferred(); pending.push(response); return response.promise; },
    readJsonResponse: async (response) => response.data,
    addMessage(role, text, type) { const node = element(); rendered.push({ role, text, type, node }); return node; },
    lastAssistantText: question(1), currentQuestionNumber: 1, questionStartedAt: 0,
    voiceFailureNoticeShown: false, autoSpeak: false, mobileLessonMedia: { matches: false },
    cancelScienceRecording() {}, cancelCurrentSpeech() {}, scheduleRecording() {}, settleMobileLessonView() {},
    isLessonStartRequest: (text) => text === "시작", cleanForDisplay: (text) => text, ensureVisibleAnswerSlot: (text) => text,
    rememberGeneratedProblem() {}, recordAssessment() {}, learningProfileForRequest: () => ({}), renderLearningProgress() {},
    trackCurrentQuestion() {}, hasCompletedCurrentSuneungLesson: () => false, finishLesson: async () => {},
    console: { error() {}, warn() {} }, crypto: { randomUUID: () => "seed-B" }
  };
  const names = ["scienceTurnSnapshot", "isCurrentScienceTurn", "updateScienceAnswerControls", "setLoading", "sendMessage", "transcribeRecording"];
  runInNewContext(names.map(namedFunction).join("\n"), context);
  return { context, nodes, rendered, requests, pending };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("science answer buttons use the visible A–E mapping and retire earlier question handlers", async () => {
  const { context, nodes } = harness();
  const sent = [];
  context.sendMessage = (text) => sent.push(text);
  context.updateScienceAnswerControls(question(1));
  const buttons = nodes.get("science-answer-buttons").children;
  assert.deepEqual(buttons.map((button) => button.textContent), ["A (1)", "B (2)", "C (3)", "D (4)", "E (5)", "새 문제 →"]);
  buttons[4].listeners.click();
  assert.deepEqual(sent, ["E"]);
  context.updateScienceAnswerControls("힌트: 측정하는 물리량을 생각해 보세요.");
  assert.equal(nodes.get("science-answer-buttons").children.length, 6);
  context.updateScienceAnswerControls(question(2));
  buttons[4].listeners.click();
  assert.deepEqual(sent, ["E"], "retired question must never grade the new question");
  nodes.get("science-answer-buttons").children[5].listeners.click();
  assert.deepEqual(sent, ["E", "새 문제"]);
});

test("pending science transcription locks all answers and submits its result exactly once", async () => {
  const { context, nodes, requests, pending } = harness();
  context.updateScienceAnswerControls(question(1));
  const asr = context.transcribeRecording({ type: "audio/webm" });
  await flush();
  assert.equal(context.input.disabled, true);
  assert.ok(nodes.get("science-answer-buttons").children.every((button) => button.disabled));
  await context.sendMessage("A");
  assert.deepEqual(requests.map((request) => request.url), ["/api/transcribe"]);
  pending[0].resolve({ ok: true, data: { text: "E" } });
  await flush();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, "/api/chat");
  assert.equal(requests[1].body.inputMode, "voice");
  assert.equal(requests[1].body.messages.at(-1).content, "E");
  pending[1].resolve({ ok: true, data: { text: question(2) } });
  await asr;
  assert.equal(context.input.disabled, false);
  assert.equal(context.input.value, "");
  assert.equal(context.scienceTurnState.question, 2);
});

test("late transcription from an earlier run cannot answer or unlock the new run", async () => {
  const { context, requests, pending, rendered } = harness();
  const asr = context.transcribeRecording({ type: "audio/webm" });
  await flush();
  context.scienceTurnState.epoch += 1;
  context.courseRunId = "run-B";
  context.scienceTurnState.transcribing = false;
  context.scienceTurnState.busy = true;
  pending[0].resolve({ ok: true, data: { text: "2" } });
  await asr;
  assert.equal(requests.length, 1);
  assert.equal(rendered.length, 0);
  assert.equal(context.input.disabled, true);
  assert.equal(context.scienceTurnState.busy, true);
});

test("science serializes same-tick submissions and ignores late chat after restart", async () => {
  const { context, requests, pending, rendered } = harness();
  const first = context.sendMessage("E");
  const second = context.sendMessage("A");
  await flush();
  assert.equal(requests.length, 1);
  await second;
  context.scienceTurnState.epoch += 1;
  context.courseRunId = "run-B";
  context.scienceTurnState.busy = true;
  context.lastAssistantText = "새 수업";
  pending[0].resolve({ ok: true, data: { text: question(8) } });
  await first;
  assert.equal(context.lastAssistantText, "새 수업");
  assert.ok(!rendered.some((message) => message.text === question(8)));
  assert.equal(context.scienceTurnState.busy, true);
});

test("skipped science questions count toward completion but never correct, incorrect, or weakness", () => {
  const { context } = harness();
  Object.assign(context, { progressStorageKey: "test", learningRecords: [], progressCorrect: element(), progressIncorrect: element(), progressTime: element(), progressWeak: element(), saveLocalJson() {} });
  runInNewContext(["safeProgressTopic", "weakTopicList", "renderLearningProgress", "recordAssessment", "learningProfileForRequest", "hasCompletedCurrentSuneungLesson"].map(namedFunction).join("\n"), context);
  for (let number = 1; number <= 10; number += 1) {
    context.recordAssessment({ question: number, attempts: 0, outcome: "skipped", topic: "실험", stage: "개념 확인" }, Date.now());
  }
  const profile = context.learningProfileForRequest();
  assert.equal(profile.completed, 10);
  assert.equal(profile.correct, 0);
  assert.equal(profile.incorrect, 0);
  assert.equal(profile.weakTopics.length, 0);
  assert.equal(context.hasCompletedCurrentSuneungLesson(), true);
  context.COURSE_ID = "suneung-2028-math";
  context.learningRecords = [];
  context.recordAssessment({ question: 1, attempts: 0, outcome: "skipped" }, Date.now());
  assert.equal(context.learningRecords.length, 0, "math must not accept skipped science records");
});

test("science restart cancels the old turn, restores readiness, and starts fresh questions automatically", async () => {
  const { context, nodes, requests, pending } = harness();
  context.sessionReady = Promise.resolve(false);
  context.lessonManuallyEnded = true;
  context.sessionRequest = async () => ({ courseRunId: "run-B" });
  const start = html.indexOf('document.getElementById("restart").addEventListener("click", async () => {');
  const end = html.indexOf("\n\n    speakButton.addEventListener", start);
  runInNewContext(html.slice(start, end), context);
  const restart = nodes.get("restart").listeners.click();
  await flush();
  assert.equal(context.courseRunId, "run-B");
  assert.equal(await context.sessionReady, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.messages.at(-1).content, "시작");
  assert.equal(requests[0].body.courseRunId, "run-B");
  pending[0].resolve({ ok: true, data: { text: question(1) } });
  await restart;
  assert.equal(context.input.disabled, false);
  assert.equal(context.scienceTurnState.question, 1);
});


test("ending a science lesson invalidates a pending answer before it can render or speak", async () => {
  const { context, pending, rendered } = harness();
  Object.assign(context, {
    conversationMode: false, discardRecording: false, nextRecordingTimer: null,
    recordingTimer: null, recordingCountdownTimer: null, audioLevelTimer: null,
    recorder: null, recordingStream: null, clearTimeout() {}, clearInterval() {}, resetMic() {}
  });
  runInNewContext(namedFunction("stopLessonMedia"), context);
  const answer = context.sendMessage("E");
  await flush();
  context.stopLessonMedia();
  pending[0].resolve({ ok: true, data: { text: question(2) } });
  await answer;
  assert.equal(context.input.disabled, true);
  assert.equal(context.scienceTurnState.busy, false);
  assert.ok(!rendered.some((message) => message.text === question(2)));
  assert.equal(context.scienceTurnState.question, 0);
});
