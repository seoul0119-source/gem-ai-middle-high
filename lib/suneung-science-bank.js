import { scienceVariants } from "./suneung-science-variants.js";
import {
  GUARDED_SUNEUNG_SCIENCE_COURSE_ID,
  SAFE_SCIENCE_REDIRECT,
  containsExcludedSuneungScienceContent
} from "./suneung-science-safety.js";

const ANSWER_LABELS = ["A", "B", "C", "D", "E"];
export const CLOSED_SUNEUNG_SCIENCE_GREETING = "안녕하세요! GEM 신앙 교육 원칙에 따라 공식 범위 일부를 제외하고, 허용된 통합과학 핵심 영역에서 새 문제 10개를 한 문제씩 공부합니다. ‘시작’이라고 입력해 주세요.";

export const CLOSED_SUNEUNG_SCIENCE_QUESTIONS = Object.freeze([
  {
    number:1,
    stage:"개념",
    topic:"측정과 단위",
    stem:"전류의 국제단위계(SI) 기본 단위는 무엇인가요?",
    choices:["볼트(V)", "암페어(A)", "옴(Ω)", "와트(W)", "줄(J)"],
    answer:"B",
    hints:[
      "전류는 전압·저항·전력·에너지와 서로 다른 물리량입니다.",
      "전압은 V, 저항은 Ω, 전력은 W, 에너지는 J로 나타냅니다. 전류의 단위를 골라 보세요."
    ],
    explanation:"전류의 SI 기본 단위는 암페어(A)입니다."
  },
  {
    number:2,
    stage:"개념",
    topic:"정보와 신호",
    stem:"스마트폰의 조도 센서가 주변 빛의 세기를 감지해 화면 밝기를 조절합니다. 센서가 먼저 하는 핵심 기능은 무엇인가요?",
    choices:[
      "전기 신호를 빛으로만 바꾼다",
      "빛의 정보를 전기 신호로 바꾼다",
      "기기의 질량을 크게 늘린다",
      "공기 중 산소를 모두 제거한다",
      "화면의 넓이를 자동으로 바꾼다"
    ],
    answer:"B",
    hints:[
      "센서는 주변의 물리적 정보를 기기가 처리할 수 있는 형태로 바꿉니다.",
      "컴퓨터 회로가 직접 처리하기 쉬운 것은 전기적 형태의 신호입니다."
    ],
    explanation:"조도 센서는 빛의 세기 정보를 전기 신호로 변환하고, 기기는 그 신호를 이용해 밝기를 조절합니다."
  },
  {
    number:3,
    stage:"개념",
    topic:"원소와 화학 결합",
    stem:"중성 마그네슘(Mg) 원자가 전자 2개를 잃으면 어떤 이온이 되나요?",
    choices:["Mg²⁻", "Mg²⁺", "Mg⁺", "Mg⁻", "전하가 없는 Mg"],
    answer:"B",
    hints:[
      "전자를 잃으면 음전하의 수가 줄어 양이온이 됩니다.",
      "잃은 전자 수와 이온 전하의 크기를 연결해 보세요."
    ],
    explanation:"중성 마그네슘 원자가 전자 2개를 잃으면 전하가 +2인 Mg²⁺가 됩니다."
  },
  {
    number:4,
    stage:"자료 분석",
    topic:"운동량과 충격량",
    stem:"네 물체가 같은 방향으로 움직입니다. 자료는 ‘물체: 질량(kg), 속력(m/s)’입니다. A: 2, 3 / B: 4, 1 / C: 1, 5 / D: 3, 2. 운동량의 크기가 가장 작은 물체는 무엇인가요?",
    choices:["물체 A", "물체 B", "물체 C", "물체 D", "물체 A와 D"],
    answer:"B",
    hints:[
      "운동량의 크기는 질량과 속력의 곱으로 비교할 수 있습니다.",
      "각 물체에 대해 질량(kg) × 속력(m/s)을 차례로 계산해 보세요."
    ],
    explanation:"운동량은 A 6, B 4, C 5, D 6 kg·m/s이므로 가장 작은 물체는 B입니다."
  },
  {
    number:5,
    stage:"자료 분석",
    topic:"산과 염기",
    stem:"같은 온도에서 네 수용액의 pH를 측정했더니 갑 2, 을 5, 병 7, 정 10이었습니다. 산성이며 수소 이온 농도가 가장 큰 수용액은 무엇인가요?",
    choices:["갑", "을", "병", "정", "갑과 을의 농도가 같다"],
    answer:"A",
    hints:[
      "pH 7보다 작은 수용액은 산성입니다.",
      "산성 수용액끼리는 pH가 더 낮을수록 수소 이온 농도가 더 큽니다."
    ],
    explanation:"갑과 을은 산성이며, pH가 더 낮은 갑의 수소 이온 농도가 더 큽니다."
  },
  {
    number:6,
    stage:"자료 분석",
    topic:"산화와 환원",
    stem:"철 솜을 공기 중에서 충분히 가열했더니 가열 전보다 고체의 질량이 증가했습니다. 질량이 증가한 까닭으로 가장 타당한 것은 무엇인가요?",
    choices:[
      "철이 공기 중 산소와 결합했기 때문이다",
      "철의 원자 수가 저절로 줄었기 때문이다",
      "철이 빛을 흡수해 물질로 바꾸었기 때문이다",
      "철의 부피가 증가하면 항상 질량도 증가하기 때문이다",
      "공기 중 질소가 모두 철로 바뀌었기 때문이다"
    ],
    answer:"A",
    hints:[
      "가열 뒤 고체에 공기 중의 다른 원자가 더해졌는지 생각해 보세요.",
      "철의 산화 과정에서는 철과 산소의 결합이 일어납니다."
    ],
    explanation:"철이 공기 중 산소와 결합해 산화물이 되므로 결합한 산소만큼 고체의 질량이 증가합니다."
  },
  {
    number:7,
    stage:"자료 분석",
    topic:"에너지 효율",
    stem:"네 장치의 ‘공급 에너지(J), 유용한 출력 에너지(J)’가 A: 100, 80 / B: 80, 56 / C: 120, 84 / D: 60, 51입니다. 에너지 효율이 가장 높은 장치는 무엇인가요?",
    choices:["장치 A", "장치 B", "장치 C", "장치 D", "네 장치가 모두 같다"],
    answer:"D",
    hints:[
      "에너지 효율은 유용한 출력 에너지를 공급 에너지로 나눈 값입니다.",
      "A는 80%, B와 C는 70%입니다. 남은 장치의 비율과 비교해 보세요."
    ],
    explanation:"효율은 A 80%, B 70%, C 70%, D 85%이므로 장치 D가 가장 높습니다."
  },
  {
    number:8,
    stage:"통합형 실전",
    topic:"운동량과 안전",
    stem:"같은 사람이 같은 속력으로 착지할 때 두꺼운 안전 매트는 딱딱한 바닥보다 멈추는 시간을 길게 합니다. 운동량 변화량이 같다고 할 때 평균 충격력은 어떻게 되나요?",
    choices:[
      "멈추는 시간이 길수록 커진다",
      "멈추는 시간이 길수록 작아진다",
      "멈추는 시간과 관계없이 항상 0이다",
      "사람의 질량이 즉시 0이 된다",
      "운동량 변화량이 같으면 반드시 무한대가 된다"
    ],
    answer:"B",
    hints:[
      "충격량은 평균 힘과 힘이 작용한 시간의 곱으로 나타낼 수 있습니다.",
      "같은 충격량을 더 긴 시간에 걸쳐 받으면 평균 힘이 어떻게 되는지 생각해 보세요."
    ],
    explanation:"운동량 변화량, 즉 충격량이 같으면 멈추는 시간이 길어질수록 평균 충격력은 작아집니다."
  },
  {
    number:9,
    stage:"통합형 실전",
    topic:"산과 염기 실험",
    stem:"미지 수용액의 pH가 4이고, 파란 리트머스 종이를 붉게 변화시켰습니다. 이 자료로 내릴 수 있는 가장 타당한 결론은 무엇인가요?",
    choices:[
      "이 수용액은 산성을 나타낸다",
      "이 수용액은 중성이다",
      "이 수용액은 강한 염기성을 나타낸다",
      "이 수용액에는 물이 전혀 없다",
      "이 자료만으로 온도가 반드시 100°C라고 할 수 있다"
    ],
    answer:"A",
    hints:[
      "pH 7을 기준으로 산성과 염기성을 구분해 보세요.",
      "파란 리트머스 종이가 붉게 변하는 성질과 pH 4가 같은 결론을 가리킵니다."
    ],
    explanation:"pH가 7보다 작고 파란 리트머스 종이를 붉게 바꾸므로 이 수용액은 산성입니다."
  },
  {
    number:10,
    stage:"통합형 실전",
    topic:"에너지 전환과 저장",
    stem:"태양광 장치가 네 시간 동안 차례로 80, 20, 80, 20 kWh의 전기에너지를 생산하고, 매시간 50 kWh가 필요합니다. 저장 과정의 손실이 없고 처음 저장량이 0일 때 수요를 모두 충족하는 운용 방법은 무엇인가요?",
    choices:[
      "1·3번째 시간의 남는 전기에너지를 각각 30 kWh 저장해 2·4번째 시간의 부족분에 사용한다",
      "2·4번째 시간의 부족분을 그대로 두고 남는 전기에너지도 저장하지 않는다",
      "생산량과 관계없이 매시간 80 kWh를 사용한다",
      "저장 장치 없이 1번째 시간의 생산량만 두 배로 간주한다",
      "네 시간의 총생산량이 200 kWh이므로 시간별 배분은 고려하지 않는다"
    ],
    answer:"A",
    hints:[
      "각 시간의 생산 전기에너지에서 필요한 50 kWh를 빼서 남는 양과 부족한 양을 구해 보세요.",
      "전기에너지가 80 kWh 생산되는 시간에는 30 kWh가 남고, 20 kWh 생산되는 시간에는 30 kWh가 부족합니다."
    ],
    explanation:"1·3번째 시간에 각각 남는 전기에너지 30 kWh를 저장해 바로 다음 시간의 30 kWh 부족분에 사용하면 모든 시간의 수요를 충족합니다."
  }
].map((question) => Object.freeze({
  ...question,
  choices:Object.freeze([...question.choices]),
  hints:Object.freeze([...question.hints])
})));

