import { isActiveCourseRun, requireStudentSession } from "../lib/student-session.js";
import { isGuardedSuneungScienceCourse } from "../lib/suneung-science-safety.js";
import { createScienceLessonEngine, isApprovedClosedSuneungScienceSpeechText } from "../lib/suneung-science-bank.js";
import { isApprovedScienceReplySpeech } from "../lib/science-reply-proof.js";
import { SUNEUNG_COURSES } from "./suneung-courses.js";
import { isGeneralSuneungCourse } from "../lib/suneung-general-flow.js";
import { aiServiceUnavailable, providerAiServiceError } from "../lib/ai-service-error.js";

const MAX_TEXT_LENGTH = 1800;
const CIRCLED_TO_SPOKEN = {
  "①": "1번 ", "②": "2번 ", "③": "3번 ", "④": "4번 ", "⑤": "5번 ",
  "⑥": "6번 ", "⑦": "7번 ", "⑧": "8번 ", "⑨": "9번 ", "⑩": "10번 "
};
const ENGLISH_QUESTION_NUMBERS = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
  6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten"
};
const KOREAN_QUESTION_NUMBERS = {
  1: "첫 번째", 2: "두 번째", 3: "세 번째", 4: "네 번째", 5: "다섯 번째",
  6: "여섯 번째", 7: "일곱 번째", 8: "여덟 번째", 9: "아홉 번째", 10: "열 번째"
};
const FRENCH_QUESTION_NUMBERS = {
  1: "un", 2: "deux", 3: "trois", 4: "quatre", 5: "cinq",
  6: "six", 7: "sept", 8: "huit", 9: "neuf", 10: "dix"
};
const SCHOOL_ENGLISH_COURSE_IDS = new Set([
  "m1-english", "m2-english", "m3-english",
  "h1-english", "h2-english", "h3-english"
]);
const KOREAN_CHOICE_LABELS = {
  A:"에이", B:"비", C:"씨", D:"디", E:"이"
};
const SUNEUNG_MATH_COURSE_PATTERN = /^suneung-\d{4}-math(?:-|$)/;

function answerBoxLinePattern() {
  // Accept both the canonical visual slot and the damaged `답: ()` form
  // produced by the previous Markdown cleanup order.
  return /^\s*(?:Answer|Réponse|답)(?:\s*\d+)?\s*:\s*\(\s*(?:[_\u3000 ]{3,})?\s*\)\s*$/gim;
}

export function isSuneungMathCourse(courseId = "") {
  return SUNEUNG_MATH_COURSE_PATTERN.test(String(courseId || ""));
}

export function isGeneralSuneungSpeechCourse(courseId = "") {
  const course = SUNEUNG_COURSES[String(courseId || "")];
  return isGeneralSuneungCourse(course);
}

// General CSAT passages must not pass through the math fraction/exponent
// normalizer. Only the visual choice labels need a predictable spoken form.
export function normalizeGeneralSuneungSpeech(value, courseId = "") {
  if (!isGeneralSuneungSpeechCourse(courseId)) return String(value || "");
  return String(value || "").replace(
    /^\s*\(?([A-E])\s*(?:\)|[.:：])\s*(.+?)\s*$/gim,
    (_, label, content) => {
      const spokenLabel = label.toUpperCase() === "E" ? "알파벳 이" : KOREAN_CHOICE_LABELS[label.toUpperCase()];
      return `${spokenLabel} 선택지, ${content}${/[.!?。？！]$/u.test(content) ? "" : "."}`;
    }
  );
}

export function generalSuneungSpeechInstructions(courseId = "") {
  if (!isGeneralSuneungSpeechCourse(courseId)) return "";
  const course = SUNEUNG_COURSES[courseId];
  const languageNames = {
    "de-DE":"German", "fr-FR":"French", "es-ES":"Spanish", "zh-CN":"Mandarin Chinese",
    "ja-JP":"Japanese", "ru-RU":"Russian", "ar-SA":"Arabic", "vi-VN":"Vietnamese", "en-US":"American English"
  };
  const targetLanguage = course.targetLanguage || (course.suneung.subject === "english" ? "en-US" : "ko-KR");
  const languageRule = languageNames[targetLanguage]
    ? `Speak Korean directions, choice labels, hints, and explanations in natural Korean. Read ${languageNames[targetLanguage]} passages and answer choices in clear natural ${languageNames[targetLanguage]}, preserving their original words. Switch languages to match the input; do not translate either language or read foreign text as Korean phonetic spellings.`
    : course.suneung.subject === "second-language"
      ? "Speak Korean naturally. Read Classical Chinese characters with their Korean Hanja readings, not Mandarin pronunciation. Do not add a translation or explanation."
      : "Speak in clear, natural Korean as a calm and encouraging Korean CSAT teacher.";
  return `${languageRule} Read exactly and only the supplied text, at a measured pace. Preserve every supplied answer choice in its original order and pause briefly between choices. Never add, guess, omit, complete, or invent a choice, sentence, or answer. A single choice segment contains only that choice: do not invent the preceding or following letters. Say the Korean label ‘알파벳 이’ distinctly for E, not the number two. Do not read markdown symbols, visual blanks, answer boxes, metadata, or lesson counters. If the input ends with ‘정답은 어느 보기인가요?’ or ‘정답은 무엇인가요?’, read the question exactly as written and finish only after it. Do not add an answer-request question when it is absent, such as in a hint or explanation.`;
}

