import chatHandler from "./chat.js";
import { getCourse } from "./courses.js";
import { requireStudentSession } from "../lib/student-session.js";
import { isSchoolEnglishNoAnswerRequest } from "./_no-answer-guard.js";
import crypto from "node:crypto";

const COOKIE_NAME = "gem_school_english_v5";
const MAX_SAVED = 12;
const MAX_TEXT = 240;
const MAX_ATTEMPTS = 7;

// This term is checked only AFTER generation. It is intentionally never placed
// in model instructions, so it cannot become an accidental prompt anchor.
const LEGACY_FIRST_WORD = "borrow";

const START_THEMES = [
  "weather and weekend plans",
  "a school club activity",
  "sports practice and teamwork",
  "healthy food and daily habits",
  "travel directions and places",
  "music, art, and hobbies",
  "technology in everyday life",
  "nature and the environment",
  "feelings and friendship",
  "family schedules and chores",
  "a community event",
  "shopping and prices",
  "a library or reading activity",
  "a science class situation",
  "a morning or evening routine",
  "a local festival or cultural activity",
  "an outdoor activity",
  "planning a small project"
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "have", "has", "had",
  "can", "could", "would", "should", "will", "shall", "may", "might", "must", "not", "but", "about", "into", "than",
  "then", "when", "where", "what", "which", "who", "why", "how", "our", "their", "his", "her", "its", "they", "them",
  "she", "him", "hers", "ours", "yours", "mine", "friend", "teacher", "student", "school", "english", "word", "words",
  "sentence", "sentences", "answer", "question", "questions", "example", "today", "please", "choose", "complete", "correct",
  "activity", "activities", "number", "best", "most", "meaning", "means", "blank", "following", "read", "write", "one",
  "two", "three", "first", "second", "third", "next", "again", "very", "really", "also", "just", "each", "every"
]);

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index >= 0) cookies[part.slice(0, index)] = part.slice(index + 1);
      return cookies;
    }, {});
}

function compact(value) {
  return String(value || "")
    .replace(/^답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

function decodeSaved(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          text: compact(item?.text),
          key: String(item?.key || "").toLowerCase().slice(0, 32)
        })).filter((item) => item.text)
      : [];
  } catch (_) {
    return [];
  }
}

function encodeSaved(items) {
  return Buffer.from(JSON.stringify(items.slice(-MAX_SAVED)), "utf8").toString("base64url");
}

function latestUserText(messages) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((message) => message?.role === "user")?.content || "";
}

function isStartSignal(text) {
  return /^(?:시작|시작하기|영어\s*시작|start|새\s*수업|시작하세요|시작해\s*주세요|시작해주세요)[.!?。]?$/i.test(String(text || "").trim());
}

function extractLatestActivity(text) {
  const output = String(text || "").trim();
  const regex = /(?:활동|문제)\s*\d+\s*\/\s*10[^\n]*/gi;
  let match;
  let last = -1;
  while ((match = regex.exec(output)) !== null) last = match.index;
  return last < 0 ? "" : output.slice(last).trim();
}

function extractActivityNumber(text) {
  const matches = [...String(text || "").matchAll(/(?:활동|문제)\s*(\d+)\s*\/\s*10/gi)];
  return matches.length ? Number(matches[matches.length - 1][1]) : 0;
}

