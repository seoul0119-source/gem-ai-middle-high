// Representative stages, not a claim that every catalog course has received a
// live pedagogical audit. The live verifier creates all ten questions afresh.
export const boardSubjectCases=Object.freeze([
 {stage:'ko',courseId:'e3-math',language:'ko',topic:'곱셈의 뜻과 구구단: 같은 수의 묶음과 곱셈식 연결',question:'같은 수의 묶음을 곱셈식으로 나타내는 방법을 다른 예로 설명해 주세요.'},
 {stage:'ko',courseId:'e3-korean',language:'ko',topic:'짧은 글에서 중심 생각과 뒷받침 문장 찾기',question:'글의 중심 생각과 뒷받침 문장을 어떻게 구별하나요? 새로운 짧은 예로 설명해 주세요.'},
 {stage:'ko',courseId:'m2-history',language:'ko',topic:'조선의 건국과 세종 시대: 주요 사건의 순서와 문화 정책',question:'역사 사건의 시간 순서와 원인 결과를 구별하는 방법을 설명해 주세요.'},
 {stage:'exam',courseId:'ged-high-math',language:'ko',topic:'일차방정식: 양변에 같은 연산을 하여 미지수 구하기',question:'방정식에서 양변에 같은 수를 더하거나 빼도 되는 이유를 다른 예로 설명해 주세요.'},
 {stage:'international',courseId:'materials-en-3-0',language:'en',topic:'Understanding unit fractions as equal parts of one whole; denominators 2, 3, 4, 6 and 8',question:'Why must the parts be equal when we describe a unit fraction? Please use a new example.'},
 {stage:'international',courseId:'materials-fr-3-1',language:'fr',topic:'Les états de l’eau et les changements d’état : fusion, solidification, évaporation et condensation, sans expérience dangereuse',question:'Quelle est la différence entre la fusion et l’évaporation ? Explique avec un exemple simple.'}
]);

// Deterministic content below tests transfer/progress/authentication contracts.
// Its simulated review is never counted as live factual verification.
const text={
 ko:{title:'같은 묶음의 수 세기',prompt:i=>`상자 하나에 연필이 3자루씩 있습니다. 상자 ${i+2}개에 있는 연필은 모두 몇 자루인가요?`,hints:['한 묶음의 수와 묶음의 개수를 찾아보세요.','같은 수를 여러 번 더하는 방법을 떠올려 보세요.'],explanation:i=>`3을 ${i+2}번 더하면 ${3*(i+2)}입니다.`,scene:'같은 묶음을 곱셈으로 나타내기',lines:['한 묶음에 들어 있는 수를 확인합니다.','묶음의 수를 세어 곱셈식으로 나타냅니다.'],narration:'같은 수의 물건이 여러 묶음 있을 때에는 곱셈으로 전체 수를 나타낼 수 있습니다. 먼저 한 묶음에 몇 개가 있는지 살펴봅니다. 다음으로 같은 묶음이 몇 개 있는지 확인합니다. 한 묶음의 수를 묶음의 개수만큼 더하면 전체 수가 됩니다. 곱셈식은 이 덧셈을 짧게 나타낸 것입니다. 예를 들어 접시 하나에 과자가 두 개씩 있고 접시가 두 개라면 두 개와 두 개를 더합니다. 이때 두 개씩 두 묶음이라는 뜻을 먼저 이해하고 곱셈식을 쓰면 됩니다. 묶음마다 물건의 수가 같은지도 확인해 보세요.',answer:'같은 수를 여러 번 더하는 상황에서 한 묶음의 수와 묶음의 개수를 먼저 찾아보세요.'},
 en:{title:'Counting equal groups',prompt:i=>`There are 3 pencils in each box. How many pencils are in ${i+2} boxes?`,hints:['Find how many pencils are in one group.','Think about adding the same amount for each group.'],explanation:i=>`Adding 3 a total of ${i+2} times gives ${3*(i+2)}.`,scene:'Representing equal groups',lines:['Find the number in each group.','Count the equal groups before multiplying.'],narration:'When each group has the same number of objects, multiplication can help us describe the total. First check how many objects are in one group. Then count how many equal groups there are. Repeated addition and multiplication describe the same collection. For example, two plates with two biscuits on each plate contain two plus two biscuits. The multiplication expression records the number in each group and the number of groups. Make sure every group has the same size before using this method.',answer:'Find the size of one group and then count the equal groups. Multiplication records their repeated addition.'},
 fr:{title:'Compter des groupes égaux',prompt:i=>`Chaque boîte contient 3 crayons. Combien de crayons y a-t-il dans ${i+2} boîtes ?`,hints:['Cherche le nombre de crayons dans un groupe.','Pense à ajouter la même quantité pour chaque groupe.'],explanation:i=>`En ajoutant 3 exactement ${i+2} fois, on obtient ${3*(i+2)}.`,scene:'Représenter des groupes égaux',lines:['Repérer le nombre dans chaque groupe.','Compter les groupes égaux avant de multiplier.'],narration:'Lorsque chaque groupe contient le même nombre d’objets, la multiplication permet de représenter le total. On commence par observer combien d’objets se trouvent dans un groupe. Ensuite, on compte les groupes de même taille. L’addition répétée et la multiplication décrivent la même collection. Par exemple, deux assiettes contenant chacune deux biscuits représentent deux biscuits plus deux biscuits. Il faut toujours vérifier que les groupes ont bien la même taille avant de choisir cette méthode.',answer:'On cherche la taille d’un groupe, puis le nombre de groupes égaux. La multiplication représente cette addition répétée.'}
};
export function subjectMaterial(language='ko'){
 const t=text[language];return {title:t.title,questions:Array.from({length:10},(_,i)=>{const answerIndex=i%4,correct=(i+2)*3;return {prompt:t.prompt(i),choices:Array.from({length:4},(_,j)=>String(correct+((j-answerIndex+4)%4))),answerIndex,hints:[...t.hints],explanation:t.explanation(i)};})};
}
export function subjectScenes(language='ko'){
 const t=text[language];return Array.from({length:5},(_,i)=>({title:`${t.scene} ${i+1}`,lines:[...t.lines],narration:t.narration}));
}
export const subjectAnswer=language=>text[language].answer;

