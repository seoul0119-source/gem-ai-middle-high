// Exercise the deployed API contracts with deterministic providers. These tests
// do not claim that a physical microphone/speaker or the live Sheet was used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {BOARD_COURSES,getBoardCourse,getBoardTopic,isBoardCourse} from '../whiteboard/board-courses.js';
import {SCIENCE_TOPICS,scienceLessonIssues,generateScienceIntro,generateScienceRemainder,askScienceBoard} from '../lib/science-board-content.js';
import {verifyScienceHandoff,SCIENCE_HANDOFF_AUDIENCE} from '../lib/science-handoff.js';
import {emptyBoardProgress} from '../whiteboard/board-progress.js';

const CHEM='suneung-2027-chemistry-1',PHYSICS='h3-science';
const previousKey=process.env.OPENAI_API_KEY,originalNow=Date.now;
const time=Date.parse('2026-10-13T00:00:00.000Z');let clock=time;
process.env.OPENAI_API_KEY='board-course-expansion-test-only';Date.now=()=>clock;
test.beforeEach(()=>{clock=time;});
test.after(()=>{Date.now=originalNow;if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;});
const member=()=>({id:'EXPANSION-'+randomUUID(),session:randomUUID(),authenticatedAt:Math.floor(time/1000),exp:Math.floor(time/1000)+12*3600});
const response=()=>({headers:{},status(code){this.code=code;return this;},setHeader(key,value){this.headers[key]=value;return this;},end(body=''){this.body=body;return this;}});
const request=(body,extra={})=>({method:'POST',headers:{host:'gem.example',origin:'https://gem.example','content-type':'application/json'},body:{pilot:'science',...body},...extra});
async function call(body,deps,extra){const res=response();await handleScienceBoard(request(body,extra),res,deps);return res;}
function decoded(res,status=200){assert.equal(res.code,status,res.body);return JSON.parse(res.body);}
function makeLesson(courseId=CHEM,topicId='chemistry-mole',complete=false,id=randomUUID()){
 const topic=getBoardTopic(courseId,topicId);
 const narration=courseId===CHEM
  ?'물질의 양을 셀 때 몰이라는 단위를 사용합니다. 같은 종류의 입자 한 몰은 일정한 개수의 입자를 뜻합니다. 물질의 질량을 몰 질량으로 나누면 물질의 양을 구할 수 있습니다. 예를 들어 탄소의 몰 질량을 십이 그램 퍼 몰이라고 하면 탄소 십이 그램은 일 몰입니다. 먼저 문제에서 주어진 질량과 몰 질량을 확인해 보세요. 단위를 함께 쓰면 나눗셈의 방향을 쉽게 확인할 수 있습니다. 기체의 부피를 사용할 때에는 온도와 압력 조건도 확인해야 합니다.'
  :'자기 선속은 코일을 지나는 자기장을 면적과 방향까지 고려해 나타낸 양입니다. 선속이 변하면 유도 기전력이 생깁니다. 유도 기전력과 전류는 서로 다른 양입니다. 전류가 계속 흐르려면 도선이 닫힌 회로를 이루어야 합니다. 코일과 자석이 그대로 있고 다른 조건도 변하지 않는다면 선속도 변하지 않습니다. 움직임 자체보다 코일을 지나는 선속이 달라지는지를 먼저 확인합니다.';
 return {id,courseId,topicId,title:topic.title,language:'ko',complete,createdAt:time,scenes:Array.from({length:complete?5:1},(_,i)=>({title:'개념 설명 '+(i+1),lines:courseId===CHEM?['물질의 양 = 질량 ÷ 몰 질량','물질과 단위를 먼저 확인합니다.']:['자기 선속의 변화를 확인합니다.','닫힌 회로와 유도 전류를 구분합니다.'],narration}))};
}
function makeMaterial(){
 return {title:'몰과 질량의 관계 확인',questions:Array.from({length:10},(_,i)=>{
  const amount=i+1,answerIndex=i%4,choices=Array.from({length:4},(_,j)=>`${(amount+((j-answerIndex+4)%4))*12} g`);
  return {prompt:`문항 ${i+1}: 탄소의 몰 질량이 12 g/mol일 때 탄소 ${amount} mol의 질량은 얼마인가요?`,choices,answerIndex,hints:['질량과 물질의 양을 연결하는 관계를 떠올려 보세요.','몰 질량의 단위와 주어진 물질의 양의 단위를 함께 써 보세요.'],explanation:`질량은 몰 질량과 물질의 양의 곱이므로 ${amount*12} g입니다.`};
 })};
}
function fixture(student=member()){
 const providerCalls=[];
 const deps={authenticate:async()=>student,now:()=>clock,
  generateIntro:async(topicId,options)=>{providerCalls.push({kind:'intro',topicId,courseId:options.courseId});return makeLesson(options.courseId||PHYSICS,topicId);},
  generateRemainder:async old=>{providerCalls.push({kind:'remainder',courseId:old.courseId});return {...old,complete:true,scenes:[old.scenes[0],...makeLesson(old.courseId,old.topicId,true,old.id).scenes.slice(1)]};},
  generatePractice:async current=>{providerCalls.push({kind:'practice',courseId:current.courseId});return {material:makeMaterial()};},
  ask:async(current,args)=>{providerCalls.push({kind:'ask',current,args});return {answer:'주어진 몰 질량과 물질의 양을 곱하면 질량을 구할 수 있어요.'};}
 };
 return {student,deps,providerCalls};
}