function contentWords(text) {
  return (String(text || "").toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .filter((word) => !STOPWORDS.has(word));
}

function firstKey(text) {
  return contentWords(text)[0] || "";
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

function tooSimilar(candidate, history) {
  const shape = normalizedShape(candidate);
  const words = new Set(contentWords(candidate));

  for (const old of history) {
    const oldText = String(old || "");
    const oldShape = normalizedShape(oldText);
    if (shape && oldShape && shape === oldShape) return true;

    const oldWords = new Set(contentWords(oldText));
    let overlap = 0;
    for (const word of words) if (oldWords.has(word)) overlap += 1;
    if (overlap >= 3) return true;
  }
  return false;
}

function containsLegacyFirstWord(text) {
  return new RegExp(`\\b${LEGACY_FIRST_WORD}\\b`, "i").test(String(text || ""));
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

function sendCaptured(response, captured, extraCookie = null) {
  for (const { name, value } of captured.headerEntries()) response.setHeader(name, value);
  if (extraCookie) {
    const existing = response.getHeader("Set-Cookie");
    if (!existing) response.setHeader("Set-Cookie", extraCookie);
    else if (Array.isArray(existing)) response.setHeader("Set-Cookie", [...existing, extraCookie]);
    else response.setHeader("Set-Cookie", [existing, extraCookie]);
  }
  response.setHeader("X-GEM-English-Guard", "v5");
  response.status(captured.statusCode || 200);
  response.end(captured.body || "");
}

function replaceLatestUser(messages, text) {
  const output = Array.isArray(messages) ? messages.map((message) => ({ ...message })) : [];
  for (let index = output.length - 1; index >= 0; index -= 1) {
    if (output[index]?.role !== "user") continue;
    output[index] = { ...output[index], content: text };
    return output;
  }
  output.push({ role: "user", content: text });
  return output;
}

function collectMessageActivities(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === "assistant")
    .map((message) => extractLatestActivity(message.content))
    .filter(Boolean);
}

export default async function handler(request, response) {
  const course = getCourse(request.body?.courseId);
  if (course?.kind !== "english") return chatHandler(request, response);

  const originalMessages = Array.isArray(request.body?.messages) ? request.body.messages : [];

  // Keep the existing no-answer safety behavior without importing the older
  // English variety wrappers that contained a literal example capable of
  // anchoring the model's first question.
  if (isSchoolEnglishNoAnswerRequest(originalMessages)) {
    if (!requireStudentSession(request, response)) return;
    return sendJson(response, 200, {
      text: "알겠어요. 정답이나 힌트는 말하지 않을게요. 현재 문제를 직접 풀어 보세요.\n\n답: (________)"
    });
  }

  const starting = isStartSignal(latestUserText(originalMessages));
  const cookies = parseCookies(request.headers?.cookie || "");
  const saved = decodeSaved(cookies[COOKIE_NAME]);
  const messageActivities = collectMessageActivities(originalMessages);
  const requestHistory = Array.isArray(request.body?.history)
    ? request.body.history.map(compact).filter(Boolean)
    : [];
  const rejected = [];
  const recentFirstKeys = new Set(saved.map((item) => item.key).filter(Boolean));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const theme = START_THEMES[crypto.randomInt(0, START_THEMES.length)];
    const nonce = `${Date.now().toString(36)}-${attempt}-${crypto.randomBytes(4).toString("hex")}`;
    const history = [...new Set([
      ...saved.map((item) => item.text),
      ...requestHistory,
      ...messageActivities,
      ...rejected
    ].map(compact).filter(Boolean))].slice(-40);

    const latest = latestUserText(originalMessages);
    const generationText = starting
      ? `${latest}\n\n이번 새 수업의 첫 활동은 ${theme} 맥락을 활용하세요. 최근 수업과 다른 핵심 어휘, 다른 문장 구조, 다른 상황을 선택하고 학년 수준을 지키세요. 지침 속 예시 문장을 실제 문제로 복사하지 마세요. 생성 키: ${nonce}`
      : latest;

    request.body = {
      ...(request.body || {}),
      messages: replaceLatestUser(originalMessages, generationText),
      history
    };

    const captured = makeCaptureResponse();
    await chatHandler(request, captured);
    if (captured.statusCode !== 200) return sendCaptured(response, captured);

    const payload = parsePayload(captured);
    const activity = extractLatestActivity(payload?.text || "");
    const number = extractActivityNumber(activity);
    if (!activity || !number) {
      rejected.push(compact(payload?.text || ""));
      continue;
    }

    const key = firstKey(activity);
    const badLegacyStart = starting && containsLegacyFirstWord(activity);
    const repeatedFirstKey = starting && key && recentFirstKeys.has(key);
    const similar = tooSimilar(activity, history);

    if (badLegacyStart || repeatedFirstKey || similar) {
      console.warn("English v5 candidate rejected", {
        attempt: attempt + 1,
        badLegacyStart,
        repeatedFirstKey,
        similar,
        key
      });
      rejected.push(compact(activity));
      continue;
    }

    const nextSaved = [
      ...saved,
      { text: compact(activity), key: starting ? key : "" }
    ].slice(-MAX_SAVED);
    const cookie = `${COOKIE_NAME}=${encodeSaved(nextSaved)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
    console.info("English v5 activity accepted", { starting, number, key, attempt: attempt + 1 });
    return sendCaptured(response, captured, cookie);
  }

  console.error("English v5 could not produce a sufficiently fresh activity");
  return sendJson(response, 502, {
    error: "새로운 영어 문제를 다시 준비하고 있습니다. 한 번만 다시 시작해 주세요."
  });
}