export function createScienceLessonEngine(seed = "") {
const lessonQuestions = scienceVariants(CLOSED_SUNEUNG_SCIENCE_QUESTIONS, seed);
function questionByNumber(number) {
  return lessonQuestions[number - 1] || null;
}

function renderQuestion(question, attempt = 1, lead = "") {
  const choices = question.choices
    .map((choice, index) => `${ANSWER_LABELS[index]}) ${choice}`)
    .join("\n");
  const header = `문제 ${question.number}/10 — ${question.stage} · ${question.topic} · 도전 ${attempt}/3`;
  return `${lead ? `${lead.trim()}\n\n` : ""}${header}\n${question.stem}\n\n${choices}${seed ? "\n\n정답은 어느 보기인가요?" : ""}\n\n답: (________)`;
}

function parseChoice(value) {
  const normalized = String(value || "").normalize("NFKC").trim().toUpperCase();
  const match = normalized.match(/^(?:(?:정답|답)(?:은|는)?\s*)?([A-E1-5])(?:\s*번)?(?:\s*(?:입니다|이에요|예요|이요|요))?[.!?。]?$/);
  if (!match) return "";
  if (/^[A-E]$/.test(match[1])) return match[1];
  return ANSWER_LABELS[Number(match[1]) - 1] || "";
}

function parseKoreanSpokenChoice(value) {
  const compact = String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[.!?。]/g, "")
    .replace(/^(?:정답|답)(?:은|는)?\s*/, "")
    .replace(/(?:입니다|이에요|예요|이요|요)$/, "")
    .replace(/\s+/g, "");
  const spokenChoices = {
    "에이":"A", "에이번":"A", "일번":"A", "첫번째":"A",
    "비":"B", "비번":"B", "이번":"B", "두번째":"B",
    "씨":"C", "씨번":"C", "삼번":"C", "세번째":"C",
    "디":"D", "디번":"D", "사번":"D", "네번째":"D",
    "이선택지":"E", "이(e)":"E", "오번":"E", "다섯번째":"E"
  };
  return spokenChoices[compact] || "";
}

