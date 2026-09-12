import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import chatHandler from "../api/chat-final.js";
import { SUNEUNG_COURSES } from "../api/suneung-courses.js";
import { isGeneralSuneungCourse } from "../lib/suneung-general-flow.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

// This build gate calls the real classroom handler with synthetic BUILD_CHECK
// context. It neither enters a public classroom nor writes a student record.
// The only permitted network destination is the configured AI provider, with
// storage explicitly disabled. Responses, cookies and credentials are not logged.
const TURN_DEADLINE_MS = 55_000;
const EXPECTED_COURSES = 13;
let plan;
const requestContext = new AsyncLocalStorage();
const globalAbort = new AbortController();
const realFetch = globalThis.fetch;
const originalConsole = Object.fromEntries(["log", "warn", "error", "info"]
  .map(method => [method, console[method].bind(console)]));
const reviewCounts = { general_2028_question_review: 0, general_2028_turn_review: 0 };
let applicationTurns = 0;
let providerRequests = 0;
let applicationDiagnostics = 0;

function check(condition, code) {
  if (!condition) throw new Error(`build_2028_${code}`);
}

function question(subject, topic, stem, choices) {
  return `문제 1/10 — 개념 · ${subject} · ${topic} · 5지선다형\n${stem}\n\n${choices
    .map((choice, index) => `${"ABCDE"[index]}) ${choice}`).join("\n")}\n\n답: (________)`;
}

