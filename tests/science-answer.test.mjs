import test from "node:test";
import assert from "node:assert/strict";
import { resolveScienceContentAnswer as resolve } from "../lib/science-answer.js";

const ruler = {
  stem:"물체의 양 끝은 2.9 cm와 9.3 cm 눈금에 있습니다. 길이는 얼마인가요?",
  choices:["6.4 cm", "6.3 cm", "6.5 cm", "6.2 cm", "6.6 cm"], answer:"A"
};
const quantityQuestion = (answer, unit) => ({ choices:[`${answer} ${unit}`, `999 ${unit}`, `998 ${unit}`, `997 ${unit}`, `996 ${unit}`], answer:"A" });

test("the reported full ruler answer and direct confirmation resolve to its actual choice", () => {
  for (const phrase of ["정답은 6.4cm입니다.", "6.4cm가 맞습니까?", "6.4cm인가요?", "정답이 6.4cm 맞나요?", "6.4 cm", "6.4", "6.40 센티미터예요", "제 답은 6.4 cm입니다", "답: 6.4 cm", "육점사 센티미터입니다", "6점4센티미터요", "64/10 cm", "십분의육십사 센티미터"]) {
    assert.deepEqual(resolve(phrase, ruler), { kind:"answer", correct:true, choice:"A" }, phrase);
  }
});

test("wrong numeric values are graded even when no distractor matches; wrong units stay wrong", () => {
  for (const phrase of ["정답은 12cm입니다", "-6.4 cm", "6.4 m", "0.064 m", "6.4 g", "6.4 kg", "0 cm"]) {
    assert.deepEqual(resolve(phrase, ruler), { kind:"answer", correct:false }, phrase);
  }
  assert.deepEqual(resolve("정답은 6.3센티미터입니다", ruler), { kind:"answer", correct:false, choice:"B" });
});

test("concept questions and requests containing the correct numeric answer are never submitted", () => {
  for (const phrase of [
    "6.4cm는 무엇인가요?", "6.4 cm가 왜 맞나요?", "6.4cm를 어떻게 계산하나요?",
    "9.3에서 2.9를 빼면 되나요?", "6.4 cm가 맞는 이유를 설명해주세요",
    "왜 답이 6.4 cm인가요?", "왜 6.4cm인가요?", "힌트 주세요. 6.4인가요?", "6.4와 6.3 중 무엇입니까?",
    "6.4cm는 길이 단위인가요?", "정답이 6.4cm라고 가정하면 설명은 무엇인가요?",
    "정답은 6.4cm입니다. 그런데 왜인가요?", "질량이라는 게 무엇인가요?",
    "정답은 무엇인가요?", "지금 답이 맞습니까? 틀렸습니까?", "한번 더 설명해 주세요",
    "센티미터가 무엇인가요?", "갑이 무엇을 말하나요?"
  ]) assert.equal(resolve(phrase, ruler), null, phrase);
});

test("actual generated units and their spoken names normalize without unit conversion", () => {
  for (const [unit, spoken] of [
    ["cm", "센티미터"], ["g", "그램"], ["kg", "킬로그램"], ["s", "초"], ["mL", "밀리리터"],
    ["N", "뉴턴"], ["암페어(A)", "암페어"], ["볼트(V)", "볼트"], ["옴(Ω)", "옴"],
    ["와트(W)", "와트"], ["줄(J)", "줄"], ["개", "개"], ["배", "배"], ["%", "퍼센트"],
    ["kg·m/s", "킬로그램 미터 매초"], ["m/s", "미터 매초"], ["kWh", "킬로와트시"]
  ]) {
    assert.deepEqual(resolve(`정답은 육십사 ${spoken}입니다`, quantityQuestion(64, unit)), { kind:"answer", correct:true, choice:"A" }, unit);
  }
});

test("negative, fraction, comma separated and signed charge answers are supported", () => {
  assert.deepEqual(resolve("마이너스 이입니다", { choices:["+2", "-2", "+1", "-1", "0"], answer:"B" }), { kind:"answer", correct:true, choice:"B" });
  assert.deepEqual(resolve("정답은 +2입니다", { choices:["+2", "-2", "+1", "-1", "0"], answer:"A" }), { kind:"answer", correct:true, choice:"A" });
  const ratio = { choices:["1/4배", "4배", "5배", "변함없다", "0배"], answer:"A" };
  for (const phrase of ["1/4배입니다", "0.25배", "사분의 일 배", "영점이오배"]) {
    assert.deepEqual(resolve(phrase, ratio), { kind:"answer", correct:true, choice:"A" }, phrase);
  }
  assert.deepEqual(resolve("일천이백삼십사 줄", quantityQuestion(1234, "J")), { kind:"answer", correct:true, choice:"A" });
  assert.deepEqual(resolve("1,234 J", quantityQuestion(1234, "J")), { kind:"answer", correct:true, choice:"A" });
  assert.equal(resolve("1/0 배", ratio), null);
});

test("choice labels and bare 1 through 5 remain owned by the original choice protocol", () => {
  for (const input of ["A", "B", "C", "D", "E", "1", "2", "3", "4", "5", "정답은 2입니다", "이입니다", "이", "일", "삼", "사", "오"]) {
    assert.equal(resolve(input, quantityQuestion(2, "g")), null, input);
  }
  assert.deepEqual(resolve("2g", quantityQuestion(2, "g")), { kind:"answer", correct:true, choice:"A" });
  assert.deepEqual(resolve("두개", quantityQuestion(2, "개")), { kind:"answer", correct:true, choice:"A" });
});

test("full option contents and unit names are accepted; partial phrases are not", () => {
  const textQuestion = { choices:["전기 신호를 빛으로 바꾼다", "빛의 정보를 전기 신호로 바꾼다", "질량을 늘린다", "산소를 없앤다", "정보를 지운다"], answer:"B" };
  assert.deepEqual(resolve("빛의 정보를 전기 신호로 바꾼다", textQuestion), { kind:"answer", correct:true, choice:"B" });
  assert.deepEqual(resolve("정답은 질량을 늘린다입니다", textQuestion), { kind:"answer", correct:false, choice:"C" });
  assert.equal(resolve("빛의 정보", textQuestion), null);
  assert.equal(resolve("빛의 정보를 전기 신호로 바꾼다는 말이 무엇인가요?", textQuestion), null);
  const units = { choices:["볼트(V)", "암페어(A)", "옴(Ω)", "와트(W)", "줄(J)"], answer:"B" };
  assert.deepEqual(resolve("암페어입니다", units), { kind:"answer", correct:true, choice:"B" });
  assert.deepEqual(resolve("볼트", units), { kind:"answer", correct:false, choice:"A" });
  assert.deepEqual(resolve("정답은 pH 4입니다", { choices:["pH 4", "pH 7", "pH 8", "pH 10", "pH 12"], answer:"A" }), { kind:"answer", correct:true, choice:"A" });
});

test("unclear unit inference and duplicate equivalent options require clarification", () => {
  assert.deepEqual(resolve("6.4", { choices:["6.4 cm", "6.4 kg", "6.5 cm", "6.2 cm", "6.6 cm"], answer:"A" }), { kind:"clarify" });
  assert.deepEqual(resolve("6.40cm", { choices:["6.4 cm", "6.40 cm", "6.5 cm", "6.2 cm", "6.6 cm"], answer:"A" }), { kind:"clarify" });
  assert.equal(resolve("정답은 6.4cm입니다", { choices:["갑", "을", "병", "정", "무"], answer:"A" }), null);
  assert.equal(resolve("6.4cm", null), null);
});