function submittedChoice(value) {
  return parseChoice(value) || parseKoreanSpokenChoice(value);
}

function isHintRequest(value) {
  if (/(?:힌트|도움|도와|모르겠|모르겠는데|이해가\s*안)/.test(String(value))) return true;
  return /^(?:힌트(?:\s*(?:주세요|부탁해요|부탁드립니다))?|도움(?:\s*주세요)?|도와\s*줘요|도와주세요|모르겠(?:어요|습니다)|잘\s*모르겠(?:어요|습니다))[.!?。]?$/
    .test(String(value || "").normalize("NFKC").trim());
}

const glossary = {
  "옴":"옴은 전기 저항의 단위이며 기호는 Ω입니다. 저항은 전류의 흐름을 방해하는 정도입니다.",
  "볼트":"볼트는 전압의 단위이며 기호는 V입니다. 전압은 두 지점 사이의 전위 차이입니다.",
  "암페어":"암페어는 전류의 단위이며 기호는 A입니다. 전류는 단위 시간에 흐르는 전하의 양입니다.",
  "와트":"와트는 전력의 단위이며 기호는 W입니다. 전력은 단위 시간에 전환하거나 사용하는 에너지입니다.",
  "줄":"줄은 에너지와 일의 단위이며 기호는 J입니다.",
  "SI":"SI는 국제단위계를 뜻합니다. 측정값을 공통된 단위로 나타내기 위한 체계입니다."
};
function supportText(question, term, attempt) {
  return `문제 ${question.number}/10 · 용어 설명 · 도전 ${attempt}/3\n${glossary[term]}\n현재 문제의 조건과 비교해 보세요.\n\n답: (________)`;
}
function requestedTerm(text, question) {
  if (!/(?:무엇|뭐|의미|뜻|설명|알려|왜|어떤)/.test(text)) return "";
  const match = text.match(/(?:^|\s)([A-E씨디비])(?:\s*번)?(?:의|\s|$)/i);
  const label = match ? ({"씨":"C","디":"D","비":"B"}[match[1]] || match[1].toUpperCase()) : "";
  const referenced = label ? question.choices[ANSWER_LABELS.indexOf(label)] || "" : "";
  return Object.keys(glossary).find(term => (text.includes(term) || referenced.includes(term))
    && (question.stem.includes(term) || question.choices.some(choice => choice.includes(term)) || term === "SI")) || "";
}

