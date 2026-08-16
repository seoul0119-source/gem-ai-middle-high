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
    const courseId = String(request.body?.courseId || "");
    const isMath = courseId.includes("math");
    const isSocial = courseId.includes("social");
    const isKorean = courseId.includes("korean");
    const isEnglishWord = courseId.includes("english-word");
    form.append("file", new Blob([Buffer.from(base64, "base64")], { type: mimeType }), `student.${extension}`);
    form.append("model", "gpt-4o-mini-transcribe");
    // Korean, social studies and mathematics lessons expect Korean answers.
    // Only the English vocabulary course should force English recognition.
    form.append("language", isEnglishWord ? "en" : "ko");
    form.append("response_format", "json");
    form.append("prompt", isMath
      ? "한국 중고등학생이 수학 답을 짧게 말합니다. 숫자, 음수, 분수, 제곱, 루트, 좌표, 사분면, 이상, 이하, 합집합, 교집합 표현을 정확한 한국어와 일반 키보드 수식으로 보존하세요."
      : isSocial
        ? "한국 중고등학생이 사회 수업 문제의 답을 한국어로 짧게 말합니다. 지리, 정치, 법, 경제, 사회, 문화 관련 용어와 숫자를 정확히 기록하세요. 들리지 않는 말을 추측하거나 같은 글자를 반복하지 마세요."
        : isKorean
          ? "한국 중고등학생이 국어 수업 문제의 답을 한국어로 짧게 말합니다. 문학, 문법, 읽기, 쓰기 관련 표현을 정확히 기록하세요. 들리지 않는 말을 추측하지 마세요."
          : "A Korean middle school student is repeating one English vocabulary word or a short English example sentence. Preserve the intended English spelling.");

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

    const transcript = data.text.trim();
    const promptLeak = isMath && (
      /한국\s*중학교\s*1학년\s*학생이\s*수학\s*답을/.test(transcript)
      || /숫자.*음수.*분수.*제곱.*루트/.test(transcript)
      || /표현을\s*정확한\s*한국어/.test(transcript)
    );
    if (promptLeak) {
      return sendJson(response, 422, { error: "답을 듣지 못했습니다. 준비되면 천천히 다시 말해 주세요." });
    }

    const compactTranscript = transcript.replace(/\s+/g, "");
    const uniqueRatio = compactTranscript.length
      ? new Set([...compactTranscript]).size / compactTranscript.length
      : 1;
    const abnormalRepetition = /(.)\1{7,}/u.test(compactTranscript)
      || (compactTranscript.length > 60 && uniqueRatio < 0.12)
      || transcript.length > 320;
    if (abnormalRepetition) {
      return sendJson(response, 422, { error: "음성이 정확히 인식되지 않았습니다. 짧게 다시 말해 주세요." });
    }

    return sendJson(response, 200, { text: transcript });
  } catch (error) {
    console.error("GEM transcription error", error);
    return sendJson(response, 500, { error: "음성 인식 연결 중 문제가 발생했습니다." });
  }
}
