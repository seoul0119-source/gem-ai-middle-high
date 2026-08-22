import { getCourse } from "./courses.js";
import { isSchoolEnglishNoAnswerRequest } from "./_no-answer-guard.js";
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
const FRENCH_ANSWER_SLOT_RULE = `

[Règle du champ de réponse en français]
- Écris toute la réponse visible en français. N'affiche aucun mot ou libellé coréen ou anglais.
- Termine chaque nouvelle activité ou nouvelle tentative qui attend l'élève exactement par « Réponse : (________) ».
- Ne place jamais la bonne réponse, une lettre correcte ou un indice dans le champ de réponse.
- N'ajoute pas de champ de réponse au résumé final qui n'attend plus de réponse.`;
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
const AVATAR_START_PROTECTION_RULE = `

[Grade 3 avatar start response — highest priority]
- The learner has only asked to start the lesson and has not answered activity 1 yet.
- Output exactly one greeting and exactly one Activity 1/10 question.
- End immediately with “Answer: (________)” and wait for the learner.
- Do not output praise, grading, an explanation, a completed equation, the correct answer, or Activity 2/10 in this response.`;
const AVATAR_HINT_PROTECTION_RULE = `

[Grade 3 avatar hint response — highest priority]
- The learner asked for a hint, not an answer.
- Give exactly one short, concrete, problem-specific teaching step and remain on the current activity.
- Explain what the learner should look at or do next using the current activity's operation or place-value idea. Never use a generic message that could fit every question.
- Treat “hint”, “help”, “I don't know”, and “I don't understand” as requests for this explanation. The learner must not need to say “explain”.
- If the learner asks again, give a different and slightly more specific step while still hiding the result.
- Never state or imply the final answer, the correct option letter, a completed equation, praise, grading, or the next activity.
- Do not repeat the question's “Answer: (________)” line inside the hint response. The original answer field is already visible above.`;
const GRADE4_GENTLE_DIFFICULTY_RULE = `

[Grade 4 gentle difficulty — highest priority]
- Use short, concrete, one-step questions that a learner can understand without knowing a formula first.
- Begin with place value, addition and subtraction within 1,000, multiplication facts through 10 × 10, exact division, and simple visual fractions.
- Use familiar objects and plain language. Do not use inches, feet, unit conversions, decimals, remainders, multi-step word problems, or abstract explanations.
- Do not ask for rectangle area or perimeter from only written side lengths. If geometry appears, show or describe a small grid of unit squares and ask the learner to count the squares.
- Keep every question to at most two short sentences and ask for one number or one choice only.`;

function isGrade3AvatarCourse(courseId) {
  return /^g[1-5]-math-(?:en|fr)$/.test(String(courseId || ""));
}
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

  const activityMatches = [...output.matchAll(/(?:Activity|Activité)\s+\d+\s*\/\s*10\b/gi)];
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
    || /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\d{1,2})\s+times\s+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(?:equals|is|makes)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\d{1,3})\b/i.test(withoutAnswerSlot)
    || /\b(?:zéro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\d{1,2})\s+fois\s+(?:zéro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\d{1,2})\s+(?:font|fait|égalent?|donnent?)\s+(?:zéro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|\d{1,3})\b/i.test(withoutAnswerSlot);
}

function hasTooAdvancedGrade3MathQuestion(text) {
  const output = String(text || "");
  if (!awaitsStudentAnswer(output)) return false;

  const activityMatches = [...output.matchAll(/(?:Activity|Activité)\s+\d+\s*\/\s*10\b/gi)];
  const currentActivity = activityMatches.length
    ? output.slice(activityMatches[activityMatches.length - 1].index)
    : output;

  return /explain\s+(?:a|the|your|what|how|why|multiplication)/i.test(currentActivity)
    || /give\s+(?:a\s+)?(?:short\s+)?explanation/i.test(currentActivity)
    || /what\s+does\s+(?:the\s+)?(?:first|second)\s+(?:number|factor)\s+(?:tell|mean|describe|represent)/i.test(currentActivity)
    || /start\s+at\s+\d+\s+and\s+count\s+by/i.test(currentActivity)
    || /what\s+numbers\s+do\s+you\s+(?:say|get|reach)/i.test(currentActivity)
    || /count\s+by\s+\d+\s+(?:two|three|four|five|six|\d+)\s+times/i.test(currentActivity)
    || /(?:define|interpret|justify|generalize)\b/i.test(currentActivity)
    || /Activity\s+\d+\s*\/\s*10\s*[—-]\s*Explain\b/i.test(currentActivity)
    || /(?:explique|définis|interprète|justifie|généralise)\b/i.test(currentActivity)
    || /que\s+(?:signifie|représente)\s+(?:le\s+)?(?:premier|deuxième)\s+(?:nombre|facteur)/i.test(currentActivity);
}

