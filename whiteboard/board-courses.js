import {SCIENCE_TOPICS} from './science-topics.js';
import {BOARD_CATALOG} from './board-catalog.js';

export {BOARD_CATALOG} from './board-catalog.js';

// Original GEM concept outlines, not a promise of complete examination coverage.
// Chemistry facts checked against OpenStax Chemistry 2e §§2.3, 3.1, 4.1, 7.6:
// https://openstax.org/books/chemistry-2e/pages/2-3-atomic-structure-and-symbolism
// https://openstax.org/books/chemistry-2e/pages/3-1-formula-mass-and-the-mole-concept
// https://openstax.org/books/chemistry-2e/pages/4-1-writing-and-balancing-chemical-equations
// https://openstax.org/books/chemistry-2e/pages/7-6-molecular-structure-and-polarity
const chemistryTopics=[
 {
  id:'chemistry-mole',title:'몰과 입자 수·질량',description:'몰을 입자 수와 연결하고, 몰 질량으로 물질의 양을 계산합니다.',
  introGuide:'Introduce the mole as a counting unit for explicitly identified particles. Compare equal amounts of different substances without claiming equal masses. Give a useful conceptual explanation now; leave mass-conversion calculations to later scenes. Use 260–350 Korean characters.',
  practiceTopic:'화학Ⅰ 몰과 입자 수·질량: n=N/NA, n=m/M, 분자 수와 구성 원자 수 구분. 기체 부피·농도·반응량 계산 제외.',
  outline:['입자의 종류를 먼저 정하는 몰의 뜻','아보가드로 상수와 입자 수','몰 질량과 질량의 구분','분자 수와 구성 원자 수','단위가 맞는 변환 예와 정리'],
  facts:[
   '1 mol은 지정한 기본 입자 6.02214076 × 10²³개를 포함하는 물질의 양이다. 계산에서는 문제에 제시한 아보가드로 상수 근삿값을 사용한다.',
   'n = N/NA에서 n은 물질의 양(mol), N은 지정한 입자의 개수, NA는 아보가드로 상수(mol⁻¹)이다. 원자·분자·이온 중 무엇을 세는지 먼저 명시한다.',
   'n = m/M에서 m은 시료 질량(g), M은 몰 질량(g/mol)이다. 같은 몰 수라도 물질의 몰 질량이 다르면 질량은 다르다.',
   '분자식의 아래첨자는 분자 한 개를 구성하는 원자 수를 나타낸다. 물 H₂O 0.5 mol에는 물 분자 0.5 mol, 수소 원자 1 mol, 산소 원자 0.5 mol이 포함된다.',
   '이온 결정의 화학식은 이온의 가장 간단한 수의 비를 나타낸다. NaCl을 독립적인 NaCl 분자로 표현하지 않는다.',
   '물의 몰 질량을 18 g/mol로 주면 물 9 g은 0.5 mol이다. 이 계산에서 물 분자 수와 모든 원자 수를 혼동하지 않는다. 반응량·농도·기체 몰 부피는 이 짧은 단원의 범위가 아니다.'
  ]
 },
 {
  id:'chemistry-atom',title:'원자·동위원소·이온',description:'원자 번호와 질량수로 양성자·중성자·전자 수를 구별합니다.',
  introGuide:'Explain an atom as a nucleus containing protons and neutrons with electrons outside. Connect atomic number to proton number and a neutral atom to equal proton/electron counts. Do not introduce orbital diagrams or nuclear reactions. Use 260–350 Korean characters.',
  practiceTopic:'화학Ⅰ 원자 번호·질량수·동위원소·이온: 양성자·중성자·전자 수 비교. 오비탈·양자수·핵반응·평균 원자량 계산 제외.',
  outline:['원자 번호와 원자를 이루는 입자','질량수와 중성자 수','동위원소가 같은 원소인 이유','전자 출입과 이온의 전하','입자 수 비교 예와 정리'],
  facts:[
   '원자 번호 Z는 원자핵의 양성자 수이며 원소의 종류를 결정한다. 전기적으로 중성인 원자에서는 전자 수가 양성자 수와 같다.',
   '질량수 A는 양성자 수와 중성자 수의 합인 정수이다. 중성자 수는 A − Z이며 질량수와 평균 원자량은 같은 개념이 아니다.',
   '동위원소는 원자 번호가 같고 중성자 수가 다른 같은 원소의 원자들이다. 따라서 질량수가 다를 수 있지만 양성자 수는 같다.',
   '일반적인 이온 형성에서 바뀌는 것은 전자 수이다. 양이온은 중성 원자보다 전자가 적고 음이온은 더 많으며 원자핵의 양성자 수는 바뀌지 않는다.',
   '이온의 전하를 기본 전하의 정수 배로 나타내면 양성자 수에서 전자 수를 뺀 값이다. Na⁺에서 플러스는 양성자가 추가되었다는 뜻이 아니다.',
   '원자 번호 11, 질량수 23인 나트륨의 양성자는 11개, 중성자는 12개이다. 중성 원자의 전자는 11개이고 Na⁺의 전자는 10개이다. 이 단원은 오비탈·양자수·핵반응을 다루지 않는다.'
  ]
 },
 {
  id:'chemistry-bonding',title:'화학 결합과 분자의 극성',description:'결합의 극성과 분자의 모양을 함께 보며 분자 전체의 극성을 판단합니다.',
  introGuide:'Introduce ionic attraction and shared electron pairs as different bonding models. Distinguish a molecule from an ionic crystal; avoid saying every compound is molecular. Defer molecular polarity conclusions until shape and bond polarity are both explained. Use 260–350 Korean characters.',
  practiceTopic:'화학Ⅰ 이온 결합·공유 결합·결합 극성·분자 극성: H₂, HCl, 직선형 CO₂, 굽은형 H₂O. 주어진 구조로 판단, 혼성화·분자궤도 제외.',
  outline:['이온 결합과 공유 결합','전기 음성도와 결합의 극성','분자의 모양과 결합 쌍극자','이산화 탄소와 물의 극성 비교','결합과 분자를 구별하는 정리'],
  facts:[
   '이온 결합은 반대 전하를 가진 이온 사이의 정전기적 인력으로 설명한다. 이온 결정 NaCl은 독립된 NaCl 분자의 모임으로 설명하지 않는다.',
   '공유 결합은 원자 사이에 공유된 전자쌍으로 설명한다. 이 단원에서는 모든 결합을 완전한 이온 결합 또는 무극성 결합이라는 두 극단으로만 분류하지 않는다.',
   '전기 음성도가 다른 원자 사이의 공유 결합에서는 전자 분포가 치우칠 수 있다. 부분 전하 δ+·δ−는 완전한 이온 전하와 다르다.',
   '분자 전체의 극성은 결합 쌍극자의 벡터 합과 분자의 구조로 판단한다. 극성 결합을 가진다고 모든 분자가 극성인 것은 아니다.',
   '직선형 CO₂의 두 C=O 결합은 극성이지만 크기가 같고 방향이 반대인 결합 쌍극자가 상쇄되어 CO₂ 분자는 무극성이다.',
   '굽은형 H₂O에서는 두 O−H 결합의 쌍극자가 상쇄되지 않아 분자가 극성이다. H₂는 무극성, HCl은 극성 분자이다. 필요한 분자 모양은 말로 분명히 주고 없는 그림을 참조하지 않는다.'
  ]
 },
 {
  id:'chemistry-reaction',title:'화학 반응식과 양적 관계',description:'반응식의 계수를 원자 수 보존과 몰비로 연결합니다.',
  introGuide:'Explain chemical reactions as rearrangements of atoms and introduce balancing by conservation of each element. Distinguish coefficients from subscripts; never change a chemical formula to balance an equation. Defer quantitative mass calculations. Use 260–350 Korean characters.',
  practiceTopic:'화학Ⅰ 화학 반응식 계수·원자 수 보존·몰비·질량 변환. 완전 반응·다른 반응물 충분 조건, 한계 반응물·수율·산염기·산화환원 제외.',
  outline:['반응 전후 각 원자의 수 보존','계수와 아래첨자의 구별','균형 잡힌 반응식의 몰비','질량을 몰 수로 바꾸는 계산','충분한 반응물 조건과 정리'],
  facts:[
   '보통의 화학 반응에서 원자는 재배열되며 각 원소 원자의 수와 전체 전하가 보존된다. 닫힌 계에서 반응 전후 총질량이 보존된다.',
   '반응식의 균형은 화학식 앞의 계수로 맞춘다. 아래첨자를 바꾸면 다른 물질이 되므로 균형을 맞추기 위해 아래첨자를 바꾸지 않는다.',
   '2H₂ + O₂ → 2H₂O에서 계수비 2:1:2는 반응하거나 생성되는 분자 수의 비 또는 몰 수의 비이다. 질량비 2:1:2를 뜻하지 않는다.',
   '질량을 알 때는 주어진 몰 질량으로 나누어 몰 수를 구한 뒤 균형 잡힌 반응식의 계수비를 적용한다. 구한 몰 수에 생성물의 몰 질량을 곱하면 생성물의 질량이다.',
   '반응량 계산에서는 지정한 반응물이 완전히 반응하고 다른 반응물은 충분하다는 조건을 분명히 제시한다. 이 짧은 단원은 한계 반응물이나 수율 계산을 요구하지 않는다.',
   '수소의 몰 질량을 2 g/mol, 물의 몰 질량을 18 g/mol로 주고 수소 2 g이 충분한 산소와 완전히 반응하면 물 1 mol 즉 18 g이 생성된다. 이론 문제이며 실제 실험을 지시하지 않는다.'
  ]
 }
].map(topic=>Object.freeze({...topic,outline:Object.freeze(topic.outline),facts:Object.freeze(topic.facts)}));

