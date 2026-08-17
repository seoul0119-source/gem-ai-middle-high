import guardedChatHandler from "./chat-guard.js";
import { getCourse } from "./courses.js";
import { isSchoolEnglishNoAnswerRequest } from "./_no-answer-guard.js";

const COOKIE_NAME = "gem_school_english_fresh_v2";
const MAX_COOKIE_HISTORY = 16;
const MAX_COOKIE_ITEM_LENGTH = 140;
const MAX_PROMPT_HISTORY = 60;
const MAX_FRESH_ATTEMPTS = 4;

const BASELINE_AVOID = [
  "borrow / pencil / eraser를 이용한 빌리기 문제",
  "polite의 뜻을 묻는 문제",
  "Can I borrow your pencil? 문장 또는 사실상 같은 문장"
];

const LEGACY_BANNED_WORDS = new Set(["borrow", "pencil", "eraser", "polite"]);

const ENGLISH_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "have", "has", "had",
  "can", "could", "would", "should", "will", "shall", "may", "might", "must", "not", "but", "about", "into", "than",
  "then", "when", "where", "what", "which", "who", "why", "how", "our", "their", "his", "her", "its", "they", "them",
  "she", "him", "hers", "ours", "yours", "mine", "friend", "teacher", "student", "school", "english", "word", "words",
  "sentence", "sentences", "answer", "question", "questions", "example", "today", "sure", "please", "choose", "complete",
  "correct", "activity", "activities", "number", "best", "most", "meaning", "means", "blank", "following", "read", "write",
  "one", "two", "three", "first", "second", "third", "next", "again", "very", "really", "also", "just", "each", "every"
]);

const EMERGENCY_WORD_BANKS = {
  "m1-english": [
    ["decide", "결정하다"], ["improve", "향상시키다"], ["protect", "보호하다"], ["invite", "초대하다"],
    ["arrive", "도착하다"], ["choose", "선택하다"], ["carry", "나르다"], ["return", "돌려주다"],
    ["prepare", "준비하다"], ["promise", "약속하다"], ["explain", "설명하다"], ["solve", "해결하다"],
    ["careful", "조심스러운"], ["useful", "유용한"], ["local", "지역의"], ["possible", "가능한"],
    ["future", "미래"], ["reason", "이유"]
  ],
  "m2-english": [
    ["suggest", "제안하다"], ["avoid", "피하다"], ["include", "포함하다"], ["achieve", "달성하다"],
    ["compare", "비교하다"], ["depend", "의존하다"], ["develop", "발전시키다"], ["experience", "경험하다"],
    ["instead", "대신에"], ["likely", "가능성이 있는"], ["reduce", "줄이다"], ["require", "요구하다"],
    ["prefer", "선호하다"], ["manage", "관리하다"], ["support", "지원하다"], ["realize", "깨닫다"],
    ["purpose", "목적"], ["method", "방법"]
  ],
  "m3-english": [
    ["responsible", "책임감 있는"], ["opportunity", "기회"], ["environment", "환경"], ["communicate", "의사소통하다"],
    ["influence", "영향을 주다"], ["benefit", "이점"], ["challenge", "도전"], ["consider", "고려하다"],
    ["provide", "제공하다"], ["recognize", "인식하다"], ["participate", "참여하다"], ["preserve", "보존하다"],
    ["efficient", "효율적인"], ["consequence", "결과"], ["solution", "해결책"], ["behavior", "행동"],
    ["community", "공동체"], ["resource", "자원"]
  ],
  "h1-english": [
    ["maintain", "유지하다"], ["significant", "중요한"], ["establish", "확립하다"], ["contribute", "기여하다"],
    ["approach", "접근법"], ["potential", "잠재적인"], ["appropriate", "적절한"], ["determine", "결정하다"],
    ["factor", "요인"], ["occur", "발생하다"], ["assume", "가정하다"], ["evaluate", "평가하다"],
    ["indicate", "나타내다"], ["respond", "반응하다"], ["issue", "쟁점"], ["specific", "구체적인"],
    ["process", "과정"], ["principle", "원리"]
  ],
  "h2-english": [
    ["interpret", "해석하다"], ["contrast", "대조하다"], ["relevant", "관련 있는"], ["perspective", "관점"],
    ["phenomenon", "현상"], ["distribute", "분배하다"], ["emerge", "나타나다"], ["complex", "복잡한"],
    ["demonstrate", "입증하다"], ["emphasize", "강조하다"], ["adapt", "적응하다"], ["restrict", "제한하다"],
    ["identify", "식별하다"], ["decline", "감소하다"], ["imply", "암시하다"], ["alternative", "대안"],
    ["variable", "변수"], ["consistent", "일관된"]
  ],
  "h3-english": [
    ["plausible", "그럴듯한"], ["contradict", "반박하다"], ["inherent", "내재된"], ["arbitrary", "임의적인"],
    ["coherent", "일관된"], ["diminish", "감소시키다"], ["infer", "추론하다"], ["subsequent", "이후의"],
    ["prevalent", "널리 퍼진"], ["compelling", "설득력 있는"], ["ambiguous", "모호한"], ["undermine", "약화시키다"],
    ["validate", "검증하다"], ["discrepancy", "불일치"], ["sophisticated", "정교한"], ["tentative", "잠정적인"],
    ["distort", "왜곡하다"], ["conventional", "관습적인"]
  ]
};

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index < 0) return cookies;
      cookies[part.slice(0, index)] = part.slice(index + 1);
      return cookies;
    }, {});
}

