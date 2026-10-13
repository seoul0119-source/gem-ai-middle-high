import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import catalog from '../lib/material-catalog.json' with {type:'json'};
import {handleMaterials,validMaterial} from '../lib/materials-ai.js';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {scienceLessonIssues} from '../lib/science-board-content.js';
import {issueScienceHandoff,verifyScienceHandoff,SCIENCE_HANDOFF_AUDIENCE} from '../lib/science-handoff.js';
import {BOARD_COURSES,getBoardCourse,getBoardTopic} from '../whiteboard/board-courses.js';
import {emptyBoardProgress} from '../whiteboard/board-progress.js';
import {ScienceController} from '../whiteboard/science-controller.js';
import {boardSubjectCases,subjectMaterial,subjectScenes,subjectAnswer,gedSubjectMaterial} from './fixtures/board-subject-stages.js';

process.env.OPENAI_API_KEY='deterministic-subject-roundtrip-test-key';
async function call(body,deps){
 const response={headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(value){this.value=value;}};
 await handleScienceBoard({method:'POST',headers:{origin:'https://board-test.invalid',host:'board-test.invalid','content-type':'application/json'},body:{pilot:'science',...body}},response,deps);
 return {code:response.code,data:response.headers['Content-Type']==='audio/mpeg'?response.value:JSON.parse(response.value)};
}
const ok=async(body,deps)=>{const result=await call(body,deps);assert.equal(result.code,200,JSON.stringify(result.data));return result.data;};

test('every material catalog course has a matching board identity, language and worksheet entry',()=>{
 assert.equal(BOARD_COURSES.length,catalog.length);
 for(const materialCourse of catalog){
  const course=getBoardCourse(materialCourse.id);assert(course,materialCourse.id);
  assert.equal(course.language,materialCourse.language);assert(getBoardTopic(course.id,'worksheet'));
  if(!['h3-science','suneung-2027-chemistry-1'].includes(course.id)){
   assert.equal(course.worksheetOnly,true,course.id);assert.deepEqual(course.topics,[],course.id);
  }
 }
 assert.equal(getBoardCourse('not-a-real-course'),null);
});

test('new worksheet-only courses reject a missing source and a lesson using another course language',()=>{
 for(const courseId of ['e3-math','materials-en-3-0','materials-fr-3-1']){
  const course=getBoardCourse(courseId),at=Math.floor(Date.now()/1000),student={id:'SOURCE-TEST-'+courseId,session:'in-process',authenticatedAt:at,exp:at+3600};
  const material=subjectMaterial(course.language),lesson={id:randomUUID(),courseId,topicId:'worksheet',title:getBoardTopic(courseId,'worksheet').title,language:course.language,createdAt:Date.now(),complete:true,scenes:subjectScenes(course.language)};
  assert.deepEqual(scienceLessonIssues(lesson),[]);
  assert.throws(()=>issueScienceHandoff(student,lesson,material),/handoff_unavailable/,'a new course requires an existing canonical worksheet source');
  const wrongLanguage={...lesson,language:course.language==='ko'?'en':'ko'};
  assert(scienceLessonIssues(wrongLanguage).length,'declared lesson language must match the trusted course');
  assert.throws(()=>issueScienceHandoff(student,wrongLanguage,material,{source:{id:randomUUID(),revision:1}}),/handoff_unavailable/);
 }
});

