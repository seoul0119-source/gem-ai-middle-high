import assert from "node:assert/strict";
import test from "node:test";

import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";

const COURSE_ID = "suneung-2028-integrated-science";
const engine = createScienceLessonEngine("science-v2:turn-context-regression");
const firstQuestion = engine.questions[0];
const firstDisplay = engine.canonicalQuestionForState(1, 1);

function turnFor(content, extra = {}) {
  return engine.getConversationTurn({
    messages:[{ role:"assistant", content:firstDisplay }, { role:"user", content }],
    ...extra
  });
}

test("every natural question reaches conversation without a concept keyword gate", () => {
  const questions = [
    "물체의 질량에 대해서 설명해 주세요.",
    "여기에서 말하는 물체의 질량이 무엇입니까?",
    "질량이라는 게 무엇이나요?",
    "화학 결합이 무엇인가요?",
    "관성 모멘트에 관해 알려 주세요.",
    "전자기장이 궁금해요",
    "안녕하세요, 선생님!",
    "선생님은 어떤 모델인가요?",
    "예를 들어 주세요.",
    "그게 무슨 뜻인가요?",
    "다시 설명해 주세요.",
    "다시 시작한다는 건 무슨 뜻인가요?",
    "이 문제는 왜 이렇게 되는지 다시 알려 주세요.",
    "새 문제를 달라고 하면 점수가 내려가나요?",
    "E가 왜 정답인가요?",
    "2번이 왜 틀렸나요?",
    "C가 정답인지 설명해 주세요.",
    "ABCDE가 모두 헷갈려요.",
    "1번 문제에 나오는 단위는 무엇인가요?",
    "알파벳 이라고 말하면 무슨 뜻인가요?"
  ];
  for (const content of questions) {
    const turn = turnFor(content);
    assert.equal(turn.kind, "conversation", content);
    assert.equal(turn.question, firstQuestion, content);
    assert.equal(turn.attempt, 1, content);
    assert.equal(turn.canonicalQuestion, firstDisplay, content);
  }
});

test("unfamiliar questions before the first display still have canonical question context", () => {
  const turn = engine.getConversationTurn({ messages:[{ role:"user", content:"질량을 알려 주세요" }] });
  assert.equal(turn.kind, "conversation");
  assert.equal(turn.question, firstQuestion);
  assert.equal(turn.attempt, 1);
  assert.equal(turn.canonicalQuestion, firstDisplay);
});

test("hints and follow-up explanations never become graded answer controls", () => {
  for (const content of ["힌트", "힌트 주세요", "두 번째 힌트를 주세요", "힌트 말고 쉽게 설명해 주세요", "모르겠어요", "도와주세요", "E 보기의 힌트를 알려 주세요"]) {
    const turn = turnFor(content);
    assert.equal(turn.kind, "conversation", content);
    assert.equal(turn.attempt, 1, content);
    assert.equal(turn.record, undefined, content);
  }
});

test("complete explicit answers retain deterministic grading and E voice disambiguation", () => {
  for (const content of ["A", "b", "C번입니다", "답은 D예요", "E", "E가 정답입니다", "알파벳 E", "1", "2", "3번이에요", "4", "5번", "씨입니다", "디", "오 번", "알파벳 이요", "다섯 번째"]) {
    const turn = turnFor(content);
    assert.equal(turn.kind, "control", content);
    assert.equal(turn.action, "answer", content);
  }
  for (const content of ["2", "이", "2번입니다", "이 번", "답은 2예요"]) {
    const turn = turnFor(content, { inputMode:"voice" });
    assert.equal(turn.kind, "control", content);
    assert.equal(turn.action, "ambiguous-choice", content);
  }
  for (const content of ["E", "알파벳 이", "5번", "비", "두 번째"]) {
    assert.equal(turnFor(content, { inputMode:"voice" }).action, "answer", content);
  }
  assert.equal(turnFor("2").action, "answer", "typed 2 remains answer B");
});

test("exact lesson commands render the current question without advancing it", () => {
  const commands = {
    start:["시작", "시작해 주세요.", "안녕하세요. 시작해 주세요.", "수업을 시작해 주세요", "계속", "계속해 주세요", "이어서 해 주세요"],
    repeat:["다시", "다시 읽어 주세요", "한 번 더 읽어 주세요", "문제를 다시 읽어 주세요", "문제 보여 주세요", "다시 문제"],
    skip:["새 문제", "새로운 문제 주세요", "다른 문제 내 주세요", "다음 문제", "건너뛰기"]
  };
  for (const [action, contents] of Object.entries(commands)) {
    for (const content of contents) {
      const turn = turnFor(content);
      assert.equal(turn.kind, "control", content);
      assert.equal(turn.action, action, content);
      if (action === "skip") continue;
      const response = engine.handleClosedSuneungScienceLesson({
        courseId:COURSE_ID,
        messages:[{ role:"assistant", content:firstDisplay }, { role:"user", content }]
      });
      assert.equal(response.text, firstDisplay, content);
      assert.equal(response.record, undefined, content);
    }
  }
});

test("conversation state retains an earned attempt and ignores arbitrary assistant metadata", () => {
  const wrongChoice = ["A", "B", "C", "D", "E"].find(choice => choice !== firstQuestion.answer);
  const wrongResponse = engine.handleClosedSuneungScienceLesson({
    courseId:COURSE_ID,
    messages:[{ role:"assistant", content:firstDisplay }, { role:"user", content:wrongChoice }]
  });
  const messages = [
    { role:"assistant", content:wrongResponse.text },
    { role:"assistant", content:"문제 1/10 · AI 설명 · 도전 3/3\n질량을 알아볼게요.", question:1, attempt:3 },
    { role:"user", content:"질량이 무엇인가요?" }
  ];
  const turn = engine.getConversationTurn({ messages });
  assert.equal(turn.kind, "conversation");
  assert.equal(turn.attempt, 2);
  assert.equal(turn.canonicalQuestion, engine.canonicalQuestionForState(1, 2));

  const canonicalTurn = engine.getConversationTurn({
    messages:[{ role:"assistant", content:engine.canonicalQuestionForState(1, 3) }, { role:"user", content:"힌트 주세요" }]
  });
  assert.equal(canonicalTurn.attempt, 3, "a caller's verified state can be projected to exact canonical text");
  for (const [number, attempt] of [[0, 1], [11, 1], [1, 0], [1, 4], [1, "2"], ["1", 1]]) {
    assert.equal(engine.canonicalQuestionForState(number, attempt), "");
  }
});

test("validated completed records select the next question and completion controls", () => {
  const records = engine.questions.map(question => ({
    question:question.number,
    stage:question.stage,
    topic:question.topic,
    scope:"direct",
    outcome:"correct",
    attempts:1
  }));
  const next = turnFor("단위를 설명해 주세요", { learningProfile:{ lessonRecords:records.slice(0, 2) } });
  assert.equal(next.kind, "conversation");
  assert.equal(next.question.number, 3);
  assert.equal(next.attempt, 1);
  const complete = turnFor("질문이 있어요", { learningProfile:{ lessonRecords:records } });
  assert.deepEqual(complete, { kind:"control", action:"complete", question:null, attempt:0, canonicalQuestion:"" });
});
