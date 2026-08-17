import guardedChatHandler from "./chat-guard.js";
import { getCourse } from "./courses.js";

const COOKIE_NAME = "gem_school_english_history";
const MAX_HISTORY = 12;
const MAX_ITEM_LENGTH = 360;

const BASELINE_AVOID = [
  "활동 1/10 — 단어: borrow. Can I borrow your pencil? 뜻 고르기 또는 borrow 의미 확인 문제.",
  "활동 2/10 — 회화: I forgot my pencil or eraser. Can I borrow yours? 빌려 달라는 대화 완성 문제.",
  "단어 polite의 뜻이 예의 바른인지 묻는 뜻 고르기 문제."
];

const LEGACY_BANNED_WORDS = new Set(["borrow", "pencil", "eraser", "polite"]);
const ENGLISH_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "have", "has", "had",
  "can", "could", "would", "should", "will", "shall", "may", "might", "must", "not", "but", "about", "into", "than",
  "then", "when", "where", "what", "which", "who", "why", "how", "our", "their", "his", "her", "its", "they", "them",
  "she", "him", "hers", "ours", "yours", "mine", "friend", "teacher", "student", "school", "english", "word", "words",
  "sentence", "sentences", "answer", "question", "questions", "example", "today", "sure", "please", "choose", "complete"
]);

