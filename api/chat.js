import { getCourse } from "./courses.js";

const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 3000;

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
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        instructions: course.prompt,
        input: messages,
        max_output_tokens: 700
      })
    });

    const data = await openAIResponse.json();
    if (!openAIResponse.ok) {
      console.error("OpenAI API error", openAIResponse.status, data?.error?.code);
      return sendJson(response, 502, {
        error: "AI 선생님 연결이 잠시 원활하지 않습니다. 잠시 후 다시 시도해 주세요."
      });
    }

    const text = data.output_text || data.output
      ?.flatMap((item) => item.content || [])
      ?.filter((item) => item.type === "output_text")
      ?.map((item) => item.text)
      ?.join("\n")
      ?.trim();

    if (!text) {
      return sendJson(response, 502, { error: "AI 선생님의 답변을 받지 못했습니다." });
    }

    return sendJson(response, 200, { text });
  } catch (error) {
    console.error("GEM chat error", error);
    return sendJson(response, 500, {
      error: "수업 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
    });
  }
}
