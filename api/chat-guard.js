import chatHandler from "./chat.js";
import { getCourse } from "./courses.js";
import { requireStudentSession } from "../lib/student-session.js";
import {
  isSchoolEnglishNoAnswerRequest,
  schoolEnglishNoAnswerResponse
} from "./_no-answer-guard.js";

const SCHOOL_ENGLISH_VARIETY_MARKER = "[중1-고3 영어 100% 자동 새 문제 규칙]";
const SCHOOL_ENGLISH_VARIETY_RULE = `

${SCHOOL_ENGLISH_VARIETY_MARKER}
- 매 활동은 현재 학년 수준에 맞는 완전히 새로운 문제로 자동 생성합니다. 중1·중2·중3·고1·고2·고3의 난이도와 어휘·문법·독해 수준을 서로 섞지 않습니다.
- 한 수업 10개 활동에서 같은 핵심 정답 단어·표현을 두 번 사용하지 않습니다. 직전 활동의 정답이 borrow였다면 다음 활동에서는 문구나 물건만 바꾸어 borrow를 다시 묻지 않습니다.
- 같은 문장 뼈대, 같은 대화 목적, 같은 등장인물·물건·장소, 같은 선택지 조합을 반복하지 않습니다. pencil을 eraser로 바꾸는 것처럼 소재만 바꾼 사실상 같은 문제도 금지합니다.
- 학생이 정답을 맞힌 뒤 다음 활동으로 넘어갈 때는 학습 목표 자체를 바꿉니다. 단어→회화→이야기→퀴즈를 기계적으로 고정하지 말고 이전 활동과 다른 영역·문형·상황을 우선 선택합니다.
- 시스템이 제공하는 과거 문제 기록과 현재 대화에 나온 이전 활동을 모두 재출제 금지 목록으로 취급합니다. 과거에 사용한 핵심 정답, 질문 문장, 상황과 매우 비슷한 후보는 폐기합니다.
- 새 수업을 시작할 때도 첫 문제를 특정 단어·문장·상황으로 고정하지 않습니다. 매번 다른 시작 영역과 다른 핵심 어휘·표현을 선택합니다.
- 문제를 출력하기 전에 서로 다른 후보 5개를 내부적으로 만들고, 이전 기록과 핵심 정답·문장 구조·상황이 가장 덜 겹치며 현재 학년에 가장 적합한 하나만 제시합니다. 후보는 출력하지 않습니다.
- 중학교는 생활 영어·기초 문법·짧은 읽기와 회화를 중심으로 학년이 올라갈수록 문장 길이와 추론을 높입니다. 고등학교는 내신·수능형 어휘·문법·독해·문맥 추론을 학년별 난이도로 다양하게 섞습니다.
- 정답 사전 공개 금지 규칙은 그대로 유지합니다. 새 문제를 다양하게 만들기 위해서도 정답을 미리 보여 주지 않습니다.`;

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function compactHistoryItem(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function collectSchoolEnglishVarietyHistory(messages, existingHistory) {
  const combined = Array.isArray(existingHistory)
    ? existingHistory.map(compactHistoryItem).filter(Boolean)
    : [];

  const assistantTexts = Array.isArray(messages)
    ? messages
        .filter((message) => message?.role === "assistant")
        .map((message) => String(message?.content || "").trim())
        .filter(Boolean)
    : [];

  // Make every question already shown in this conversation visible to the
  // duplicate checker, even when the browser did not place it in `history`.
  for (const text of assistantTexts.slice(-24)) {
    if (/(?:활동|문제)\s*\d+\s*\/\s*10|_{4,}|답\s*:\s*\(/i.test(text)) {
      combined.push(`이전 영어 활동: ${compactHistoryItem(text)}`);
    }
  }

  // Also remember previously confirmed target answers. This prevents the
  // next activity from asking the same word again with a different object.
  const usedAnswers = new Set();
  for (const text of assistantTexts) {
    const patterns = [
      /정답(?:이에요|입니다|이야|이다)?[!,:.\s“”"']*([A-Za-z][A-Za-z'-]{1,30})\b/gi,
      /(?:정답|답)\s*(?:은|는|:)?\s*[“”"']?([A-Za-z][A-Za-z'-]{1,30})\b/gi,
      /(?:correct\s+answer|answer)\s*(?:is|:)\s*["']?([A-Za-z][A-Za-z'-]{1,30})\b/gi
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        usedAnswers.add(match[1].toLowerCase());
      }
    }
  }

  if (usedAnswers.size) {
    combined.push(`이미 사용한 핵심 정답 — 다시 문제로 내지 말 것: ${[...usedAnswers].slice(-30).join(", ")}`);
  }

  // A request-specific rotation token helps avoid a fixed first-question path
  // while the actual grade and curriculum constraints still come from course.prompt.
  combined.push(`이번 생성 다양화 코드: ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  return [...new Set(combined)].slice(-60);
}

export default async function handler(request, response) {
  const course = getCourse(request.body?.courseId);
  const messages = Array.isArray(request.body?.messages) ? request.body.messages : [];

  if (course?.kind === "english") {
    if (!course.prompt.includes(SCHOOL_ENGLISH_VARIETY_MARKER)) {
      course.prompt += SCHOOL_ENGLISH_VARIETY_RULE;
    }

    request.body = request.body || {};
    request.body.history = collectSchoolEnglishVarietyHistory(
      messages,
      request.body.history
    );
  }

  if (course?.kind === "english" && isSchoolEnglishNoAnswerRequest(messages)) {
    if (!requireStudentSession(request, response)) return;
    return sendJson(response, 200, { text: schoolEnglishNoAnswerResponse() });
  }

  return chatHandler(request, response);
}