function isGrade3AvatarStart(messages, courseId) {
  if (!isGrade3AvatarCourse(courseId)) return false;
  const lastMessage = messages[messages.length - 1];
  return lastMessage?.role === "user" && /^(?:start|begin|commencer|commence|début|démarrer|시작|시작하기)$/i.test(lastMessage.content.trim());
}

function hasInvalidGrade3StartResponse(text, language) {
  const output = String(text || "");
  const activityWord = language === "fr" ? "Activité" : "Activity";
  const activities = output.match(/(?:Activity|Activité)\s+\d+\s*\/\s*10\b/gi) || [];
  if (activities.length !== 1 || !new RegExp(`${activityWord}\\s+1\\s*\\/\\s*10\\b`, "i").test(output)) return true;

  const answerSlot = /(?:Answer|Réponse)(?:\s*1)?\s*:\s*\([ _\u3000]{3,}\)/i.exec(output);
  if (!answerSlot) return true;
  const afterSlot = output.slice(answerSlot.index + answerSlot[0].length).trim();
  if (afterSlot) return true;

  return /\b(?:great job|correct|well done|the answer is|equals|makes|bravo|bonne réponse|la réponse est|font|égalent?)\b/i.test(output.slice(0, answerSlot.index));
}

function hasIncompleteChoiceSet(text) {
  const output = String(text || "");
  const activityMatches = [...output.matchAll(/(?:Activity|Activité|문제|활동)\s+\d+\s*\/\s*10\b/gi)];
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

function hasOrphanChoiceLabel(text) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.some((line, index) => {
    if (!/^\s*[A-Da-d](?:[).:：])?\s*$/.test(line)) return false;
    const nearby = lines.slice(Math.max(0, index - 3), index + 4).join("\n");
    return !/^\s*[A-Da-d]\s*[).:：]\s*\S+/m.test(nearby);
  });
}

export function isAvatarHintRequest(messages, courseId) {
  if (!isGrade3AvatarCourse(courseId)) return false;
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return /\b(?:hint|help|explain|show\s+me\s+how|i\s+don'?t\s+know|i\s+don'?t\s+understand)\b/i.test(latest?.content || "")
    || /(?:indice|aide(?:-moi)?|explique|montre-moi\s+comment|je\s+ne\s+sais\s+pas|je\s+ne\s+comprends\s+pas|répète|encore)/i.test(latest?.content || "")
    || /(?:힌트|모르겠|잘\s*모르|도와\s*주|도움|설명\s*해\s*주)/i.test(latest?.content || "");
}

