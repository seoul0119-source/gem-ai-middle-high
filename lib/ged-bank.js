import {createHash} from 'node:crypto';
// Original pilot exercises, not copied official examination questions.
// The first option in these source rows is the reviewed answer; all options
// and the question order are shuffled deterministically for each course run.
const q = (topic, prompt, choices, hint, explanation) => ({topic,prompt,choices,hint,explanation});
const korean = [
q('중심 내용','다음 글의 중심 내용은?\n도서관은 책을 빌리는 곳이지만, 이웃이 함께 배우는 공간이기도 하다. 주민들은 독서 모임에서 생각을 나누고 강연에서 새로운 지식을 얻는다.', ['도서관은 책 대출뿐 아니라 공동 학습의 공간이다.','도서관에서는 책을 빌릴 수 없다.','도서관은 강연만 여는 곳이다.','독서 모임에서는 대화가 금지된다.'],'첫 문장과 뒤의 두 사례가 공통으로 말하는 역할을 살펴보세요.','책 대출과 독서 모임·강연을 함께 설명하므로 공동 학습의 공간이라는 내용이 중심입니다.'),
q('내용 일치','다음 안내와 일치하는 것은?\n토요일 글쓰기 모임은 오후 2시에 시작한다. 참가비는 무료이며, 참석자는 필기구를 가져와야 한다.', ['참석자는 필기구를 준비해야 한다.','모임은 일요일에 열린다.','오전 2시에 시작한다.','참가비를 내야 한다.'],'요일, 시각, 비용, 준비물을 안내문과 하나씩 대조하세요.','안내문에서 참석자가 필기구를 가져와야 한다고 명시했습니다.'),
q('접속 표현','빈칸에 알맞은 말은?\n비가 많이 내렸다. (     ) 야외 행사를 실내에서 진행했다.', ['그래서','그러나','반면에','예를 들어'],'앞 문장이 뒤 행동의 이유인지, 반대 내용인지 생각하세요.','비가 원인이 되어 장소를 바꾸었으므로 원인과 결과를 잇는 ‘그래서’가 알맞습니다.'),
q('직유법','“호수는 거울처럼 맑았다.”에 사용된 표현 방법은?', ['직유법','설의법','반어법','열거법'],'두 대상을 연결하는 ‘처럼’에 주목하세요.','‘처럼’을 사용해 호수를 거울에 직접 빗댄 직유법입니다.'),
q('의인법','사람이 아닌 대상을 사람처럼 표현한 문장은?', ['바람이 내 귀에 속삭였다.','기차가 역에 도착했다.','물은 낮은 곳으로 흘렀다.','책상 위에 공책이 있다.'],'대상이 사람처럼 말하거나 느끼는 문장을 찾아보세요.','바람에 사람의 행동인 ‘속삭이다’를 부여하여 의인화했습니다.'),
q('문장 성분','“민수가 사과를 먹었다.”에서 ‘사과를’의 문장 성분은?', ['목적어','주어','서술어','독립어'],'누가 행동하는지, 무엇을 대상으로 행동하는지 구분하세요.','‘사과를’은 먹는 행위의 대상이며 목적격 조사 ‘를’이 붙은 목적어입니다.'),
q('높임 표현','선생님께 직접 하는 말로 가장 적절한 것은?', ['선생님, 식사하셨어요?','선생님, 밥 먹었니?','선생님, 밥 먹어라.','선생님, 밥 먹었냐?'],'듣는 사람에 대한 높임과 문장 끝 표현을 확인하세요.','‘식사하셨어요?’는 주체 높임 ‘-시-’와 상대 높임 ‘-어요’를 사용한 표현입니다.'),
q('근거 찾기','“학교에 자전거 보관대를 늘려야 한다.”라는 주장에 가장 직접적인 근거는?', ['등교 때 기존 보관대가 가득 차 자전거를 세우기 어렵다.','우리 학교 급식은 맛있다.','도서관에 새 책이 들어왔다.','교실의 시계가 정확하다.'],'주장이 해결하려는 문제와 직접 관련된 사실을 고르세요.','기존 보관 공간이 부족하다는 사실이 보관대를 늘리자는 주장을 뒷받침합니다.'),
q('사실과 의견','객관적으로 확인할 수 있는 사실에 해당하는 문장은?', ['이 책은 모두 120쪽이다.','이 책은 세상에서 가장 재미있다.','이 책의 표지는 정말 아름답다.','모든 사람이 이 책을 좋아할 것이다.'],'측정하거나 관찰해 확인할 수 있는 내용인지 살펴보세요.','쪽수는 직접 세어 확인할 수 있습니다. 나머지는 평가나 예측입니다.'),
q('퇴고','“오랜 기간 동안 연습했다.”를 중복 표현 없이 고친 문장은?', ['오랜 기간 연습했다.','오랜 기간 동안 내내 연습했다.','긴 오랜 기간 동안 연습했다.','기간 동안 동안 연습했다.'],'시간의 길이를 나타내는 표현이 겹치는지 보세요.','‘기간’과 ‘동안’의 의미가 겹치므로 ‘동안’을 빼면 간결해집니다.'),
q('화법','친구와 의견이 다를 때 토의 태도로 가장 적절한 것은?', ['친구의 근거를 듣고 내 의견의 이유를 설명한다.','친구의 말을 끝까지 듣지 않는다.','목소리가 크면 옳다고 주장한다.','관련 없는 소문으로 친구를 비난한다.'],'사람에 대한 비난과 의견에 대한 검토를 구분하세요.','상대의 근거를 듣고 자신의 이유를 제시하는 태도가 합리적인 토의에 적합합니다.'),
q('시점','“나는 문을 열었다. 마당에 선 동생을 보자 반가운 마음이 들었다.”의 서술자는?', ['이야기 속 인물인 ‘나’','이야기 밖에서 모든 인물의 속마음을 아는 서술자','대사만 전달하는 서술자','독자 자신'],'‘나는’이 누구의 행동과 감정을 전하는지 보세요.','이야기 속 ‘나’가 자신의 행동과 감정을 말하는 1인칭 서술입니다.')
];
const english = [
q('문법 · 현재형','빈칸에 알맞은 말은?\nMy brother _____ breakfast at seven every day.', ['eats','eat','eating','to eat'],'주어의 수와 every day가 나타내는 시제를 살펴보세요.','주어 My brother는 3인칭 단수이고 매일의 습관이므로 현재형 eats를 씁니다.'),
q('문법 · 과거형','빈칸에 알맞은 말은?\nWe _____ the museum yesterday.', ['visited','visit','visits','visiting'],'yesterday가 나타내는 시간을 생각해 보세요.','yesterday는 과거이므로 visit의 과거형 visited가 알맞습니다.'),
q('문법 · 조동사','빈칸에 알맞은 말은?\nShe can _____ very well.', ['swim','swims','swam','swimming'],'조동사 뒤 동사의 형태를 떠올려 보세요.','조동사 can 다음에는 동사원형 swim이 옵니다.'),
q('문법 · 비교급','빈칸에 알맞은 말은?\nThis bag is _____ than that one.', ['lighter','light','lightest','most light'],'than 앞에서 두 대상을 어떻게 비교하는지 생각하세요.','두 가방을 비교하므로 light의 비교급 lighter가 필요합니다.'),
q('어휘 · 문맥','밑줄 친 borrow의 뜻은?\nMay I borrow your pen? I will give it back after class.', ['빌리다','팔다','잃어버리다','고치다'],'뒤 문장의 give it back이 어떤 상황인지 살펴보세요.','수업 후 돌려주겠다고 했으므로 borrow는 ‘빌리다’입니다.'),
q('대화','빈칸에 가장 알맞은 응답은?\nA: Thank you for your help.\nB: _____', ["You're welcome.","I'm twelve.",'It is Monday.','It is under the desk.'],'상대가 질문을 하는지, 감사를 표현하는지 먼저 확인하세요.','감사에 대한 자연스러운 응답은 You’re welcome입니다.'),
q('독해 · 목적','다음 안내문의 목적은?\nThe library will close at 3 p.m. this Friday for repairs. It will open again on Saturday morning.', ['도서관 운영 시간 변경을 알리려고','새 사서를 모집하려고','책 구매를 권하려고','독서 모임에 초대하려고'],'안내문이 주로 전달하는 시간과 이유에 주목하세요.','금요일 조기 폐관과 토요일 재개관 시간을 알려 주는 안내입니다.'),
q('독해 · 내용 일치','다음 글과 일치하는 것은?\nJina walks to school on sunny days. When it rains, she takes the bus.', ['Jina takes the bus on rainy days.','Jina always rides a bike.','Jina never takes the bus.','Jina walks to school when it rains.'],'맑은 날과 비 오는 날의 이동 방법을 나누어 확인하세요.','When it rains, she takes the bus라고 했으므로 비 오는 날 버스를 탑니다.'),
q('독해 · 주제','다음 글의 주제로 가장 알맞은 것은?\nPlants need enough light and water to grow. If you keep a plant indoors, put it near a window and water it regularly.', ['How to care for indoor plants','How to build a window','Why people travel','Where to buy furniture'],'뒤 문장의 두 가지 조언이 무엇을 위한 것인지 생각하세요.','실내 식물에 빛과 물을 제공하는 관리 방법을 설명합니다.'),
q('문법 · 접속사','빈칸에 알맞은 말은?\nI stayed home _____ I had a cold.', ['because','but','or','although'],'감기에 걸린 것이 집에 머문 이유인지 반대 상황인지 살펴보세요.','이유를 나타내는 절을 이끄는 because가 알맞습니다.'),
q('문법 · 전치사','빈칸에 알맞은 말은?\nThe meeting starts _____ nine o’clock.', ['at','on','in','to'],'요일, 달, 정확한 시각에 쓰는 전치사를 구분하세요.','정확한 시각 nine o’clock 앞에는 at을 씁니다.'),
q('독해 · 추론','다음 글에서 알 수 있는 것은?\nMinho wanted to buy a notebook for 3,000 won, but he had only 2,000 won. He decided to come back the next day.', ['Minho did not have enough money for the notebook.','The notebook was free.','Minho bought two notebooks.','The shop was closed all day.'],'가격과 가지고 있는 돈을 비교하세요.','가격은 3,000원인데 2,000원만 가지고 있어 돈이 부족했습니다.')
];
function math(n) {
 const a=2+n%7,b=3+n%5;
 return [
 q('다항식의 계산',`(x + ${a}) + (2x + ${b})를 간단히 하면?`,[`3x + ${a+b}`,`2x + ${a+b}`,`3x + ${a*b}`,`x + ${a+b}`],'문자 부분이 같은 항끼리, 상수끼리 모으세요.',`x + 2x = 3x이고 ${a} + ${b} = ${a+b}이므로 3x + ${a+b}입니다.`),
 q('일차방정식',`${a}x + ${b} = ${a*4+b}일 때 x의 값은?`,['4','3','5','6'],'양변에서 상수항을 뺀 다음 x의 계수로 나누세요.',`양변에서 ${b}을 빼면 ${a}x = ${a*4}, 따라서 x = 4입니다.`),
 q('인수분해',`x² + ${a+1}x + ${a}를 인수분해하면?`,[`(x + 1)(x + ${a})`,`(x - 1)(x - ${a})`,`(x + 1)(x - ${a})`,`(x - 1)(x + ${a})`],'곱해서 상수항, 더해서 x의 계수가 되는 두 수를 찾으세요.',`1과 ${a}의 곱은 ${a}, 합은 ${a+1}이므로 (x + 1)(x + ${a})입니다.`),
 q('이차방정식',`방정식 (x - ${a})(x + ${b}) = 0의 두 근은?`,[`${a}, -${b}`,`-${a}, ${b}`,`${a}, ${b}`,`-${a}, -${b}`],'두 식의 곱이 0이 되려면 적어도 하나가 0이어야 합니다.',`x - ${a} = 0 또는 x + ${b} = 0이므로 x = ${a} 또는 x = -${b}입니다.`),
 q('함숫값',`f(x) = ${a}x + ${b}일 때 f(2)는?`,[`${2*a+b}`,`${2*a+b+1}`,`${2*a+b-1}`,`${2*a+b+2}`],'함수식의 x 자리에 주어진 수를 대입하세요.',`f(2) = ${a} × 2 + ${b} = ${2*a+b}입니다.`),
 q('좌표와 거리',`두 점 (${a}, 1), (${a}, ${b+1}) 사이의 거리는?`,[`${b}`,`${b+1}`,`${b+2}`,`${b+3}`],'두 점의 x좌표가 같다는 점을 이용하세요.',`x좌표가 같으므로 y좌표의 차의 절댓값은 |${b+1} - 1| = ${b}입니다.`),
 q('집합',`A = {1, 2, 3}, B = {2, 3, ${a+4}}일 때 A ∩ B는?`,['{2, 3}','{1, 2, 3}','{1}',`{1, 2, 3, ${a+4}}`],'교집합은 두 집합에 모두 들어 있는 원소의 집합입니다.','A와 B에 공통으로 속하는 원소는 2와 3이므로 {2, 3}입니다.'),
 q('경우의 수',`셔츠 ${a}벌과 바지 ${b}벌 중에서 각각 한 벌씩 고르는 방법의 수는?`,[`${a*b}`,`${a*b+1}`,`${a*b-1}`,`${a*b+2}`],'각 셔츠마다 고를 수 있는 바지의 수를 생각하세요.',`곱의 법칙에 따라 ${a} × ${b} = ${a*b}가지입니다.`),
 q('일차부등식',`${a}x < ${a*b}의 해는?`,[`x < ${b}`,`x > ${b}`,`x < -${b}`,`x > -${b}`],'양변을 양수로 나눌 때 부등호 방향이 어떻게 되는지 생각하세요.',`양변을 양수 ${a}로 나누면 부등호 방향은 그대로이고 x < ${b}입니다.`),
 q('직선의 기울기',`직선 y = ${a}x + ${b}의 기울기는?`,[`${a}`,`${a+10}`,`${a+20}`,`${a+30}`],'y = mx + c에서 x의 계수와 상수항의 역할을 구분하세요.',`y = mx + c에서 기울기는 m이므로 ${a}입니다.`)
 ];
}
export function createGedQuestions(courseId, runId) {
 let seed=createHash('sha256').update(`ged-v1:${courseId}:${runId}`).digest().readUInt32LE();
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const shuffle=items=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
 const source=courseId==='ged-high-korean'?korean:courseId==='ged-high-english'?english:courseId==='ged-high-math'?math(seed):null;
 if(!source)throw Error('Unknown GED course');
 const questions=shuffle(source).slice(0,10).map(item=>{const choices=shuffle(item.choices);return {...item,choices,answer:'ABCD'[choices.indexOf(item.choices[0])]};});
 // Keep pre-v2 runs byte-for-byte stable so saved answers and resumed lessons
 // retain their original labels. Only newly issued v2 runs use balanced slots.
 if(!String(runId).startsWith('ged-v2:'))return questions;
 const order=shuffle([0,1,2,3]);
 const pool=[...order,...order,...order.slice(0,2)];
 let slots=pool;
 for(let attempt=0;attempt<64;attempt++){
  const candidate=shuffle(pool);
  if(!candidate.some((slot,i)=>i>1&&slot===candidate[i-1]&&slot===candidate[i-2])){slots=candidate;break;}
 }
 return questions.map((item,index)=>{
  const choices=[...item.choices],from='ABCD'.indexOf(item.answer),to=slots[index];
  [choices[from],choices[to]]=[choices[to],choices[from]];
  return {...item,choices,answer:'ABCD'[to]};
 });
}