test('course catalog keeps the three existing physics units and explicitly scopes the chemistry pilot',async()=>{
 assert(isBoardCourse(CHEM));assert(isBoardCourse(PHYSICS));
 assert.equal(isBoardCourse('suneung-2027-chemistry-2'),false);
 assert.equal(isBoardCourse('h2-science'),false);
 assert.equal(getBoardCourse(CHEM).language,'ko');
 assert.deepEqual(SCIENCE_TOPICS.map(t=>t.id),['induction','momentum','capacitors']);
 assert.deepEqual(getBoardCourse(PHYSICS).topics.map(t=>t.id),SCIENCE_TOPICS.map(t=>t.id));
 assert.deepEqual(getBoardCourse(CHEM).topics.map(t=>t.id),['chemistry-mole','chemistry-atom','chemistry-bonding','chemistry-reaction']);
 assert(!getBoardCourse(CHEM).topics.some(t=>t.id==='worksheet'),'existing-question explanation is not an unrelated visible unit');
 assert.equal(getBoardTopic(CHEM,'induction'),null);
 assert(BOARD_COURSES.some(c=>c.id===CHEM));
 const f=fixture();
 const chem=decoded(await call({},f.deps,{method:'GET',query:{courseId:CHEM}}));
 assert.equal(chem.courseId,CHEM);assert.equal(chem.language,'ko');assert.deepEqual(chem.topics.map(t=>t.id),getBoardCourse(CHEM).topics.map(t=>t.id));
 const existing=decoded(await call({},f.deps,{method:'GET'}));assert.equal(existing.courseId,PHYSICS);assert.deepEqual(existing.topics.map(t=>t.id),SCIENCE_TOPICS.map(t=>t.id));
 assert.equal(f.providerCalls.length,0);
});