export function buildSafeGrade3Hint(messages, language = "en") {
  const indexedAssistantMessages = messages
    .map((message, index) => ({ ...message, index }))
    .filter((message) => message.role === "assistant")
    .reverse();
  // A repeated hint places another assistant message after the question. Find
  // the most recent message that still contains the activity instead of
  // treating the previous hint as the current problem.
  const questionMessage = indexedAssistantMessages.find((message) =>
    /(?:Activity|Activité)\s+\d+\s*\/\s*10\b/i.test(message.content || "")
  ) || indexedAssistantMessages[0];
  const latestQuestion = questionMessage?.content || "";
  const activityMatches = [...latestQuestion.matchAll(/(?:Activity|Activité)\s+\d+\s*\/\s*10\b/gi)];
  const currentActivity = activityMatches.length
    ? latestQuestion.slice(activityMatches[activityMatches.length - 1].index)
    : latestQuestion;

  // Hints may repeat the problem's operands so the next step is concrete, but
  // they never include the result, a correct option letter, or a completed
  // counting sequence. This keeps both visible text and TTS from disclosing
  // the answer before the learner responds.
  const isFrench = language === "fr";
  const hintCount = messages.slice((questionMessage?.index ?? -1) + 1).filter((message) =>
    message.role === "user" && isAvatarHintRequest([message], `g2-math-${isFrench ? "fr" : "en"}`)
  ).length;
  const hintStep = Math.max(1, hintCount);

  const progressiveHint = (englishSteps, frenchSteps) => {
    const steps = isFrench ? frenchSteps : englishSteps;
    return steps[Math.min(hintStep - 1, steps.length - 1)];
  };

  // Some activities use a natural-language question ("What is 24 + 13?")
  // while others use a short label ("Add: 247 + 136").  Detect the actual
  // expression either way so the hint never falls back to the generic message.
  const addition = currentActivity.match(/\b(\d{1,4})\s*\+\s*(\d{1,4})\b/);
  if (addition) {
    const first = Number(addition[1]);
    const second = Number(addition[2]);
    const firstOnes = first % 10;
    const secondOnes = second % 10;
    const firstTens = Math.floor(first / 10) % 10;
    const secondTens = Math.floor(second / 10) % 10;
    const firstHundreds = Math.floor(first / 100) % 10;
    const secondHundreds = Math.floor(second / 100) % 10;
    const englishTens = (value) => `${value} ${value === 1 ? "ten" : "tens"}`;
    const englishHundreds = (value) => `${value} ${value === 1 ? "hundred" : "hundreds"}`;
    const frenchTens = (value) => `${value} ${value === 1 ? "dizaine" : "dizaines"}`;
    const frenchHundreds = (value) => `${value} ${value === 1 ? "centaine" : "centaines"}`;
    const tens = Math.floor(second / 10) * 10;
    const ones = second % 10;
    if (hintCount === 1) {
      if (isFrench) return `Commence par les unités : ${firstOnes} plus ${secondOnes}. Garde en tête une éventuelle retenue, sans donner le total.`;
      return `Start with the ones place: ${firstOnes} plus ${secondOnes}. Keep any extra ten in mind, but do not say the total.`;
    }
    if (hintCount === 2 && (firstTens || secondTens)) {
      if (isFrench) return `Passe maintenant aux dizaines : ${frenchTens(firstTens)} plus ${frenchTens(secondTens)}. Ajoute la retenue éventuelle, sans donner le total.`;
      return `Now work with the tens: ${englishTens(firstTens)} plus ${englishTens(secondTens)}. Include any extra ten, but do not say the total.`;
    }
    if (hintCount >= 3 && (firstHundreds || secondHundreds)) {
      if (isFrench) return `Passe ensuite aux centaines : ${frenchHundreds(firstHundreds)} plus ${frenchHundreds(secondHundreds)}. Réunis les valeurs de position toi-même.`;
      return `Next work with the hundreds: ${englishHundreds(firstHundreds)} plus ${englishHundreds(secondHundreds)}. Combine the place values yourself.`;
    }
    if (tens > 0 && ones > 0) {
      if (isFrench) return `Décompose ${second} en ${tens} et ${ones}. Ajoute d'abord ${tens}, puis ${ones}, sans donner encore le total.`;
      return `Break ${second} into ${tens} and ${ones}. Add ${tens} first, then ${ones}, without saying the total yet.`;
    }
    if (isFrench) return "Additionne d'abord les dizaines, puis les unités. Écris seulement le total que tu trouves.";
    return "Add the tens first, then add the ones. Write only the total you find.";
  }

  const buildSubtractionHint = (start, taken, reason = "") => {
    const startOnes = start % 10;
    const takenOnes = taken % 10;
    const startTens = Math.floor(start / 10) % 10;
    const takenTens = Math.floor(taken / 10) % 10;
    const startHundreds = Math.floor(start / 100) % 10;
    const takenHundreds = Math.floor(taken / 100) % 10;
    const borrowFromTens = startOnes < takenOnes;
    const adjustedTens = startTens - (borrowFromTens ? 1 : 0);
    const borrowFromHundreds = adjustedTens < takenTens;
    const adjustedHundreds = startHundreds - (borrowFromHundreds ? 1 : 0);

    if (hintCount <= 1) {
      if (isFrench) {
        const why = reason ? `Le mot « ${reason} » indique que des objets quittent le groupe. ` : "";
        return `${why}Fais une soustraction : pars de ${start} et enlève ${taken}. Ne calcule pas encore le résultat final.`;
      }
      const why = reason ? `The word “${reason}” means items leave the group. ` : "";
      return `${why}Use subtraction: start with ${start} and take away ${taken}. Do not calculate the final answer yet.`;
    }

    if (hintCount === 2) {
      if (borrowFromTens) {
        if (isFrench) return `Commence par les unités. Comme ${startOnes} est plus petit que ${takenOnes}, échange une dizaine puis calcule ${startOnes + 10} moins ${takenOnes}. Garde seulement le chiffre des unités.`;
        return `Start with the ones. Since ${startOnes} is smaller than ${takenOnes}, regroup one ten and work out ${startOnes + 10} minus ${takenOnes}. Keep only the ones digit.`;
      }
      if (isFrench) return `Commence par les unités : calcule ${startOnes} moins ${takenOnes}. Garde seulement le chiffre des unités.`;
      return `Start with the ones: work out ${startOnes} minus ${takenOnes}. Keep only the ones digit.`;
    }

    if (hintCount === 3 && (startTens || takenTens)) {
      const topTens = borrowFromHundreds ? adjustedTens + 10 : adjustedTens;
      if (isFrench) {
        const regroup = borrowFromHundreds ? "Échange maintenant une centaine contre dix dizaines. " : "";
        return `${regroup}Pour les dizaines, calcule ${topTens} moins ${takenTens}. Garde seulement le chiffre des dizaines.`;
      }
      const regroup = borrowFromHundreds ? "Now regroup one hundred as ten tens. " : "";
      return `${regroup}For the tens, work out ${topTens} minus ${takenTens}. Keep only the tens digit.`;
    }

    if (startHundreds || takenHundreds) {
      if (isFrench) return `Pour finir, calcule les centaines : ${adjustedHundreds} moins ${takenHundreds}. Assemble toi-même les chiffres des centaines, dizaines et unités.`;
      return `Finally, work with the hundreds: ${adjustedHundreds} minus ${takenHundreds}. Put your hundreds, tens, and ones digits together yourself.`;
    }
    if (isFrench) return "Vérifie chaque valeur de position, puis assemble toi-même les chiffres sans demander le résultat.";
    return "Check each place-value digit, then put the digits together yourself without asking for the final answer.";
  };

  const subtraction = currentActivity.match(/\b(\d{1,4})\s*[-−]\s*(\d{1,4})\b/);
  if (subtraction) {
    const start = Number(subtraction[1]);
    const taken = Number(subtraction[2]);
    return buildSubtractionHint(start, taken);
  }

  // Word problems often describe subtraction without writing a minus sign.
  // Recognize the starting amount and the amount given away, spent, or lost so
  // the very first hint is specific to the learner's current question.
  const subtractionStory = currentActivity.match(
    /(?:has|have|there\s+(?:are|is)|a|ont|il\s+y\s+a)\s+(\d{1,4})\b[\s\S]{0,220}?(gives?|gave|gives\s+away|loses?|lost|spends?|spent|uses?|used|borrows?|borrowed|takes?|took|removes?|removed|donne|donné|perd|perdu|utilise|utilisé|emprunte|emprunté|retire|retiré)\s+(\d{1,4})\b/i
  );
  if (subtractionStory) {
    const start = Number(subtractionStory[1]);
    const reason = subtractionStory[2];
    const taken = Number(subtractionStory[3]);
    return buildSubtractionHint(start, taken, reason);
  }

  // Equivalent-fraction questions previously fell through to the generic
  // multiple-choice hint.  Keep the target fraction in the explanation and
  // advance the method on every request without evaluating an option or
  // revealing its letter.
  const equivalentFraction = currentActivity.match(
    /(?:which|quelle)\s+fraction[\s\S]{0,100}?(?:equal|equivalent|égale|équivalente)\s*(?:to|à)?\s*(\d+)\s*\/\s*(\d+)/i
  );
  if (equivalentFraction) {
    const numerator = Number(equivalentFraction[1]);
    const denominator = Number(equivalentFraction[2]);
    const fractionOptions = [...currentActivity.matchAll(
      /^\s*[A-D]\s*[).:：]\s*(\d+)\s*\/\s*(\d+)\s*$/gim
    )].map((match) => ({ numerator: Number(match[1]), denominator: Number(match[2]) }));

    if (hintCount <= 1) {
      if (isFrench) {
        return `Des fractions équivalentes s'obtiennent en multipliant le numérateur et le dénominateur par le même nombre. Pars de ${numerator}/${denominator} et cherche cette même transformation dans les choix.`;
      }
      return `Equivalent fractions are made by multiplying the numerator and denominator by the same number. Start with ${numerator}/${denominator} and look for that same change in the choices.`;
    }

    if (hintCount === 2) {
      if (isFrench) {
        return `Teste chaque fraction n/d avec les produits croisés : compare n fois ${denominator} et d fois ${numerator}. Les deux produits doivent être égaux. Ne calcule qu'un choix à la fois.`;
      }
      return `Test each fraction n/d with cross products: compare n times ${denominator} with d times ${numerator}. The two products must match. Check only one choice at a time.`;
    }

    const option = fractionOptions[Math.min(hintCount - 3, Math.max(0, fractionOptions.length - 1))];
    if (option) {
      if (isFrench) {
        return `Pour le choix que tu testes, compare ${option.numerator} fois ${denominator} avec ${option.denominator} fois ${numerator}. Fais les deux petits calculs toi-même et décide s'ils sont égaux.`;
      }
      return `For the choice you are testing, compare ${option.numerator} times ${denominator} with ${option.denominator} times ${numerator}. Work out both small products yourself and decide whether they match.`;
    }

    if (isFrench) return "Multiplie le numérateur et le dénominateur par le même nombre, puis vérifie un choix à la fois sans demander la réponse.";
    return "Multiply the numerator and denominator by the same number, then check one choice at a time without asking for the answer.";
  }

  // Written area questions used to fall through to one generic sentence.
  // Give a concrete visual route first, then a more specific operation on each
  // later request, while never completing the multiplication for the learner.
  const asksForArea = /\b(?:area|aire)\b/i.test(currentActivity);
  if (asksForArea) {
    const dimensions = currentActivity.match(
      /(?:rectangle|rectangulaire)[\s\S]{0,180}?(\d{1,2})\s*(?:inches?|feet|cm|mètres?|metres?)?\s*(?:long|length|de\s+long|longueur)[\s\S]{0,100}?(\d{1,2})\s*(?:inches?|feet|cm|mètres?|metres?)?\s*(?:wide|width|de\s+large|largeur)/i
    );
    const firstSide = dimensions?.[1];
    const secondSide = dimensions?.[2];
    if (firstSide && secondSide) {
      return progressiveHint(
        [
          `Area means the space inside the rectangle. Draw ${secondSide} rows and put ${firstSide} small squares in each row.`,
          `Use your drawing. Add ${firstSide} once for each of the ${secondSide} rows, but stop before finding the total.`,
          `Write ${secondSide} groups of ${firstSide} as ${secondSide} × ${firstSide}. Work out that multiplication yourself.`
        ],
        [
          `L’aire est l’espace à l’intérieur du rectangle. Dessine ${secondSide} rangées de ${firstSide} petits carrés.`,
          `Utilise ton dessin. Additionne ${firstSide} une fois pour chacune des ${secondSide} rangées, sans calculer encore le total.`,
          `Écris ${secondSide} groupes de ${firstSide} sous la forme ${secondSide} × ${firstSide}. Fais toi-même la multiplication.`
        ]
      );
    }
    return progressiveHint(
      [
        "Area is the space inside a shape. Cover the shape with equal unit squares without gaps.",
        "Count the squares in one row, then count how many equal rows there are.",
        "Multiply the number of squares in one row by the number of rows. Work out the result yourself."
      ],
      [
        "L’aire est l’espace à l’intérieur d’une figure. Recouvre-la de carrés-unités sans laisser de trou.",
        "Compte les carrés d’une rangée, puis le nombre de rangées égales.",
        "Multiplie le nombre de carrés d’une rangée par le nombre de rangées. Calcule toi-même le résultat."
      ]
    );
  }

  if (/\b(?:times|multiplication|equal\s+groups?|array|fois|multiplication|groupes?\s+égaux|rangées?)\b/i.test(currentActivity)) {
    return progressiveHint(
      [
        "Draw or imagine the equal groups in the question. Put the same number of objects in every group.",
        "Count one group, then write that number once for every group as repeated addition.",
        "Turn the repeated addition into a multiplication. Work out the product yourself."
      ],
      [
        "Dessine ou imagine les groupes égaux de la question. Mets le même nombre d’objets dans chaque groupe.",
        "Compte un groupe, puis écris ce nombre une fois pour chaque groupe comme une addition répétée.",
        "Transforme l’addition répétée en multiplication. Calcule toi-même le produit."
      ]
    );
  }

  if (/\b(?:divide|division|share\s+equally|each\s+group|divise|division|partage\s+également|chaque\s+groupe)\b/i.test(currentActivity)) {
    return progressiveHint(
      [
        "Draw the groups named in the question. Share one object into each group in turn.",
        "Keep making equal rounds until no objects remain. Do not count the whole collection again.",
        "Count the objects in just one group. That count is the number you should enter."
      ],
      [
        "Dessine les groupes indiqués. Distribue un objet dans chaque groupe à tour de rôle.",
        "Continue les tours égaux jusqu’à ce qu’il ne reste rien. Ne recompte pas toute la collection.",
        "Compte les objets d’un seul groupe. C’est le nombre à écrire."
      ]
    );
  }

  const placeValue = currentActivity.match(/(?:number|nombre)\s+(\d{2,4}).*?(ones|tens|hundreds|thousands|unités|dizaines|centaines|milliers)/is);
  if (placeValue) {
    const place = placeValue[2].toLowerCase();
    if (isFrench) {
      const position = /unité/.test(place) ? "premier" : /dizaine/.test(place) ? "deuxième" : /centaine/.test(place) ? "troisième" : "quatrième";
      return `Lis les chiffres de droite à gauche : unités, dizaines, centaines. Cherche le ${position} chiffre en partant de la droite.`;
    }
    const position = place === "ones" ? "first" : place === "tens" ? "second" : place === "hundreds" ? "third" : "fourth";
    return `Read the digits from right to left: ones, tens, hundreds. Find the ${position} digit from the right.`;
  }
  if (/\b(?:greater|less|compare|largest|smallest|supérieur|inférieur|compare|plus grand|plus petit)\b/i.test(currentActivity)) {
    if (isFrench) return "Compare d'abord le chiffre de gauche de chaque nombre. S'ils sont égaux, compare le chiffre suivant.";
    return "Compare the leftmost digit in each number first. If they match, compare the next digit.";
  }
  if (/true\s+or\s+false|true-or-false|vrai\s+ou\s+faux/i.test(currentActivity)) {
    if (isFrench) return "Calcule d'abord la multiplication. Puis compare ton résultat au nombre de la question.";
    return "Work out the multiplication first. Then compare your result with the number in the question.";
  }
  if (/skip\s+count|number\s+pattern|missing\s+number|suite\s+numérique|nombre\s+manquant/i.test(currentActivity)) {
    if (isFrench) return "Observe de combien les nombres augmentent. Continue le même rythme d'une seule étape.";
    return "Look at how much the numbers increase each time. Continue the same pattern by one step.";
  }
  if (/\b(?:A|B|C)\)|multiple[ -]?choice|choice\b|choix/i.test(currentActivity)) {
    if (hintCount <= 1) {
      if (isFrench) return "Repère l'opération ou la règle précise demandée dans la question. Applique-la à un seul choix, sans regarder les autres.";
      return "Identify the exact operation or rule asked for in the question. Apply it to just one choice before looking at the others.";
    }
    if (hintCount === 2) {
      if (isFrench) return "Élimine un choix en vérifiant s'il respecte cette règle. Ensuite, vérifie le choix suivant avec la même méthode.";
      return "Eliminate one choice by checking whether it follows that rule. Then test the next choice with the same method.";
    }
    if (isFrench) return "Vérifie ton choix en remplaçant la valeur dans la question. Garde la lettre de la réponse pour toi jusqu'à la fin.";
    return "Check your choice by putting its value back into the question. Keep the answer letter to yourself until the end.";
  }
  if (/\b(?:array|rows?|columns?|equal\s+groups?|baskets?|shelves|shelf|cups?|picture|rangées?|colonnes?|groupes?|paniers?|image)\b/i.test(currentActivity)) {
    return progressiveHint(
      [
        "Point to one row or group and count only the objects in it.",
        "Write that group amount once for each row as repeated addition.",
        "Add the repeated groups yourself and enter only the total."
      ],
      [
        "Montre une rangée ou un groupe et compte seulement ses objets.",
        "Écris cette quantité une fois pour chaque rangée comme une addition répétée.",
        "Additionne toi-même les groupes et écris seulement le total."
      ]
    );
  }
  if (/missing\s+factor|fact\s+family|how\s+many\s+groups/i.test(currentActivity)) {
    return progressiveHint(
      [
        "Draw the equal groups shown in the question and label the known numbers.",
        "Use the known total to make one equal group at a time.",
        "Count the groups or the objects in one group, whichever the blank asks for."
      ],
      [
        "Dessine les groupes égaux et note les nombres connus.",
        "Utilise le total connu pour former un groupe égal à la fois.",
        "Compte les groupes ou les objets d’un groupe, selon ce que demande la case vide."
      ]
    );
  }
  return progressiveHint(
    [
      "Circle the numbers in the current question and underline the words that tell what happens to them.",
      "Draw the situation with simple dots or boxes. Show only the first action from the question.",
      "Write the one calculation that matches your drawing. Work out its result yourself."
    ],
    [
      "Entoure les nombres de la question et souligne les mots qui indiquent ce qui leur arrive.",
      "Dessine la situation avec des points ou des cases. Montre seulement la première action.",
      "Écris le calcul qui correspond à ton dessin. Calcule toi-même le résultat."
    ]
  );
}