// Every fixture has an independently known, unique answer. Language questions
// explicitly identify the situation/speaker whenever a pronoun could otherwise
// have multiple referents. The student asks about context before submitting it.
const FIXTURES = [
  {
    courseId: "suneung-2028-korean", answer: "C",
    question: question("국어", "화법과 언어 · 청중 고려",
      "학생은 같은 학년 친구들에게 학교 텃밭의 토양 관리 방법을 발표하려 한다. 친구들은 텃밭 활동에는 관심이 있지만 토양 관련 전문 용어에는 익숙하지 않다.\n청중의 특성을 고려한 발표 방법으로 가장 적절한 것은?",
      ["전문 용어의 뜻을 모두 생략한다.", "관심이 있으므로 발표의 핵심 내용도 생략한다.",
        "낯선 용어를 쉬운 말로 설명하고 텃밭 활동의 구체적인 사례를 든다.",
        "토양과 무관한 이야기로만 발표한다.", "연구자용 자료를 뜻풀이 없이 그대로 읽는다."]),
    help: "여기서 청중의 배경지식이라는 말은 무슨 뜻인가요?",
    helpTerms: /청중|친구|듣는\s*사람/,
    detailTerms: /이미|알고|아는|사전\s*지식/
  },
  {
    courseId: "suneung-2028-english", answer: "C",
    question: question("영어", "글의 목적",
      "다음 글의 목적으로 가장 적절한 것은?\n\nDear Garden Club members,\nOur Friday meeting has been rescheduled to Monday because the school garden will be closed for repairs this Friday. Please come to the garden at four o'clock on Monday. Thank you for your understanding.",
      ["To invite new members to join a sports team", "To ask students to pay for garden repairs",
        "To announce a change in the club meeting schedule", "To cancel all future club activities",
        "To explain how to grow vegetables at home"]),
    help: "rescheduled는 무슨 뜻인가요? 이 글과 연결해 설명해 주세요.",
    helpTerms: /일정|시간|날짜|모임/,
    detailTerms: /변경|바꾸|바뀌|다시\s*정|옮기/
  },
  {
    courseId: "suneung-2028-history", answer: "B",
    question: question("한국사", "조선의 문화",
      "다음 설명에 해당하는 조선의 왕은?\n\n백성이 자기 뜻을 글로 쉽게 표현하도록 훈민정음을 창제하였다. 훈민정음은 1446년에 반포되었다.",
      ["태조", "세종", "영조", "정조", "고종"]),
    help: "여기서 '반포'라는 말은 무슨 뜻인가요?",
    helpTerms: /공식|널리|백성|사람/,
    detailTerms: /알리|알려|공표|발표/
  },
  {
    courseId: "suneung-2028-integrated-social", answer: "D",
    question: question("통합사회", "시장과 외부 효과",
      "어떤 공장의 생산 과정에서 나온 오염 때문에 인근 주민들이 피해를 입지만, 이 피해 비용은 제품 가격이나 공장의 생산 비용에 반영되지 않는다. 이 사례를 설명하는 개념은?",
      ["소비의 긍정적 외부 효과", "완전 경쟁에서의 정보 대칭", "공공재의 비경합성", "생산의 부정적 외부 효과", "규모의 경제"]),
    help: "이 문제에서 사회적 비용은 무엇을 포함하는지 설명해 주세요.",
    helpTerms: /공장|생산자|사적|생산\s*비용/,
    detailTerms: /주민|피해|외부\s*비용|오염/
  },
  {
    courseId: "suneung-2028-second-german", answer: "B",
    question: question("독일어", "생활문 독해",
      "다음 글에 따르면 Lea가 도서관에 가는 요일은?\n\nLea geht jeden Dienstag in die Bibliothek.",
      ["Am Montag.", "Am Dienstag.", "Am Mittwoch.", "Am Donnerstag.", "Am Freitag."]),
    help: "이 문장에서 jeden은 어떤 뜻과 역할인가요?",
    helpTerms: /매주|매번|매|각각/,
    detailTerms: /화요일|Dienstag|반복|요일/
  },
  {
    courseId: "suneung-2028-second-french", answer: "E",
    question: question("프랑스어", "감사 표현",
      "다음 대화에서 감사 인사에 대한 응답으로 빈칸에 가장 알맞은 것은?\n\nLéa : Merci pour ton aide !\nPaul : ________",
      ["Je m'appelle Paul.", "Il est trois heures.", "Nous sommes lundi.", "J'habite à Paris.", "De rien !"]),
    help: "여기에서 ton은 무슨 뜻인가요? 누구를 가리키나요?",
    helpTerms: /너의|네\s*(?:도움|것)|상대방|폴|Paul/,
    detailTerms: /도움|aide|소유/
  },
  {
    courseId: "suneung-2028-second-spanish", answer: "C",
    question: question("스페인어", "안내문 독해",
      "다음 안내문에 따르면 도서관의 문을 여는 시각은?\n\nLa biblioteca abre a las nueve de la mañana.",
      ["A las siete de la mañana.", "A las ocho de la mañana.", "A las nueve de la mañana.", "A las diez de la mañana.", "A las once de la mañana."]),
    help: "이 문장에서 abre의 뜻은 무엇인가요?",
    helpTerms: /열|여는|개관/,
    detailTerms: /도서관|biblioteca|abrir/
  },
  {
    courseId: "suneung-2028-second-chinese", answer: "D",
    question: question("중국어", "일과 표현",
      "다음 말에 따르면 화자가 아침에 일어나는 시각은?\n\n我每天早上七点起床。",
      ["三点", "五点", "六点", "七点", "九点"]),
    help: "여기서 起床은 무슨 뜻인가요?",
    helpTerms: /일어나|일어나는|기상/,
    detailTerms: /잠|아침|침대|起床/
  },
  {
    courseId: "suneung-2028-second-japanese", answer: "A",
    question: question("일본어", "시설 안내문",
      "다음 안내문에 따르면 도서관의 정기 휴관일은?\n\n図書館は月曜日が休みです。",
      ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日"]),
    help: "이 문장에서 休み는 무슨 뜻인가요?",
    helpTerms: /쉬|휴관|휴무/,
    detailTerms: /도서관|문을\s*열지|운영|図書館/
  },
  {
    courseId: "suneung-2028-second-russian", answer: "E",
    question: question("러시아어", "가게 영업 시간",
      "다음 안내에 따르면 가게가 문을 여는 시각은?\n\nМагазин открывается в десять часов утра.",
      ["В шесть часов утра.", "В семь часов утра.", "В восемь часов утра.", "В девять часов утра.", "В десять часов утра."]),
    help: "여기서 открывается는 무슨 뜻인가요?",
    helpTerms: /열|여는|영업.*시작/,
    detailTerms: /가게|상점|Магазин/
  },
  {
    courseId: "suneung-2028-second-arabic", answer: "B",
    question: question("아랍어", "박물관 안내",
      "다음 안내에 따르면 박물관이 문을 여는 시각은?\n\nيفتح المتحف في الساعة التاسعة صباحًا.",
      ["في الساعة الثامنة صباحًا.", "في الساعة التاسعة صباحًا.", "في الساعة العاشرة صباحًا.", "في الساعة الحادية عشرة صباحًا.", "في الساعة الثانية عشرة ظهرًا."]),
    help: "이 문장에서 صباحًا는 무슨 뜻인가요?",
    helpTerms: /아침|오전/,
    detailTerms: /시간|시각|때|صباح/
  },
  {
    courseId: "suneung-2028-second-vietnamese", answer: "A",
    question: question("베트남어", "대명사와 소유 표현",
      "란(Lan)이 자기 펜을 들고 있다. 호아(Hoa)가 펜의 주인을 묻고, 란이 자신의 펜이라고 대답한다. 란의 대답으로 빈칸에 가장 알맞은 것은?\n\nHoa: Đây là bút của ai?\nLan: ________",
      ["Đây là bút của tôi.", "Đây là bút của Hoa.", "Đây là bút của Nam.", "Đây là bút của Mai.", "Đây là bút của Bình."]),
    help: "이 대화에서 란이 말하는 tôi는 누구를 가리키나요?",
    helpTerms: /란|Lan/i,
    detailTerms: /나|자신|자기|화자|말하는\s*사람/
  },
  {
    courseId: "suneung-2028-second-hanmun", answer: "C",
    question: question("한문", "한자 어휘와 문장 이해",
      "다음 문장에서 日이 가리키는 대상으로 가장 알맞은 것은?\n\n日出東方。",
      ["달", "별", "해", "바람", "구름"]),
    help: "東方은 각각 어떤 뜻의 한자가 합쳐진 말인가요?",
    helpTerms: /동쪽|동녘/,
    detailTerms: /방향|쪽|方/
  }
];

function selectPlan(args) {
  let fixturesOnly = false;
  let all = false;
  let courseId;
  for (const arg of args) {
    if (arg === "--fixtures-only") {
      check(!fixturesOnly, "duplicate_option");
      fixturesOnly = true;
    } else if (arg === "--all") {
      check(!all, "duplicate_option");
      all = true;
    } else if (arg.startsWith("--course=")) {
      check(courseId === undefined, "duplicate_option");
      courseId = arg.slice("--course=".length);
      check(Boolean(courseId), "course_selection_invalid");
    } else {
      throw new Error("build_2028_unknown_option");
    }
  }
  check(!(all && courseId !== undefined), "conflicting_selection");
  const selected = courseId === undefined ? FIXTURES : FIXTURES.filter(fixture => fixture.courseId === courseId);
  check(selected.length > 0, "course_selection_invalid");
  const focused = courseId !== undefined;
  return {
    fixturesOnly, fixtures: selected, focused,
    maxApplicationTurns: selected.length * 3,
    expectedProviderRequests: selected.length * 7,
    // A release checks one course. A deliberate full audit retains all 13 cases.
    maxProviderRequests: focused ? 14 : 170,
    deadlineMs: focused ? 90_000 : 300_000,
    concurrency: focused ? 1 : 3
  };
}

function verifyQuestion(payload, number) {
  const headings = [...payload.text.matchAll(/문제\s*(\d+)\s*\/\s*10/g)];
  check(headings.length === 1 && Number(headings[0][1]) === number, "question_sequence_failed");
  const displayed = payload.text.slice(headings[0].index);
  check(new RegExp(`^문제\\s*${number}\\s*\\/\\s*10\\s*[—–-]`).test(displayed), "question_header_failed");
  const labels = [...displayed.matchAll(/^\s*([A-E])\)\s*(\S[^\n]*)/gm)];
  check(labels.map(match => match[1]).join("") === "ABCDE", "five_choices_incomplete");
  check(/답\s*:\s*\([ _\u3000]{3,}\)\s*$/.test(displayed), "answer_slot_missing");
}