const worksheetTopic=Object.freeze({
 id:'worksheet',title:'현재 10문제 개념 설명',description:'지금 교실에서 풀고 있는 같은 10문제에 필요한 개념을 설명합니다.',
 introGuide:'Read every canonical worksheet question first. Begin with a useful prerequisite concept for the first unsolved/current area and connect it to the supplied set. Do not greet at length, disclose choices or answers, replace problems, or introduce unrelated units. Use 260–350 Korean characters.',
 outline:Object.freeze(['현재 문제들에 필요한 첫 개념','공통 개념과 조건','풀이에 필요한 관계와 방법','다른 수치의 짧은 적용 예','문제로 돌아가기 위한 핵심 정리']),
 facts:Object.freeze(['선택한 과목과 실제 저장된 10문제의 개념·조건을 기준으로 설명한다.','문제·보기·정답·순서를 바꾸거나 새 문제로 대체하지 않는다.','저장된 문제의 정답이나 보기를 설명 대본에서 직접 공개하지 않고 다른 예로 개념을 가르친다.'])
});

const freezeWorksheetTopic=topic=>Object.freeze({...topic,outline:Object.freeze(topic.outline),facts:Object.freeze(topic.facts)});
export const WORKSHEET_TOPICS=Object.freeze({
 ko:worksheetTopic,
 en:freezeWorksheetTopic({
  id:'worksheet',title:'Concepts for the current 10 questions',description:'Learn the concepts needed for the same 10 questions in your classroom.',
  introGuide:'Read every canonical worksheet question first. Begin with a useful prerequisite concept for the first unsolved/current area and connect it to the supplied set. Do not greet at length, disclose choices or answers, replace problems, or introduce unrelated units. Explain in English appropriate for the course grade. Use 450–750 characters for the first spoken explanation.',
  outline:['The first concept needed for these questions','Shared concepts and conditions','Relationships and methods for solving','A short example with different details','Key ideas before returning to the questions'],
  facts:['Base the explanation on the selected course and the concepts and conditions in the actual saved 10 questions.','Do not change the questions, choices, answers or order, and do not replace them with new questions.','Teach with different examples without directly revealing the saved questions’ answers or answer choices in the lesson narration.']
 }),
 fr:freezeWorksheetTopic({
  id:'worksheet',title:'Notions pour les 10 questions en cours',description:'Découvrez les notions nécessaires aux mêmes 10 questions de votre classe.',
  introGuide:'Read every canonical worksheet question first. Begin with a useful prerequisite concept for the first unsolved/current area and connect it to the supplied set. Do not greet at length, disclose choices or answers, replace problems, or introduce unrelated units. Explain in French appropriate for the course grade. Use 450–750 characters for the first spoken explanation.',
  outline:['La première notion utile à ces questions','Notions communes et conditions','Relations et méthodes de résolution','Un court exemple avec des données différentes','Les idées clés avant de reprendre les questions'],
  facts:['Fonder les explications sur le cours choisi ainsi que sur les notions et les conditions des 10 questions réellement enregistrées.','Ne modifier ni les questions, ni les propositions, ni les réponses, ni leur ordre, et ne pas les remplacer par de nouvelles questions.','Enseigner avec des exemples différents sans révéler directement les réponses ou les propositions des questions enregistrées dans le commentaire de la leçon.']
 })
});