test('new chemistry lesson, exact quiz, paused question and Mei handoff stay on the same course',async()=>{
 const f=fixture(),begun=decoded(await call({action:'start',courseId:CHEM,topicId:'chemistry-mole'},f.deps));
 assert.equal(begun.lesson.courseId,CHEM);assert.equal(scienceLessonIssues(begun.lesson).length,0);
 const practiced=decoded(await call({action:'practice',courseId:CHEM,token:begun.token},f.deps));
 const complete=decoded(await call({action:'continue',courseId:CHEM,token:begun.token,quizToken:practiced.quizToken},f.deps));
 assert.deepEqual(complete.lesson.scenes[0],begun.lesson.scenes[0]);assert.equal(complete.lesson.id,begun.lesson.id);assert.equal(complete.lesson.courseId,CHEM);
 decoded(await call({action:'ask',courseId:CHEM,token:complete.token,quizToken:practiced.quizToken,scene:2,questionIndex:3,text:'이 문제를 칠판 설명과 연결해 주세요.',question:{prompt:'CLIENT REPLACEMENT'}},f.deps));
 const asked=f.providerCalls.find(c=>c.kind==='ask');assert.equal(asked.current.courseId,CHEM);assert.equal(asked.args.scene,2);assert.equal(asked.args.question.prompt,practiced.material.questions[3].prompt);assert.deepEqual(asked.args.question.choices,practiced.material.questions[3].choices);
 assert(!JSON.stringify(asked).includes('CLIENT REPLACEMENT'));
 const sent=decoded(await call({action:'handoff',courseId:CHEM,token:complete.token,quizToken:practiced.quizToken},f.deps));
 const verified=verifyScienceHandoff(sent.ticket,sent.handoffToken,SCIENCE_HANDOFF_AUDIENCE);
 assert(verified);assert.equal(verified.pass.id,f.student.id);assert.equal(verified.handoff.courseId,CHEM);assert.deepEqual(verified.handoff.lesson,complete.lesson);assert.deepEqual(verified.handoff.material,practiced.material);
 assert(f.providerCalls.filter(c=>c.kind!=='ask').every(c=>c.courseId===CHEM));
 assert.equal(f.providerCalls.filter(c=>c.kind==='practice').length,1);
});

test('unsupported courses and foreign unit IDs fail before generation',async()=>{
 const f=fixture();
 for(const body of [
  {action:'start',courseId:'suneung-2027-chemistry-2',topicId:'chemistry-mole'},
  {action:'start',courseId:CHEM,topicId:'induction'},
  {action:'start',courseId:PHYSICS,topicId:'chemistry-mole'},
  {action:'start',courseId:'materials-en-1-0',topicId:'chemistry-mole'}
 ])assert.equal((await call(body,f.deps)).code,400);
 assert.equal(f.providerCalls.length,0);
});

test('chemistry renewal across re-login preserves all question order and rejects another student',async()=>{
 const f=fixture(),begun=decoded(await call({action:'start',courseId:CHEM,topicId:'chemistry-atom'},f.deps));
 const practiced=decoded(await call({action:'practice',courseId:CHEM,token:begun.token},f.deps));
 const complete=decoded(await call({action:'continue',courseId:CHEM,token:begun.token,quizToken:practiced.quizToken},f.deps));
 clock=time+4*3600000;const fresh={...f.student,session:randomUUID(),authenticatedAt:Math.floor(clock/1000),exp:Math.floor(clock/1000)+3600};
 const forbid=async()=>{throw Error('renewal must not generate');};
 const deps={...f.deps,authenticate:async()=>fresh,generateIntro:forbid,generateRemainder:forbid,generatePractice:forbid};
 const renewed=decoded(await call({action:'resume',courseId:CHEM,token:complete.token,quizToken:practiced.quizToken},deps));
 assert.deepEqual(renewed.lesson,complete.lesson);assert.deepEqual(renewed.material,practiced.material);
 assert.equal((await call({action:'resume',courseId:CHEM,token:complete.token,quizToken:practiced.quizToken},{...deps,authenticate:async()=>({...fresh,id:'OTHER-STUDENT'})})).code,403);
});

function savedWorksheet(student,withLesson=false){
 const progress=emptyBoardProgress();
 progress.items[0]={attempts:[1,0],hints:1,result:'correct'};
 progress.items[1]={attempts:[0,2,3],hints:2,result:'revealed'};
 progress.items[2]={attempts:[],hints:0,result:'revealed'};
 progress.items[3]={attempts:[0,1],hints:2,result:'open'};
 progress.events=[randomUUID(),randomUUID()];
 return {studentId:student.id,worksheet:{id:randomUUID(),course:CHEM,topic:'지금 풀던 몰 문제',revision:7,content:{...makeMaterial(),...(withLesson?{lesson:makeLesson(CHEM,'chemistry-mole',true)}:{})},progress},cursor:3};
}