const FALLBACK_ACTIVITIES = {
  "m1-english": [
    `활동 {n}/10 — 단어\n\n다음 단어의 뜻을 골라 보세요.\n\ndiscover\n\n1. 발견하다\n2. 닫다\n3. 기다리다\n\n답: (________)`,
    `활동 {n}/10 — 회화\n\n도서관 위치를 묻는 상황입니다. 가장 자연스러운 대답을 고르세요.\n\nA: Excuse me. Where is the library?\nB: ________\n\n1. It is next to the gym.\n2. I am twelve years old.\n3. I ate breakfast.\n\n답: (________)`,
    `활동 {n}/10 — 퀴즈\n\n문장을 알맞게 완성하세요.\n\nMina ________ her lunch to school every day.\n\n1. bring\n2. brings\n3. bringing\n\n답: (________)`,
    `활동 {n}/10 — 이야기\n\nJoon found a small dog near the park. He called the phone number on its tag. Soon, the owner came and thanked him.\n\nJoon은 왜 전화했을까요?\n\n1. 개의 주인을 찾기 위해\n2. 공원 문을 닫기 위해\n3. 친구에게 숙제를 묻기 위해\n\n답: (________)`
  ],
  "m2-english": [
    `활동 {n}/10 — 단어\n\n문맥에 맞는 뜻을 고르세요.\n\nsuggest\n\n1. 제안하다\n2. 숨기다\n3. 고장 내다\n\n답: (________)`,
    `활동 {n}/10 — 회화\n\nA: I am tired after practice.\nB: Why don't you ________ for a few minutes?\n\n1. rest\n2. shout\n3. hurry\n\n답: (________)`,
    `활동 {n}/10 — 퀴즈\n\nIf it rains tomorrow, we ________ inside.\n\n1. stay\n2. will stay\n3. stayed\n\n답: (________)`,
    `활동 {n}/10 — 이야기\n\nSora wanted to reduce plastic waste. She began carrying a reusable bottle and lunch box. After a month, her family decided to do the same.\n\n가족이 바뀐 가장 큰 이유는 무엇일까요?\n\n1. Sora의 행동을 보고 따라 했기 때문에\n2. 새 휴대폰을 샀기 때문에\n3. 학교가 문을 닫았기 때문에\n\n답: (________)`
  ],
  "m3-english": [
    `활동 {n}/10 — 단어\n\nresponsible의 뜻으로 가장 알맞은 것을 고르세요.\n\n1. 책임감 있는\n2. 매우 시끄러운\n3. 쉽게 부서지는\n\n답: (________)`,
    `활동 {n}/10 — 회화\n\nA: I haven't finished my science project yet.\nB: ________\n\n1. You still have time. Let's make a plan.\n2. The weather was sunny yesterday.\n3. I never use a calendar.\n\n답: (________)`,
    `활동 {n}/10 — 퀴즈\n\nThe book ________ I read last weekend was exciting.\n\n1. who\n2. that\n3. where\n\n답: (________)`,
    `활동 {n}/10 — 이야기\n\nA city opened more bicycle lanes to reduce traffic. At first, only a few people used them, but usage increased after safer crossings were added.\n\n자전거 이용이 늘어난 이유로 가장 알맞은 것은 무엇인가요?\n\n1. 도로 안전이 개선되었기 때문에\n2. 자동차 가격이 모두 같아졌기 때문에\n3. 자전거 도로가 사라졌기 때문에\n\n답: (________)`
  ],
  "h1-english": [
    `활동 {n}/10 — 어휘\n\nmaintain의 의미로 가장 알맞은 것을 고르세요.\n\n1. 유지하다\n2. 우연히 발견하다\n3. 완전히 포기하다\n\n답: (________)`,
    `활동 {n}/10 — 문법\n\nThe students ________ in the library are preparing for the debate.\n\n1. study\n2. studying\n3. studiedly\n\n답: (________)`,
    `활동 {n}/10 — 독해\n\nSome people remember information better when they explain it to someone else. Explaining forces the learner to organize ideas and notice gaps in understanding.\n\n이 글의 중심 내용으로 가장 알맞은 것은 무엇인가요?\n\n1. 설명하는 활동은 이해를 점검하는 데 도움이 된다.\n2. 모든 학습은 혼자 해야 한다.\n3. 기억력은 연습과 관계가 없다.\n\n답: (________)`,
    `활동 {n}/10 — 문장 완성\n\nBecause the bus was delayed, we ________ the beginning of the concert.\n\n1. missed\n2. created\n3. borrowed\n\n답: (________)`
  ],
  "h2-english": [
    `활동 {n}/10 — 어휘\n\ncontribute의 의미로 가장 알맞은 것을 고르세요.\n\n1. 기여하다\n2. 거절하다\n3. 숨기다\n\n답: (________)`,
    `활동 {n}/10 — 문법\n\nHad I known about the schedule change, I ________ earlier.\n\n1. would have arrived\n2. arrive\n3. will arriving\n\n답: (________)`,
    `활동 {n}/10 — 독해\n\nUrban trees do more than improve a city's appearance. They provide shade, reduce surface temperatures, and can help absorb some air pollutants. Their benefits, however, depend on careful placement and long-term maintenance.\n\n글의 요지로 가장 알맞은 것은 무엇인가요?\n\n1. 도시 나무의 효과는 관리와 배치에 따라 달라질 수 있다.\n2. 모든 도시는 나무를 제거해야 한다.\n3. 나무는 도시 온도와 아무 관계가 없다.\n\n답: (________)`,
    `활동 {n}/10 — 문맥\n\nThe evidence was limited; ________, the researchers avoided making a strong conclusion.\n\n1. therefore\n2. meanwhile\n3. otherwise\n\n답: (________)`
  ],
  "h3-english": [
    `활동 {n}/10 — 어휘\n\nplausible의 의미로 가장 알맞은 것을 고르세요.\n\n1. 그럴듯한\n2. 영구적으로 닫힌\n3. 불필요하게 빠른\n\n답: (________)`,
    `활동 {n}/10 — 문맥 추론\n\nThe first explanation seemed convincing, but new evidence directly ________ its central claim.\n\n1. contradicted\n2. preserved\n3. decorated\n\n답: (________)`,
    `활동 {n}/10 — 독해\n\nEfficiency is often measured by how quickly a task is completed. Yet speed alone can be misleading when a faster process creates errors that require later correction. A useful measure of efficiency should therefore consider both time and the quality of the final result.\n\n필자가 강조하는 바로 가장 알맞은 것은 무엇인가요?\n\n1. 효율성은 속도와 결과의 질을 함께 고려해야 한다.\n2. 가장 빠른 방법은 언제나 가장 정확하다.\n3. 오류 수정에는 시간이 들지 않는다.\n\n답: (________)`,
    `활동 {n}/10 — 문법·의미\n\nNot until the final data were analyzed ________ the researchers recognize the pattern.\n\n1. did\n2. had\n3. were\n\n답: (________)`
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

function findLatestActivityStart(text) {
  const output = String(text || "");
  const regex = /(?:활동|문제)\s*\d+\s*\/\s*10[^\n]*/gi;
  let match;
  let lastIndex = -1;
  while ((match = regex.exec(output)) !== null) lastIndex = match.index;
  return lastIndex;
}

function extractActivity(text) {
  const output = String(text || "").trim();
  const start = findLatestActivityStart(output);
  if (start < 0) return "";
  return output.slice(start)
    .replace(/답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ITEM_LENGTH);
}

function extractActivityNumber(text) {
  const match = String(text || "").match(/(?:활동|문제)\s*(\d+)\s*\/\s*10/i);
  return match ? Number(match[1]) : 0;
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
    const key = String(item || "").toLowerCase().replace(/[^a-z가-힣0-9]+/g, "").slice(0, 240);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function stripDummyChoices(text) {
  return String(text || "")
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*(?:\.{2,}|…+|⋯+|_{2,}|[-–—]*)\s*$/gm, "")
    .replace(/^\s*\d+\s*[.)]\s*(?:\.{2,}|…+|⋯+|_{2,}|[-–—]*)\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function englishKeywords(text) {
  return (String(text || "").toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .filter((word) => !ENGLISH_STOPWORDS.has(word));
}

function isTooSimilar(candidate, history) {
  const words = englishKeywords(candidate);
  if (words.some((word) => LEGACY_BANNED_WORDS.has(word))) return true;
  const candidateSet = new Set(words);
  const counts = new Map();
  words.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));

  for (const old of history) {
    const oldSet = new Set(englishKeywords(old));
    let overlap = 0;
    for (const word of candidateSet) {
      if (!oldSet.has(word)) continue;
      overlap += 1;
      if ((counts.get(word) || 0) >= 2) return true;
      if (overlap >= 2) return true;
    }
  }
  return false;
}

function chooseFallback(courseId, number, history) {
  const pool = FALLBACK_ACTIVITIES[courseId] || FALLBACK_ACTIVITIES["m1-english"];
  const formatted = pool.map((item) => item.replaceAll("{n}", String(Math.min(Math.max(number || 1, 1), 10))));
  return formatted.find((item) => !isTooSimilar(item, history))
    || formatted.find((item) => !history.some((old) => old.includes(extractActivity(item).slice(0, 80))))
    || formatted[history.length % formatted.length];
}

function replaceLatestActivity(text, replacement) {
  const output = String(text || "");
  const start = findLatestActivityStart(output);
  if (start < 0) return replacement;
  const prefix = output.slice(0, start).trimEnd();
  return prefix ? `${prefix}\n\n${replacement}` : replacement;
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

  const latestUserText = [...(Array.isArray(request.body?.messages) ? request.body.messages : [])]
    .reverse()
    .find((message) => message?.role === "user")?.content || "";
  const isStarting = /^(?:시작|시작하기|영어\s*시작|start|새\s*수업)$/i.test(String(latestUserText).trim());
  const previousNumber = messageHistory.length ? extractActivityNumber(messageHistory[messageHistory.length - 1]) : 0;

  const originalEnd = response.end.bind(response);
  response.end = function patchedEnd(chunk, encoding, callback) {
    let outgoingChunk = chunk;
    try {
      const raw = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
      const payload = raw ? JSON.parse(raw) : null;

      if (payload?.text) {
        payload.text = stripDummyChoices(payload.text);
        let newest = extractActivity(payload.text);
        const candidateNumber = extractActivityNumber(newest);
        const isAdvancing = isStarting || previousNumber === 0 || (candidateNumber > 0 && candidateNumber > previousNumber);

        if (newest && isAdvancing && isTooSimilar(newest, combinedHistory)) {
          const fallback = chooseFallback(request.body?.courseId, candidateNumber || Math.min(previousNumber + 1, 10), combinedHistory);
          payload.text = replaceLatestActivity(payload.text, fallback);
          newest = extractActivity(payload.text);
          console.warn("Repeated school English activity replaced by fresh fallback");
        }

        if (newest) {
          const persisted = dedupe([...cookieHistory, ...messageHistory, newest]).slice(-MAX_HISTORY);
          const cookie = `${COOKIE_NAME}=${encodeHistory(persisted)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
          const existing = response.getHeader("Set-Cookie");
          if (!existing) response.setHeader("Set-Cookie", cookie);
          else if (Array.isArray(existing)) response.setHeader("Set-Cookie", [...existing, cookie]);
          else response.setHeader("Set-Cookie", [existing, cookie]);
        }

        outgoingChunk = JSON.stringify(payload);
      }
    } catch (error) {
      console.warn("English auto-variation guard skipped", error?.message || error);
    }
    return originalEnd(outgoingChunk, encoding, callback);
  };

  return guardedChatHandler(request, response);
}
