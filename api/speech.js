import { requireStudentSession } from "../lib/student-session.js";

const MAX_TEXT_LENGTH = 1800;
const CIRCLED_TO_SPOKEN = {
  "①": "1번 ", "②": "2번 ", "③": "3번 ", "④": "4번 ", "⑤": "5번 ",
  "⑥": "6번 ", "⑦": "7번 ", "⑧": "8번 ", "⑨": "9번 ", "⑩": "10번 "
};

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function cleanText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*|```/g, ""))
    .replace(/\*\*|__|`|#+\s?/g, "")
    // Never speak dummy option placeholders such as "① ..." that may appear
    // after an unclear voice transcription.
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*(?:\.{2,}|…+|⋯+|_{2,}|[-–—]*)\s*$/gm, "")
    .replace(/^\s*\d+\s*[.)]\s*(?:\.{2,}|…+|⋯+|_{2,}|[-–—]*)\s*$/gm, "")
    // Meaningful circled choices are spoken naturally as 1번, 2번, 3번...
    // instead of letting the TTS engine guess the Unicode symbol.
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (mark) => CIRCLED_TO_SPOKEN[mark] || "")
    // Keep lesson counters visible on screen, but remove them from TTS input.
    .replace(/^\s*(?:(?:활동|문제|과제|연습)\s*)?\d+\s*\/\s*10\s*(?:[—–-]\s*[^\n]*)?\s*$/gm, "")
    .replace(/^\s*(?:활동|문제|과제|연습)\s*\d+\s*\/\s*10\s*[:：]?\s*/gm, "")
    // Answer boxes and visual blanks are for the screen only.
    .replace(/^\s*답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gm, "")
    .replace(/_{4,}/g, " ")
    .replace(/^\s*(?:한글\s*)?발음(?:은)?\s*[:：].*$/gm, "")
    .replace(/^\s*(?:\.{2,}|…+|⋯+)\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  if (!requireStudentSession(request, response)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  const input = cleanText(request.body?.text);
  if (!apiKey || !input) return sendJson(response, 400, { error: "읽을 문장이 없습니다." });

  try {
    const result = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input,
        instructions: "Speak like a warm, calm and encouraging bilingual English teacher. Speak Korean explanations naturally. Pronounce every English word and English sentence with clear native American English pronunciation, slightly slowly. Do not imitate Korean phonetic spellings. Never read markdown symbols, visual blanks, answer boxes, dummy ellipsis choices, or lesson counters. Read numbered answer choices naturally as 1번, 2번, 3번.",
        response_format: "mp3"
      })
    });

    if (!result.ok) {
      console.error("OpenAI speech error", result.status);
      return sendJson(response, 502, { error: "음성을 만들지 못했습니다." });
    }

    const audio = Buffer.from(await result.arrayBuffer()).toString("base64");
    return sendJson(response, 200, { audio, mimeType: "audio/mpeg" });
  } catch (error) {
    console.error("GEM speech error", error);
    return sendJson(response, 500, { error: "음성 연결 중 문제가 발생했습니다." });
  }
}