test('importing an existing chemistry worksheet prepares concepts for its exact ten questions without generating replacements',async()=>{
 const f=fixture(),snapshot=savedWorksheet(f.student),before=structuredClone(snapshot),transferCalls=[];
 f.deps.readTransfer=async(token)=>{transferCalls.push(token);return snapshot;};
 const originalIntro=f.deps.generateIntro;let concepts;
 f.deps.generateIntro=async(topicId,options)=>{concepts={topicId,options};return originalIntro(topicId,options);};
 const imported=decoded(await call({action:'import',courseId:CHEM,transferToken:'existing-worksheet-capability',material:{questions:[]},source:{id:randomUUID(),revision:99}},f.deps));
 assert.deepEqual(transferCalls,['existing-worksheet-capability']);
 assert.equal(concepts.topicId,'worksheet');assert.equal(concepts.options.courseId,CHEM);
 assert.deepEqual(concepts.options.material,{title:snapshot.worksheet.content.title,questions:snapshot.worksheet.content.questions});
 assert.equal(imported.lesson.courseId,CHEM);assert.equal(imported.lesson.topicId,'worksheet');
 assert.deepEqual(imported.material,{title:snapshot.worksheet.content.title,questions:snapshot.worksheet.content.questions});
 assert.deepEqual(imported.source,{id:snapshot.worksheet.id,revision:7});assert.deepEqual(imported.progress,snapshot.worksheet.progress);assert.equal(imported.cursor,3);
 assert.equal(f.providerCalls.filter(c=>c.kind==='practice').length,0);
 assert.deepEqual(snapshot,before);
 const complete=decoded(await call({action:'continue',courseId:CHEM,token:imported.token,quizToken:imported.quizToken},f.deps));
 assert.equal(complete.lesson.id,imported.lesson.id);assert.deepEqual(complete.lesson.scenes[0],imported.lesson.scenes[0]);
 const sent=decoded(await call({action:'handoff',courseId:CHEM,token:complete.token,quizToken:imported.quizToken,progress:imported.progress,cursor:3,source:{id:randomUUID(),revision:999}},f.deps));
 const verified=verifyScienceHandoff(sent.ticket,sent.handoffToken,SCIENCE_HANDOFF_AUDIENCE);
 assert(verified);assert.equal(verified.handoff.id,snapshot.worksheet.id);assert.deepEqual(verified.handoff.source,{id:snapshot.worksheet.id,revision:7});
 assert.deepEqual(verified.handoff.material,imported.material);assert.deepEqual(verified.handoff.progress,imported.progress);assert.equal(verified.handoff.cursor,3);
 assert.equal(f.providerCalls.filter(c=>c.kind==='practice').length,0);
});

test('reopening an existing worksheet with its completed board makes no content generation calls',async()=>{
 const f=fixture(),snapshot=savedWorksheet(f.student,true);
 f.deps.readTransfer=async()=>snapshot;
 const imported=decoded(await call({action:'import',courseId:CHEM,transferToken:'saved-lesson-capability'},f.deps));
 assert.deepEqual(imported.lesson,snapshot.worksheet.content.lesson);assert.deepEqual(imported.progress,snapshot.worksheet.progress);
 assert.equal(imported.source.id,snapshot.worksheet.id);assert.equal(imported.cursor,3);assert.equal(f.providerCalls.length,0);
 const complete=decoded(await call({action:'continue',courseId:CHEM,token:imported.token,quizToken:imported.quizToken},f.deps));
 assert.deepEqual(complete.lesson,imported.lesson);assert.equal(f.providerCalls.length,0);
});

test('worksheet transfer enforces current authentication, student ownership, course and canonical question bounds before generation',async()=>{
 const f=fixture(),snapshot=savedWorksheet(f.student);let fetched=0;
 const deps={...f.deps,readTransfer:async()=>{fetched++;return snapshot;}};
 const denied=await call({action:'import',courseId:CHEM,transferToken:'saved-capability'},{...deps,authenticate:async(req,res)=>{res.status(401).end(JSON.stringify({error:'session_required'}));return null;}});
 assert.equal(denied.code,401);assert.equal(fetched,0);
 for(const mutate of [
  s=>s.studentId='OTHER-STUDENT',
  s=>s.worksheet.course=PHYSICS,
  s=>s.worksheet.content.questions[0].choices.push('FIFTH CHOICE'),
  s=>s.worksheet.content.questions.reverse(),
  s=>s.worksheet.content.questions[0].answerIndex=4,
  s=>s.worksheet.progress.items[0]={attempts:[1],hints:0,result:'correct'},
  s=>s.worksheet.revision=0
 ]){
  const invalid=structuredClone(snapshot);mutate(invalid);
  const res=await call({action:'import',courseId:CHEM,transferToken:'saved-capability'},{...deps,readTransfer:async()=>invalid});
  assert([400,403].includes(res.code),`invalid transfer reached status ${res.code}: ${res.body}`);
 }
 assert.equal(f.providerCalls.length,0);
});