function verifyCoverage() {
  const courseIds = Object.entries(SUNEUNG_COURSES)
    .filter(([, course]) => course.suneung?.year === "2028" && isGeneralSuneungCourse(course))
    .map(([id]) => id).sort();
  const fixtureIds = FIXTURES.map(fixture => fixture.courseId).sort();
  check(courseIds.length === EXPECTED_COURSES && JSON.stringify(courseIds) === JSON.stringify(fixtureIds), "course_coverage_mismatch");
  for (const fixture of FIXTURES) {
    check(/^[A-E]$/.test(fixture.answer), "fixture_answer_missing");
    verifyQuestion({ text: fixture.question }, 1);
  }
}

function syntheticLesson(courseId) {
  const courseRunId = `build-2028:${randomUUID()}`;
  const token = createSessionToken({ id: "BUILD_CHECK", name: "BUILD_CHECK", session: "build-2028-check",
    courseId, courseRunId, startedAt: new Date().toISOString(), endedAt: null });
  check(Boolean(token), "synthetic_context_missing");
  return { courseId, courseRunId, cookie: `${SESSION_COOKIE}=${token}`, lessonSeed: randomUUID(),
    messages: [], lessonRecords: [], turn: 0 };
}

async function ask(lesson, content, step, inputMode = "text") {
  check(!globalAbort.signal.aborted, "verification_aborted");
  applicationTurns += 1;
  lesson.turn += 1;
  check(applicationTurns <= plan.maxApplicationTurns, "application_budget_exceeded");
  originalConsole.log(`CSAT 2028 live turn: ${lesson.courseId}; step=${step}.`);
  lesson.messages.push({ role: "user", content });
  const captured = {
    statusCode: 0, payload: null, headers: new Map(),
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); return this; },
    getHeader(name) { return this.headers.get(String(name).toLowerCase()); },
    end(value = "") { this.payload = value ? JSON.parse(String(value)) : {}; return this; }
  };
  const abort = new AbortController();
  let timer;
  try {
    await Promise.race([
      requestContext.run({ signal: abort.signal, course: lesson.courseId, step }, () => chatHandler({
        method: "POST", headers: { cookie: lesson.cookie }, body: {
          courseId: lesson.courseId, courseRunId: lesson.courseRunId, lessonSeed: lesson.lessonSeed,
          inputMode, messages: lesson.messages.map(message => ({ ...message })),
          learningProfile: { lessonRecords: lesson.lessonRecords.map(record => ({ ...record })) }, history: []
        }
      }, captured)),
      new Promise((_, reject) => { timer = setTimeout(() => {
        abort.abort(); reject(new Error("build_2028_turn_deadline_exceeded"));
      }, TURN_DEADLINE_MS); })
    ]);
  } finally { clearTimeout(timer); }
  if (captured.statusCode !== 200 || captured.payload?.error) {
    originalConsole.error(`CSAT 2028 handler failed: ${lesson.courseId}; step=${step}; HTTP=${captured.statusCode}.`);
    throw new Error("build_2028_handler_response_failed");
  }
  const payload = captured.payload;
  check(typeof payload?.text === "string" && payload.text.trim().length > 20, "empty_reply");
  check(!/새 문제를 다시 준비해 주세요|질문에 나온 핵심어를 지문에서 찾아|답안을 확인하지 못했습니다/.test(payload.text), "legacy_fallback_returned");
  check(!/\[\/?GEM_RECORD\]/i.test(payload.text), "private_record_visible");
  lesson.messages.push({ role: "assistant", content: payload.text });
  if (payload.record) lesson.lessonRecords.push(payload.record);
  return payload;
}

