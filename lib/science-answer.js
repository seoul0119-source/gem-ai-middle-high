// Resolve submitted *contents* of a science answer. Choice letters and spoken
// choice ambiguity are handled first by the lesson engine. This parser never
// extracts a number from a longer question or asks a model to grade an answer.
const LABELS = "ABCDE";
const DIGITS = { 영:0, 공:0, 일:1, 이:2, 삼:3, 사:4, 오:5, 육:6, 칠:7, 팔:8, 구:9 };
const NATIVE_NUMBERS = { 한:1, 하나:1, 두:2, 둘:2, 세:3, 셋:3, 네:4, 넷:4 };
const UNIT_ALIASES = [
  ["kg·m/s", ["kg·m/s", "kg*m/s", "kgm/s", "킬로그램미터매초", "킬로그램미터/초"]],
  ["m/s", ["m/s", "미터매초", "미터퍼초", "미터/초"]],
  ["cm", ["cm", "센티미터", "센티메터"]],
  ["mm", ["mm", "밀리미터", "밀리메터"]],
  ["m", ["m", "미터", "메터"]],
  ["kg", ["kg", "킬로그램", "키로그램"]],
  ["g", ["g", "그램", "그람"]],
  ["s", ["s", "초"]],
  ["min", ["min", "분"]],
  ["mL", ["ml", "밀리리터"]],
  ["L", ["l", "리터"]],
  ["N", ["n", "뉴턴"]],
  ["mA", ["ma", "밀리암페어"]],
  ["A", ["a", "암페어", "암페아"]],
  ["mV", ["mv", "밀리볼트"]],
  ["V", ["v", "볼트"]],
  ["kΩ", ["kω", "kohm", "킬로옴"]],
  ["Ω", ["ω", "ohm", "옴"]],
  ["kW", ["kw", "킬로와트"]],
  ["mW", ["mw", "밀리와트"]],
  ["W", ["w", "와트"]],
  ["kJ", ["kj", "킬로줄"]],
  ["J", ["j", "줄", "주울"]],
  ["kWh", ["kwh", "킬로와트시"]],
  ["%", ["%", "퍼센트", "프로"]],
  ["배", ["배"]],
  ["개", ["개", "회"]],
  ["°C", ["°c", "℃", "섭씨도"]]
];

function compact(value) {
  return String(value ?? "").normalize("NFKC").replace(/[−–]/g, "-")
    .replace(/\s+/g, "").trim();
}

function unitOf(value) {
  const unit = compact(value).toLowerCase();
  if (!unit) return "";
  // Choices use both a Korean name and its symbol, e.g. 암페어(A).
  const labeled = unit.match(/^(.+)\(([^()]+)\)$/);
  if (labeled) {
    const name = unitOf(labeled[1]);
    return name !== null && name === unitOf(labeled[2]) ? name : null;
  }
  return UNIT_ALIASES.find(([, aliases]) => aliases.includes(unit))?.[0] ?? null;
}

function koreanInteger(value) {
  if (Object.hasOwn(NATIVE_NUMBERS, value)) return NATIVE_NUMBERS[value];
  if (/^\d+$/.test(value)) return Number(value);
  if (/^[영공일이삼사오육칠팔구]+$/.test(value)) {
    return Number([...value].map(char => DIGITS[char]).join(""));
  }
  if (!/^[일이삼사오육칠팔구십백천만]+$/.test(value)) return null;
  let total = 0, block = 0, digit = 0, previousPlace = Infinity;
  for (const char of value) {
    if (Object.hasOwn(DIGITS, char)) {
      if (digit) return null;
      digit = DIGITS[char];
      continue;
    }
    const place = { 십:10, 백:100, 천:1000, 만:10000 }[char];
    if (place === 10000) {
      if (total) return null;
      total = (block + digit || 1) * place;
      block = 0; digit = 0; previousPlace = Infinity;
    } else {
      if (place >= previousPlace) return null;
      block += (digit || 1) * place;
      digit = 0; previousPlace = place;
    }
  }
  return total + block + digit;
}

function numberOf(value) {
  let raw = compact(value).replace(/^마이너스/, "-").replace(/^플러스/, "+");
  const fraction = raw.match(/^(.+?)(?:분의)(.+)$/);
  if (fraction) {
    const denominator = numberOf(fraction[1]), numerator = numberOf(fraction[2]);
    return denominator !== null && denominator !== 0 && numerator !== null ? numerator / denominator : null;
  }
  const slash = raw.match(/^([^/]+)\/([^/]+)$/);
  if (slash) {
    const numerator = numberOf(slash[1]), denominator = numberOf(slash[2]);
    return numerator !== null && denominator !== null && denominator !== 0 ? numerator / denominator : null;
  }
  if (/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(raw)) {
    const result = Number(raw.replaceAll(",", ""));
    return Number.isFinite(result) ? result : null;
  }
  const sign = raw.startsWith("-") ? -1 : 1;
  raw = raw.replace(/^[+-]/, "");
  const decimal = raw.split("점");
  if (decimal.length > 2) return null;
  const whole = koreanInteger(decimal[0]);
  if (whole === null) return null;
  if (decimal.length === 1) return sign * whole;
  if (!/^[0-9영공일이삼사오육칠팔구]+$/.test(decimal[1])) return null;
  const places = [...decimal[1]].map(char => DIGITS[char] ?? char).join("");
  return sign * Number(`${whole}.${places}`);
}