test('an already attached canonical board wins over a conflicting prior board from another tab',async()=>{
 const f=fixture(),snapshot=savedWorksheet(f.student);f.deps.readTransfer=async()=>snapshot;
 const prior=decoded(await call({action:'import',courseId:CHEM,transferToken:'before-another-tab-attached'},f.deps));
 const attached=makeLesson(CHEM,'worksheet',true);assert.notEqual(attached.id,prior.lesson.id);
 snapshot.worksheet.content.lesson=attached;snapshot.worksheet.revision=8;
 const before=f.providerCalls.length;
 const current=decoded(await call({action:'import',courseId:CHEM,transferToken:'current-saved-snapshot',token:prior.token,quizToken:prior.quizToken},f.deps));
 assert.deepEqual(current.lesson,attached,'retry must not keep selecting a local lesson that canonical storage rejects');
 assert.equal(current.source.id,snapshot.worksheet.id);assert.equal(current.source.revision,8);assert.deepEqual(current.material,prior.material);assert.equal(f.providerCalls.length,before);
 const sent=decoded(await call({action:'handoff',courseId:CHEM,token:current.token,quizToken:current.quizToken},f.deps));
 assert.deepEqual(verifyScienceHandoff(sent.ticket,sent.handoffToken,SCIENCE_HANDOFF_AUDIENCE).handoff.lesson,attached);
});