for(const representative of boardSubjectCases)test(`${representative.stage}: ${representative.courseId} keeps the newly generated ten questions through explanation, ask, practice, signed handoff and re-login`,async()=>{
 const {courseId,language}=representative,providerRequests=[],events=[];
 const materialProvider=async(_url,options)=>{
  const request=JSON.parse(options.body);providerRequests.push(request);
  const name=request.text?.format?.name;
  assert(['gem_material','worksheet_review'].includes(name),'no unrelated provider operation');
  return Response.json({status:'completed',output_text:JSON.stringify(name==='gem_material'?(courseId.startsWith('ged-')?gedSubjectMaterial():subjectMaterial(language)):{valid:true,issues:[]})});
 };
 const {material}=await handleMaterials({mode:'generate',courseId,topic:representative.topic,variation:randomUUID()},{fetcher:materialProvider});
 assert(validMaterial(material));assert.equal(providerRequests.length,2,'generation receives an independent review');
 const now=Date.now(),at=Math.floor(now/1000);let clock=now;
 let student={id:'SUBJECT-TEST-'+courseId,session:randomUUID(),authenticatedAt:at,iat:at,exp:at+8*3600};
 const worksheetId=randomUUID(),progress=emptyBoardProgress();
 let snapshot={studentId:student.id,worksheet:{id:worksheetId,course:courseId,topic:material.title,revision:1,content:structuredClone(material),progress},cursor:0};
 const original=structuredClone(snapshot),scenes=subjectScenes(language);
 const deps={authenticate:async()=>student,now:()=>clock,
  readTransfer:async transfer=>{assert.equal(transfer,'in-process-test');return structuredClone(snapshot);},
  readLatest:async proof=>{assert(proof.ticket&&proof.handoffToken);return structuredClone(snapshot);},
  generateIntro:async(topicId,options)=>{events.push('intro');assert.equal(topicId,'worksheet');assert.equal(options.courseId,courseId);assert.deepEqual(options.material,material);return{id:randomUUID(),courseId,topicId,title:getBoardTopic(courseId,topicId).title,language,createdAt:clock,complete:false,scenes:[scenes[0]]};},
  generateRemainder:async(lesson,options)=>{events.push('remainder');assert.deepEqual(options.material,material);return {...lesson,complete:true,scenes:[lesson.scenes[0],...scenes.slice(1)]};},
  generatePractice:async()=>{throw Error('An imported worksheet must never regenerate questions');},
  ask:async(lesson,args,options)=>{events.push('ask');assert.equal(lesson.courseId,courseId);assert.equal(lesson.language,language);assert.equal(args.scene,2);assert.deepEqual(options.material,material);assert.equal(args.question,undefined,'a concept question must not be graded');return {answer:subjectAnswer(language)};},
  fetcher:async()=>{throw Error('No external network is permitted in deterministic tests');}
 };
 const intro=await ok({action:'import',courseId,transferToken:'in-process-test'},deps);
 assert.equal(intro.lesson.complete,false);assert.equal(intro.lesson.scenes.length,1);assert.deepEqual(scienceLessonIssues(intro.lesson),[]);assert.deepEqual(intro.material,material);assert.deepEqual(snapshot,original);
 const full=await ok({action:'continue',courseId,token:intro.token,quizToken:intro.quizToken},deps);
 assert.equal(full.lesson.complete,true);assert.equal(full.lesson.scenes.length,5);assert.deepEqual(full.lesson.scenes[0],intro.lesson.scenes[0]);assert.equal(full.lesson.id,intro.lesson.id);
 const controller=new ScienceController(2);controller.practiceStart(material.questions,10,intro.progress);controller.play();const before=structuredClone(controller.progress),turn=controller.ask();
 const answer=await ok({action:'ask',courseId,token:full.token,quizToken:intro.quizToken,scene:2,text:representative.question},deps);
 assert(answer.answer);assert(controller.reply(turn));assert(controller.replied(turn));controller.play();assert.equal(controller.scene,2);assert.equal(controller.status,'playing');assert.deepEqual(controller.progress,before);
 controller.practiceStart(material.questions,1);const first=material.questions[0],wrong=(first.answerIndex+1)%4;
 assert.equal(controller.grade(wrong).correct,false);assert.equal(controller.grade(first.answerIndex).correct,true);
 controller.back();assert.equal(controller.scene,2);controller.practiceStart(material.questions,10);assert.equal(controller.practice.correct,1);assert(controller.next());
 const saved=structuredClone(controller.progress),exported=await ok({action:'handoff',courseId,token:full.token,quizToken:intro.quizToken,progress:saved,cursor:1},deps);
 const verified=verifyScienceHandoff(exported.ticket,exported.handoffToken,SCIENCE_HANDOFF_AUDIENCE);
 assert(verified);assert.equal(verified.handoff.courseId,courseId);assert.equal(verified.handoff.id,worksheetId);assert.deepEqual(verified.handoff.material,material);assert.deepEqual(verified.handoff.progress,saved);assert.equal(verified.handoff.cursor,1);assert.deepEqual(verified.handoff.lesson,full.lesson);
 // Simulate the target's canonical return in memory only. The API verifier is
 // real; external Site acceptance/storage is a separate integration boundary.
 const second=material.questions[1];saved.items[1]={attempts:[second.answerIndex],hints:0,result:'correct'};saved.events.push('target-in-process-answer');
 snapshot={studentId:student.id,worksheet:{...original.worksheet,revision:2,content:{...structuredClone(material),lesson:full.lesson},progress:saved},cursor:2};
 clock+=4000;student={...student,session:randomUUID(),authenticatedAt:Math.floor(clock/1000),iat:Math.floor(clock/1000),exp:Math.floor(clock/1000)+3600};
 const resumed=await ok({action:'resume',courseId,token:full.token,quizToken:intro.quizToken,refreshWorksheet:true},deps);
 assert.equal(resumed.syncPending,undefined);assert.deepEqual(resumed.lesson,full.lesson);assert.deepEqual(resumed.material,material);assert.deepEqual(resumed.progress,saved);assert.equal(resumed.cursor,2);assert.deepEqual(resumed.source,{id:worksheetId,revision:2});
 const returned=await ok({action:'import',courseId,transferToken:'in-process-test',token:resumed.token,quizToken:resumed.quizToken},deps);
 assert.deepEqual(returned.lesson,full.lesson);assert.deepEqual(returned.progress,saved);assert.deepEqual(returned.material,material);
 const practice=await ok({action:'practice',courseId,token:returned.token,quizToken:returned.quizToken},deps);assert.deepEqual(practice.material,material);
 assert.deepEqual(events,['intro','remainder','ask'],'return/resume reuses the approved explanation and question set');
 assert.equal((await call({action:'resume',courseId,token:full.token,quizToken:intro.quizToken},{...deps,authenticate:async()=>({...student,id:'ANOTHER-STUDENT'})})).code,403);
 const otherCourse=boardSubjectCases.find(c=>c.courseId!==courseId).courseId;
 assert.equal((await call({action:'resume',courseId:otherCourse,token:full.token,quizToken:intro.quizToken},deps)).code,403);
 assert.deepEqual(original.worksheet.content,material);assert.deepEqual(original.worksheet.progress,emptyBoardProgress());
});