export function hasTooHardGrade4PilotQuestion(text, courseId) {
  if (!/^g4-math-(?:en|fr)$/.test(String(courseId || ""))) return false;
  const output = String(text || "");
  if (!awaitsStudentAnswer(output)) return false;
  const activityMatches = [...output.matchAll(/(?:Activity|Activité)\s+\d+\s*\/\s*10\b/gi)];
  const currentActivity = activityMatches.length
    ? output.slice(activityMatches[activityMatches.length - 1].index)
    : output;

  const writtenGeometryWithoutGrid = /\b(?:area|perimeter|aire|périmètre)\b/i.test(currentActivity)
    && !/\b(?:unit\s+squares?|grid|rows?|columns?|carrés?-unités?|quadrillage|rangées?|colonnes?)\b/i.test(currentActivity);
  return writtenGeometryWithoutGrid
    || /\b(?:inches?|feet|yards?|pouces?|pieds?|verges?)\b/i.test(currentActivity)
    || /\b(?:decimal|remainder|convert|conversion|décimal|reste|convertis?|conversion)\b/i.test(currentActivity)
    || /\b(?:two-step|multi-step|deux\s+étapes|plusieurs\s+étapes)\b/i.test(currentActivity);
}

export function isKoreanHintRequest(messages, course) {
  if (!course || course.language === "en" || course.language === "fr") return false;
  const latest = [...messages].reverse().find((message) => message.role === "user");
  const text = String(latest?.content || "");

  return /(?:힌트|모르겠|잘\s*모르|도와\s*주|도움|어떻게\s*(?:풀|해)|설명\s*해\s*주)/i.test(text);
}

