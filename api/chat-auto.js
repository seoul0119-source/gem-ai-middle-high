import guardedChatHandler from "./chat-guard.js";
import { getCourse } from "./courses.js";

const COOKIE_NAME = "gem_school_english_history";
const MAX_HISTORY = 10;
const MAX_ITEM_LENGTH = 320;

const BASELINE_AVOID = [
  "활동 1/10 — 단어: borrow. Can I borrow your pencil? 뜻 고르기 또는 borrow 의미 확인 문제.",
  "활동 2/10 — 회화: I forgot my pencil or eraser. Can I borrow yours? 빌려 달라는 대화 완성 문제.",
  "단어 polite의 뜻이 예의 바른인지 묻는 뜻 고르기 문제."
];

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
      ? parsed.map((item) => String(item || "").slice(0, MAX_ITEM_LENGTH)).filter(Boolean).slice(-MAX_HISTORY)
      : [];
  } catch (_) {
    return [];
  }
}

function encodeHistory(history) {
  const clean = history
    .map((item) => String(item || "").replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_LENGTH))
    .filter(Boolean)
    .slice(-MAX_HISTORY);
  return Buffer.from(JSON.stringify(clean), "utf8").toString("base64url");
}

function extractActivity(text) {
  const output = String(text || "").trim();
  const match = output.match(/(?:활동|문제)\s*\d+\s*\/\s*10[\s\S]*/i);
  if (!match) return "";
  return match[0]
    .replace(/답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ITEM_LENGTH);
}

function collectMessageActivities(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message?.role === "assistant")
    .map((message) => extractActivity(message.content))
    .filter(Boolean);
}

function dedupe(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = String(item || "").toLowerCase().replace(/[^a-z가-힣0-9]+/g, "").slice(0, 220);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export default async function handler(request, response) {
  const course = getCourse(request.body?.courseId);
  if (course?.kind !== "english") {
    return guardedChatHandler(request, response);
  }

  const cookies = parseCookies(request.headers?.cookie || "");
  const cookieHistory = decodeHistory(cookies[COOKIE_NAME]);
  const requestHistory = Array.isArray(request.body?.history) ? request.body.history : [];
  const messageHistory = collectMessageActivities(request.body?.messages);
  const combinedHistory = dedupe([
    ...BASELINE_AVOID,
    ...cookieHistory,
    ...requestHistory,
    ...messageHistory
  ]).slice(-60);

  request.body = {
    ...(request.body || {}),
    history: combinedHistory
  };

  const originalEnd = response.end.bind(response);
  response.end = function patchedEnd(chunk, encoding, callback) {
    try {
      const raw = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
      const payload = raw ? JSON.parse(raw) : null;
      const newest = extractActivity(payload?.text);
      if (newest) {
        const persisted = dedupe([...cookieHistory, ...messageHistory, newest]).slice(-MAX_HISTORY);
        const cookie = `${COOKIE_NAME}=${encodeHistory(persisted)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
        const existing = response.getHeader("Set-Cookie");
        if (!existing) response.setHeader("Set-Cookie", cookie);
        else if (Array.isArray(existing)) response.setHeader("Set-Cookie", [...existing, cookie]);
        else response.setHeader("Set-Cookie", [existing, cookie]);
      }
    } catch (error) {
      console.warn("English history cookie update skipped", error?.message || error);
    }
    return originalEnd(chunk, encoding, callback);
  };

  return guardedChatHandler(request, response);
}