// Keep established fixed-unit entry points intact. All other trusted classrooms
// begin from an existing worksheet; they must not inherit another subject's units.
const legacyCourses=Object.freeze([
 Object.freeze({id:'h3-science',title:'한국어 고3 과학',language:'ko',grade:'고등학교 3학년',subject:'과학',worksheetOnly:false,topics:SCIENCE_TOPICS}),
 Object.freeze({id:'suneung-2027-chemistry-1',title:'2027학년도 수능 화학Ⅰ',language:'ko',grade:'2027학년도 수능 대비',subject:'화학Ⅰ',worksheetOnly:false,topics:Object.freeze(chemistryTopics)})
]);
const legacyIds=new Set(legacyCourses.map(course=>course.id));
const noFixedTopics=Object.freeze([]);
export const BOARD_COURSES=Object.freeze([
 ...legacyCourses,
 ...BOARD_CATALOG.filter(course=>!legacyIds.has(course.id)).map(course=>Object.freeze({...course,worksheetOnly:true,topics:noFixedTopics}))
]);
const coursesById=new Map(BOARD_COURSES.map(course=>[course.id,course]));
export const BOARD_COURSE_LABELS=Object.freeze(Object.fromEntries(BOARD_COURSES.map(course=>[course.id,course.title])));
export const getBoardCourse=(id='h3-science')=>coursesById.get(id)||null;
export const isBoardCourse=id=>typeof id==='string'&&!!getBoardCourse(id);
export const getBoardTopic=(courseId,topicId)=>{const course=typeof courseId==='string'?getBoardCourse(courseId):null;return course?(topicId==='worksheet'?WORKSHEET_TOPICS[course.language]:course.topics.find(topic=>topic.id===topicId)||null):null;};
