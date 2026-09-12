import { SCIENCE_CONCEPTS } from "./suneung-science-concepts.js";
import { containsExcludedSuneungScienceContent } from "./suneung-science-safety.js";

const MODES = { explain: "개념 설명", simple: "쉬운 설명", example: "개념 예시" };
const BY_TITLE = new Map(SCIENCE_CONCEPTS.map(concept => [concept.title, concept]));
const RETURN_TO_QUESTION = "현재 문제와 도전 횟수는 그대로입니다. 더 궁금한 점을 질문하거나 준비되면 답을 말해 주세요.";
const compact = text => String(text || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();

// Help scripts contain only reviewed content. Neither user text nor a solved
// question's answer/explanation is interpolated into a concept response.
function conceptBody(concepts, mode) {
  const content = concepts.map(concept => {
    const detail = mode === "example" ? concept.example
      : mode === "simple" ? `${concept.simpleExplanation || concept.explanation}\n${concept.example}`
        : concept.explanation;
    return concepts.length > 1 ? `${concept.title}: ${detail}` : detail;
  }).join("\n\n");
  return `${concepts.map(concept => concept.title).join(" / ")}\n${content}\n\n${RETURN_TO_QUESTION}`;
}

export function renderScienceConceptHelp(question, attempt, concepts, mode = "explain") {
  return `문제 ${question.number}/10 · ${MODES[mode]} · 도전 ${attempt}/3\n${conceptBody(concepts, mode)}\n\n답: (________)`;
}

export function readScienceConceptHelp(value) {
  const text = String(value || "");
  const match = text.match(/^문제 (10|[1-9])\/10 · (개념 설명|쉬운 설명|개념 예시) · 도전 ([1-3])\/3\n([^\n]+)\n/);
  if (!match) return null;
  const mode = Object.keys(MODES).find(key => MODES[key] === match[2]);
  const concepts = match[4].split(" / ").map(title => BY_TITLE.get(title));
  if (!concepts.length || concepts.length > 2 || concepts.some(concept => !concept) || new Set(concepts).size !== concepts.length) return null;
  const question = { number: Number(match[1]) };
  if (renderScienceConceptHelp(question, Number(match[3]), concepts, mode) !== text) return null;
  return { question: question.number, attempt: Number(match[3]), concepts, mode };
}

const APPROVED_HELP_SPEECH = new Set();
for (const first of SCIENCE_CONCEPTS) {
  for (const mode of Object.keys(MODES)) {
    APPROVED_HELP_SPEECH.add(conceptBody([first], mode));
    for (const second of SCIENCE_CONCEPTS) {
      if (first !== second) APPROVED_HELP_SPEECH.add(conceptBody([first, second], mode));
    }
  }
  if (containsExcludedSuneungScienceContent([first.title, ...first.aliases, first.explanation, first.simpleExplanation || "", first.example].join("\n"))) {
    throw new Error(`Unapproved science concept: ${first.id}`);
  }
}

export function isApprovedScienceConceptSpeech(text) {
  return APPROVED_HELP_SPEECH.has(text);
}

export function namedScienceConcepts(text, question = null) {
  const original = String(text || "").normalize("NFKC").toLowerCase();
  const positions = [];
  let source = "";
  for (let i = 0; i < original.length; i += 1) {
    if (/\s/.test(original[i])) continue;
    positions.push(i);
    source += original[i];
  }
  const matches = [];
  for (const concept of SCIENCE_CONCEPTS) {
    for (const alias of [concept.title, ...concept.aliases]) {
      const token = compact(alias);
      let offset = 0;
      while (offset < source.length) {
        const index = source.indexOf(token, offset);
        if (index < 0) break;
        offset = index + token.length;
        if (token.length === 1 && /[가-힣]/.test(token)
          && (/[가-힣]/.test(original[positions[index] - 1] || "") || !/^(?:[은는이가을를과와에의도]|$|[^가-힣])/.test(original.slice(positions[index] + 1)))) continue;
        if (token === "줄" && /^(?:\s*수|래|까|게)/.test(original.slice(positions[index] + 1))) continue;
        if (/^[a-z]+$/.test(token) && (/[a-z]/.test(source[index - 1] || "") || /[a-z]/.test(source[index + token.length] || ""))) continue;
        matches.push({ concept, index, length: token.length, topicMatch: question && concept.topics.includes(question.topic) ? 1 : 0, exactTitle: token === compact(concept.title) ? 1 : 0 });
      }
    }
  }
  // Prefer “양이온” over its substring “이온”, but keep two separately named
  // concepts for questions such as “이온 결합과 공유 결합은 어떻게 달라요?”.
  const selected = [];
  for (const item of matches.sort((a, b) => b.length - a.length || b.topicMatch - a.topicMatch || b.exactTitle - a.exactTitle || a.index - b.index)) {
    if (selected.some(old => old.concept === item.concept || item.index < old.index + old.length && old.index < item.index + item.length)) continue;
    selected.push(item);
    if (selected.length === 2) break;
  }
  return selected.sort((a, b) => a.index - b.index).map(item => item.concept);
}

export function relatedScienceConcepts(question) {
  const inStem = namedScienceConcepts(question.stem, question).filter(concept => concept.topics.includes(question.topic));
  const inTopic = SCIENCE_CONCEPTS.filter(concept => concept.topics.includes(question.topic));
  return [...new Set([...inStem, ...inTopic])].slice(0, 3);
}

export function resolveScienceHelp(text, question, messages) {
  const source = String(text || "").normalize("NFKC").trim();
  const short = compact(source);
  const helpLanguage = /무엇|뭐|뭔|뜻|의미|설명|알려|가르쳐|궁금|질문|왜|어떻게|이해|차이|다르|달라|예시|예를|쉽게|풀어서|자세히|모르겠|모르는데|모르겠는데|맞나요|맞습니까|정답인가/.test(short);
  const named = namedScienceConcepts(source, question);
  const bareConcept = named.some(concept => [concept.title, ...concept.aliases].some(alias => compact(alias) === short.replace(/[?!.。]+$/g, "")));
  if (!helpLanguage && !bareConcept) return null;
  const mode = /예시|예를/.test(short) ? "example" : /쉽게|풀어서|자세히|차근차근|이해가안/.test(short) ? "simple" : "explain";
  if (named.length) return { kind: "concept", concepts: named, mode };
  if (/상관없는|관련없는|임의의/.test(short)) return { kind: "clarify" };
  if (/힌트(?:말고|가아니라|대신)/.test(short)) {
    for (const message of [...messages].reverse()) {
      const previous = message.role === "assistant" ? readScienceConceptHelp(message.content) : null;
      if (previous?.question === question.number) return { kind: "concept", concepts: previous.concepts, mode: "simple" };
    }
    return { kind: "question" };
  }

  const choiceQuestion = /(?:^|[\s,])(?:보기\s*)?(?:[A-E](?:\s*(?:번|보기|선택지))?|[1-5]\s*번|(?:에이|비|씨|디|이)\s*(?:번|보기|선택지))(?=[\s?!.]|가|이|는|은|의|를|을)/i.test(source);
  if (choiceQuestion || /(?:이|현재)?문제|풀이|계산|정답인가|맞나요|맞습니까/.test(short)) return { kind: "question" };

  const followup = /^(?:그게|그건|그것|그말|이게|이건|이것|그럼|그러면|좀|조금|다시|더|쉽게|예시|예를|자세히|한번|한번더|이해가안|잘이해|잘모르|무슨뜻|뭔말|왜|어떻게)/.test(short);
  if (followup) {
    for (const message of [...messages].reverse()) {
      if (message.role !== "assistant") continue;
      const previous = readScienceConceptHelp(message.content);
      if (previous?.question === question.number) return { kind: "concept", concepts: previous.concepts, mode };
    }
    const related = relatedScienceConcepts(question);
    if (related.length) return { kind: "concept", concepts: related.slice(0, 1), mode };
  }
  return { kind: "clarify" };
}
