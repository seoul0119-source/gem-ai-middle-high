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
    const courseId = String(request.body?.courseId || "");
    const cleanContext = String(request.body?.context || "")
      .replace(/\[도표 시작\][\s\S]*?\[도표 끝\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const problemStart = Math.max(
      cleanContext.lastIndexOf("문제 "),
      cleanContext.lastIndexOf("단어입니다")
    );
    const questionContext = (problemStart >= 0 ? cleanContext.slice(problemStart) : cleanContext.slice(-360))
      .slice(0, 360);
    const isMath = courseId.includes("math");
    const isSocial = courseId.includes("social");
    const isKorean = courseId.includes("korean");
    const isEnglishWord = courseId.includes("english-word");
    const language = isEnglishWord ? "en" : "ko";
    const audioBuffer = Buffer.from(base64, "base64");
    const lessonPrompt = isMath
      ? "한국 중고등학생의 수학 문제에 대한 짧은 답변입니다."
      : isSocial
        ? "한국 중고등학생의 사회 문제에 대한 짧은 답변입니다."
        : isKorean
          ? "한국 중고등학생의 국어 문제에 대한 짧은 답변입니다."
          : "A Korean student is repeating one English word or a short sentence.";
    const courseKeywords = isMath
      ? ["음수", "분수", "제곱", "루트", "좌표", "사분면", "합집합", "교집합"]
      : isSocial
        ? ["지리", "정치", "법", "경제", "사회", "문화", "기후", "기본권"]
        : isKorean
          ? ["문학", "문법", "읽기", "쓰기", "화자", "서술자"]
          : [];
    const contextKeywords = questionContext.match(/[가-힣]{2,}|[A-Za-z][A-Za-z0-9-]{2,}|-?\d+(?:[.,]\d+)*/g) || [];
    const keywords = [...new Set([...courseKeywords, ...contextKeywords])]
      .filter((word) => word.length <= 30)
      .slice(0, 24);

    function createForm(model) {
      const form = new FormData();
      form.append("file", new Blob([audioBuffer], { type: mimeType }), `student.${extension}`);
      form.append("model", model);
      form.append("response_format", "json");
      form.append("prompt", lessonPrompt);
      if (model === "gpt-transcribe") {
        form.append("languages[]", language);
        keywords.forEach((keyword) => form.append("keywords[]", keyword));
      } else {
        form.append("language", language);
      }
      return form;
    }

    async function requestTranscription(model) {
      const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: createForm(model)
      });
      const data = await result.json();
      return { result, data };
    }

    let { result, data } = await requestTranscription("gpt-transcribe");
    if (!result.ok && [400, 403, 404].includes(result.status)) {
      console.warn("GPT Transcribe fallback", result.status, data?.error?.code, data?.error?.param);
      ({ result, data } = await requestTranscription("gpt-4o-transcribe"));
    }
    if (!result.ok || !data.text?.trim()) {
      console.error(
        "OpenAI transcription error",
        result.status,
        data?.error?.code,
        data?.error?.param,
        data?.error?.message
      );
      return sendJson(response, 502, { error: "목소리를 알아듣지 못했습니다. 다시 말해 주세요." });
    }

    const transcript = data.text.trim();
    const promptLeak = (
      /한국\s*중고등학생이\s*(?:수학|사회|국어)\s*(?:수업\s*문제의\s*)?답을/.test(transcript)
      || /숫자.*음수.*분수.*제곱.*루트/.test(transcript)
      || /지리.*정치.*법.*경제.*사회.*문화/.test(transcript)
      || /문학.*문법.*읽기.*쓰기/.test(transcript)
      || /들리지\s*않는\s*말을\s*추측/.test(transcript)
      || /같은\s*글자를\s*반복하지\s*마세요/.test(transcript)
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
      || /^(감사합니다|고맙습니다|시청해\s*주셔서\s*감사합니다|자막\s*(?:제공|제작))\.?$/i.test(transcript)
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