function latestSuneungQuestionSection(value) {
  const text = String(value || "");
  const headers = [...text.matchAll(/^\s*문제\s*\d+\s*\/\s*10\b/gim)];
  const latestHeader = headers[headers.length - 1];
  return latestHeader ? text.slice(latestHeader.index) : text;
}

export function hasSuneungMathChoices(value) {
  const question = latestSuneungQuestionSection(value);
  const rawLabels = new Set(
    [...question.matchAll(/^\s*\(?([A-E])\s*(?:\)|[.:：])\s*\S+/gim)]
      .map((match) => match[1].toUpperCase())
  );
  if (["A", "B", "C", "D", "E"].every((label) => rawLabels.has(label))) return true;

  // A client may already have converted the labels before calling this API.
  const spokenLabels = new Set(
    [...question.matchAll(/^\s*(에이|비|씨|디|이)\s+(?:보기|선택지)\s*[,，:：.]\s*\S+/gm)]
      .map((match) => match[1])
  );
  return ["에이", "비", "씨", "디", "이"].every((label) => spokenLabels.has(label));
}

export function prepareAnswerPromptForSpeech(value, courseId = "") {
  const text = String(value || "");
  const answerBox = answerBoxLinePattern();
  if (!answerBox.test(text)) return text;

  // Answer boxes are visual controls. Ordinary courses keep the established
  // behavior of not speaking them at all.
  if (!isSuneungMathCourse(courseId) && !isGeneralSuneungSpeechCourse(courseId)) {
    return text.replace(answerBoxLinePattern(), "").trimEnd();
  }

  const finalQuestion = hasSuneungMathChoices(text)
    ? "정답은 어느 보기인가요?"
    : "정답은 무엇인가요?";
  const withoutBoxes = text
    .replace(answerBoxLinePattern(), "")
    .replace(/^\s*정답은 (?:어느 보기|무엇)인가요\?\s*$/gm, "")
    .trimEnd();
  return `${withoutBoxes}\n\n${finalQuestion}`.trim();
}

export function normalizeSuneungMathSpeech(value, courseId = "") {
  if (!isSuneungMathCourse(courseId)) return String(value || "");

  return String(value || "")
    // The question header has already been converted, so numeric fractions in
    // the problem and choices can now be read denominator-first in Korean.
    // The boundaries avoid treating dates such as 2026/09/12 as fractions.
    .replace(/(?<![\d./])([-−]?\d+)\s*\/\s*(\d+)(?![\d/])/g, (_, numerator, denominator) => {
      const negative = /^[-−]/.test(numerator);
      const magnitude = numerator.replace(/^[-−]/, "");
      return `${negative ? "마이너스 " : ""}${denominator}분의 ${magnitude}`;
    })
    .replace(/\bsqrt\s*\(\s*([^()\n]+?)\s*\)/gi, "$1의 제곱근")
    .replace(/√\s*\(\s*([^()\n]+?)\s*\)/g, "$1의 제곱근")
    .replace(/√\s*([A-Za-z0-9가-힣]+)/g, "$1의 제곱근")
    .replace(/([A-Za-z0-9가-힣)\]])\s*(?:\^2|²)/g, "$1의 제곱")
    .replace(/([A-Za-z0-9가-힣)\]])\s*(?:\^3|³)/g, "$1의 세제곱")
    .replace(/^\s*\(?([A-E])\s*(?:\)|[.:：])\s*(.+?)\s*$/gim, (_, label, content) => {
      const choice = KOREAN_CHOICE_LABELS[label.toUpperCase()] || label;
      const ending = /[.!?。？！]$/u.test(content) ? "" : ".";
      return `${choice} 선택지, ${content}${ending}`;
    });
}