function latestDisplayedAttempt(messages, questionNumber) {
  const pattern = new RegExp(`문제\\s*${questionNumber}\\s*\\/\\s*10[^\\n]*도전\\s*([1-3])\\s*\\/\\s*3`, "i");
  for (const message of [...messages].reverse()) {
    if (message?.role !== "assistant") continue;
    if (!isApprovedClosedSuneungScienceResponse(message.content)) continue;
    const match = String(message.content || "").match(pattern);
    if (match) return Number(match[1]);
  }
  return 0;
}

function deliveredHintCount(messages, questionNumber) {
  const pattern = new RegExp(`문제\\s*${questionNumber}\\s*\\/\\s*10\\s*·\\s*힌트\\s*([12])\\s*\\/\\s*2`, "gi");
  let highest = 0;
  for (const message of messages) {
    if (message?.role !== "assistant") continue;
    if (!isApprovedClosedSuneungScienceResponse(message.content)) continue;
    for (const match of String(message.content || "").matchAll(pattern)) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return highest;
}

function validatedCompletedRecords(profile) {
  const candidates = Array.isArray(profile?.lessonRecords) ? profile.lessonRecords : [];
  const byQuestion = new Map();
  for (const candidate of candidates) {
    const question = questionByNumber(Number(candidate?.question));
    if (!question || byQuestion.has(question.number)) continue;
    const attempts = Number(candidate.attempts);
    const outcome = candidate.outcome;
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) continue;
    if (!['correct', 'incorrect'].includes(outcome)) continue;
    if (outcome === "incorrect" && attempts !== 3) continue;
    if (candidate.stage !== question.stage || candidate.topic !== question.topic || candidate.scope !== "direct") continue;
    byQuestion.set(question.number, { question:question.number, outcome, attempts, topic:question.topic });
  }
  const records = [];
  for (let number = 1; number <= 10 && byQuestion.has(number); number += 1) {
    records.push(byQuestion.get(number));
  }
  return records;
}

