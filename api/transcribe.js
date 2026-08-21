import { requireStudentSession } from "../lib/student-session.js";

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

  if (!requireStudentSession(request, response)) return;

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
    const isHistory = courseId.includes("history");
    const isScience = courseId.includes("science");
    const isEnglishWord = courseId.includes("english-word");
    const isEnglishCourse = isEnglishWord
      || courseId.endsWith("-english")
      || courseId === "toefl"
      || courseId === "toeic"
      || courseId === "g3-math-en";
    // 새 영어 과정은 한국어와 영어가 자연스럽게 섞이므로 언어를 강제로
    // 고정하지 않습니다. 기존 단어 따라 말하기 과정만 영어로 고정합니다.
    const language = isEnglishWord || courseId === "g3-math-en" ? "en" : isEnglishCourse ? null : "ko";
    const audioBuffer = Buffer.from(base64, "base64");
    const lessonPrompt = courseId === "g3-math-en"
      ? "A Grade 3 learner is answering a multiplication activity in English. Transcribe only the short spoken English answer."
      : isMath
      ? "한국 중고등학생의 수학 문제에 대한 짧은 답변입니다."
      : isSocial
        ? "한국 중고등학생의 사회 문제에 대한 짧은 답변입니다."
        : isKorean
          ? "한국 중고등학생의 국어 문제에 대한 짧은 답변입니다."
          : isHistory
            ? "한국 중고등학생의 한국사 문제에 대한 짧은 답변입니다. 인물, 시대, 사건, 제도와 연도를 정확히 받아쓰세요."
            : isScience
              ? "한국 중고등학생의 과학 문제에 대한 짧은 답변입니다. 과학 용어, 수치, 단위와 실험 조건을 정확히 받아쓰세요."
              : isEnglishCourse
                ? "A Korean learner is answering an English lesson. Transcribe only the spoken Korean or English answer."
                : "A Korean student is repeating one English word or a short sentence.";
    const courseKeywords = isMath
      ? ["음수", "분수", "제곱", "루트", "좌표", "사분면", "합집합", "교집합"]
      : isSocial
        ? ["지리", "정치", "법", "경제", "사회", "문화", "기후", "기본권"]
        : isKorean
          ? ["문학", "문법", "읽기", "쓰기", "화자", "서술자"]
          : isHistory
            ? ["고조선", "삼국", "통일신라", "발해", "고려", "조선", "개항", "독립운동", "광복", "대한민국", "민주화"]
            : isScience
              ? ["물질", "원자", "분자", "힘", "운동", "에너지", "전기", "세포", "유전", "생태계", "지구", "기후", "태양계", "변인", "단위"]
              : isEnglishCourse
                ? ["Reading", "Listening", "Speaking", "Writing", "grammar", "vocabulary", "TOEFL", "TOEIC"]
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
        if (language) form.append("languages[]", language);
        keywords.forEach((keyword) => form.append("keywords[]", keyword));
      } else if (language) {
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

    let transcriptionModel = "gpt-transcribe";
    let { result, data } = await requestTranscription(transcriptionModel);
    if (!result.ok && [400, 403, 404].includes(result.status)) {
      console.warn("GPT Transcribe fallback", result.status, data?.error?.code, data?.error?.param);
      transcriptionModel = "gpt-4o-transcribe";
      ({ result, data } = await requestTranscription(transcriptionModel));
    }
    if (!result.ok || !data.text?.trim()) {
      console.error(
        "OpenAI transcription error",
        result.status,
        data?.error?.code,
        data?.error?.param,
        data?.error?.message
      );
      return sendJson(response, 502, { error: isEnglishCourse
        ? "I couldn't understand your answer. Please say it again."
        : "목소리를 알아듣지 못했습니다. 다시 말해 주세요." });
    }

    const transcript = data.text.trim();
    console.info("GEM transcription success", transcriptionModel, transcript.length);
    const promptLeak = (
      /한국\s*중고등학생이\s*(?:수학|사회|국어|한국사|과학)\s*(?:수업\s*문제의\s*)?답을/.test(transcript)
      || /한국\s*중고등학생의\s*(?:수학|사회|국어|한국사|과학)\s*문제에\s*대한\s*짧은\s*답변/.test(transcript)
      || /숫자.*음수.*분수.*제곱.*루트/.test(transcript)
      || /지리.*정치.*법.*경제.*사회.*문화/.test(transcript)
      || /문학.*문법.*읽기.*쓰기/.test(transcript)
      || /고조선.*삼국.*고려.*조선.*독립운동/.test(transcript)
      || /물질.*원자.*분자.*힘.*운동.*에너지/.test(transcript)
      || /Korean learner.*answering an English lesson/i.test(transcript)
      || /Transcribe only the spoken/i.test(transcript)
      || /들리지\s*않는\s*말을\s*추측/.test(transcript)
      || /같은\s*글자를\s*반복하지\s*마세요/.test(transcript)
      || /표현을\s*정확한\s*한국어/.test(transcript)
    );
    if (promptLeak) {
      return sendJson(response, 422, { error: isEnglishCourse
        ? "I couldn't hear your answer. Please say it again slowly."
        : "답을 듣지 못했습니다. 준비되면 천천히 다시 말해 주세요." });
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
      return sendJson(response, 422, { error: isEnglishCourse
        ? "I couldn't recognize that clearly. Please give a short answer again."
        : "음성이 정확히 인식되지 않았습니다. 짧게 다시 말해 주세요." });
    }

    return sendJson(response, 200, { text: transcript });
  } catch (error) {
    console.error("GEM transcription error", error);
    return sendJson(response, 500, { error: "음성 인식 연결 중 문제가 발생했습니다." });
  }
}
