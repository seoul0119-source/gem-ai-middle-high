import { getCourse } from "./courses.js";
import { requireStudentSession } from "../lib/student-session.js";

const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 3000;
const MAX_WORD_RETRIES = 3;
const INTERACTIVE_COURSE_KINDS = new Set([
  "math", "korean", "social", "history", "science", "english", "toefl", "toeic"
]);
const ANSWER_SLOT_RULE = `

[모든 과목 공통 답안 칸 표시 규칙]
- 학생이 답해야 하는 새 문제·활동·과제에는 문제 내용의 맨 마지막 줄에 반드시 정확히 “답: (________)”을 표시합니다.
- 오답이나 불분명한 음성 때문에 같은 문제에서 다시 답을 기다릴 때도 응답의 맨 마지막 줄에 반드시 “답: (________)”을 다시 표시합니다.
- 객관식, 단답형, 서술형, 말하기, 듣기, 빈칸 완성 문제를 포함한 모든 문제에 같은 답안 칸을 표시합니다.
- 답이 여러 개인 문제라면 “답 1: (________)”, “답 2: (________)”처럼 필요한 수만큼 각각 표시합니다.
- 답안 칸 안에는 정답, 정답 번호, 첫 글자, 힌트나 예시 답을 넣지 않습니다.
- TOEFL Complete the Words처럼 문제 문장 안에 철자 빈칸이 있는 유형도 문장 안의 빈칸과 별도로 맨 아래에 “답: (________)”을 표시합니다.
- 수업 종료 요약처럼 학생의 답을 더 기다리지 않는 응답에는 답안 칸을 표시하지 않습니다.`;
const ENGLISH_ANSWER_SLOT_RULE = `

[English-only answer field rule]
- Write the entire visible response in English. Do not display Korean words or labels unless the learner explicitly asks for Korean help.
- End every new activity or retry that awaits the learner with exactly “Answer: (________)”.
- Never write the Korean label “답:”. Never place the correct answer or a hint inside the answer field.
- Do not add an answer field to a final lesson summary that expects no further response.`;
const SCHOOL_ENGLISH_ANSWER_PROTECTION_RULE = `

[중1-고3 영어 정답 사전 공개 금지 — 최우선 규칙]
- 빈칸 완성, 문장 완성, 지문 완성, 알맞은 단어·표현 넣기 문제에서는 학생이 현재 문제에 답하기 전까지 정답 단어·표현을 절대로 말하거나 쓰지 않습니다.
- 새 문제를 제시하는 같은 응답 안에서 정답, 모범 답, 완성된 문장, 정답이 포함된 번역·예문·힌트를 함께 제공하지 않습니다.
- 학생이 “답을 말하지 마세요”, “정답 말하지 마”, “모르겠어요”, “힌트”, 침묵, 잡음, 불분명한 음성처럼 아직 정답을 제출하지 않은 말을 하면 현재 문제의 정답을 공개하지 않습니다.
- 이때는 문제를 그대로 다시 보여 주거나 정답이 직접 드러나지 않는 짧은 힌트만 제공하고 학생의 답을 기다립니다.
- “정답은 ○○”, “답은 ○○”, “빈칸에는 ○○가 들어갑니다”, “The answer is ○○”, “Fill the blank with ○○” 같은 정답 공개 문장을 학생이 답하기 전에 절대로 출력하지 않습니다.
- 객관식 문제는 선택지 자체를 보여 줄 수 있지만, 학생이 답하기 전에는 어느 선택지가 정답인지 표시하거나 말하지 않습니다.
- 학생이 답한 뒤에는 그 답을 채점하고 필요한 설명을 할 수 있습니다. 단, 같은 응답에서 새 빈칸 문제를 제시한다면 새 문제의 정답은 다시 숨깁니다.
- 화면에 표시되는 내용과 음성으로 읽히는 내용 모두 이 규칙을 따릅니다.`;
const FALLBACK_WORDS = [
  { word: "protect", pronunciation: "프로텍트", meaning: "보호하다", example: "We must protect the environment.", translation: "우리는 환경을 보호해야 합니다." },
  { word: "invite", pronunciation: "인바이트", meaning: "초대하다", example: "I will invite my friend.", translation: "나는 내 친구를 초대할 것입니다." },
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

function hasRequiredToeflBlank(text) {
  const output = String(text || "");
  if (!/Complete\s+the\s+Words/i.test(output)) return true;
  return /[A-Za-z]{1,12}_{4,}[A-Za-z]{0,8}/.test(output);
}

function hasRequiredToeicBlank(text) {
  const output = String(text || "");
  const questionHeader = /(?:문제\s*)?\d+\s*\/\s*10[^\n]*/gi;
  let match;
  let latestQuestionStart = -1;

  while ((match = questionHeader.exec(output)) !== null) {
    latestQuestionStart = match.index;
  }

  if (latestQuestionStart < 0) return true;
  const latestQuestion = output.slice(latestQuestionStart);
  const isCompletionQuestion = /Part\s*[56]|문장\s*완성|지문\s*완성/i.test(latestQuestion);
  if (!isCompletionQuestion) return true;
  const questionWithoutAnswerSlots = latestQuestion.replace(
    /^답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gm,
    ""
  );
  return /_{4,}/.test(questionWithoutAnswerSlots);
}

function getLatestToeicQuestion(text) {
  const output = String(text || "");
  const questionHeader = /(?:문제\s*)?\d+\s*\/\s*10[^\n]*/gi;
  let match;
  let latestQuestionStart = -1;

  while ((match = questionHeader.exec(output)) !== null) {
    latestQuestionStart = match.index;
  }

  return latestQuestionStart < 0 ? "" : output.slice(latestQuestionStart);
}

function hasRequiredToeicScene(text) {
  const latestQuestion = getLatestToeicQuestion(text);
  if (!latestQuestion || !/Part\s*1\b|사진\s*묘사|사진\s*(?:문제|장면)/i.test(latestQuestion)) return true;
  const sceneMatch = latestQuestion.match(/\[TOEIC 그림 시작\]([\s\S]*?)\[TOEIC 그림 끝\]/);
  if (!sceneMatch) return false;
  const scene = sceneMatch[1];
  return /^장소\s*:\s*\S+/m.test(scene)
    && /^인물\s*:\s*[0-3]\s*$/m.test(scene)
    && /^행동\s*:\s*\S+/m.test(scene)
    && /^배경\s*:\s*\S+/m.test(scene);
}

function hasRequiredSchoolEnglishBlank(text) {
  const output = String(text || "");
  const questionHeader = /(?:문제|활동)\s*\d+\s*\/\s*10[^\n]*/gi;
  let match;
  let latestQuestionStart = -1;

  while ((match = questionHeader.exec(output)) !== null) {
    latestQuestionStart = match.index;
  }

  if (latestQuestionStart < 0) return true;
  const latestQuestion = output.slice(latestQuestionStart);
  const isCompletionQuestion = /빈칸|문장\s*완성|지문\s*완성|완성하|괄호.{0,24}(?:넣|쓰|고르)|알맞은\s+(?:단어|표현|말).{0,24}(?:넣|쓰|고르)/i.test(latestQuestion);
  if (!isCompletionQuestion) return true;
  const questionWithoutAnswerSlots = latestQuestion.replace(
    /^답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gm,
    ""
  );
  return /_{4,}/.test(questionWithoutAnswerSlots);
}

function hasPrematureSchoolEnglishAnswer(text) {
  const output = String(text || "");
  if (!awaitsStudentAnswer(output)) return false;

  const cleaned = output
    .replace(/정답(?:은|을)?\s*(?:말하지|공개하지|알려\s*주지|알려주지)[^\n.]*/gi, "")
    .replace(/^답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gm, "");

  return /(?:정답|답)\s*:\s*["'“”‘’]?[^\s_(][^\n]{0,40}/i.test(cleaned)
    || /(?:정답|답)\s*(?:은|는)\s*["'“”‘’]?[^\s_(][^\n.!?]{0,30}(?:입니다|이에요|예요|이다|야)(?:[.!?]|$)/im.test(cleaned)
    || /(?:빈칸|괄호)(?:에|에는)\s*["'“”‘’]?[^\s_][A-Za-z가-힣'-]{0,30}(?:이|가)?\s*(?:들어갑니다|들어가요|맞습니다|맞아요)/i.test(cleaned)
    || /(?:빈칸|괄호)(?:에|에는)\s*(?:들어갈|들어가는|알맞은)\s*(?:단어|표현|말)?\s*(?:은|는|이|가)?\s*["'“”‘’]?[^\s_][^\n.!?]{0,30}(?:입니다|이에요|예요|이다|들어갑니다|들어가요)/i.test(cleaned)
    || /(?:the\s+)?(?:correct\s+)?answer\s*(?:is|:)\s*["']?[A-Za-z][A-Za-z'-]*/i.test(cleaned)
    || /fill(?:\s+in)?\s+(?:the\s+)?blank\s+with\s+["']?[A-Za-z][A-Za-z'-]*/i.test(cleaned);
}

function hasPrematureGrade3MathAnswer(text) {
  const output = String(text || "");
  if (!awaitsStudentAnswer(output)) return false;

  const activityMatches = [...output.matchAll(/Activity\s+\d+\s*\/\s*10\b/gi)];
  const currentActivity = activityMatches.length
    ? output.slice(activityMatches[activityMatches.length - 1].index)
    : output;
  const withoutAnswerSlot = currentActivity
    .replace(/^Answer(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gim, "")
    .replace(/^답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gim, "");

  // Completed equations are legitimate visible choices in a multiple-choice
  // activity; the rule below targets direct questions that reveal their own
  // answer in the stem or narration.
  if (/^\s*[A-D][).]\s+/m.test(withoutAnswerSlot)) return false;

  // A new Grade 3 question may contain an unfinished expression such as
  // "7 × 2 = ?", but it must never contain a completed result before the
  // learner answers. Catch both symbolic and spoken completed equations.
  return /\b\d{1,2}\s*(?:×|x|\*)\s*\d{1,2}\s*=\s*\d{1,3}\b/i.test(withoutAnswerSlot)
    || /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\d{1,2})\s+times\s+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(?:equals|is|makes)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\d{1,3})\b/i.test(withoutAnswerSlot);
}

function hasTooAdvancedGrade3MathQuestion(text) {
  const output = String(text || "");
  if (!awaitsStudentAnswer(output)) return false;

  const activityMatches = [...output.matchAll(/Activity\s+\d+\s*\/\s*10\b/gi)];
  const currentActivity = activityMatches.length
    ? output.slice(activityMatches[activityMatches.length - 1].index)
    : output;

  return /explain\s+(?:a|the|your|what|how|why|multiplication)/i.test(currentActivity)
    || /give\s+(?:a\s+)?(?:short\s+)?explanation/i.test(currentActivity)
    || /what\s+does\s+(?:the\s+)?(?:first|second)\s+(?:number|factor)\s+(?:tell|mean|describe|represent)/i.test(currentActivity)
    || /(?:define|interpret|justify|generalize)\b/i.test(currentActivity)
    || /Activity\s+\d+\s*\/\s*10\s*[—-]\s*Explain\b/i.test(currentActivity);
}

function hasIncompleteChoiceSet(text) {
  const output = String(text || "");
  const activityMatches = [...output.matchAll(/(?:Activity|문제|활동)\s+\d+\s*\/\s*10\b/gi)];
  const currentActivity = activityMatches.length
    ? output.slice(activityMatches[activityMatches.length - 1].index)
    : output;
  const optionLines = [...currentActivity.matchAll(/^\s*([A-Da-d])\s*[).:：]\s*(.*?)\s*$/gm)];
  if (!optionLines.length) return false;

  const options = new Map(optionLines.map((match) => [match[1].toUpperCase(), match[2].trim()]));
  if ([...options.values()].some((value) => !value)) return true;

  const looksLikeChoiceActivity = /(?:multiple[ -]?choice|fact choice|equation choice|repeated-addition choice|선택|객관식)/i.test(currentActivity);
  if (!looksLikeChoiceActivity) return false;
  return !["A", "B", "C"].every((label) => options.get(label));
}

function awaitsStudentAnswer(text) {
  const output = String(text || "");
  if (!output.trim()) return false;
  if (/(?:오늘의|이번)\s+.+수업을\s+마쳤|수업\s+종료|학습을\s+마쳤/.test(output)) return false;

  return /(?:문제|활동|과제|연습)\s*\d+\s*\/\s*10/i.test(output)
    || /(?:^|\s)\d+\s*\/\s*10(?:\s|—|-)/m.test(output)
    || /(?:답|정답).{0,24}(?:입력|말해|적어|써|고르|골라|선택|대답)/s.test(output)
    || /(?:다시|한\s*번\s*더).{0,20}(?:답해|말해|입력|적어|써)/s.test(output)
    || /(?:따라\s*말해|영어로\s+짧게\s+다시\s+말해)/.test(output);
}

function ensureAnswerSlot(text, courseKind, language) {
  let output = String(text || "").trimEnd();
  const isEnglishOnly = language === "en";
  const isEnglishAnswerCourse = ["english", "toefl", "toeic"].includes(courseKind);
  const isEnglishProblem = isEnglishAnswerCourse
    && /(?:^|\s)\d+\s*\/\s*10(?:\s|—|-)/m.test(output);
  if (!awaitsStudentAnswer(output) && !isEnglishProblem) return output;

  if (isEnglishOnly) {
    output = output
      .replace(/^답(?:\s*\d+)?\s*:\s*.*$/gm, "Answer: (________)")
      .replace(/^정답(?:\s*\d+)?\s*:\s*.*$/gm, "Answer: (________)");
    if (/Answer(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/i.test(output)) return output;
    return `${output}\n\nAnswer: (________)`;
  }

  if (isEnglishAnswerCourse) {
    output = output.replace(
      /^답\s*:\s*(?!\([ _\u3000]{3,}\)\s*$).+$/gm,
      "답: (________)"
    );
  }

  const visibleSlot = /답(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/;
  if (visibleSlot.test(output)) return output;
  return `${output}\n\n답: (________)`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  if (!requireStudentSession(request, response)) return;

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
    if (INTERACTIVE_COURSE_KINDS.has(course.kind)) {
      const history = sanitizeHistory(request.body?.history);
      const historyRule = history.length
        ? course.language === "en"
          ? `\n\n[Previous activities — do not repeat]\n${history.map((item, index) => `${index + 1}. ${item}`).join("\n")}\nReject any new activity that uses the same task structure with only different numbers, objects, names, or word order. Choose a different activity family.`
          : `\n\n[과거 문제 기록 — 재출제 금지]\n${history.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n위 문제들과 같은 유형·문장 구조에 숫자만 바꾼 문제도 피하세요.`
        : "";
      const signatures = new Set(history.map(normalizeProblem).filter(Boolean));
      const schoolEnglishAnswerRule = course.kind === "english"
        ? SCHOOL_ENGLISH_ANSWER_PROTECTION_RULE
        : "";
      const voiceRule = request.body?.inputMode === "voice"
        ? course.language === "en"
          ? `\n\n[The learner's answer came from speech recognition]\nIf it is unclear or unrelated to the current activity, do not grade it as wrong and never reveal the answer. Say only: “I couldn't understand that clearly. Please give a short answer again.” Then wait on the same activity. Use English only.`
          : `\n\n[이번 학생 답은 음성 인식 결과]\n문장이 어색하거나 현재 문제의 답으로 해석하기 불분명하면 오답으로 채점하지 마세요. 정답, 정답 번호, 완성된 모범 답, 정답이 포함된 예시를 절대로 미리 말하지 마세요. “음성이 정확히 전달되지 않았어요. 답만 짧게 다시 말해 주세요.”라고만 안내하고 현재 문제에서 기다리세요.`
        : "";

      for (let attempt = 0; attempt < 3; attempt += 1) {
        let formatRepairRule = "";
        if (attempt > 0) {
          formatRepairRule += course.language === "en"
            ? `\n\n[Multiple-choice format repair]\nEvery multiple-choice activity must contain three complete choices labeled A), B), and C). Write meaningful text after every label. Never output an empty label such as “C)” or “C answer”. Verify that exactly one choice is correct before responding.`
            : `\n\n[객관식 형식 오류 재생성]\n객관식 문제에는 A), B), C) 선택지를 모두 완전하게 작성하세요. 어떤 선택지 뒤도 비워 두지 말고 “C 답”처럼 쓰지 마세요. 출력 전에 정답이 하나뿐인지 확인하세요.`;
        }
        if (course.kind === "toefl" && attempt > 0) {
          formatRepairRule = `\n\n[형식 오류 재생성]\nComplete the Words 문제에는 반드시 영어 단어 앞부분 바로 뒤에 밑줄 4개 이상이 이어지는 빈칸(예: wor____)이 보여야 합니다. 완성 단어와 정답은 쓰지 마세요. 빈칸이 없는 후보는 출력하지 마세요.`;
        }
        if (course.kind === "toeic" && attempt > 0) {
          formatRepairRule = `\n\n[형식 오류 재생성]\nTOEIC Part 5·6 문장 또는 지문에서 학생이 채울 위치에는 반드시 키보드의 일반 밑줄 문자(_) 8개인 “________”을 표시하세요. 공백만 두거나 완성 단어·정답을 쓰지 마세요. 문제 맨 아래에는 별도로 정확히 “답: (________)”을 표시하세요. Part 1 사진 묘사형 문제라면 선택지보다 먼저 [TOEIC 그림 시작]과 [TOEIC 그림 끝] 사이에 장소, 인물, 행동, 배경 네 줄을 반드시 넣으세요. “사진:”이라는 설명문만 쓰지 마세요. 빈칸이나 그림 블록이 없는 후보는 출력하지 마세요.`;
        }
        if (course.kind === "english" && attempt > 0) {
          formatRepairRule = `\n\n[형식 오류 재생성]\n중1-고3 영어의 빈칸·문장 완성·지문 완성·알맞은 단어 또는 표현 넣기 문제에서는 학생이 채울 실제 위치에 키보드의 일반 밑줄 문자(_) 8개인 “________”을 반드시 표시하세요. 공백만 두거나 완성 단어·정답을 쓰지 마세요. 모든 활동과 문제 맨 아래에는 문제 유형과 관계없이 별도로 정확히 “답: (________)”을 표시하세요. 표시가 하나라도 빠진 후보는 출력하지 마세요.`;
        }
        const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
            instructions: course.prompt + historyRule + voiceRule + (course.language === "en" ? ENGLISH_ANSWER_SLOT_RULE : ANSWER_SLOT_RULE) + schoolEnglishAnswerRule + formatRepairRule,
            input: messages,
            max_output_tokens: course.kind === "toefl"
              ? 1200
              : ["korean", "social", "history", "science", "english", "toeic"].includes(course.kind)
                ? 900
                : 650
          })
        });
        const data = await openAIResponse.json();
        if (!openAIResponse.ok) {
          console.error("OpenAI lesson error", openAIResponse.status, data?.error?.code);
          return sendJson(response, 502, { error: "AI 선생님 연결이 잠시 원활하지 않습니다." });
        }
        const text = getOutputText(data);
        if (!text) continue;
        if (course.kind === "toefl" && !hasRequiredToeflBlank(text)) {
          console.warn("TOEFL Complete the Words without a visible blank rejected", attempt + 1);
          continue;
        }
        if (course.kind === "toeic" && !hasRequiredToeicBlank(text)) {
          console.warn("TOEIC Part 5/6 without a visible blank rejected", attempt + 1);
          continue;
        }
        if (course.kind === "toeic" && !hasRequiredToeicScene(text)) {
          console.warn("TOEIC Part 1 without a renderable scene rejected", attempt + 1);
          continue;
        }
        if (course.kind === "english" && !hasRequiredSchoolEnglishBlank(text)) {
          console.warn("Grade 7-12 English completion question without a visible blank rejected", attempt + 1);
          continue;
        }
        if (course.kind === "english" && hasPrematureSchoolEnglishAnswer(text)) {
          console.warn("Grade 7-12 English premature answer disclosure rejected", attempt + 1);
          continue;
        }
        if (request.body?.courseId === "g3-math-en" && hasPrematureGrade3MathAnswer(text)) {
          console.warn("Grade 3 math premature answer disclosure rejected", attempt + 1);
          continue;
        }
        if (request.body?.courseId === "g3-math-en" && hasTooAdvancedGrade3MathQuestion(text)) {
          console.warn("Grade 3 math abstract explanation question rejected", attempt + 1);
          continue;
        }
        if (hasIncompleteChoiceSet(text)) {
          console.warn("Incomplete multiple-choice set rejected", attempt + 1);
          continue;
        }
        const answerReadyText = ensureAnswerSlot(text, course.kind, course.language);
        const signature = normalizeProblem(answerReadyText);
        if (!signature || !signatures.has(signature)) return sendJson(response, 200, { text: answerReadyText });
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