function isValidClosedScienceRecord(record) {
  const question = questionByNumber(Number(record?.question));
  const attempts = Number(record?.attempts);
  if (!question || !Number.isInteger(attempts) || attempts < 1 || attempts > 3) return false;
  if (record.stage !== question.stage || record.topic !== question.topic || record.scope !== "direct") return false;
  if (!['correct', 'incorrect'].includes(record.outcome)) return false;
  if (record.outcome === "incorrect" && attempts !== 3) return false;
  const expectedWeakType = record.outcome === "incorrect" || attempts > 1 ? question.topic : "";
  return record.weakType === expectedWeakType;
}

function createRecord(question, outcome, attempts) {
  const record = {
    question:question.number,
    stage:question.stage,
    topic:question.topic,
    scope:"direct",
    outcome,
    attempts,
    weakType:outcome === "incorrect" || attempts > 1 ? question.topic : ""
  };
  if (!isValidClosedScienceRecord(record)) throw new Error("Invalid closed science record");
  return record;
}

function renderHint(question, hintNumber, attempt) {
  if (hintNumber > 2) {
    return `문제 ${question.number}/10 · 힌트 2/2 · 도전 ${attempt}/3\n힌트는 두 단계까지 제공됩니다. 이제 A~E 또는 1~5 중 하나로 답해 주세요.\n\n답: (________)`;
  }
  return `문제 ${question.number}/10 · 힌트 ${hintNumber}/2 · 도전 ${attempt}/3\n${question.hints[hintNumber - 1]}\n정답은 아직 공개하지 않습니다. A~E 또는 1~5 중 하나로 답해 주세요.\n\n답: (________)`;
}

function renderSummary(records) {
  const correct = records.filter((record) => record.outcome === "correct").length;
  const incorrect = records.length - correct;
  const review = [...new Set(records
    .filter((record) => record.outcome === "incorrect" || record.attempts > 1)
    .map((record) => record.topic))];
  return [
    "이번 통합과학 수업을 마쳤습니다.",
    `정답 ${correct}문제 · 오답 ${incorrect}문제`,
    `맞춤 복습 주제: ${review.length ? review.join(", ") : "현재 기록상 추가 복습 주제가 없습니다."}`,
    "각 문항의 정답·오답·도전 횟수 기록을 바탕으로 다음 복습을 이어갈 수 있습니다."
  ].join("\n");
}

