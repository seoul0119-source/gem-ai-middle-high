import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import chatHandler from "../api/chat-final.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

// Live build-only check: call the deployed handler implementation in-process,
// using synthetic BUILD_CHECK context. Never call a public classroom, session
// endpoint, student Sheet, or database. Only the configured AI provider may be
// contacted. The synthetic cookie and provider credentials never enter logs.
const DEADLINE_MS = 180_000;
const REQUEST_DEADLINE_MS = 55_000;
const MAX_APPLICATION_TURNS = 11;
const MAX_PROVIDER_REQUESTS = 24; // Includes bounded format/model retries.
const requestContext = new AsyncLocalStorage();
const globalAbort = new AbortController();
const realFetch = globalThis.fetch;
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console)
};
let applicationTurns = 0;
let providerRequests = 0;
let applicationDiagnostics = 0;

function requireCheck(condition, code) {
  if (!condition) throw new Error(`build_general_${code}`);
}

function responseCapture() {
  return {
    statusCode: 0,
    payload: null,
    headers: new Map(),
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); return this; },
    getHeader(name) { return this.headers.get(String(name).toLowerCase()); },
    end(value = "") {
      try { this.payload = value ? JSON.parse(String(value)) : {}; }
      catch { throw new Error("build_general_invalid_json"); }
      return this;
    }
  };
}

function syntheticLesson(courseId) {
  const courseRunId = `build-general:${randomUUID()}`;
  const token = createSessionToken({
    id: "BUILD_CHECK",
    name: "BUILD_CHECK",
    session: "build-general-check",
    courseId,
    courseRunId,
    startedAt: new Date().toISOString(),
    endedAt: null
  });
  requireCheck(Boolean(token), "synthetic_context_missing");
  return {
    courseId,
    courseRunId,
    cookie: `${SESSION_COOKIE}=${token}`,
    lessonSeed: randomUUID(),
    turn: 0,
    messages: [],
    lessonRecords: []
  };
}

async function ask(lesson, content) {
  applicationTurns += 1;
  lesson.turn += 1;
  originalConsole.log(`CSAT live turn: ${lesson.courseId}; turn=${lesson.turn}.`);
  requireCheck(applicationTurns <= MAX_APPLICATION_TURNS, "application_budget_exceeded");
  lesson.messages.push({ role: "user", content });
  const captured = responseCapture();
  const abort = new AbortController();
  let timeout;
  const timedOut = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      abort.abort();
      reject(new Error("build_general_request_deadline_exceeded"));
    }, REQUEST_DEADLINE_MS);
  });
  try {
    await Promise.race([
      requestContext.run({ signal: abort.signal, course: lesson.courseId, turn: lesson.turn }, () => chatHandler({
        method: "POST",
        headers: { cookie: lesson.cookie },
        body: {
          courseId: lesson.courseId,
          courseRunId: lesson.courseRunId,
          lessonSeed: lesson.lessonSeed,
          inputMode: "text",
          messages: lesson.messages.map(message => ({ ...message })),
          learningProfile: { lessonRecords: lesson.lessonRecords.map(record => ({ ...record })) },
          history: []
        }
      }, captured)),
      timedOut
    ]);
  } finally {
    clearTimeout(timeout);
  }
  if (captured.statusCode !== 200 || captured.payload?.error) {
    originalConsole.error(`CSAT live handler failed: ${lesson.courseId}; turn=${lesson.turn}; HTTP=${captured.statusCode}.`);
    throw new Error("build_general_handler_response_failed");
  }
  const payload = captured.payload;
  requireCheck(typeof payload?.text === "string" && payload.text.trim().length > 30, "empty_reply");
  requireCheck(!/새 문제를 다시 준비해 주세요|질문에 나온 핵심어를 지문에서 찾아|답안을 확인하지 못했습니다/.test(payload.text),
    "legacy_fallback_returned");
  requireCheck(!/\[\/?GEM_RECORD\]/i.test(payload.text), "private_record_visible");
  lesson.messages.push({ role: "assistant", content: payload.text });
  if (payload.record) lesson.lessonRecords.push(payload.record);
  return payload;
}

function verifyQuestion(payload, number) {
  const headings = [...payload.text.matchAll(/문제\s*(\d+)\s*\/\s*10/g)];
  requireCheck(headings.length === 1 && Number(headings[0][1]) === number, "question_sequence_failed");
  const question = payload.text.slice(headings[0].index);
  requireCheck(new RegExp(`^문제\\s*${number}\\s*\\/\\s*10\\s*[—–-]`).test(question), "question_header_failed");
  const labels = [...question.matchAll(/^\s*([A-E])\)\s*(\S[^\n]*)/gm)];
  requireCheck(labels.map(match => match[1]).join("") === "ABCDE", "five_choices_incomplete");
  requireCheck(/답\s*:\s*\([ _\u3000]{3,}\)\s*$/.test(question), "answer_slot_missing");
}