export function buildSafeKoreanHint(messages, courseKind) {
  const latestQuestion = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.content || "";

  // 힌트에는 현재 문제의 숫자·정답·선택지 번호·완성된 계산식을
  // 재사용하지 않습니다. 화면과 음성 모두 다음 한 단계만 안내합니다.
  if (courseKind === "math") {
    if (/좌표|사분면|좌표평면/.test(latestQuestion)) {
      return "x좌표와 y좌표의 부호를 각각 확인해 보세요. 두 부호의 조합이 좌표평면의 어느 위치인지 찾아보세요.";
    }
    if (/그래프|도표|표\s|자료/.test(latestQuestion)) {
      return "가로축과 세로축 또는 표의 제목을 먼저 확인하세요. 그다음 질문에 필요한 행이나 점 하나만 찾아보세요.";
    }
    if (/방정식|부등식|미지수/.test(latestQuestion)) {
      return "미지수가 있는 항을 한쪽에 모으기 위해 양변에 같은 연산을 한 번만 적용해 보세요.";
    }
    if (/분수|분모|분자/.test(latestQuestion)) {
      return "분모를 같게 만들 필요가 있는지 먼저 확인한 뒤, 한 단계씩 계산해 보세요.";
    }
    if (/넓이|둘레|부피|도형|각도/.test(latestQuestion)) {
      return "주어진 길이와 구하려는 값을 따로 표시하고, 필요한 관계식 하나를 먼저 떠올려 보세요.";
    }
    return "주어진 값과 구해야 하는 것을 따로 표시한 뒤, 필요한 첫 계산 한 단계만 해 보세요.";
  }

  if (courseKind === "korean") {
    return "질문에 나온 핵심어를 지문에서 찾아 밑줄을 긋고, 바로 앞뒤 문장을 다시 읽어 보세요.";
  }
  if (courseKind === "social" || courseKind === "history") {
    return "자료의 제목·시기·핵심 용어를 먼저 확인하고, 질문과 직접 연결되는 근거 하나를 찾아보세요.";
  }
  if (courseKind === "science") {
    return "문제에서 바뀐 조건과 관찰해야 할 결과를 나누어 표시한 뒤, 둘의 관계를 생각해 보세요.";
  }
  if (courseKind === "english" || courseKind === "toefl" || courseKind === "toeic") {
    return "정답을 넣지 말고, 빈칸 앞뒤의 핵심 단어와 문장의 시제부터 확인해 보세요.";
  }
  return "문제의 핵심어를 표시하고, 정답을 구하는 데 필요한 첫 단계만 생각해 보세요.";
}