export function truncateSpeechText(value, courseId = "", maxLength = MAX_TEXT_LENGTH) {
  const text = String(value || "").trim();
  // The general-course client segments passages and each A–E choice before
  // requesting speech. Never silently discard later choices here. The API
  // rejects an oversized unsplit segment explicitly below.
  if (isGeneralSuneungSpeechCourse(courseId)) return text;
  const safeMaxLength = Number.isSafeInteger(maxLength) && maxLength > 0
    ? maxLength
    : MAX_TEXT_LENGTH;
  if (text.length <= safeMaxLength) return text;

  if (isSuneungMathCourse(courseId)) {
    const choiceStarts = [...text.matchAll(/^[ \t]*에이[ \t]+(?:보기|선택지)[ \t]*[,，:：.][ \t]*\S+/gm)];
    const latestChoiceStart = choiceStarts[choiceStarts.length - 1]?.index;
    if (Number.isSafeInteger(latestChoiceStart)) {
      const choiceSuffix = text.slice(latestChoiceStart).trim();
      const hasAllChoices = ["에이", "비", "씨", "디", "이"].every((label) => (
        new RegExp(`^\\s*${label}\\s+(?:보기|선택지)\\s*[,，:：.]\\s*\\S+`, "m").test(choiceSuffix)
      ));
      const hasFinalPrompt = /(?:^|\n)정답은 (?:어느 보기|무엇)인가요\?\s*$/.test(choiceSuffix);
      const separator = "\n\n";
      if (hasAllChoices && hasFinalPrompt && choiceSuffix.length + separator.length < safeMaxLength) {
        const prefixLength = safeMaxLength - separator.length - choiceSuffix.length;
        const prefix = text.slice(0, Math.min(latestChoiceStart, prefixLength)).trimEnd();
        return `${prefix}${separator}${choiceSuffix}`;
      }
    }

    const finalPrompt = text.match(/(?:^|\n)(정답은 (?:어느 보기|무엇)인가요\?)\s*$/)?.[1];
    if (finalPrompt && finalPrompt.length < safeMaxLength) {
      const separator = "\n\n";
      const prefixLength = safeMaxLength - separator.length - finalPrompt.length;
      const prefix = text.slice(0, prefixLength).trimEnd();
      return `${prefix}${separator}${finalPrompt}`;
    }
  }

  return text.slice(0, safeMaxLength);
}

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export function cleanText(value, courseId = "") {
  const raw = String(value || "");
  const isSchoolEnglish = SCHOOL_ENGLISH_COURSE_IDS.has(String(courseId || ""));

  let output = raw
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*|```/g, ""))
    // Remove emphasis without erasing visual underscore blanks before their
    // answer-slot meaning has been determined.
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*\*|`|#+\s?/g, "")
    // Never speak dummy option placeholders such as "① ...".
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*(?:\.{2,}|…+|⋯+|_{2,}|[-–—]*)\s*$/gm, "")
    .replace(/^\s*\d+\s*[.)]\s*(?:\.{2,}|…+|⋯+|_{2,}|[-–—]*)\s*$/gm, "");

  // Resolve the visual answer slot while its underscores are still intact.
  // Math and general CSAT courses get a final spoken question; other courses
  // preserve the long-standing behavior of leaving visual controls silent.
  output = prepareAnswerPromptForSpeech(output, courseId);

  // Bracketed TOEIC/TOEFL counters are useful visually, but sound unnatural
  // when Korean and English labels are read together.
  output = output.replace(/^\s*\[\s*(?:(?:문제|활동|Activity|Question)\s*)?\d+\s*\/\s*10\s*\][^\n]*$/gim, "");

  // Counters such as "Activity 2/10" are useful on screen, but a speech
  // engine often reads 2/10 as a fraction or produces an unnatural suffix.
  // Convert only the spoken copy into a short, natural question transition.
  output = output
    .replace(/^\s*Activity\s*(\d{1,2})\s*\/\s*10\s*(?:[—–-]\s*[^\n]*)?\s*$/gim, (_, number) => {
      const spoken = ENGLISH_QUESTION_NUMBERS[Number(number)] || number;
      return `Question ${spoken}.`;
    })
    .replace(/^\s*Activité\s*(\d{1,2})\s*\/\s*10\s*(?:[—–-]\s*[^\n]*)?\s*$/gim, (_, number) => {
      const spoken = FRENCH_QUESTION_NUMBERS[Number(number)] || number;
      return `Question ${spoken}.`;
    })
    .replace(/^\s*(?:문제|활동|과제|연습)\s*(\d{1,2})\s*\/\s*10\s*(?:[—–-]\s*[^\n]*)?\s*$/gm, (_, number) => {
      const spoken = KOREAN_QUESTION_NUMBERS[Number(number)] || `${number}번째`;
      return `${spoken} 문제입니다.`;
    });

  // For middle/high-school English, answer choices stay visible on screen but
  // are not spoken. This prevents the teacher voice from literally saying the
  // correct option before the learner answers.
  if (isSchoolEnglish) {
    output = output
      .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s+.+$/gm, "")
      .replace(/^\s*\d+\s*[.)]\s+.+$/gm, "")
      .replace(/^\s*[A-Ea-e]\s*[.)]\s+.+$/gm, "")
      .replace(/^\s*(?:보기|선택지)\s*[:：].*$/gm, "");
  } else {
    // In other subjects, meaningful circled choices are spoken naturally.
    output = output.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (mark) => CIRCLED_TO_SPOKEN[mark] || "");
  }

  output = output
    // Remove any counter formats that were not converted above.
    .replace(/^\s*(?:(?:활동|문제|과제|연습)\s*)?\d+\s*\/\s*10\s*(?:[—–-]\s*[^\n]*)?\s*$/gm, "")
    .replace(/^\s*(?:활동|문제|과제|연습)\s*\d+\s*\/\s*10\s*[:：]?\s*/gm, "")
    // Defense in depth: neither a canonical answer box nor the old damaged
    // `답: ()` representation may ever be spoken.
    .replace(answerBoxLinePattern(), "")
    // Attempt counters are visual metadata, not mathematical fractions.
    .replace(/도전[ \t]*[1-3][ \t]*\/[ \t]*3[ \t]*(?:[·—–-][ \t]*)?/g, "")
    .replace(/_{4,}/g, " ")
    .replace(/^\s*(?:한글\s*)?발음(?:은)?\s*[:：].*$/gm, "")
    .replace(/^\s*(?:\.{2,}|…+|⋯+)\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  output = normalizeGeneralSuneungSpeech(normalizeSuneungMathSpeech(output, courseId), courseId);
  return truncateSpeechText(output, courseId);
}

