import guardedChatHandler from "./chat-guard.js";
import { getCourse } from "./courses.js";
import { isSchoolEnglishNoAnswerRequest } from "./_no-answer-guard.js";

const COOKIE_NAME = "gem_school_english_fresh_v3";
const MAX_COOKIE_HISTORY = 24;
const MAX_COOKIE_ITEM_LENGTH = 260;
const MAX_PROMPT_HISTORY = 60;
const MAX_FRESH_ATTEMPTS = 8;

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

function compactHistoryItem(value) {
  return String(value || "")
    .replace(/답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_COOKIE_ITEM_LENGTH);
}

function decodeHistory(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return Array.isArray(parsed)
      ? parsed.map(compactHistoryItem).filter(Boolean).slice(-MAX_COOKIE_HISTORY)
      : [];
  } catch (_) {
    return [];
  }
}

function encodeHistory(history) {
  const clean = history.map(compactHistoryItem).filter(Boolean).slice(-MAX_COOKIE_HISTORY);
  return Buffer.from(JSON.stringify(clean), "utf8").toString("base64url");
}

function dedupe(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const clean = compactHistoryItem(item);
    const key = clean.toLowerCase().replace(/[^a-z가-힣0-9]+/g, "").slice(0, 220);
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
    .slice(0, 360);
}

function hasLegacyBannedContent(text) {
  return englishKeywords(text).some((word) => LEGACY_BANNED_WORDS.has(word));
}

function isTooSimilar(candidate, history) {
  const cleanCandidate = String(candidate || "").trim();
  if (!cleanCandidate) return true;
  if (hasLegacyBannedContent(cleanCandidate)) return true;

  const candidateWords = new Set(englishKeywords(cleanCandidate));
  const candidateShape = normalizedShape(cleanCandidate);

  for (const old of history) {
    const oldText = String(old || "");
    const oldWords = new Set(englishKeywords(oldText));
    let overlap = 0;
    for (const word of candidateWords) {
      if (oldWords.has(word)) overlap += 1;
    }

    // Two uncommon shared English content words usually means the model only
    // changed the object, name or number instead of creating a truly new task.
    if (overlap >= 2) return true;

    const oldShape = normalizedShape(oldText);
    if (candidateShape && oldShape) {
      const short = candidateShape.length < oldShape.length ? candidateShape : oldShape;
      const long = candidateShape.length < oldShape.length ? oldShape : candidateShape;
      if (short.length >= 65 && long.includes(short.slice(0, Math.min(short.length, 190)))) return true;
    }
  }
  return false;
}

function latestUserText(messages) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((message) => message?.role === "user")?.content || "";
}

function replaceLatestUserForSkip(messages, desiredNumber) {
  const output = Array.isArray(messages) ? messages.map((message) => ({ ...message })) : [];
  for (let index = output.length - 1; index >= 0; index -= 1) {
    if (output[index]?.role !== "user") continue;
    output[index] = {
      ...output[index],
      content: `현재 문제의 정답과 힌트를 절대로 공개하지 마세요. 현재 문제는 건너뛰고 활동 ${desiredNumber}/10의 완전히 새로운 문제를 즉시 제시하세요. 직전 문제의 핵심 단어, 문장 구조, 상황, 선택지와 정답을 재사용하지 마세요.`
    };
    break;
  }
  return output;
}

function isStartSignal(text) {
  return /^(?:시작|시작하기|영어\s*시작|start|새\s*수업|시작하세요|시작해\s*주세요|시작해주세요)[.!?。]?$/i.test(String(text || "").trim());
}

function isLegitimateRetry(candidateText, userText, inputMode) {
  const candidate = String(candidateText || "");
  const user = String(userText || "");
  if (/(?:힌트|모르겠|도와|다시|한\s*번\s*더|천천히|뜻)/i.test(user)) return true;
  if (/(?:음성이\s*정확히|다시\s*(?:말|답|풀)|한\s*번\s*더|힌트|괜찮아요|조금\s*더\s*생각|현재\s*문제)/i.test(candidate)) return true;
  if (inputMode === "voice" && /(?:알아듣|전달되지|인식|짧게\s*다시)/i.test(candidate)) return true;
  return false;
}

function makeCaptureResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: "",
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), { name: String(name), value });
      return this;
    },
    getHeader(name) { return headers.get(String(name).toLowerCase())?.value; },
    end(chunk = "") {
      this.body = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
      return this;
    },
    headerEntries() { return [...headers.values()]; }
  };
}

function parsePayload(captured) {
  try { return captured.body ? JSON.parse(captured.body) : null; }
  catch (_) { return null; }
}