async function verifyStory(fixture) {
  // Simulate the Korean transcript received by the English classroom's voice
  // path. This does not record audio or verify the speech-to-text provider.
  const englishVoiceStart = fixture.courseId === "suneung-2028-english";
  const fresh = await ask(syntheticLesson(fixture.courseId),
    englishVoiceStart ? "안녕하세요. 영어 수업 시작해 주세요." : "시작해 주세요.",
    englishVoiceStart ? "korean_voice_start_transcript" : "fresh_question",
    englishVoiceStart ? "voice" : "text");
  check(!fresh.record, "start_graded_as_answer");
  verifyQuestion(fresh, 1);
  const fixtureLesson = syntheticLesson(fixture.courseId);
  fixtureLesson.messages.push({ role: "assistant", content: fixture.question });
  const helped = await ask(fixtureLesson, fixture.help, "contextual_help");
  check(!helped.record, "help_graded_as_answer");
  check(!/문제\s*\d+\s*\/\s*10|도전\s*[123]\s*\/\s*3/.test(helped.text), "help_changed_progress");
  check(!/정답\s*(?:은|이|:)\s*(?:[A-E]|[1-5]\s*번)/i.test(helped.text), "help_disclosed_choice");
  check(fixture.helpTerms.test(helped.text) && fixture.detailTerms.test(helped.text), "contextual_help_missing");
  const answered = await ask(fixtureLesson, `답은 ${fixture.answer}입니다.`, "correct_answer");
  check(answered.record?.question === 1 && answered.record?.outcome === "correct"
    && answered.record?.attempts === 1 && answered.record?.stage === "개념"
    && answered.record?.scope === "direct", "known_correct_answer_not_recorded");
  verifyQuestion(answered, 2);
  originalConsole.log(`CSAT 2028 live case passed: ${fixture.courseId}; new question 1 + contextual help + correct ${fixture.answer} + complete question 2.`);
}