function verifyHelp(payload, expectedTerms = null) {
  requireCheck(!payload.record, "help_graded_as_answer");
  requireCheck(!/문제\s*\d+\s*\/\s*10/.test(payload.text), "help_replaced_question");
  requireCheck(!/도전\s*[123]\s*\/\s*3/.test(payload.text), "help_consumed_attempt");
  requireCheck(!/정답\s*(?:은|이|:)\s*(?:[A-E]|[1-5]\s*번)/i.test(payload.text), "help_disclosed_choice");
  if (expectedTerms) requireCheck(expectedTerms.test(payload.text), "contextual_help_missing");
}

const FIXTURES = [
  {
    name: "2028 Korean",
    courseId: "suneung-2028-korean",
    question: `문제 1/10 — 개념 · 국어 · 화법과 작문 · 5지선다형
다음은 학생이 발표를 준비하며 세운 계획이다.

같은 학년 친구들에게 학교 텃밭의 토양 관리 방법을 설명하려 한다. 친구들은 텃밭 활동에 관심은 있지만, 토양 관련 용어에는 익숙하지 않다.

청중의 특성을 고려한 발표 방법으로 가장 적절한 것은?
A) 전문 용어를 많이 사용하고 뜻풀이는 생략한다.
B) 관심이 있는 주제이므로 발표의 핵심 내용은 설명하지 않는다.
C) 낯선 용어를 쉬운 말로 풀고 텃밭 활동의 구체적인 사례를 든다.
D) 정보 전달보다 재미가 중요하므로 토양과 무관한 이야기로만 구성한다.
E) 청중의 배경지식과 관계없이 토양 연구자 대상의 발표 자료를 그대로 읽는다.

답: (________)`,
    hintTerms: /청중|친구|용어|배경지식|발표|텃밭/,
    concept: "토양 관리라는 게 무엇인가요? 쉽게 설명해 주세요.",
    conceptTerms: /토양|흙|물주기|거름|영양/,
    checkActualStart: true
  },
  {
    name: "2028 English",
    courseId: "suneung-2028-english",
    question: `문제 1/10 — 개념 · 영어 · 글의 목적 · 5지선다형
다음 글의 목적으로 가장 적절한 것은?

Dear Garden Club members,
Our Friday meeting has been rescheduled to Monday because the school garden will be closed for repairs this Friday. Please come to the garden at four o'clock on Monday. Thank you for your understanding.

A) To invite new members to join a sports team
B) To ask students to pay for garden repairs
C) To announce a change in the club meeting schedule
D) To cancel all future club activities
E) To explain how to grow vegetables at home

답: (________)`,
    hintTerms: /일정|변경|요일|날짜|회의|모임|안내|목적/,
    concept: "rescheduled는 무슨 뜻인가요? 여기서는 왜 그 말을 썼나요?",
    conceptTerms: /reschedul|일정|변경|다시\s*정|옮기/,
    checkActualStart: false
  },
  {
    name: "2028 French",
    courseId: "suneung-2028-second-french",
    answerChoice: "E",
    question: `문제 1/10 — 개념 · 프랑스어Ⅰ · 의사소통 · 5지선다형
다음 대화에서 감사 인사에 대한 응답으로 빈칸에 가장 알맞은 것은?

Léa : Merci pour ton aide !
Paul : ________

A) Je m'appelle Paul.
B) Il est trois heures.
C) Nous sommes lundi.
D) J'habite à Paris.
E) De rien !

답: (________)`,
    hintTerms: /감사|고마|응답|대답|merci/i,
    concept: "여기에서 ton은 무슨 뜻인가요? 누구를 가리키나요?",
    conceptTerms: /ton|너의|네\s*(?:도움|것)|소유/,
    checkActualStart: false
  }
];

async function verifyStory(fixture) {
  const lesson = syntheticLesson(fixture.courseId);
  lesson.messages.push({ role: "assistant", content: fixture.question });
  const hint = await ask(lesson, "힌트 주세요.");
  verifyHelp(hint, fixture.hintTerms);
  const explanation = await ask(lesson, fixture.concept);
  verifyHelp(explanation, fixture.conceptTerms);
  const answered = await ask(lesson, `답은 ${fixture.answerChoice || "C"}입니다.`);
  requireCheck(answered.record?.question === 1 && answered.record?.outcome === "correct"
    && answered.record?.attempts === 1 && answered.record?.stage === "개념"
    && answered.record?.scope === "direct", "correct_answer_not_recorded");
  verifyQuestion(answered, 2);

  if (fixture.checkActualStart) {
    const freshLesson = syntheticLesson(fixture.courseId);
    const first = await ask(freshLesson, "시작해 주세요.");
    requireCheck(!first.record, "start_graded_as_answer");
    requireCheck(/^문제\s*1\s*\/\s*10/.test(first.text), "start_has_no_canonical_header");
    verifyQuestion(first, 1);
    const help = await ask(freshLesson, "이 문제를 풀려면 어디부터 살펴보면 좋을까요?");
    verifyHelp(help);
  }
  originalConsole.log(`CSAT live general check passed: ${fixture.name}; contextual hint + concept explanation + correct ${fixture.answerChoice || "C"} + complete question 2${fixture.checkActualStart ? "; live question 1 + follow-up also checked" : ""}.`);
}