test('the real chemistry concept generator grounds generation, independent review and repair in the same worksheet',async()=>{
 const material=makeMaterial(),scene={title:'몰과 몰 질량의 뜻',lines:['물질의 양은 입자 수와 연결됩니다.','질량을 몰 질량으로 나누어 물질의 양을 구합니다.'],narration:'물질의 양을 셀 때 몰이라는 단위를 사용합니다. 같은 종류의 입자 한 몰은 일정한 개수의 입자를 뜻합니다. 물질의 질량을 몰 질량으로 나누면 물질의 양을 구할 수 있습니다. 예를 들어 물의 몰 질량을 십팔 그램 퍼 몰이라고 주었을 때 물 구 그램은 영 점 오 몰입니다. 먼저 문제에서 주어진 질량과 몰 질량을 확인해 보세요. 단위를 함께 쓰면 나눗셈의 방향을 쉽게 확인할 수 있습니다. 분자의 개수를 구할 때에는 물질의 양과 아보가드로 상수의 관계를 사용합니다. 어떤 종류의 입자를 세는지도 꼭 확인합니다.'};
 assert(scene.narration.length>=260&&scene.narration.length<=350);
 const calls=[];let reviews=0;
 const fetcher=async(_url,options)=>{
  const req=JSON.parse(options.body);calls.push(req);
  const review=req.text?.format?.name==='science_board_review';
  const output=review?(++reviews===1?{valid:false,issues:['Clarify that the mole counts the specified kind of particle.']}:{valid:true,issues:[]}):{scenes:[scene]};
  return Response.json({status:'completed',output_text:JSON.stringify(output)});
 };
 const lesson=await generateScienceIntro('worksheet',{courseId:CHEM,material,fetcher,now:()=>clock});
 assert.equal(lesson.courseId,CHEM);assert.equal(lesson.topicId,'worksheet');assert.equal(lesson.language,'ko');assert.equal(scienceLessonIssues(lesson).length,0);
 assert.equal(calls.length,4);assert.equal(reviews,2);
 for(const req of calls){
  assert.equal(req.store,false);assert(req.instructions.includes('2027학년도 수능 대비'));assert(req.instructions.includes('화학Ⅰ'));
  assert(req.instructions.includes(JSON.stringify(material)));assert(req.instructions.includes('untrusted DATA'));
  assert(req.instructions.includes('Solid NaCl is an ionic lattice, not a collection of discrete NaCl molecules'));
  assert(req.instructions.includes('Distinguish molar mass M in g/mol from sample mass m in g'));
  assert(req.instructions.includes('Restrict molecules and atoms per molecule to molecular substances'));
  assert(req.instructions.includes('Never generalize these molecular statements to all chemical formulas or to ionic NaCl'));
  assert(req.instructions.includes('requires the SAME substance and SAME sample'));
  assert(req.instructions.includes('both beside the board formula and in the spoken explanation'));
  assert(!req.instructions.includes('flux through ONE turn'),'chemistry must not inherit the special electromagnetic induction contract');
 }
 assert(calls[2].instructions.includes('Repair the proposed scenes'));assert(calls[2].input[0].content.includes('Clarify that the mole'));
 const tutorRequests=[],tutorFetcher=async(_url,options)=>{
  const req=JSON.parse(options.body);tutorRequests.push(req);
  return Response.json({status:'completed',output_text:req.instructions.includes('CHEMISTRY QUANTITIES AND SPOKEN UNITS')?'몰 질량은 물질의 양당 질량으로, 단위는 그램 퍼 몰입니다. 시료의 질량은 그램으로 나타냅니다.':'코일을 지나는 자기 선속이 시간에 따라 변하는지를 먼저 확인해 보세요.'});
 };
 await askScienceBoard(lesson,{scene:0,text:'몰 질량 M과 시료 질량 m의 단위는 무엇인가요?'},{fetcher:tutorFetcher});
 assert(tutorRequests[0].instructions.includes('molar mass M in g/mol (read 그램 퍼 몰)'));
 assert(tutorRequests[0].instructions.includes('sample mass m in g (그램)'));
 assert(tutorRequests[0].instructions.includes('mass of a 1 mol sample'));
 assert(tutorRequests[0].instructions.includes('Explain what M, m, n and N_A mean'));
 assert(tutorRequests[0].instructions.includes('Honor the exact or rounded N_A value supplied'));
 await askScienceBoard(makeLesson(PHYSICS,'induction'),{scene:0,text:'유도 기전력은 언제 생기나요?'},{fetcher:tutorFetcher});
 assert(!tutorRequests[1].instructions.includes('CHEMISTRY QUANTITIES AND SPOKEN UNITS'),'the existing high-three science tutor must not inherit chemistry-specific instructions');
});

