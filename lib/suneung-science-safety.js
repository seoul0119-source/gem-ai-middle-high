export const GUARDED_SUNEUNG_SCIENCE_COURSE_ID = "suneung-2028-integrated-science";

const EXCLUDED_FRAGMENTS = [
  "진화", "다윈", "darwin", "evolution", "자연선택", "naturalselection",
  "선택압", "selectionpressure", "차등생존", "차등번식", "differentialsurvival", "differentialreproduction",
  "적자생존", "survivalofthefittest", "공통조상", "공동조상", "공통계통", "공통기원",
  "같은조상", "동일한조상", "하나의조상", "조상을공유", "조상에서갈라", "조상으로부터분화",
  "commonancestor", "commondescent", "sharedancestry", "sharedancestor", "sameancestor",
  "shareanancestor", "descendfromoneancestor", "descendedfromoneancestor", "descentwithmodification",
  "종분화", "종의분화", "speciation", "계통수", "계통발생", "phylogeny", "phylogenetic",
  "원시생명", "primordiallife", "화학진화", "chemicalevolution", "생명기원", "생명의기원",
  "originoflife", "자연발생", "abiogenesis", "유인원", "apeancestor", "호미닌", "hominin", "hominid",
  "유전적변이", "돌연변이", "생물적응", "생물의적응", "biologicaladaptation", "evolutionaryadaptation",
  "화석", "fossil", "지질시대", "geologictime",
  "대멸종", "massextinction",
  "빅뱅", "bigbang", "우주기원", "우주의기원", "대폭발우주론",
  "originofuniverse", "우주초기", "별의진화", "지구나이", "ageofearth", "earthsage",
  "수십억년", "수백만년", "billionsofyears", "billionyears", "millionsofyears", "millionyears"
];

// These words have ordinary, curriculum-safe meanings in the compounds below.
// Remove only complete safe compounds before checking the otherwise excluded
// ambiguous words. Unsafe text elsewhere in the same message remains visible
// to the guard (for example, "화석 연료와 생물 진화").
const ALLOWED_AMBIGUOUS_USES = [
  /화석연료/g,
  /fossilfuels?/g,
  /(?:산불|화재|불길)진화(?:작업|활동|훈련|장비|대원|요원|헬기|과정|방법)/g,
  /(?:산불|화재|불길)진화$/g
];

const EVOLUTIONARY_PROPAGATION_RULES = [
  [
    ["형질", "특징", "유전자", "대립유전자", "trait", "allele", "genetictrait", "genevariant"],
    ["유리한", "알맞은", "적합한", "잘적응한", "advantageous", "beneficial", "favorable", "betteradapted"],
    ["세대를거쳐", "세대가지날수록", "여러세대", "다음세대", "후대", "자손", "overgenerations", "acrossgenerations", "successivegenerations", "offspring"],
    ["퍼진", "퍼져", "퍼뜨", "확산", "증가", "늘어나", "많아진", "우세해진", "빈도가높", "축적", "남긴", "남겨", "spread", "increaseinfrequency", "becomemorecommon", "proliferat"]
  ],
  [
    ["개체", "생물", "organism", "individual"],
    ["번식성공", "생존에유리", "번식에유리", "reproductivesuccess", "survivaladvantage"],
    ["더많은자손", "자손을더많", "moreoffspring", "moredescendants"]
  ]
];

function compactScienceText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
}

function removeAllowedAmbiguousUses(compact) {
  return ALLOWED_AMBIGUOUS_USES.reduce((text, pattern) => text.replace(pattern, ""), compact);
}

function matchesEvolutionaryPropagation(compact) {
  return EVOLUTIONARY_PROPAGATION_RULES.some((rule) =>
    rule.every((alternatives) => alternatives.some((fragment) => compact.includes(fragment)))
  );
}

export function containsExcludedSuneungScienceContent(value) {
  const compact = removeAllowedAmbiguousUses(compactScienceText(value));
  return Boolean(compact) && (
    EXCLUDED_FRAGMENTS.some((fragment) => compact.includes(fragment)) ||
    matchesEvolutionaryPropagation(compact)
  );
}

export function isGuardedSuneungScienceCourse(courseId) {
  return String(courseId || "") === GUARDED_SUNEUNG_SCIENCE_COURSE_ID;
}

export const SAFE_SCIENCE_REDIRECT = "이 교실에서는 해당 주제를 다루지 않습니다. 허용된 통합과학 학습으로 돌아가겠습니다. 현재 문제가 보이면 그 문제의 답을 입력하고, 아직 시작 전이면 ‘시작’이라고 입력해 주세요.";
