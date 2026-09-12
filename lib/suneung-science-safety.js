export const GUARDED_SUNEUNG_SCIENCE_COURSE_ID = "suneung-2028-integrated-science";
export const SUNEUNG_2027_SCIENCE_COURSES = {
  "suneung-2027-physics-1": "물리학Ⅰ",
  "suneung-2027-physics-2": "물리학Ⅱ",
  "suneung-2027-chemistry-1": "화학Ⅰ",
  "suneung-2027-chemistry-2": "화학Ⅱ",
  "suneung-2027-biology-1": "생명과학Ⅰ",
  "suneung-2027-biology-2": "생명과학Ⅱ",
  "suneung-2027-earth-science-1": "지구과학Ⅰ",
  "suneung-2027-earth-science-2": "지구과학Ⅱ"
};
export const GUARDED_SUNEUNG_SCIENCE_COURSE_IDS = new Set([
  GUARDED_SUNEUNG_SCIENCE_COURSE_ID,
  ...Object.keys(SUNEUNG_2027_SCIENCE_COURSES)
]);

const EXCLUDED_FRAGMENTS = [
  "진화", "다윈", "darwin", "자연선택", "naturalselection",
  "선택압", "selectionpressure", "차등생존", "차등번식", "differentialsurvival", "differentialreproduction",
  "적자생존", "survivalofthefittest", "공통조상", "공동조상", "공통계통", "공통기원",
  "같은조상", "동일한조상", "하나의조상", "조상을공유", "조상에서갈라", "조상으로부터분화",
  "commonancestor", "commondescent", "sharedancestry", "sharedancestor", "sameancestor",
  "shareanancestor", "descendfromoneancestor", "descendedfromoneancestor", "descentwithmodification",
  "종분화", "종의분화", "speciation", "계통수", "계통발생", "phylogeny", "phylogenetic",
  "원시생명", "primordiallife", "화학진화", "chemicalevolution", "biologicalevolution",
  "humanevolution", "organicevolution", "molecularevolution", "stellarevolution", "생명기원", "생명의기원",
  "originoflife", "자연발생", "abiogenesis", "유인원", "apeancestor", "호미닌", "hominin", "hominid",
  "유전적변이", "돌연변이", "생물적응", "생물의적응", "biologicaladaptation",
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
  /(?:산불|화재|불길|불)(?:을|를|이|가)?진화(?:한다|합니다|하였다|했다|하고|하며|하면|하는|한뒤|한후|하려|하기|해야|해주세요|시킨다|시키다|시켰다|시키는|되었다|됐다|중)/g,
  /(?:산불|화재|불길|불)진화(?:작업|활동|훈련|장비|대원|요원|헬기|과정|방법)/g,
  /(?:산불|화재|불길|불)(?:을|를)?진화$/g
];

// English is checked as a word (while still tolerating punctuation inserted
// between letters), so ordinary words such as "revolutionary" do not trip a
// compact-substring match. Micro-/macro-/co-evolution and evolve variants are
// still excluded.
const ENGLISH_EVOLUTION_PATTERNS = [
  /(?:^|[^a-z0-9])(?:micro[^a-z0-9]*|macro[^a-z0-9]*|co[^a-z0-9]*)?e[^a-z0-9]*v[^a-z0-9]*o[^a-z0-9]*l[^a-z0-9]*u[^a-z0-9]*t[^a-z0-9]*i[^a-z0-9]*o[^a-z0-9]*n(?:ary|arily|al|ism|ists?|s)?(?=$|[^a-z0-9])/,
  /(?:^|[^a-z0-9])(?:micro[^a-z0-9]*|macro[^a-z0-9]*|co[^a-z0-9]*)?e[^a-z0-9]*v[^a-z0-9]*o[^a-z0-9]*l[^a-z0-9]*u[^a-z0-9]*t[^a-z0-9]*i[^a-z0-9]*o[^a-z0-9]*n(?:ary)?(?:adaptation|biology|theory|process|mechanism)(?=$|[^a-z0-9])/,
  /(?:^|[^a-z0-9])(?:micro[^a-z0-9]*|macro[^a-z0-9]*|co[^a-z0-9]*)?e[^a-z0-9]*v[^a-z0-9]*o[^a-z0-9]*l[^a-z0-9]*v[^a-z0-9]*e(?:d|s|ing)?(?=$|[^a-z0-9])/
];

const ENGLISH_LIFE_ORIGIN_PATTERNS = [
  /(?:^|[^a-z])(?:life|living\s+organisms?)[^.!?]{0,60}(?:arose|emerged|formed|originated)[^.!?]{0,40}\bfrom\b[^.!?]{0,30}(?:non[\s-]*living|inorganic|inanimate)(?=$|[^a-z])/,
  /(?:^|[^a-z])(?:non[\s-]*living|inorganic|inanimate)[^.!?]{0,60}(?:gave\s+rise\s+to|produced|became)[^.!?]{0,30}(?:life|living\s+organisms?)(?=$|[^a-z])/
];

