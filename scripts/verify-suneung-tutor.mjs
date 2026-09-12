import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { handleScienceTutor } from "../lib/suneung-science-tutor.js";
import { verifyScienceReplyProof } from "../lib/science-reply-proof.js";
import { containsExcludedSuneungScienceContent } from "../lib/suneung-science-safety.js";

// This build check calls the server implementation directly with synthetic
// context. It creates no student session, cookie, deployed route or database
// record. The existing provider key and generated reply proofs stay private.
const COURSE_ID = "suneung-2028-integrated-science";
const DEADLINE_MS = 115_000;

function requireCheck(condition, code) {
  if (!condition) throw new Error(code);
}

function reviewedExample(engine, student, response, expectedTerms) {
  requireCheck(typeof response?.text === "string" && response.text.trim(), "build_tutor_empty_reply");
  requireCheck(!Object.prototype.hasOwnProperty.call(response, "record"), "build_tutor_unexpected_grading");
  requireCheck(!containsExcludedSuneungScienceContent(response.text), "build_tutor_excluded_content");
  requireCheck(typeof response.teacherModel === "string"
    && /^[a-zA-Z0-9._-]{1,80}$/.test(response.teacherModel), "build_tutor_model_unverified");

  const position = verifyScienceReplyProof({ student, text:response.text, proof:response.scienceReplyProof });
  requireCheck(position?.questionNumber === 1 && position?.attempt === 1, "build_tutor_progress_changed");
  const text = engine.projectClosedSuneungScienceSpeechText(response.text);
  requireCheck(Boolean(text) && expectedTerms.every(term => text.includes(term)), "build_tutor_explanation_incomplete");
  return { model:response.teacherModel, text };
}

async function verifyTutor() {
  requireCheck(Boolean(process.env.OPENAI_API_KEY), "build_tutor_credentials_missing");
  const now = Date.now();
  const student = {
    id:"BUILD_CHECK",
    session:"build-check",
    courseId:COURSE_ID,
    // Exactly reproduces the reported ruler question: 9.3 cm - 2.9 cm.
    courseRunId:"science-v2:numeric-content-1448123",
    startedAt:new Date(now).toISOString(),
    exp:Math.floor(now / 1000) + 3600
  };
  const engine = createScienceLessonEngine(student.courseRunId);
  const rawMessages = [
    { role:"assistant", content:engine.canonicalQuestionForState(1, 1) },
    { role:"user", content:"물체의 질량에 대해서 설명해 주세요." }
  ];
  const options = () => ({
    student,
    messages:rawMessages.map(({ role, content }) => ({ role, content })),
    rawMessages,
    learningProfile:{ lessonRecords:[] },
    inputMode:"text"
  });

  console.log("CSAT live tutor verification: checking mass explanation and a conversational follow-up.");
  const first = await handleScienceTutor(options());
  const firstExample = reviewedExample(engine, student, first, ["질량"]);

  rawMessages.push(
    { role:"assistant", content:first.text, scienceReplyProof:first.scienceReplyProof },
    { role:"user", content:"무게와 어떤 차이가 있나요? 쉽게 설명해 주세요." }
  );
  const second = await handleScienceTutor(options());
  const secondExample = reviewedExample(engine, student, second, ["질량", "무게", "중력"]);

  requireCheck(engine.questions[0].choices["ABCDE".indexOf(engine.questions[0].answer)] === "6.4 cm",
    "build_tutor_answer_fixture_changed");
  rawMessages.push(
    { role:"assistant", content:second.text, scienceReplyProof:second.scienceReplyProof },
    { role:"user", content:"정답은 6.4cm입니다." }
  );
  const answered = await handleScienceTutor({ ...options(), inputMode:"voice" });
  requireCheck(answered.record?.question === 1 && answered.record?.outcome === "correct"
    && answered.record?.attempts === 1, "build_tutor_answer_not_graded");
  requireCheck(/문제 2\/10/.test(answered.text), "build_tutor_next_question_missing");
  requireCheck(answered.teacherModel === undefined, "build_tutor_grading_called_ai");

  for (const [index, example] of [firstExample, secondExample].entries()) {
    console.log(`CSAT synthetic example ${index + 1}; actual model: ${example.model}`);
    console.log(example.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""));
  }
  console.log("CSAT live tutor verification passed: both explanations reviewed; signed question 1, attempt 1 preserved during help; spoken 6.4 cm graded correctly and advanced to question 2.");
}

const deadline = setTimeout(() => {
  console.error("CSAT live tutor verification failed: build_tutor_deadline_exceeded");
  process.exit(1);
}, DEADLINE_MS);

try {
  await verifyTutor();
} catch (error) {
  // Never print provider response objects, request headers, credentials,
  // proofs or stack traces into deployment logs.
  const code = /^(?:build_tutor|science_ai)_[a-z_]+$/.test(error?.message || "")
    ? error.message : "build_tutor_request_failed";
  console.error(`CSAT live tutor verification failed: ${code}`);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
}