// A standalone short numeric choice needs an explicit reading, not an
// invitation for the generative voice to interpret a letter/number fragment.
export function numericChoiceScript(text, courseId = "") {
  if (!isSuneungMathCourse(courseId)) return text;
  const match = String(text).trim().match(/^(에이|비|씨|디|이)\s+(?:보기|선택지)\s*[,，:：.]\s*([-−]?)(\d{1,4})(?:\.(\d+))?\.?$/);
  if (!match) return text;
  const [, label, sign, integer, decimals] = match;
  const digits = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const units = ["", "십", "백", "천"];
  const canonical = String(Number(integer));
  const whole = canonical === "0" ? "영" : [...canonical].map((digit, index) => {
    const place = canonical.length - index - 1;
    return digit === "0" ? "" : `${digit === "1" && place ? "" : digits[Number(digit)]}${units[place]}`;
  }).join("");
  const fraction = decimals ? ` 점 ${[...decimals].map((digit) => digits[Number(digit)]).join(" ")}` : "";
  return `${label} 선택지. 값은 ${sign ? "마이너스 " : ""}${whole}${fraction}입니다.`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  const student = requireStudentSession(request, response);
  if (!student) return;

  const apiKey = process.env.OPENAI_API_KEY;
  const courseId = String(request.body?.courseId || "");
  if (!isActiveCourseRun(student, courseId, request.body?.courseRunId)) {
    return sendJson(response, 409, {
      error: "현재 시작된 수업과 음성 요청 과목이 일치하지 않습니다. 교실에서 다시 입장해 주세요."
    });
  }
  const isToeic = courseId === "toeic";
  const isSuneung = courseId.startsWith("suneung-");
  const isSuneungMath = isSuneungMathCourse(courseId);
  const isGeneralSuneung = isGeneralSuneungSpeechCourse(courseId);
  const isEnglishAvatar = /^g[1-5]-math-en$/.test(courseId);
  const isFrenchAvatar = /^g[1-5]-math-fr$/.test(courseId);
  const rawText = String(request.body?.text || "");
  if (isGeneralSuneung && rawText.length > MAX_TEXT_LENGTH) {
    return sendJson(response, 413, {
      error:"긴 음성 내용은 보기와 문단 단위로 나누어 다시 요청해 주세요.", code:"speech_segment_too_long", maxLength:MAX_TEXT_LENGTH
    });
  }
  if (isGuardedSuneungScienceCourse(courseId)
    && !createScienceLessonEngine(student.courseRunId, courseId).isApprovedClosedSuneungScienceSpeechText(rawText)
    && !isApprovedClosedSuneungScienceSpeechText(rawText)
    && !isApprovedScienceReplySpeech({ student, text:rawText, proof:request.body?.scienceReplyProof })) {
    return sendJson(response, 400, {
      error:"승인된 통합과학 수업 내용만 음성으로 들을 수 있습니다."
    });
  }
  const narrationCourse = isGuardedSuneungScienceCourse(courseId) ? "suneung-2028-math" : courseId;
  const input = numericChoiceScript(normalizeSuneungMathSpeech(cleanText(rawText, courseId), narrationCourse), narrationCourse);
  if (isGeneralSuneung && input.length > MAX_TEXT_LENGTH) {
    return sendJson(response, 413, {
      error:"긴 음성 내용은 보기와 문단 단위로 나누어 다시 요청해 주세요.", code:"speech_segment_too_long", maxLength:MAX_TEXT_LENGTH
    });
  }
  if (!apiKey || !input) return sendJson(response, 400, { error: isEnglishAvatar
    ? "There is no text to speak."
    : isFrenchAvatar
      ? "Il n'y a aucun texte à lire."
    : "읽을 문장이 없습니다." });

  try {
    const result = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input,
        instructions: isEnglishAvatar
          ? "Speak only in clear natural American English as a warm elementary mathematics teacher. Never speak Korean. Read the multiplication sign as 'times', never as the Korean word '곱하기'. Do not read markdown symbols, visual blanks, answer boxes, or lesson counters."
          : isFrenchAvatar
            ? "Parle uniquement en français naturel, clair et chaleureux, comme un professeur de mathématiques de l'école élémentaire. Prononce le signe de multiplication comme « fois ». Ne parle ni coréen ni anglais. Ne lis pas les symboles Markdown, les champs de réponse, les blancs visuels ni les compteurs d'activités."
          : isGeneralSuneung
            ? generalSuneungSpeechInstructions(courseId)
          : isSuneung
            ? `Speak in clear, natural Korean as a calm and encouraging Korean CSAT teacher. Read mathematical expressions, scientific terms, units, and answer choices accurately and at a measured pace. Do not add, guess, or omit content. Never reveal an answer that is not present in the input. Do not read markdown symbols, visual blanks, answer boxes, metadata, or lesson counters.${isSuneungMath ? " Preserve every answer choice in its original order and pause briefly between choices. When the input ends with ‘정답은 어느 보기인가요?’ or ‘정답은 무엇인가요?’, read that final answer-request question exactly as written and finish only after it. Do not add either question when it is absent from the input, such as in a hint or explanation." : ""}`
          : isToeic
            ? "Speak like a clear, natural TOEIC practice teacher. Read the Korean directions naturally, and pronounce the English question and each answer choice in clear American English. Never read lesson counters, part headings, markdown symbols, visual blanks, or answer boxes. Read exactly and only the answer choices present in the input, in their original order. Do not add, invent, omit, complete, or guess any choice or sentence. Do not reveal which choice is correct."
            : "Speak like a warm, calm and encouraging bilingual English teacher. Speak Korean explanations naturally. Pronounce every English word and English sentence with clear native American English pronunciation, slightly slowly. Do not imitate Korean phonetic spellings. Never read markdown symbols, visual blanks, answer boxes, dummy ellipsis choices, or lesson counters. For middle/high-school English multiple-choice activities, do not speak the answer-choice text; the learner reads choices on screen and answers by number.",
        response_format: "mp3"
      })
    });

    if (!result.ok) {
      const data = await result.json().catch(() => null);
      const serviceError = providerAiServiceError(result.status, data) || aiServiceUnavailable();
      if (serviceError.payload.code === "ai_service_unavailable") {
        serviceError.payload.error = isEnglishAvatar
          ? "The teacher voice service is temporarily unavailable. Please try again later."
          : isFrenchAvatar
            ? "Le service vocal du professeur est temporairement indisponible. Réessayez plus tard."
            : serviceError.payload.error;
      }
      console.warn("OpenAI speech unavailable", result.status, serviceError.payload.code);
      return sendJson(response, serviceError.status, serviceError.payload);
    }

    const audio = Buffer.from(await result.arrayBuffer()).toString("base64");
    return sendJson(response, 200, { audio, mimeType: "audio/mpeg" });
  } catch (error) {
    console.error("GEM speech error", error);
    return sendJson(response, 500, { error: isEnglishAvatar
      ? "There was a problem connecting the teacher voice."
      : isFrenchAvatar
        ? "Un problème est survenu avec la voix du professeur."
      : "음성 연결 중 문제가 발생했습니다." });
  }
}