const EXCLUDED_SEMANTIC_RULES = [
  [
    ["형질", "특징", "유전자", "대립유전자", "trait", "allele", "genetictrait", "genevariant"],
    ["유리한", "알맞은", "적합한", "잘적응한", "advantageous", "beneficial", "favorable", "betteradapted"],
    ["세대를거쳐", "세대가지날수록", "여러세대", "다음세대", "후대", "후손", "자손", "대를이어", "overgenerations", "acrossgenerations", "successivegenerations", "offspring"],
    ["퍼진", "퍼짐", "퍼져", "퍼뜨", "확산", "증가", "늘어나", "많아진", "우세해진", "빈도가높", "축적", "남긴", "남겨", "spread", "increaseinfrequency", "riseinfrequency", "becomemorecommon", "proliferat"]
  ],
  [
    ["개체", "생물", "organism", "individual"],
    ["번식성공", "생존에유리", "번식에유리", "reproductivesuccess", "survivaladvantage"],
    ["더많은자손", "자손을더많", "moreoffspring", "moredescendants"]
  ],
  [
    ["대립유전자", "유전자풀", "allele", "genepool"],
    ["빈도", "frequenc"],
    ["세대", "generation"],
    ["변화", "변한", "바뀌", "증가", "감소", "change", "shift", "increase", "decrease"]
  ],
  [
    ["환경", "environment"],
    ["형질", "특징", "유전되는", "유전가능", "trait", "characteristic", "heritable", "geneticvariant"],
    ["선별", "골라", "걸러", "도태", "더잘살아남", "favor", "filter", "select", "survivebetter"]
  ],
  [
    ["종", "생물", "생명체", "species", "organism", "lifeform", "livingthing"],
    ["조상", "선조", "ancestor", "ancestry", "ancestral"],
    ["공유", "같은", "동일", "갈라", "비롯", "share", "descend", "diverg", "branch"]
  ],
  [
    ["생명", "생명체"],
    ["무생물", "무기물", "비생명"],
    ["생겨", "발생", "출현", "만들어"]
  ],
  [
    ["우주", "universe", "cosmos"],
    ["팽창", "expansion", "expand"],
    ["한점", "특이점", "처음", "초기", "시작", "singlepoint", "singularity", "begin"]
  ],
  [
    ["지구", "earth"],
    ["형성", "나이", "formed", "age"],
    ["억년", "백만년", "천만년", "millionyear", "billionyear"]
  ],
  [
    ["개체군", "생물집단", "population"],
    ["유전", "형질", "특징", "genetic", "trait", "characteristic"],
    ["세대", "오랜시간", "generation", "overtime"],
    ["변화", "변한", "달라", "바뀌", "change", "differ", "shift"]
  ],
  [
    ["개체", "생물", "종", "organism", "individual", "species"],
    ["유전되는", "유전가능", "heritable", "inherited"],
    ["형질", "특징", "차이", "trait", "characteristic", "difference", "variant"],
    ["더많은자손", "자손을더많", "더많은새끼", "새끼를더많", "moreoffspring", "moredescendants", "reproducemore"]
  ]
];

function normalizeScienceText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase();
}

function compactScienceText(value) {
  return normalizeScienceText(value).replace(/[^a-z0-9가-힣]/g, "");
}

function removeAllowedAmbiguousUses(compact) {
  return ALLOWED_AMBIGUOUS_USES.reduce((text, pattern) => text.replace(pattern, ""), compact);
}

function matchesExcludedSemanticRule(compact) {
  return EXCLUDED_SEMANTIC_RULES.some((rule) =>
    rule.every((alternatives) => alternatives.some((fragment) => compact.includes(fragment)))
  );
}

function matchesEnglishEvolutionWord(value) {
  const normalized = normalizeScienceText(value);
  return ENGLISH_EVOLUTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function matchesEnglishLifeOriginClaim(value) {
  const normalized = normalizeScienceText(value);
  return ENGLISH_LIFE_ORIGIN_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function containsExcludedSuneungScienceContent(value) {
  const compact = removeAllowedAmbiguousUses(compactScienceText(value));
  return Boolean(compact) && (
    matchesEnglishEvolutionWord(value) ||
    matchesEnglishLifeOriginClaim(value) ||
    EXCLUDED_FRAGMENTS.some((fragment) => compact.includes(fragment)) ||
    matchesExcludedSemanticRule(compact)
  );
}

export function isGuardedSuneungScienceCourse(courseId) {
  return GUARDED_SUNEUNG_SCIENCE_COURSE_IDS.has(String(courseId || ""));
}

export const SAFE_SCIENCE_REDIRECT = "이 교실에서는 해당 주제를 다루지 않습니다. 허용된 과학 학습으로 돌아가겠습니다. 현재 문제가 보이면 그 문제의 답을 입력하고, 아직 시작 전이면 ‘시작’이라고 입력해 주세요.";