function hasAnswerRevealingHint(text) {
  const output = String(text || "");
  return /\b(?:the\s+(?:correct\s+)?answer\s+is|choose\s+[A-C]|option\s+[A-C]|equals?\s+\d+|make(?:s)?\s+\d+|total\s+is\s+\d+)\b/i.test(output)
    || /\b\d+(?:\s*,\s*\d+){2,}\b/.test(output)
    || /(?:Activity|Question)\s+\d+\s*\/\s*10/i.test(output);
}

function awaitsStudentAnswer(text) {
  const output = String(text || "");
  if (!output.trim()) return false;
  if (/(?:오늘의|이번)\s+.+수업을\s+마쳤|수업\s+종료|학습을\s+마쳤/.test(output)) return false;

  return /(?:Activity|Activité|문제|활동|과제|연습)\s*\d+\s*\/\s*10/i.test(output)
    || /(?:^|\s)\d+\s*\/\s*10(?:\s|—|-)/m.test(output)
    || /(?:답|정답).{0,24}(?:입력|말해|적어|써|고르|골라|선택|대답)/s.test(output)
    || /(?:다시|한\s*번\s*더).{0,20}(?:답해|말해|입력|적어|써)/s.test(output)
    || /(?:따라\s*말해|영어로\s+짧게\s+다시\s+말해)/.test(output);
}