function decodeHistory(value) {
  if (!value) return [];
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item || "").slice(0, MAX_COOKIE_ITEM_LENGTH)).filter(Boolean).slice(-MAX_COOKIE_HISTORY)
      : [];
  } catch (_) {
    return [];
  }
}

function encodeHistory(history) {
  const clean = history
    .map((item) => compactHistoryItem(item))
    .filter(Boolean)
    .slice(-MAX_COOKIE_HISTORY);
  return Buffer.from(JSON.stringify(clean), "utf8").toString("base64url");
}

function compactHistoryItem(value) {
  return String(value || "")
    .replace(/답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_COOKIE_ITEM_LENGTH);
}

function dedupe(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const clean = compactHistoryItem(item);
    const key = clean.toLowerCase().replace(/[^a-z가-힣0-9]+/g, "").slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function findLatestActivityStart(text) {
  const output = String(text || "");
  const regex = /(?:활동|문제)\s*\d+\s*\/\s*10[^\n]*/gi;
  let match;
  let lastIndex = -1;
  while ((match = regex.exec(output)) !== null) lastIndex = match.index;
  return lastIndex;
}

function extractLatestActivity(text) {
  const output = String(text || "").trim();
  const start = findLatestActivityStart(output);
  if (start < 0) return "";
  return output.slice(start)
    .replace(/답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/g, "")
    .trim();
}

function extractActivityNumber(text) {
  const matches = [...String(text || "").matchAll(/(?:활동|문제)\s*(\d+)\s*\/\s*10/gi)];
  return matches.length ? Number(matches[matches.length - 1][1]) : 0;
}

function collectMessageActivities(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message?.role === "assistant")
    .map((message) => extractLatestActivity(message.content))
    .filter(Boolean);
}

function englishKeywords(text) {
  return (String(text || "").toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .filter((word) => !ENGLISH_STOPWORDS.has(word));
}

function normalizedShape(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/(?:활동|문제)\s*\d+\s*\/\s*10[^\n]*/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?/g, "#")
    .replace(/_{4,}/g, "_")
    .replace(/[^a-z가-힣#_]+/g, "")
    .slice(0, 320);
}

function isTooSimilar(candidate, history) {
  const cleanCandidate = String(candidate || "").trim();
  if (!cleanCandidate) return false;

  const words = englishKeywords(cleanCandidate);
  if (words.some((word) => LEGACY_BANNED_WORDS.has(word))) return true;

  const candidateSet = new Set(words);
  const candidateShape = normalizedShape(cleanCandidate);
  for (const old of history) {
    const oldText = String(old || "");
    const oldWords = new Set(englishKeywords(oldText));
    let overlap = 0;
    for (const word of candidateSet) {
      if (oldWords.has(word)) overlap += 1;
      if (overlap >= 2) return true;
    }

    const oldShape = normalizedShape(oldText);
    if (candidateShape && oldShape) {
      const short = candidateShape.length < oldShape.length ? candidateShape : oldShape;
      const long = candidateShape.length < oldShape.length ? oldShape : candidateShape;
      if (short.length >= 70 && long.includes(short.slice(0, Math.min(short.length, 180)))) return true;
    }
  }
  return false;
}

function makeCaptureResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), { name: String(name), value });
      return this;
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase())?.value;
    },
    end(chunk = "") {
      this.body = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
      return this;
    },
    headerEntries() {
      return [...headers.values()];
    }
  };
}

function sendCaptured(response, captured, extraCookie = null) {
  for (const { name, value } of captured.headerEntries()) {
    response.setHeader(name, value);
  }

  if (extraCookie) {
    const existing = response.getHeader("Set-Cookie");
    if (!existing) response.setHeader("Set-Cookie", extraCookie);
    else if (Array.isArray(existing)) response.setHeader("Set-Cookie", [...existing, extraCookie]);
    else response.setHeader("Set-Cookie", [existing, extraCookie]);
  }

  response.status(captured.statusCode || 200);
  response.end(captured.body || "");
}

function parsePayload(captured) {
  try {
    return captured.body ? JSON.parse(captured.body) : null;
  } catch (_) {
    return null;
  }
}

