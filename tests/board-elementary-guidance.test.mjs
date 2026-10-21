// Transport-contract regressions with deterministic providers. These tests do
// not evaluate generated teaching quality, spoken audio, or a live AI model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_COURSES,getBoardCourse} from '../whiteboard/board-courses.js';
import {elementaryBoardGrade,elementaryBoardGuidance,elementaryWorksheetScaffolding} from '../lib/board-grade-guidance.js';
import {generateScienceIntro,generateScienceRemainder,generateSciencePractice,askScienceBoard,scienceLessonIssues} from '../lib/science-board-content.js';

const approved={valid:true,issues:[]};
const implicitPermission='ordinary arithmetic, straightforward algebraic rearrangements';
const marker=grade=>`GEM GRADE-ACCESSIBILITY CONTRACT — YEAR ${grade}:`;
const narration={
 ko:'먼저 눈앞에 있는 물건을 하나씩 살펴봐요. 연필을 셀 때는 연필 하나를 가리키며 수를 하나 말해요. 같은 연필을 다시 세지 않도록 왼쪽에서 오른쪽으로 차례로 세어 봐요. 물건을 센다는 것은 모두 몇 개인지 알아보는 일이에요. 물건이 여러 곳에 놓여 있으면 한곳씩 차례로 살펴보면 좋아요. 센 물건과 아직 세지 않은 물건을 나누어 생각해 보세요. 마지막으로 말한 수가 물건 전체의 수를 알려 줘요. 작은 물건으로 이 방법을 먼저 연습하면 다른 물건도 차례대로 셀 수 있어요. 서두르지 말고 하나씩 살펴봐요.',
 en:'First, look at the objects in front of you. When we count pencils, we point to one pencil and say one number. We move from left to right so that we do not count the same pencil again. Counting helps us find how many objects there are altogether. If the objects are in different places, look at one place at a time. Think about which objects you have counted and which you still need to count. The last number you say tells you how many objects there are. You can practise with a few familiar objects first. Take your time and look at each object.',
 fr:'Regarde d’abord les objets devant toi. Pour compter les crayons, montre un crayon et dis un nombre. Avance de gauche à droite pour ne pas compter deux fois le même crayon. Compter nous aide à savoir combien il y a d’objets en tout. Si les objets sont à plusieurs endroits, regarde un endroit à la fois. Pense aux objets déjà comptés et à ceux qui restent à compter. Le dernier nombre que tu dis indique combien il y a d’objets. Tu peux commencer avec quelques objets que tu connais bien. Prends ton temps et regarde chaque objet.',
};
const additions={ko:' 여기서 물건은 우리가 하나씩 세어 보는 것을 말해요.',en:' An object is one thing that we can point to and count.',fr:' Un objet est une chose que nous pouvons montrer et compter.'};
const scene=(language,number)=>({
 title:({ko:'하나씩 살펴보기',en:'Look at each object',fr:'Regarder chaque objet'}[language])+' '+number,
 lines:{ko:['물건을 하나씩 살펴봐요.','같은 물건을 두 번 세지 않아요.'],en:['Look at one object at a time.','Count each object only once.'],fr:['Regarde un objet à la fois.','Compte chaque objet une seule fois.']}[language],
 narration:narration[language],
});
const worksheet=()=>({title:'Counting familiar objects',questions:Array.from({length:10},(_,index)=>({
 prompt:`There are ${index+2} pencils on a table. How many pencils are there?`,
 choices:[String(index+2),String(index+3),String(index+4),String(index+5)],answerIndex:0,
 hints:['Point to each pencil once.','Say one number for each pencil.'],explanation:`There are ${index+2} pencils.`,
}))});
function provider(outputs){
 const requests=[];
 return {requests,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  requests.push(JSON.parse(options.body));assert.ok(outputs.length,'unexpected additional provider call');
  const value=outputs.shift();return Response.json({status:'completed',output_text:typeof value==='string'?value:JSON.stringify(value)});
 }};
}
const modelVariables=['OPENAI_REVIEW_MODEL','OPENAI_MODEL','OPENAI_SCIENCE_BOARD_MODEL','OPENAI_SCIENCE_BOARD_REMAINDER_MODEL','OPENAI_SCIENCE_BOARD_REMAINDER_REVIEW_MODEL','OPENAI_WHITEBOARD_MODEL'];
async function withDefaultModels(run){
 const before=new Map(modelVariables.map(name=>[name,process.env[name]]));
 try{for(const name of modelVariables)delete process.env[name];return await run();}
 finally{for(const [name,value]of before){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
}
const representativeCourses=['ko','en','fr'].flatMap(language=>Array.from({length:6},(_,index)=>({
 language,grade:index+1,id:language==='ko'?`e${index+1}-math`:`materials-${language}-${index+1}-0`,
})));

test('all 80 trusted first-to-sixth-year courses receive the correct level; higher, GED and advanced courses do not',()=>{
 const counts={ko:0,en:0,fr:0},pairs=new Set();
 for(const course of BOARD_COURSES){
  const expected=Number((course.language==='ko'?/^e([1-6])-[a-z]+$/:course.language==='en'?/^materials-en-([1-6])-\d+$/:/^materials-fr-([1-6])-\d+$/).exec(course.id)?.[1])||null;
  assert.equal(elementaryBoardGrade(course),expected,course.id);
  if(expected){
   counts[course.language]++;pairs.add(course.language+':'+expected);
   assert.ok(elementaryBoardGuidance(course).includes(marker(expected)),course.id);
   assert.match(elementaryWorksheetScaffolding(course),/explicitly explain necessary arithmetic/);
  }else{
   assert.equal(elementaryBoardGuidance(course),'',course.id);
   assert.equal(elementaryWorksheetScaffolding(course),'',course.id);
  }
 }
 assert.deepEqual(counts,{ko:32,en:24,fr:24});assert.equal(pairs.size,18);
 for(const sample of representativeCourses)assert.equal(elementaryBoardGrade(getBoardCourse(sample.id)),sample.grade,sample.id);
 for(const course of [null,{}, {language:'en',grade:'Grade 10'}, {language:'en',grade:'Grade 12'}, {language:'ko',grade:'초졸 검정고시 대비'}, {language:'fr',grade:'5e'}, {language:'fr',grade:'__proto__'}, {language:'de',grade:'Grade 1'}])assert.equal(elementaryBoardGrade(course),null);
 assert.equal(elementaryBoardGrade(getBoardCourse('materials-fr-6-1')),6,'the app sixth-year policy includes French 6e');
 const emphasis={1:'VERY, VERY EASY:',2:'VERY EASY:',3:'EASY:',4:'SOMEWHAT EASIER:',5:'A LITTLE EASIER:',6:'A LITTLE EASIER:'};
 for(let grade=1;grade<=6;grade++)assert.ok(elementaryBoardGuidance(getBoardCourse(`e${grade}-korean`)).includes(emphasis[grade]));
});

test('18 country/year combinations keep grade guidance through generation, rejection, exact repair, final review and paused questions',async t=>{
 t.mock.method(console,'info',()=>{});t.mock.method(console,'warn',()=>{});
 await withDefaultModels(async()=>{
  for(const {language,grade,id}of representativeCourses){
   const sheet=worksheet(),sheetBefore=structuredClone(sheet),first=scene(language,1),rest=Array.from({length:4},(_,index)=>scene(language,index+2));
   const mock=provider([
    {scenes:[first]},approved,{scenes:rest},
    {valid:false,issues:['Explain the necessary everyday word in a short, concrete sentence.']},
    {edits:[{sceneNumber:2,field:'narration',lineIndex:-1,before:'',after:additions[language]}]},approved,
   ]);
   const intro=await generateScienceIntro('worksheet',{courseId:id,material:sheet,fetcher:mock.fetcher}),introBefore=structuredClone(intro);
   const complete=await generateScienceRemainder(intro,{material:sheet,fetcher:mock.fetcher});
   assert.deepEqual(scienceLessonIssues(complete,{allowIntro:false}),[],id);
   assert.equal(complete.scenes.length,5);assert.strictEqual(complete.scenes[0],intro.scenes[0]);assert.deepEqual(intro,introBefore);
   assert.equal(complete.scenes[1].narration,rest[0].narration+' '+additions[language]);
   assert.deepEqual(complete.scenes.slice(2),rest.slice(1));assert.deepEqual(sheet,sheetBefore);
   assert.deepEqual(mock.requests.map(request=>request.text.format.name),['science_board_scenes','science_board_review','science_board_scenes','science_board_review','science_board_scene_edits','science_board_review'],id+' keeps the existing bounded call sequence');
   assert.deepEqual(mock.requests.map(request=>request.max_output_tokens),[1600,2000,8000,4000,4000,4000],id+' does not increase output budgets');
   for(const request of mock.requests){
    assert.equal(request.model,'gpt-5.6-luna',id+' keeps the scene model');
    assert.ok(request.instructions.includes(marker(grade)),id+' applies the grade contract at '+request.text.format.name);
    assert.ok(request.instructions.includes(JSON.stringify(sheet)),id+' grounds every scene stage in the exact worksheet');
    assert.ok(!request.instructions.includes(implicitPermission),id+' no longer permits skipping necessary elementary steps');
    assert.match(request.instructions,/explicitly explain necessary arithmetic or prerequisite reasoning/);
    assert.match(request.instructions,/must teach each distinct task-level method/);
    assert.match(request.instructions,/Keep every question, choice, hint, key and explanation unchanged/);
   }
   for(const index of [3,5]){
    const review=JSON.parse(mock.requests[index].input[0].content);
    assert.equal(review.assembledLesson.scenes.length,5);assert.equal(review.candidate.scenes.length,4);
    assert.deepEqual(review.previousScenes,[intro.scenes[0]]);
   }
   const lastReview=JSON.parse(mock.requests[5].input[0].content);
   assert.deepEqual(lastReview.assembledLesson.scenes,complete.scenes,'the actual repaired lesson gets independent final review');
   const practice=await generateSciencePractice(complete,{material:sheet,fetcher:mock.fetcher});
   assert.strictEqual(practice.material,sheet);assert.equal(mock.requests.length,6,'practice reuses the existing ten questions');
   const answer={ko:'물건을 하나씩 가리켜 보세요. 한 물건에 수 하나를 말하면 차례대로 셀 수 있어요.',en:'Look at one object first. Say one number for that object. Then move to the next object.',fr:'Nous regardons un objet. Nous disons un nombre pour cet objet. Puis nous passons à l’objet suivant.'}[language];
   const paused=provider([answer]),result=await askScienceBoard(complete,{scene:1,text:'Please explain this more simply.'},{material:sheet,fetcher:paused.fetcher});
   assert.equal(result.answer,answer);assert.equal(paused.requests.length,1);
   assert.equal(paused.requests[0].model,'gpt-4.1-mini-2025-04-14','the paused tutor model remains unchanged');
   assert.equal(paused.requests[0].max_output_tokens,900);
   assert.ok(paused.requests[0].instructions.includes(marker(grade)),id+' paused questions use the same level');
   assert.ok(!paused.requests[0].instructions.includes('Group related methods across the five scenes'),'a paused answer does not need a full lesson');
   assert.ok(!paused.requests[0].instructions.includes('Keep the existing scene count and narration bounds'),'a paused answer keeps its concise existing answer bounds');
   assert.ok(paused.requests[0].instructions.includes(JSON.stringify(complete.scenes[1])));
   assert.match(paused.requests[0].instructions,/Never claim to change, grade, advance or resume/);
   assert.deepEqual(sheet,sheetBefore);assert.deepEqual(intro,introBefore);
  }
 });
});

test('representative secondary, exam and advanced requests keep their existing implicit-step permission and receive no elementary contract',async t=>{
 t.mock.method(console,'info',()=>{});t.mock.method(console,'warn',()=>{});
 await withDefaultModels(async()=>{
  for(const id of ['m1-math','h3-math','ged-elementary-math','materials-en-7-0','materials-en-12-0','materials-en-advanced-0','materials-fr-7-0','materials-fr-12-0','materials-fr-advanced-0']){
   const course=getBoardCourse(id),mock=provider([{scenes:[scene(course.language,1)]},approved]);
   await generateScienceIntro('worksheet',{courseId:id,material:worksheet(),fetcher:mock.fetcher});
   assert.equal(mock.requests.length,2);
   for(const request of mock.requests){
    assert.ok(!request.instructions.includes('GEM GRADE-ACCESSIBILITY CONTRACT'),id);
    assert.ok(request.instructions.includes(implicitPermission),id+' retains its prior prerequisite policy');
    assert.equal(request.model,'gpt-5.6-luna');
   }
  }
 });
});