function quantityOf(value) {
  const text = compact(value);
  const ph = text.match(/^pH(.+)$/i);
  if (ph) {
    const number = numberOf(ph[1]);
    return number === null ? null : { number, unit:"pH", numberText:ph[1] };
  }
  // Try a complete number first, then split only at a recognized unit. This
  // avoids treating a numeral mentioned in a concept question as an answer.
  const number = numberOf(text);
  if (number !== null) return { number, unit:"", numberText:text };
  for (let i = text.length - 1; i > 0; i -= 1) {
    const unit = unitOf(text.slice(i));
    if (unit === null || !unit) continue;
    const amount = numberOf(text.slice(0, i));
    if (amount !== null) return { number:amount, unit, numberText:text.slice(0, i) };
  }
  return null;
}

function answerPhrase(value) {
  let text = String(value ?? "").normalize("NFKC").trim().replace(/[.!?。！？]+$/g, "").trim();
  text = text.replace(/^(?:(?:제|내)\s*)?(?:정답|답안|답)(?:은|는|이|가)?\s*[:：]?\s*/, "");
  // Only complete, narrow answer confirmations count as submissions. Longer
  // questions such as '6.4 cm가 왜 맞나요?' retain the extra words and fail.
  text = text.replace(/(?:이|가)?\s*(?:맞습니까|맞나요|맞아요|맞니|맞죠|정답인가요|정답입니까|정답이죠|맞는\s*답인가요|인가요|입니까)$/, "").trim();
  text = text.replace(/(?:라고\s*생각합니다|라고\s*생각해요|입니다|이에요|예요|이요|요)$/, "").trim();
  return text;
}

function sameNumber(a, b) {
  return Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * null: dialogue/unsupported input; clarify: ambiguous submitted content;
 * answer: server-computable correct/incorrect, with a choice when one matches.
 * Physical-unit aliases are accepted, but different units are not silently
 * converted: conversion exercises explicitly require the displayed unit.
 */
export function resolveScienceContentAnswer(value, question) {
  if (!Array.isArray(question?.choices) || !/^[A-E]$/.test(question?.answer)) return null;
  const phrase = answerPhrase(value);
  if (!phrase || phrase.length > 1000) return null;
  const numeric = quantityOf(phrase);
  // Preserve A–E and 1–5 as the engine's existing choice-selection protocol.
  if (/^[A-E]$/i.test(compact(phrase))) return null;
  if (numeric && !numeric.unit && numeric.number >= 1 && numeric.number <= 5
      && Number.isInteger(numeric.number) && !/[+\-./점분]/.test(numeric.numberText)) return null;

  const exact = question.choices.map((choice, index) => compact(choice) === compact(phrase) ? index : -1).filter(index => index >= 0);
  if (exact.length > 1) return { kind:"clarify" };
  if (exact.length === 1 && !numeric) return { kind:"answer", correct:LABELS[exact[0]] === question.answer, choice:LABELS[exact[0]] };

  const quantities = question.choices.map(quantityOf);
  if (!numeric || !quantities.some(Boolean)) {
    // Unit-name questions accept their complete symbol or spoken Korean name.
    const submittedUnit = unitOf(phrase);
    if (!submittedUnit) return null;
    const matchedUnits = question.choices.map((choice, index) => unitOf(choice) === submittedUnit ? index : -1).filter(index => index >= 0);
    if (matchedUnits.length > 1) return { kind:"clarify" };
    if (matchedUnits.length === 1) return { kind:"answer", correct:LABELS[matchedUnits[0]] === question.answer, choice:LABELS[matchedUnits[0]] };
    return null;
  }

  let submittedUnit = numeric.unit;
  if (!submittedUnit) {
    const units = [...new Set(quantities.filter(Boolean).map(quantity => quantity.unit))];
    if (units.length !== 1) return { kind:"clarify" };
    submittedUnit = units[0];
  }
  const matches = quantities.map((quantity, index) => quantity && quantity.unit === submittedUnit
    && sameNumber(quantity.number, numeric.number) ? index : -1).filter(index => index >= 0);
  if (matches.length > 1) return { kind:"clarify" };
  if (matches.length === 1) return { kind:"answer", correct:LABELS[matches[0]] === question.answer, choice:LABELS[matches[0]] };
  return { kind:"answer", correct:false };
}