function seededShuffle(items) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function buildEmergencyActivity(courseId, number, history) {
  const bank = EMERGENCY_WORD_BANKS[courseId] || EMERGENCY_WORD_BANKS["m1-english"];
  const historyText = history.join(" ").toLowerCase();
  const randomized = seededShuffle(bank);
  const target = randomized.find(([word]) => !historyText.includes(word.toLowerCase())) || randomized[0];
  const wrongMeanings = seededShuffle(bank.filter(([word]) => word !== target[0]))
    .slice(0, 2)
    .map(([, meaning]) => meaning);
  const options = seededShuffle([target[1], ...wrongMeanings]);
  const label = courseId.startsWith("h") ? "어휘" : "단어";
  const safeNumber = Math.min(Math.max(Number(number) || 1, 1), 10);

  return `활동 ${safeNumber}/10 — ${label}\n\n다음 영어 단어의 뜻으로 가장 알맞은 것을 고르세요.\n\n${target[0]}\n\n${options.map((option, index) => `${index + 1}. ${option}`).join("\n")}\n\n답: (________)`;
}

export default async function handler(request, response) {
  const course = getCourse(request.body?.courseId);
  const messages = Array.isArray(request.body?.messages) ? request.body.messages : [];

  if (course?.kind !== "english" || isSchoolEnglishNoAnswerRequest(messages)) {
    return guardedChatHandler(request, response);
  }

  const cookies = parseCookies(request.headers?.cookie || "");
  const cookieHistory = decodeHistory(cookies[COOKIE_NAME]);
  const requestHistory = Array.isArray(request.body?.history) ? request.body.history : [];
  const messageHistory = collectMessageActivities(messages);

  let workingHistory = dedupe([
    ...cookieHistory,
    ...requestHistory,
    ...messageHistory,
    ...BASELINE_AVOID
  ]).slice(-MAX_PROMPT_HISTORY);

  const latestUserText = [...messages]
    .reverse()
    .find((message) => message?.role === "user")?.content || "";
  const isStarting = /^(?:시작|시작하기|영어\s*시작|start|새\s*수업)$/i.test(String(latestUserText).trim());
  const previousNumber = messageHistory.length ? extractActivityNumber(messageHistory[messageHistory.length - 1]) : 0;

  let lastCaptured = null;
  let lastCandidateNumber = previousNumber ? Math.min(previousNumber + 1, 10) : 1;

  for (let attempt = 0; attempt < MAX_FRESH_ATTEMPTS; attempt += 1) {
    request.body = {
      ...(request.body || {}),
      history: workingHistory
    };

    const captured = makeCaptureResponse();
    await guardedChatHandler(request, captured);
    lastCaptured = captured;

    if (captured.statusCode !== 200) {
      return sendCaptured(response, captured);
    }

    const payload = parsePayload(captured);
    if (!payload?.text) {
      return sendCaptured(response, captured);
    }

    const candidateNumber = extractActivityNumber(payload.text);
    if (candidateNumber) lastCandidateNumber = candidateNumber;
    const latestActivity = extractLatestActivity(payload.text);
    const freshnessCandidate = latestActivity || (isStarting ? String(payload.text) : "");
    const isAdvancing = isStarting
      || previousNumber === 0
      || (candidateNumber > 0 && candidateNumber > previousNumber);

    if (!freshnessCandidate || !isAdvancing || !isTooSimilar(freshnessCandidate, workingHistory)) {
      const newest = compactHistoryItem(freshnessCandidate || payload.text);
      const persisted = dedupe([...cookieHistory, ...messageHistory, newest]).slice(-MAX_COOKIE_HISTORY);
      const cookie = `${COOKIE_NAME}=${encodeHistory(persisted)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
      return sendCaptured(response, captured, cookie);
    }

    console.warn("Repeated school English activity rejected before delivery", attempt + 1);
    workingHistory = dedupe([
      ...workingHistory,
      freshnessCandidate,
      `이번에는 직전 후보와 핵심 영어 단어, 문장 구조, 상황을 모두 바꾸세요. 재사용 금지: ${englishKeywords(freshnessCandidate).slice(0, 12).join(", ")}`
    ]).slice(-MAX_PROMPT_HISTORY);
  }

  const fallback = buildEmergencyActivity(request.body?.courseId, lastCandidateNumber, workingHistory);
  const fallbackPayload = JSON.stringify({ text: fallback });
  const fallbackCaptured = makeCaptureResponse();
  fallbackCaptured.status(200).setHeader("Content-Type", "application/json; charset=utf-8");
  fallbackCaptured.setHeader("Cache-Control", "no-store");
  fallbackCaptured.end(fallbackPayload);

  const persisted = dedupe([...cookieHistory, ...messageHistory, fallback]).slice(-MAX_COOKIE_HISTORY);
  const cookie = `${COOKIE_NAME}=${encodeHistory(persisted)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
  console.warn("Fresh English emergency activity used after repeated model candidates");
  return sendCaptured(response, fallbackCaptured, cookie);
}