function isApprovedSummary(value, finalOutcome = "") {
  const lines = String(value || "").split("\n");
  if (lines.length !== 4) return false;
  if (lines[0] !== "이번 통합과학 수업을 마쳤습니다.") return false;
  const totals = lines[1].match(/^정답 (10|[0-9])문제 · 오답 (10|[0-9])문제$/);
  if (!totals || Number(totals[1]) + Number(totals[2]) !== 10) return false;
  const incorrect = Number(totals[2]);
  if (lines[3] !== "각 문항의 정답·오답·도전 횟수 기록을 바탕으로 다음 복습을 이어갈 수 있습니다.") return false;

  const reviewPrefix = "맞춤 복습 주제: ";
  if (!lines[2].startsWith(reviewPrefix)) return false;
  const review = lines[2].slice(reviewPrefix.length);
  if (review === "현재 기록상 추가 복습 주제가 없습니다.") {
    return incorrect === 0 && finalOutcome !== "incorrect";
  }
  const topics = review.split(", ");
  if (!topics.length || new Set(topics).size !== topics.length) return false;
  const bankTopicIndexes = topics.map((topic) =>
    lessonQuestions.findIndex((question) => question.topic === topic)
  );
  const orderedBankTopics = bankTopicIndexes.every((index) => index >= 0)
    && bankTopicIndexes.every((index, position) => position === 0 || index > bankTopicIndexes[position - 1]);
  if (!orderedBankTopics || topics.length < incorrect) return false;
  if (finalOutcome === "correct") {
    const finalTopic = questionByNumber(10).topic;
    return incorrect <= 9 && topics.filter((topic) => topic !== finalTopic).length >= incorrect;
  }
  if (finalOutcome === "incorrect") {
    return incorrect >= 1 && topics.includes(questionByNumber(10).topic);
  }
  return true;
}

function buildApprovedStaticResponses() {
  const approved = new Set([SAFE_SCIENCE_REDIRECT]);
  for (const question of lessonQuestions) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      approved.add(renderQuestion(question, attempt));
      approved.add(renderQuestion(question, attempt, SAFE_SCIENCE_REDIRECT));
      approved.add(renderHint(question, 1, attempt));
      approved.add(renderHint(question, 2, attempt));
      approved.add(renderHint(question, 3, attempt));
      for (const term of Object.keys(glossary)) approved.add(supportText(question, term, attempt));
      approved.add(`문제 ${question.number}/10 · 답안 재입력 · 도전 ${attempt}/3\n답안을 확인하지 못했습니다. 다른 내용은 다루지 않고 현재 문제를 계속하겠습니다. A~E 또는 1~5 중 하나만 입력해 주세요.\n\n답: (________)`);
    }

    if (question.number < 10) {
      const nextQuestion = questionByNumber(question.number + 1);
      approved.add(renderQuestion(nextQuestion, 1, `정답입니다. ${question.explanation}`));
      const correctIndex = ANSWER_LABELS.indexOf(question.answer);
      approved.add(renderQuestion(
        nextQuestion,
        1,
        `세 번의 도전을 마쳤습니다. 정답은 ${question.answer}) ${question.choices[correctIndex]}입니다. ${question.explanation}`
      ));
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        for (let hintNumber = attempt; hintNumber <= 2; hintNumber += 1) {
          const lead = `아직 정답이 아닙니다.\n문제 ${question.number}/10 · 힌트 ${hintNumber}/2\n${question.hints[hintNumber - 1]}\n정답은 아직 공개하지 않습니다.`;
          approved.add(renderQuestion(question, attempt + 1, lead));
        }
      }
    } else {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        for (let hintNumber = attempt; hintNumber <= 2; hintNumber += 1) {
          const lead = `아직 정답이 아닙니다.\n문제 ${question.number}/10 · 힌트 ${hintNumber}/2\n${question.hints[hintNumber - 1]}\n정답은 아직 공개하지 않습니다.`;
          approved.add(renderQuestion(question, attempt + 1, lead));
        }
      }
    }
  }
  return approved;
}