async function verifyLive() {
  verifyCoverage();
  check(Boolean(process.env.OPENAI_API_KEY), "credentials_missing");
  check(typeof realFetch === "function", "fetch_unavailable");
  globalThis.fetch = async (input, options = {}) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    check(url === "https://api.openai.com/v1/responses" && options.method === "POST", "network_scope_rejected");
    let body;
    try { body = JSON.parse(options.body); } catch { throw new Error("build_2028_provider_body_invalid"); }
    check(body.store === false, "provider_storage_not_disabled");
    providerRequests += 1;
    check(providerRequests <= plan.maxProviderRequests, "provider_budget_exceeded");
    const review = body.text?.format?.name;
    if (Object.hasOwn(reviewCounts, review)) reviewCounts[review] += 1;
    const signals = [globalAbort.signal, requestContext.getStore()?.signal, options.signal].filter(Boolean);
    return realFetch(input, { ...options, signal: AbortSignal.any(signals) });
  };
  const eventCodes = new Map([
    ["General CSAT turn rejected", "turn_rejected"],
    ["General CSAT content rejected", "content_rejected"],
    ["General CSAT review unavailable", "review_unavailable"],
    ["Out-of-sequence Suneung response rejected", "sequence_rejected"],
    ["Invalid or out-of-sequence Suneung record rejected", "record_rejected"],
    ["Incomplete general CSAT response rejected", "response_incomplete"],
    ["Incomplete Suneung five-choice set rejected", "choices_incomplete"],
    ["Duplicate lesson problem rejected", "duplicate_question"],
    ["OpenAI lesson error", "provider_error"],
    ["GEM chat error", "handler_exception"],
    ["CSAT preferred model unavailable; using supported fallback", "model_fallback"]
  ]);
  for (const method of Object.keys(originalConsole)) console[method] = (...args) => {
    applicationDiagnostics += 1;
    const event = eventCodes.get(args[0]);
    if (!event) return;
    const context = requestContext.getStore();
    const reason = args[1]?.reason;
    const safeReason = typeof reason === "string" && /^[a-z_]{1,100}$/.test(reason) ? reason : "none";
    const status = Number.isInteger(args[1]) && args[1] >= 400 && args[1] <= 599 ? args[1] : 0;
    originalConsole.log(`CSAT 2028 diagnostic: ${context?.course || "general"}; step=${context?.step || "none"}; ${event}; reason=${safeReason}; HTTP=${status}.`);
  };
  originalConsole.log(`CSAT 2028 live verification: ${plan.fixtures.length} general course(s); ${plan.maxApplicationTurns} synthetic application turns; expected ${plan.expectedProviderRequests} provider requests; maximum ${plan.maxProviderRequests}; deadline ${plan.deadlineMs / 1000}s; no student records are written.`);
  let nextIndex = 0;
  const failures = [];
  const workers = Array.from({ length: plan.concurrency }, async () => {
    while (nextIndex < plan.fixtures.length && !globalAbort.signal.aborted) {
      const fixture = plan.fixtures[nextIndex++];
      try { await verifyStory(fixture); }
      catch (error) {
        failures.push(error);
        const code = /^build_2028_[a-z_]+$/.test(error?.message || "") ? error.message : "build_2028_request_failed";
        originalConsole.error(`CSAT 2028 live case failed: ${fixture.courseId}; ${code}.`);
        globalAbort.abort();
      }
    }
  });
  await Promise.allSettled(workers);
  if (failures.length) throw failures[0];
  check(applicationTurns === plan.maxApplicationTurns && providerRequests >= plan.expectedProviderRequests, "live_request_count_mismatch");
  check(reviewCounts.general_2028_question_review >= plan.fixtures.length
    && reviewCounts.general_2028_turn_review >= plan.maxApplicationTurns, "independent_review_coverage_missing");
  originalConsole.log(`CSAT 2028 live verification passed: ${plan.fixtures.length}/${plan.fixtures.length} selected courses; ${applicationTurns} application turns; ${providerRequests} real provider requests; ${reviewCounts.general_2028_question_review} question reviews; ${reviewCounts.general_2028_turn_review} turn reviews; ${applicationDiagnostics} application diagnostics.`);
}