test('chemistry remainder review measures the approved prefix and each repaired candidate without making the total aim a hard bound',async()=>{
 const material=makeMaterial(),first=makeLesson(CHEM,'worksheet'),original=structuredClone(first);
 const shortNarration='시료의 질량과 몰 질량은 서로 다른 양입니다. 질량은 그램으로 나타내지만 몰 질량의 단위는 그램 퍼 몰입니다. 물질의 양에 몰 질량을 곱하면 시료의 질량을 구할 수 있습니다. 반대로 질량을 몰 질량으로 나누면 물질의 양이 됩니다. 계산 전에 문제에서 지정한 물질과 주어진 단위를 먼저 확인하세요. 단위를 함께 쓰면 곱할지 나눌지 판단할 수 있습니다.';
 assert(shortNarration.length>=160&&shortNarration.length<260);
 const rest=['입자의 종류와 물질의 양','몰 질량과 시료 질량','단위를 확인하는 계산','관계와 조건 정리'].map(title=>({title,lines:['몰 질량의 단위는 g/mol입니다.','시료 질량의 단위는 g입니다.'],narration:shortNarration}));
 const wrong=structuredClone(rest);wrong[1].lines[0]='몰 질량의 단위는 g입니다.';
 const repaired=structuredClone(rest);repaired[1].narration+=' 두 단위의 차이를 꼭 구별해 보세요.';
 const issue={valid:false,issues:['Scene 3 incorrectly gives g as the unit of molar mass; use g/mol and distinguish sample mass in g.']};
 const outputs=[{scenes:wrong},issue,{scenes:repaired},{valid:true,issues:[]}],calls=[];
 const fetcher=async(_url,options)=>{calls.push(JSON.parse(options.body));assert(outputs.length,'unexpected provider request');return Response.json({status:'completed',output_text:JSON.stringify(outputs.shift())});};
 const full=await generateScienceRemainder(first,{courseId:CHEM,material,fetcher});
 assert.deepEqual(first,original);assert.strictEqual(full.scenes[0],first.scenes[0]);assert.equal(full.id,first.id);assert.deepEqual(full.scenes.slice(1),repaired);assert.equal(calls.length,4);
 const reviews=calls.filter(req=>req.text?.format?.name==='science_board_review');assert.equal(reviews.length,2,'passed count metadata must not bypass the factual rejection or its independent re-review');
 for(const [index,request] of reviews.entries()){
  const reviewed=JSON.parse(request.input[0].content),contract=reviewed.reviewContract,candidate=index?repaired:wrong,assembled=[...first.scenes,...candidate];
  assert.equal(contract.phase,'remainder');assert.equal(contract.candidateSceneCount,4);assert.equal(contract.approvedPreviousSceneCount,1);assert.equal(contract.assembledSceneCount,5);assert.deepEqual(contract.candidateSceneNumbers,[2,3,4,5]);
  assert.deepEqual(reviewed.previousScenes,first.scenes);assert.deepEqual(reviewed.candidate,{scenes:candidate});assert.deepEqual(reviewed.assembledLesson,{scenes:assembled,complete:true});
  assert.deepEqual(contract.narrationMeasurements.scenes,assembled.map((scene,i)=>({sceneNumber:i+1,characters:scene.narration.length})));
  assert.equal(contract.narrationMeasurements.assembledTotal,assembled.reduce((sum,scene)=>sum+scene.narration.length,0));assert(contract.narrationMeasurements.assembledTotal<1300,'an existing soft aim must not become an invented hard gate');assert.equal(contract.wholeLessonAim.narrationCharacters.kind,'soft_target');assert.equal(contract.deterministicChecks.status,'passed');
  assert(request.instructions.includes(JSON.stringify(material)),'review must retain all ten canonical questions after repair');assert.match(request.instructions,/Passed structure and length checks do not approve factual content/);
 }
 assert.notEqual(JSON.parse(reviews[0].input[0].content).reviewContract.narrationMeasurements.assembledTotal,JSON.parse(reviews[1].input[0].content).reviewContract.narrationMeasurements.assembledTotal,'measurements must be recalculated after the factual repair');
 assert(calls[2].input[0].content.includes(issue.issues[0]));assert.match(calls[2].instructions,/Repair only the four candidate scenes 2–5/);assert(!calls[2].instructions.includes('Aim for about 300 characters for scene 1'));
 for(const request of calls)assert(request.instructions.includes(JSON.stringify(material)),'generation, repair and review must use the same complete worksheet');
});

test('authenticated refresh after re-login reads newer canonical attempts without renewing the original lesson deadline',async()=>{
 const f=fixture(),snapshot=savedWorksheet(f.student,true);f.deps.readTransfer=async()=>snapshot;
 const imported=decoded(await call({action:'import',courseId:CHEM,transferToken:'existing-completed-worksheet'},f.deps));
 const latest=structuredClone(snapshot);latest.worksheet.revision=8;latest.cursor=4;latest.worksheet.progress.items[3]={attempts:[0,1,3],hints:2,result:'correct'};
 clock=time+4*3600000;const fresh={...f.student,session:randomUUID(),authenticatedAt:Math.floor(clock/1000),exp:Math.floor(clock/1000)+3600};let reads=0;
 const forbid=async()=>{throw Error('refresh cannot generate content');};
 const renewed=decoded(await call({action:'resume',courseId:CHEM,token:imported.token,quizToken:imported.quizToken,refreshWorksheet:true},{...f.deps,authenticate:async()=>fresh,generateIntro:forbid,generateRemainder:forbid,generatePractice:forbid,readLatest:async proof=>{
  reads++;const verified=verifyScienceHandoff(proof.ticket,proof.handoffToken,SCIENCE_HANDOFF_AUDIENCE);assert(verified);assert.equal(verified.pass.id,fresh.id);assert.equal(verified.handoff.id,snapshot.worksheet.id);assert.deepEqual(verified.handoff.material,imported.material);return latest;
 }}));
 assert.equal(reads,1);assert.equal(renewed.syncPending,undefined);assert.deepEqual(renewed.progress,latest.worksheet.progress);assert.equal(renewed.source.revision,8);assert.equal(renewed.cursor,4);
 assert.deepEqual(renewed.lesson,imported.lesson);assert.deepEqual(renewed.material,imported.material);
 const payload=token=>JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 assert.equal(payload(renewed.token).resumeUntil,payload(imported.token).resumeUntil);assert.equal(payload(renewed.quizToken).resumeUntil,payload(imported.quizToken).resumeUntil);
 assert.equal(f.providerCalls.length,0);
});