const APPROVED_STATIC_RESPONSES = buildApprovedStaticResponses();

function projectClosedSuneungScienceSpeechText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*|```/g, ""))
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*\*|`|#+\s?/g, "")
    .replace(/_{4,}/g, "________")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim()
    .replace(/^\s*(?:활동|문제|Activity|Activité)\s*\d+\s*\/\s*10[^\n]*$/gim, "")
    .replace(/^\s*(?:답|Answer|Réponse)(?:\s*\d+)?\s*:\s*\([ _\u3000]{3,}\)\s*$/gim, "")
    .replace(/_{4,}/g, " 빈칸 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const APPROVED_STATIC_SPEECH_RESPONSES = new Set(
  [
    ...[...APPROVED_STATIC_RESPONSES].map(projectClosedSuneungScienceSpeechText),
    projectClosedSuneungScienceSpeechText(CLOSED_SUNEUNG_SCIENCE_GREETING)
  ].filter(Boolean)
);
// Validate each requested clip against server-built lesson scripts. Arbitrary
// client additions still fail closed before reaching the voice provider.
if (seed) {
  for (const full of [...APPROVED_STATIC_SPEECH_RESPONSES]) {
    for (const part of full.split(/(?=^[ \t]*(?:[A-E][).:：][ \t]+|정답은 어느 보기인가요\?))/gm)) {
      if (part.trim()) APPROVED_STATIC_SPEECH_RESPONSES.add(part.trim());
    }
  }
}

function isApprovedClosedSuneungScienceResponse(value) {
  const text = String(value || "");
  if (!text || text.length > 10000 || containsExcludedSuneungScienceContent(text)) return false;
  if (APPROVED_STATIC_RESPONSES.has(text)) return true;

  const summaryMarker = "이번 통합과학 수업을 마쳤습니다.";
  const summaryIndex = text.indexOf(summaryMarker);
  if (summaryIndex < 0) return false;
  const summary = text.slice(summaryIndex);
  if (summaryIndex === 0) return isApprovedSummary(summary);
  if (text.slice(summaryIndex - 2, summaryIndex) !== "\n\n") return false;
  const lead = text.slice(0, summaryIndex - 2);
  const finalQuestion = questionByNumber(10);
  const correctLead = `정답입니다. ${finalQuestion.explanation}`;
  const correctIndex = ANSWER_LABELS.indexOf(finalQuestion.answer);
  const incorrectLead = `세 번의 도전을 마쳤습니다. 정답은 ${finalQuestion.answer}) ${finalQuestion.choices[correctIndex]}입니다. ${finalQuestion.explanation}`;
  if (lead === correctLead) return isApprovedSummary(summary, "correct");
  if (lead === incorrectLead) return isApprovedSummary(summary, "incorrect");
  return false;
}

function isApprovedClosedSuneungScienceSpeechText(value) {
  const text = String(value || "");
  if (!text || text.length > 10000 || containsExcludedSuneungScienceContent(text)) return false;
  return APPROVED_STATIC_SPEECH_RESPONSES.has(text)
    || isApprovedClosedSuneungScienceResponse(text);
}