async function verifyGeneralCourses() {
  requireCheck(Boolean(process.env.OPENAI_API_KEY), "credentials_missing");
  requireCheck(typeof realFetch === "function", "fetch_unavailable");

  // Forward real provider requests unchanged apart from a stricter deadline.
  // There are no canned/fake AI responses, fallback test keys, or Sheet writes.
  globalThis.fetch = async (input, options = {}) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    requireCheck(url === "https://api.openai.com/v1/responses" && options.method === "POST", "network_scope_rejected");
    providerRequests += 1;
    requireCheck(providerRequests <= MAX_PROVIDER_REQUESTS, "provider_budget_exceeded");
    const signals = [globalAbort.signal, requestContext.getStore()?.signal, options.signal].filter(Boolean);
    return realFetch(input, { ...options, signal: AbortSignal.any(signals) });
  };

  // Emit only allowlisted event/reason codes; never exception messages, raw
  // provider data, request headers, cookies, proofs, student text or traces.
  const eventCodes = new Map([
    ["General CSAT turn rejected", "turn_rejected"],
    ["Out-of-sequence Suneung response rejected", "sequence_rejected"],
    ["Invalid or out-of-sequence Suneung record rejected", "record_rejected"],
    ["Incomplete general CSAT response rejected", "response_incomplete"],
    ["Incomplete Suneung five-choice set rejected", "choices_incomplete"],
    ["Duplicate lesson problem rejected", "duplicate_question"],
    ["OpenAI lesson error", "provider_error"],
    ["GEM chat error", "handler_exception"],
    ["CSAT preferred model unavailable; using supported fallback", "model_fallback"]
  ]);
  for (const method of ["log", "warn", "error", "info"]) {
    console[method] = (...args) => {
      applicationDiagnostics += 1;
      const context = requestContext.getStore();
      const event = eventCodes.get(args[0]);
      if (!event) return;
      const reason = args[1]?.reason;
      const safeReason = typeof reason === "string" && /^[a-z_]{1,100}$/.test(reason) ? reason : "none";
      const status = Number.isInteger(args[1]) && args[1] >= 400 && args[1] <= 599 ? args[1] : 0;
      const providerCode = event === "provider_error" && /^[a-z_]{1,80}$/.test(String(args[2] || "")) ? args[2] : "none";
      originalConsole.log(`CSAT build diagnostic: ${context?.course || "general"}; turn=${context?.turn || 0}; ${event}; reason=${safeReason}; HTTP=${status}; providerCode=${providerCode}.`);
    };
  }
  originalConsole.log("CSAT live general verification: 3 synthetic course stories; no student records are written.");
  const results = await Promise.allSettled(FIXTURES.map(async fixture => {
    try { return await verifyStory(fixture); }
    catch (error) { globalAbort.abort(); throw error; }
  }));
  for (const [index, result] of results.entries()) {
    if (result.status !== "rejected") continue;
    const code = /^build_general_[a-z_]+$/.test(result.reason?.message || "")
      ? result.reason.message : "build_general_request_failed";
    originalConsole.error(`CSAT live general case failed: ${FIXTURES[index].name}; ${code}.`);
  }
  const failed = results.find(result => result.status === "rejected");
  if (failed) throw failed.reason;
  requireCheck(applicationTurns === MAX_APPLICATION_TURNS && providerRequests >= MAX_APPLICATION_TURNS,
    "live_request_count_mismatch");
  originalConsole.log(`CSAT live general verification passed: 3/3 stories, ${applicationTurns} application turns, ${providerRequests} real provider requests, ${applicationDiagnostics} application diagnostics.`);
}

const deadline = setTimeout(() => {
  globalAbort.abort();
  originalConsole.error("CSAT live general verification failed: build_general_deadline_exceeded");
  process.exit(1);
}, DEADLINE_MS);

try {
  await verifyGeneralCourses();
} catch (error) {
  const code = /^build_general_[a-z_]+$/.test(error?.message || "")
    ? error.message : "build_general_request_failed";
  originalConsole.error(`CSAT live general verification failed: ${code}`);
  process.exitCode = 1;
} finally {
  globalAbort.abort();
  clearTimeout(deadline);
  globalThis.fetch = realFetch;
  for (const [method, original] of Object.entries(originalConsole)) console[method] = original;
}