let deadline;
try {
  // Validate selection and the entire fixture inventory before inspecting any
  // credentials or making calls. A typo must not silently run the paid full suite.
  plan = selectPlan(process.argv.slice(2));
  verifyCoverage();
  if (plan.fixturesOnly) {
    originalConsole.log(`CSAT 2028 fixture coverage checked: 13/13 general courses; selected=${plan.fixtures.map(fixture => fixture.courseId).join(",")}; application turns=${plan.maxApplicationTurns}; expected provider requests=${plan.expectedProviderRequests}; maximum=${plan.maxProviderRequests}; deadline=${plan.deadlineMs / 1000}s; concurrency=${plan.concurrency}. No live AI requests were made.`);
  } else {
    deadline = setTimeout(() => {
      globalAbort.abort();
      originalConsole.error("CSAT 2028 live verification failed: build_2028_deadline_exceeded");
      process.exit(1);
    }, plan.deadlineMs);
    await verifyLive();
  }
} catch (error) {
  const code = /^build_2028_[a-z_]+$/.test(error?.message || "") ? error.message : "build_2028_request_failed";
  originalConsole.error(`CSAT 2028 live verification failed: ${code}`);
  process.exitCode = 1;
} finally {
  globalAbort.abort(); clearTimeout(deadline); globalThis.fetch = realFetch;
  for (const [method, original] of Object.entries(originalConsole)) console[method] = original;
}