function handleClosedSuneungScienceLesson({
  courseId,
  messages,
  learningProfile,
  blockedInput = false
}) {
  if (courseId !== GUARDED_SUNEUNG_SCIENCE_COURSE_ID) return null;
  const safeMessages = Array.isArray(messages) ? messages : [];
  const completed = validatedCompletedRecords(learningProfile);
  if (completed.length >= 10) {
    return { text:blockedInput ? SAFE_SCIENCE_REDIRECT : renderSummary(completed) };
  }

  const question = questionByNumber(completed.length + 1);
  const displayedAttempt = latestDisplayedAttempt(safeMessages, question.number);
  if (blockedInput) {
    return {
      text:renderQuestion(question, displayedAttempt || 1, SAFE_SCIENCE_REDIRECT)
    };
  }
  if (!displayedAttempt) return { text:renderQuestion(question, 1) };

  const latestUser = safeMessages[safeMessages.length - 1];
  if (latestUser?.role !== "user") {
    return { text:renderQuestion(question, displayedAttempt) };
  }
  const submitted = String(latestUser?.content || "");
  const term = requestedTerm(submitted, question);
  if (term) return { text:supportText(question, term, displayedAttempt) };
  if (/(?:다시|한번\s*더|한 번\s*더).*(?:읽|문제|질문)|문제.*(?:읽어|보여)/.test(submitted)) {
    return { text:renderQuestion(question, displayedAttempt) };
  }
  if (isHintRequest(submitted) || /^(?:(?:현재|이)\s*)?(?:문제|보기|풀이)(?:를|을)?\s*(?:좀\s*)?(?:설명|알려)|(?:어떻게|왜).*(?:풀|계산|되)/.test(submitted)) {
    return {
      text:renderHint(
        question,
        deliveredHintCount(safeMessages, question.number) + 1,
        displayedAttempt
      )
    };
  }

  const choice = submittedChoice(submitted);
  if (!choice) {
    return {
      text:`문제 ${question.number}/10 · 답안 재입력 · 도전 ${displayedAttempt}/3\n답안을 확인하지 못했습니다. 다른 내용은 다루지 않고 현재 문제를 계속하겠습니다. A~E 또는 1~5 중 하나만 입력해 주세요.\n\n답: (________)`
    };
  }

  const attempt = displayedAttempt;
  if (choice === question.answer) {
    const record = createRecord(question, "correct", attempt);
    const completedWithCurrent = [...completed, record];
    const lead = `정답입니다. ${question.explanation}`;
    return question.number === 10
      ? { text:`${lead}\n\n${renderSummary(completedWithCurrent)}`, record }
      : { text:renderQuestion(questionByNumber(question.number + 1), 1, lead), record };
  }

  if (attempt < 3) {
    const hintNumber = Math.min(
      2,
      Math.max(attempt, deliveredHintCount(safeMessages, question.number) + 1)
    );
    const lead = `아직 정답이 아닙니다.\n문제 ${question.number}/10 · 힌트 ${hintNumber}/2\n${question.hints[hintNumber - 1]}\n정답은 아직 공개하지 않습니다.`;
    return { text:renderQuestion(question, attempt + 1, lead) };
  }

  const record = createRecord(question, "incorrect", 3);
  const completedWithCurrent = [...completed, record];
  const correctIndex = ANSWER_LABELS.indexOf(question.answer);
  const lead = `세 번의 도전을 마쳤습니다. 정답은 ${question.answer}) ${question.choices[correctIndex]}입니다. ${question.explanation}`;
  return question.number === 10
    ? { text:`${lead}\n\n${renderSummary(completedWithCurrent)}`, record }
    : { text:renderQuestion(questionByNumber(question.number + 1), 1, lead), record };
}

// Fail closed during module initialization if a reviewed bank edit ever adds
// excluded text. This happens before any lesson request can be served.
for (const question of lessonQuestions) {
  const reviewedText = [question.stage, question.topic, question.stem, ...question.choices, ...question.hints, question.explanation].join("\n");
  if (containsExcludedSuneungScienceContent(reviewedText)) {
    throw new Error(`Closed Suneung science bank failed safety review at question ${question.number}`);
  }
}
return { questions:lessonQuestions, isValidClosedScienceRecord, projectClosedSuneungScienceSpeechText,
  isApprovedClosedSuneungScienceResponse, isApprovedClosedSuneungScienceSpeechText, handleClosedSuneungScienceLesson };
}

export const { isValidClosedScienceRecord, projectClosedSuneungScienceSpeechText,
  isApprovedClosedSuneungScienceResponse, isApprovedClosedSuneungScienceSpeechText,
  handleClosedSuneungScienceLesson } = createScienceLessonEngine();
