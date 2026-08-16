import { getCourse } from "./courses.js";

const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 3000;
const MAX_WORD_RETRIES = 3;
const FALLBACK_WORDS = [
  { word: "protect", pronunciation: "프로텍트", meaning: "보호하다", example: "We must protect the environment.", translation: "우리는 환경을 보호해야 합니다." },
  { word: "invite", pronunciation: "인바이트", meaning: "초대하다", example: "I will invite my friend.", translation: "나는 친구를 초대할 것입니다." },
  { word: "return", pronunciation: "리턴", meaning: "돌아오다, 돌려주다", example: "Please return the book tomorrow.", translation: "내일 그 책을 돌려주세요." },
  { word: "future", pronunciation: "퓨처", meaning: "미래", example: "I have a dream for the future.", translation: "나는 미래를 위한 꿈이 있습니다." },
  { word: "reason", pronunciation: "리즌", meaning: "이유", example: "Tell me the reason.", translation: "그 이유를 말해 주세요." },
  { word: "practice", pronunciation: "프랙티스", meaning: "연습하다", example: "I practice English every day.", translation: "나는 매일 영어를 연습합니다." },
  { word: "arrive", pronunciation: "어라이브", meaning: "도착하다", example: "We will arrive before noon.", translation: "우리는 정오 전에 도착할 것입니다." },
  { word: "choose", pronunciation: "추즈", meaning: "선택하다", example: "You can choose one book.", translation: "책 한 권을 선택할 수 있습니다." },
  { word: "carry", pronunciation: "캐리", meaning: "나르다", example: "Can you carry this bag?", translation: "이 가방을 들어 줄 수 있나요?" },
  { word: "improve", pronunciation: "임프루브", meaning: "향상시키다", example: "Reading can improve your English.", translation: "독서는 영어 실력을 향상시킬 수 있습니다." }
];

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return null;

  return messages
    .slice(-MAX_MESSAGES)
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, MAX_MESSAGE_LENGTH)
    }))
    .filter((message) => message.content.trim());
}

function extractTaughtWord(text) {
  const match = String(text || "").match(/^\s*([A-Za-z][A-Za-z'-]{1,30})\s*,\s*\1(?:\s|[.!?]|$)/im);
  return match?.[1]?.toLowerCase() || null;
}

function collectUsedWords(messages) {
  return new Set(messages
    .filter((message) => message.role === "assistant")
    .map((message) => extractTaughtWord(message.content))
    .filter(Boolean));
}

function fallbackLesson(usedWords) {
  const item = FALLBACK_WORDS.find(({ word }) => !usedWords.has(word));
  if (!item) return null;
  return `좋아요!\n\n다음 단어입니다.\n\n${item.word}, ${item.word}\n\n발음: ${item.pronunciation}\n뜻: ${item.meaning}\n\n예문: ${item.example}\n뜻: ${item.translation}\n\n이제 따라 말해 보세요.`;
}

function getOutputText(data) {
  return data.output_text || data.output
    ?.flatMap((item) => item.content || [])
    ?.filter((item) => item.type === "output_text")
    ?.map((item) => item.text)
    ?.join("\n")
    ?.trim();
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-60).map((item) => String(item || "").slice(0, 500)).filter(Boolean);
}

function normalizeProblem(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/문제\s*\d+\s*\/\s*10[^\n]*/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?/g, "#")
    .replace(/\s+/g, "")
    .replace(/[^a-z가-힣#]/g, "")
    .slice(0, 280);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(response, 503, {
      error: "수업 엔진 준비 중입니다. 관리자에게 OPENAI_API_KEY 설정을 확인해 주세요."
    });
  }

  const course = getCourse(request.body?.courseId);
  if (!course) {
    return sendJson(response, 400, { error: "올바른 수업을 선택해 주세요." });
  }

  const messages = sanitizeMessages(request.body?.messages);
  if (!messages || messages.length === 0) {
    return sendJson(response, 400, { error: "수업 메시지를 입력해 주세요." });
  }

  try {
    if (["math", "korean"].includes(course.kind)) {
      const history = sanitizeHistory(request.body?.history);
      const historyRule = history.length
        ? `\n\n[과거 문제 기록 — 재출제 금지]\n${history.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n위 문제들과 같은 유형·문장 구조에 숫자만 바꾼 문제도 피하세요.`
        : "";
      const signatures = new Set(history.map(normalizeProblem).filter(Boolean));

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
            instructions: course.prompt + historyRule,
            input: messages,
            max_output_tokens: course.kind === "korean" ? 900 : 650
          })
        });
        const data = await openAIResponse.json();
        if (!openAIResponse.ok) {
          console.error("OpenAI lesson error", openAIResponse.status, data?.error?.code);
          return sendJson(response, 502, { error: "AI 선생님 연결이 잠시 원활하지 않습니다." });
        }
        const text = getOutputText(data);
        if (!text) continue;
        const signature = normalizeProblem(text);
        if (!signature || !signatures.has(signature)) return sendJson(response, 200, { text });
        console.warn("Duplicate lesson problem rejected", attempt + 1);
      }
      return sendJson(response, 502, { error: "새 문제를 다시 준비해 주세요." });
    }

    const usedWords = collectUsedWords(messages);
    const usedList = [...usedWords].join(", ") || "없음";

    for (let attempt = 0; attempt < MAX_WORD_RETRIES; attempt += 1) {
      const duplicateRule = `\n\n[현재 수업 중복 방지]\n이미 가르친 단어: ${usedList}\n발음이 성공하여 다음 단어로 이동할 때는 위 단어를 절대로 다시 선택하지 마세요. 새로운 단어를 선택하세요.`;
      const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
          instructions: course.prompt + duplicateRule,
          input: messages,
          max_output_tokens: 400
        })
      });

      const data = await openAIResponse.json();
      if (!openAIResponse.ok) {
        console.error("OpenAI API error", openAIResponse.status, data?.error?.code);
        return sendJson(response, 502, {
          error: "AI 선생님 연결이 잠시 원활하지 않습니다. 잠시 후 다시 시도해 주세요."
        });
      }

      const text = getOutputText(data);
      if (!text) continue;
      const proposedWord = extractTaughtWord(text);
      const isRetryResponse = !/좋아요[!.]?/.test(text)
        && /(괜찮아요|다시\s*(?:따라|말해|들어))/.test(text);
      if (proposedWord && usedWords.has(proposedWord) && isRetryResponse) {
        return sendJson(response, 200, { text });
      }
      if (!proposedWord || !usedWords.has(proposedWord)) {
        return sendJson(response, 200, { text });
      }
      console.warn("Duplicate lesson word rejected", proposedWord, attempt + 1);
    }

    const fallback = fallbackLesson(usedWords);
    if (fallback) return sendJson(response, 200, { text: fallback });
    return sendJson(response, 502, { error: "새 단어를 준비하지 못했습니다. 새 수업을 시작해 주세요." });
  } catch (error) {
    console.error("GEM chat error", error);
    return sendJson(response, 500, {
      error: "수업 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
    });
  }
}