function ensureAnswerSlot(text, courseKind, language, suppressAnswerSlot = false) {
  let output = String(text || "").trimEnd();
  if (suppressAnswerSlot) {
    return output.replace(/^\s*(?:Answer|Réponse|답|정답)(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gim, "").trimEnd();
  }
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

  if (language === "fr") {
    output = output
      .replace(/^(?:Answer|답|정답)(?:\s*\d+)?\s*:\s*.*$/gim, "Réponse : (________)")
      .replace(/^Réponse(?:\s*\d+)?\s*:\s*.*$/gim, "Réponse : (________)");
    if (/Réponse(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)/i.test(output)) return output;
    return `${output}\n\nRéponse : (________)`;
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
          : course.language === "fr"
            ? `\n\n[Activités précédentes — ne pas répéter]\n${history.map((item, index) => `${index + 1}. ${item}`).join("\n")}\nN'utilise pas la même structure en changeant seulement les nombres, les objets ou l'ordre des mots. Choisis une autre famille d'activité.`
            : `\n\n[과거 문제 기록 — 재출제 금지]\n${history.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n위 문제들과 같은 유형·문장 구조에 숫자만 바꾼 문제도 피하세요.`
        : "";
      const signatures = new Set(history.map(normalizeProblem).filter(Boolean));
      const schoolEnglishAnswerRule = course.kind === "english"
        ? SCHOOL_ENGLISH_ANSWER_PROTECTION_RULE
        : "";
      const voiceRule = request.body?.inputMode === "voice"
        ? course.language === "en"
          ? `\n\n[The learner's answer came from speech recognition]\nIf it is unclear or unrelated to the current activity, do not grade it as wrong and never reveal the answer. Say only: “I couldn't understand that clearly. Please give a short answer again.” Then wait on the same activity. Use English only.`
          : course.language === "fr"
            ? `\n\n[La réponse de l'élève vient de la reconnaissance vocale]\nSi elle est peu claire ou sans rapport avec l'activité, ne la note pas comme fausse et ne révèle jamais la réponse. Dis seulement : « Je n'ai pas bien compris. Donne une réponse courte encore une fois. » Puis attends sur la même activité. Utilise uniquement le français.`
            : `\n\n[이번 학생 답은 음성 인식 결과]\n문장이 어색하거나 현재 문제의 답으로 해석하기 불분명하면 오답으로 채점하지 마세요. 정답, 정답 번호, 완성된 모범 답, 정답이 포함된 예시를 절대로 미리 말하지 마세요. “음성이 정확히 전달되지 않았어요. 답만 짧게 다시 말해 주세요.”라고만 안내하고 현재 문제에서 기다리세요.`
        : "";
      const grade3Start = isGrade3AvatarStart(messages, request.body?.courseId);
      const avatarStartRule = grade3Start ? AVATAR_START_PROTECTION_RULE : "";
      const grade3Hint = isAvatarHintRequest(messages, request.body?.courseId);
      const avatarHintRule = grade3Hint ? AVATAR_HINT_PROTECTION_RULE : "";
      const grade4GentleRule = /^g4-math-(?:en|fr)$/.test(String(request.body?.courseId || ""))
        ? GRADE4_GENTLE_DIFFICULTY_RULE
        : "";
      const koreanHint = isKoreanHintRequest(messages, course);

      if (isSchoolEnglishNoAnswerRequest(messages)) {
        const noAnswerText = course.language === "en"
          ? "Understood. I will not reveal the answer. Please solve the current question yourself."
          : "알겠습니다. 정답은 미리 말하지 않겠습니다. 현재 문제를 직접 풀어 보세요.";
        return sendJson(response, 200, { text: noAnswerText });
      }

      if (grade3Hint) {
        return sendJson(response, 200, { text: buildSafeGrade3Hint(messages, course.language) });
      }
      if (koreanHint) {
        return sendJson(response, 200, { text: buildSafeKoreanHint(messages, course.kind) });
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        let formatRepairRule = "";
        if (attempt > 0) {
          formatRepairRule += course.language === "en"
            ? `\n\n[Multiple-choice format repair]\nEvery multiple-choice activity must contain three complete choices labeled A), B), and C). Write meaningful text after every label. Never output an empty label such as “C)” or “C answer”. Verify that exactly one choice is correct before responding.`
            : course.language === "fr"
              ? `\n\n[Réparation du QCM]\nChaque QCM doit contenir trois choix complets A), B) et C). N'écris jamais un choix vide. Vérifie qu'une seule réponse est correcte.`
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
            instructions: course.prompt + historyRule + voiceRule + (course.language === "en" ? ENGLISH_ANSWER_SLOT_RULE : course.language === "fr" ? FRENCH_ANSWER_SLOT_RULE : ANSWER_SLOT_RULE) + schoolEnglishAnswerRule + avatarStartRule + avatarHintRule + grade4GentleRule + formatRepairRule,
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
        if (grade3Start && hasInvalidGrade3StartResponse(text, course.language)) {
          console.warn("Grade 3 start response disclosed feedback or multiple activities", attempt + 1);
          continue;
        }
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
        if (isGrade3AvatarCourse(request.body?.courseId) && hasPrematureGrade3MathAnswer(text)) {
          console.warn("Grade 3 math premature answer disclosure rejected", attempt + 1);
          continue;
        }
        if (isGrade3AvatarCourse(request.body?.courseId) && hasTooAdvancedGrade3MathQuestion(text)) {
          console.warn("Grade 3 math abstract explanation question rejected", attempt + 1);
          continue;
        }
        if (hasTooHardGrade4PilotQuestion(text, request.body?.courseId)) {
          console.warn("Grade 4 pilot question exceeded gentle difficulty", attempt + 1);
          continue;
        }
        if (grade3Hint && hasAnswerRevealingHint(text)) {
          console.warn("Grade 3 hint disclosed an answer or repeated the answer field", attempt + 1);
          continue;
        }
        if (hasIncompleteChoiceSet(text)) {
          console.warn("Incomplete multiple-choice set rejected", attempt + 1);
          continue;
        }
        if (hasOrphanChoiceLabel(text)) {
          console.warn("Orphan multiple-choice label rejected", attempt + 1);
          continue;
        }
        const answerReadyText = ensureAnswerSlot(text, course.kind, course.language, grade3Hint);
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
