const MAX_BASE64_LENGTH = 5_500_000;

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const base64 = String(request.body?.audio || "");
  if (!apiKey || !base64 || base64.length > MAX_BASE64_LENGTH) {
    return sendJson(response, 400, { error: "짧게 다시 말해 주세요." });
  }

  try {
    const mimeType = String(request.body?.mimeType || "audio/webm").split(";")[0];
    const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(base64, "base64")], { type: mimeType }), `student.${extension}`);
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "en");
    form.append("response_format", "json");
    form.append("prompt", "A Korean middle school student is repeating one English vocabulary word or a short English example sentence. Preserve the intended English spelling.");

    const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
    const data = await result.json();
    if (!result.ok || !data.text?.trim()) {
      console.error("OpenAI transcription error", result.status, data?.error?.code);
      return sendJson(response, 502, { error: "목소리를 알아듣지 못했습니다. 다시 말해 주세요." });
    }

    return sendJson(response, 200, { text: data.text.trim() });
  } catch (error) {
    console.error("GEM transcription error", error);
    return sendJson(response, 500, { error: "음성 인식 연결 중 문제가 발생했습니다." });
  }
}
