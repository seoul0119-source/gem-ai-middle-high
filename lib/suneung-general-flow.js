// The established math/science engines do not use this general-CSAT policy.
export function isGeneralSuneungCourse(course) {
  return Boolean(course?.suneung && !["math", "science", "integrated-science"].includes(course.suneung.subject));
}

export function isSuneungConversationHelp(value) {
  return /(?:힌트|모르겠|잘\s*모르|도와|도움|설명|무엇|뭐(?:예|에|야|죠|지)|무슨|왜|어떻게|어떤\s*(?:뜻|의미)|뜻|의미|이해|예를|예시|다시\s*(?:읽|말|들려)|쉽게|알려|정답.*(?:말|알려)|답.*(?:말하지|알려))/i.test(String(value || ""));
}

const spokenLetters = { 에이: "A", 비: "B", 씨: "C", 시: "C", 디: "D", 이: "E", 이이: "E" };
const spokenNumbers = { 일번: "A", 이번: "B", 삼번: "C", 사번: "D", 오번: "E" };
const answerEndings = "(?:입니다|예요|에요|이요|요|이다|를선택합니다|로할게요|로하겠습니다|를고르겠습니다|라고생각해요|라고생각합니다|일것같아요|인것같아요|일것같습니다|인것같습니다|같아요|가맞나요|가맞습니까|맞나요|맞습니까)?";

export function classifyGeneralSuneungInput(value, { inputMode = "text", questionText = "" } = {}) {
  const text = String(value || "").normalize("NFKC").trim();
  const compact = text.toLowerCase().replace(/[\s.!?,。！？]/g, "");
  // Korean speech recognition cannot distinguish the letter E (이) from 2.
  // Never spend an attempt by guessing which answer a learner intended.
  if (inputMode === "voice" && new RegExp(`^(?:(?:제)?(?:정답|답)(?:은|는|이)?)?(?:2|이)(?:번)?${answerEndings}$`).test(compact)) {
    return { intent: "clarify" };
  }
  const explicit = compact.match(new RegExp(`^(?:(?:제)?(?:정답|답)(?:은|는|이)?)?(?:알파벳|선택지|선택|option)?([a-e]|에이|비|씨|시|디|이이|이|일번|이번|삼번|사번|오번|[1-5])(?:번)?${answerEndings}$`, "i"));
  if (explicit) {
    const label = explicit[1];
    return { intent: "answer", choice: spokenLetters[label] || spokenNumbers[label] || (/^[1-5]$/.test(label) ? "ABCDE"[Number(label) - 1] : label.toUpperCase()) };
  }
  const normalize = text => text.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, "");
  const withoutPrefix = text.replace(/^(?:(?:제\s*)?(?:정답|답)(?:은|는)?\s*)/, "");
  const submitted = new Set([text, withoutPrefix, withoutPrefix.replace(/(?:입니다|예요|에요)\.?$/, "")].map(normalize));
  const options = [...String(questionText).matchAll(/^[ \t]*([A-E])[ \t]*[).:：][ \t]*([^\r\n]+)/gim)];
  const matches = options.filter(option => submitted.has(normalize(option[2])));
  if (matches.length === 1) return { intent: "answer", choice: matches[0][1].toUpperCase() };
  // Natural conversation is not an incorrect answer merely because it is not A–E.
  return { intent: "help" };
}

export function generalQuestionHeaders(text) {
  return [...String(text || "").matchAll(/^[ \t]*문제\s*(\d+)\s*\/\s*10[ \t]*[—–·-][ \t]*([^\r\n]+)$/gim)]
    .map(match => ({ question: Number(match[1]), tail: match[2], index: match.index }));
}

export function isCompleteGeneralQuestion(text) {
  const headers = generalQuestionHeaders(text);
  const current = headers.length ? String(text).slice(headers.at(-1).index) : "";
  const options = [...current.matchAll(/^[ \t]*([A-E])[ \t]*[).:：][ \t]*(\S[^\r\n]*)/gim)];
  return options.length === 5 && new Set(options.map(option => option[1].toUpperCase())).size === 5;
}

export function generalAttemptCount(messages, questionNumber) {
  let count = 0;
  let active = false;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const headers = generalQuestionHeaders(message.content);
    if (headers.length && isCompleteGeneralQuestion(message.content)) {
      const isCurrent = headers.at(-1).question === questionNumber;
      if (!isCurrent || !active) count = 0;
      active = isCurrent;
    }
    const attempts = [...String(message.content).matchAll(/도전\s*([12])\s*\/\s*3/g)];
    if (active && attempts.length) count = Number(attempts.at(-1)[1]);
  }
  return count;
}

export function latestCompleteGeneralQuestion(messages, questionNumber = 0) {
  for (const message of [...messages].reverse()) {
    if (message?.role !== "assistant") continue;
    const text = String(message.content || "");
    const headers = generalQuestionHeaders(text);
    for (let index = headers.length - 1; index >= 0; index -= 1) {
      const header = headers[index];
      if (questionNumber && header.question !== questionNumber) continue;
      const questionText = text.slice(header.index, headers[index + 1]?.index).trim();
      if (isCompleteGeneralQuestion(questionText)) return { question: header.question, text: questionText };
    }
  }
  return null;
}

export function normalizeGeneralProblem(value) {
  const source = String(value || "");
  const headers = generalQuestionHeaders(source);
  const question = headers.length ? source.slice(headers.at(-1).index) : source;
  return question.normalize("NFKC").toLowerCase()
    .replace(/문제\s*\d+\s*\/\s*10[^\n]*/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?/g, "#")
    .replace(/[^\p{L}\p{N}#]/gu, "")
    .slice(0, 16000);
}

export function validateGeneralSuneungTurn({ text, record, intent, currentQuestion, start, completed, previousAttempts = 0 }) {
  const headers = generalQuestionHeaders(text);
  if (intent === "help") {
    if (record || headers.some(header => header.question !== currentQuestion)) return "help_changed_question";
    if (/(?:도전\s*[123]\s*\/\s*3|정답(?:입니다|이에요)|오답입니다|맞았습니다|학습\s*완료|수업을\s*마쳤)/.test(text)) return "help_graded_answer";
    return "";
  }
  if (start) {
    return !record && headers.length === 1 && headers[0].question === 1 && isCompleteGeneralQuestion(text)
      ? "" : "invalid_first_question";
  }
  if (completed) return !record && headers.length === 0 ? "" : "completed_lesson_restarted";
  if (intent !== "answer") return "";
  if (record) {
    if (record.question !== currentQuestion || record.attempts !== previousAttempts + 1) return "invalid_answer_record";
    if (record.outcome === "incorrect" && record.attempts !== 3) return "premature_final_incorrect";
    if (record.question === 10) return headers.length === 0 ? "" : "question_after_completion";
    return headers.length === 1 && headers[0].question === currentQuestion + 1 && isCompleteGeneralQuestion(text)
      ? "" : "missing_next_question";
  }
  if (previousAttempts >= 2) return "missing_third_attempt_record";
  if (headers.some(header => header.question !== currentQuestion)) return "advanced_without_record";
  if (/(?:정답입니다|정답이에요|맞았습니다|맞았어요)/.test(text)) return "correct_without_record";
  return new RegExp(`도전\\s*${previousAttempts + 1}\\s*\\/\\s*3`).test(text)
    ? "" : "answer_not_graded";
}