function sendCaptured(response, captured, extraCookie = null, textOverride = null) {
  for (const { name, value } of captured.headerEntries()) response.setHeader(name, value);
  if (extraCookie) {
    const existing = response.getHeader("Set-Cookie");
    if (!existing) response.setHeader("Set-Cookie", extraCookie);
    else if (Array.isArray(existing)) response.setHeader("Set-Cookie", [...existing, extraCookie]);
    else response.setHeader("Set-Cookie", [existing, extraCookie]);
  }

  response.status(captured.statusCode || 200);
  if (textOverride !== null) {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify({ text: textOverride }));
  } else {
    response.end(captured.body || "");
  }
}

export default async function handler(request, response) {
  const course = getCourse(request.body?.courseId);
  if (course?.kind !== "english") return guardedChatHandler(request, response);

  const originalMessages = Array.isArray(request.body?.messages) ? request.body.messages : [];
  const originalUserText = latestUserText(originalMessages);
  const skipWithoutAnswer = isSchoolEnglishNoAnswerRequest(originalMessages);
  const messageHistory = collectMessageActivities(originalMessages);
  const previousNumber = messageHistory.length
    ? extractActivityNumber(messageHistory[messageHistory.length - 1])
    : 0;
  const starting = isStartSignal(originalUserText) || previousNumber === 0;
  const desiredNumber = starting ? 1 : Math.min(previousNumber + 1, 10);
  const effectiveMessages = skipWithoutAnswer
    ? replaceLatestUserForSkip(originalMessages, desiredNumber)
    : originalMessages;

  const cookies = parseCookies(request.headers?.cookie || "");
  const cookieHistory = decodeHistory(cookies[COOKIE_NAME]);
  const requestHistory = Array.isArray(request.body?.history) ? request.body.history : [];

  let workingHistory = dedupe([
    ...cookieHistory,
    ...requestHistory,
    ...messageHistory,
    ...BASELINE_AVOID
  ]).slice(-MAX_PROMPT_HISTORY);

  for (let attempt = 0; attempt < MAX_FRESH_ATTEMPTS; attempt += 1) {
    const nonce = `${Date.now().toString(36)}-${attempt}-${Math.random().toString(36).slice(2, 9)}`;
    request.body = {
      ...(request.body || {}),
      messages: effectiveMessages,
      history: dedupe([
        ...workingHistory,
        `이번 활동 ${desiredNumber}/10은 위 기록과 핵심 단어·문장 구조·상황·정답·선택지를 겹치지 않게 완전히 새로 만드세요. 예시는 형식 참고일 뿐 실제 문제로 재사용하지 마세요. 다양화 코드: ${nonce}`
      ]).slice(-MAX_PROMPT_HISTORY)
    };

    const captured = makeCaptureResponse();
    await guardedChatHandler(request, captured);

    if (captured.statusCode !== 200) return sendCaptured(response, captured);
    const payload = parsePayload(captured);
    if (!payload?.text) continue;

    const activity = extractLatestActivity(payload.text);
    const candidateNumber = extractActivityNumber(payload.text);
    const sameNumber = previousNumber > 0 && candidateNumber === previousNumber;
    const retryAllowed = !skipWithoutAnswer
      && sameNumber
      && isLegitimateRetry(payload.text, originalUserText, request.body?.inputMode);

    let reject = false;
    if (!activity || !candidateNumber) reject = true;
    else if (starting && candidateNumber !== 1) reject = true;
    else if (!starting && !retryAllowed && candidateNumber < desiredNumber) reject = true;
    else if (!retryAllowed && isTooSimilar(activity, workingHistory)) reject = true;
    else if (hasLegacyBannedContent(activity)) reject = true;

    if (!reject) {
      const newest = compactHistoryItem(activity);
      const persisted = dedupe([...cookieHistory, ...messageHistory, newest]).slice(-MAX_COOKIE_HISTORY);
      const cookie = `${COOKIE_NAME}=${encodeHistory(persisted)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
      const deliveredText = skipWithoutAnswer
        ? `알겠어요. 정답은 말하지 않을게요. 이전 문제는 건너뛰고 새로운 문제로 넘어갑니다.\n\n${payload.text}`
        : payload.text;
      return sendCaptured(response, captured, cookie, deliveredText);
    }

    console.warn("School English candidate rejected; regenerating", attempt + 1);
    if (activity) {
      workingHistory = dedupe([
        ...workingHistory,
        activity,
        `재사용 금지 핵심 영어: ${englishKeywords(activity).slice(0, 16).join(", ")}`
      ]).slice(-MAX_PROMPT_HISTORY);
    }
  }

  response.status(502).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({
    error: "같은 문제를 반복하지 않기 위해 새 문제를 다시 준비하고 있습니다. 한 번만 다시 말씀해 주세요."
  }));
}