export function gedSubjectMaterial(){
 const tasks=[
  ['방정식 x + 4 = 10을 만족하는 x의 값은 얼마인가요?',6,'양변에서 4를 빼면 x = 6입니다.'],
  ['어떤 수에서 7을 뺐더니 2가 되었습니다. 처음 수를 구하세요.',9,'처음 수는 2 + 7 = 9입니다.'],
  ['한 변의 길이가 x인 정삼각형의 둘레가 36입니다. x는 얼마인가요?',12,'3x = 36이므로 x = 12입니다.'],
  ['일정한 속력으로 이동하는 자전거가 2시간 동안 30 km를 갔습니다. 속력은 몇 km/h인가요?',15,'속력은 거리 나누기 시간이므로 30 ÷ 2 = 15입니다.'],
  ['어떤 수를 3으로 나눈 값이 6입니다. 그 수를 구하세요.',18,'x ÷ 3 = 6이므로 x = 18입니다.'],
  ['연속된 두 자연수의 합이 43일 때 작은 수를 구하세요.',21,'x + (x + 1) = 43에서 2x = 42이므로 x = 21입니다.'],
  ['사탕을 같은 수씩 4명에게 나누어 주었더니 한 사람당 6개를 받았습니다. 사탕은 모두 몇 개인가요?',24,'전체 수를 x라 하면 x ÷ 4 = 6이므로 x = 24입니다.'],
  ['가로가 3이고 넓이가 81인 직사각형의 세로를 구하세요.',27,'넓이는 가로 곱하기 세로이므로 3x = 81에서 x = 27입니다.'],
  ['원래 가격에서 10을 할인했더니 지불할 금액이 20이 되었습니다. 원래 가격은 얼마인가요?',30,'x − 10 = 20의 양변에 10을 더하면 x = 30입니다.'],
  ['수직선에서 어떤 점이 오른쪽으로 7만큼 이동하여 40에 도착했습니다. 출발한 좌표를 구하세요.',33,'x + 7 = 40의 양변에서 7을 빼면 x = 33입니다.']
 ];
 return {title:'일차방정식과 생활 속 수량 관계',questions:tasks.map(([prompt,value,explanation],i)=>({prompt,choices:Array.from({length:4},(_,j)=>String(value+((j-i%4+4)%4))),answerIndex:i%4,hints:['구하려는 수를 문자로 나타내어 보세요.','문제의 관계를 식으로 쓰고 양변에 같은 연산을 해 보세요.'],explanation}))};
}