test('unavailable or mismatched progress refresh retains playable reviewed content and reports pending synchronization',async()=>{
 const f=fixture(),snapshot=savedWorksheet(f.student,true);f.deps.readTransfer=async()=>snapshot;
 const imported=decoded(await call({action:'import',courseId:CHEM,transferToken:'existing-completed-worksheet'},f.deps));
 const before=f.providerCalls.length;
 for(const invalid of [null,...[
  s=>s.studentId='OTHER-STUDENT',
  s=>s.worksheet.course=PHYSICS,
  s=>s.worksheet.id=randomUUID(),
  s=>s.worksheet.revision=6,
  s=>s.worksheet.content.questions[0].prompt='CHANGED QUESTION'
 ].map(mutate=>{const value=structuredClone(snapshot);mutate(value);return value;})]){
  const renewed=decoded(await call({action:'resume',courseId:CHEM,token:imported.token,quizToken:imported.quizToken,refreshWorksheet:true},{...f.deps,readLatest:async()=>{if(invalid===null)throw Error('temporary network failure');return invalid;}}));
  assert.equal(renewed.syncPending,true);assert.deepEqual(renewed.material,imported.material);assert.deepEqual(renewed.lesson,imported.lesson);assert.deepEqual(renewed.progress,imported.progress);
  const stillPlayable=decoded(await call({action:'continue',courseId:CHEM,token:renewed.token,quizToken:renewed.quizToken},f.deps));assert.deepEqual(stillPlayable.lesson,imported.lesson);
 }
 assert.equal(f.providerCalls.length,before);
});

test('board-origin worksheet refresh derives its exact saved ID from the signed lesson and quiz',async()=>{
 const f=fixture(),begun=decoded(await call({action:'start',courseId:CHEM,topicId:'chemistry-mole'},f.deps));
 const practiced=decoded(await call({action:'practice',courseId:CHEM,token:begun.token},f.deps)),complete=decoded(await call({action:'continue',courseId:CHEM,token:begun.token,quizToken:practiced.quizToken},f.deps));
 const sent=decoded(await call({action:'handoff',courseId:CHEM,token:complete.token,quizToken:practiced.quizToken},f.deps));
 const latest={studentId:f.student.id,worksheet:{id:sent.worksheetId,course:CHEM,topic:'chemistry-mole',revision:2,content:{...practiced.material,lesson:complete.lesson},progress:emptyBoardProgress()},cursor:1};
 latest.worksheet.progress.items[0]={attempts:[0],hints:0,result:'correct'};
 const before=f.providerCalls.length;
 const renewed=decoded(await call({action:'resume',courseId:CHEM,token:complete.token,quizToken:practiced.quizToken,refreshWorksheet:true,worksheetId:randomUUID()},{...f.deps,readLatest:async proof=>{assert.equal(proof.worksheetId,sent.worksheetId,'caller-supplied worksheet ID must not select the record');return latest;}}));
 assert.equal(renewed.source.id,sent.worksheetId);assert.equal(renewed.source.revision,2);assert.deepEqual(renewed.progress,latest.worksheet.progress);assert.equal(f.providerCalls.length,before);
});
