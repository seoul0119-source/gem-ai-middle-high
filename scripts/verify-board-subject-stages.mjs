// Opt-in live regression: node scripts/verify-board-subject-stages.mjs --stage=ko
// Stages: ko | exam | international | all. --case=<courseId> narrows a retry.
// Default execution is sequential; --concurrency=2 overlaps independent cases.
// Only OpenAI is contacted. Learners, transfers, target returns and records are
// in memory; no real student ID, Google Sheet or target Site row is written.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {handleMaterials,validMaterial,hasExcludedTopic} from '../lib/materials-ai.js';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {scienceLessonIssues} from '../lib/science-board-content.js';
import {verifyScienceHandoff,SCIENCE_HANDOFF_AUDIENCE} from '../lib/science-handoff.js';
import {getBoardCourse} from '../whiteboard/board-courses.js';
import {ScienceController} from '../whiteboard/science-controller.js';
import {emptyBoardProgress} from '../whiteboard/board-progress.js';
import {boardSubjectCases} from '../tests/fixtures/board-subject-stages.js';
import {runBoardVerificationCases} from './board-verification-runner.mjs';

const args=process.argv.slice(2),stage=args.find(a=>a.startsWith('--stage='))?.slice(8)||'all';
const only=args.find(a=>a.startsWith('--case='))?.slice(7);
const concurrency=Number(args.find(a=>a.startsWith('--concurrency='))?.slice(14)??'1');
assert(['ko','exam','international','all'].includes(stage),'Unknown verification stage');
assert([1,2].includes(concurrency),'Verification concurrency must be 1 or 2');
assert(args.every(a=>a==='--dry-run'||/^--(?:stage|case|concurrency)=/.test(a)),'Unknown verifier argument');
const cases=boardSubjectCases.filter(c=>(stage==='all'||c.stage===stage)&&(!only||c.courseId===only));
assert(cases.length,'No representative course matches the requested stage/case');
for(const c of cases)assert.equal(getBoardCourse(c.courseId)?.language,c.language,c.courseId);
if(args.includes('--dry-run')){
 console.log(JSON.stringify({stage,concurrency,cases,verification:'plan only; no provider calls or student writes'}));
 process.exit(0);
}
if(!process.env.OPENAI_API_KEY)throw Error('Existing classroom AI configuration is required for live verification.');

function mp3Seconds(bytes){
 assert(Buffer.isBuffer(bytes),'Speech must contain MP3 bytes');let at=0,total=0,frames=0;
 if(bytes.subarray(0,3).toString()==='ID3')at=10+((bytes[6]&127)<<21)+((bytes[7]&127)<<14)+((bytes[8]&127)<<7)+(bytes[9]&127);
 while(at+4<=bytes.length){
  const h=bytes.readUInt32BE(at);if((h>>>21)!==2047){at++;continue;}
  const version=(h>>>19)&3,layer=(h>>>17)&3,rateIndex=(h>>>12)&15,sampleIndex=(h>>>10)&3,padding=(h>>>9)&1;
  if(version===1||layer!==1||rateIndex===0||rateIndex===15||sampleIndex===3){at++;continue;}
  const rates=version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
  const sample=[44100,48000,32000][sampleIndex]/(version===3?1:version===2?2:4),size=Math.floor((version===3?144:72)*rates[rateIndex]*1000/sample)+padding;
  if(at+size>bytes.length)break;total+=(version===3?1152:576)/sample;frames++;at+=size;
 }
 assert(frames>20,'Expected playable MP3 frames from the speech provider');return total;
}
async function verifyCase(representative){
 const {courseId,language,topic,question}=representative,started=Date.now();
 console.log('Subject board live case started',JSON.stringify({stage:representative.stage,courseId,language,topic}));
 const providerCalls={},speechRequests=[];
 const fetcher=async(url,options)=>{
  assert(['https://api.openai.com/v1/responses','https://api.openai.com/v1/audio/speech'].includes(String(url)),'No external record or target Site requests are allowed');
  const request=JSON.parse(options.body),kind=url.endsWith('/speech')?'speech':request.text?.format?.name||'board_question';
  providerCalls[kind]=(providerCalls[kind]||0)+1;if(kind==='speech')speechRequests.push(request);
  return fetch(url,options);
 };
 const generated=await handleMaterials({mode:'generate',courseId,topic,variation:randomUUID()},{fetcher}),material=generated.material;
 assert(validMaterial(material));assert(!hasExcludedTopic(material));assert.equal(material.questions.length,10);
 const questionsPreparedMs=Date.now()-started,identity=JSON.stringify(material),worksheetId=randomUUID();
 let clock=Date.now(),student={id:'SUBJECT_BUILD_'+courseId,session:'in-process-only',authenticatedAt:Math.floor(clock/1000),iat:Math.floor(clock/1000),exp:Math.floor(clock/1000)+8*3600};
 let snapshot={studentId:student.id,worksheet:{id:worksheetId,course:courseId,topic:material.title,revision:1,content:structuredClone(material),progress:emptyBoardProgress()},cursor:0};
 const originalSnapshot=structuredClone(snapshot),dependencies={authenticate:async()=>student,now:()=>Math.max(clock,Date.now()),fetcher,
  readTransfer:async token=>{assert.equal(token,'subject-build-in-process');return structuredClone(snapshot);},
  readLatest:async proof=>{assert(proof.ticket&&proof.handoffToken);return structuredClone(snapshot);},
  generatePractice:async()=>{throw Error('Imported questions must never be regenerated');}
 };
 async function call(action,body={}){
  const response={headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(value){this.value=value;}};
  await handleScienceBoard({method:'POST',headers:{origin:'https://subject-build.invalid',host:'subject-build.invalid','content-type':'application/json'},body:{pilot:'science',action,courseId,...body}},response,dependencies);
  assert.equal(response.code,200,`${courseId} ${action} failed: ${response.value}`);
  return response.headers['Content-Type']==='audio/mpeg'?response.value:JSON.parse(response.value);
 }
 const boardStarted=Date.now(),intro=await call('import',{transferToken:'subject-build-in-process'}),firstBoardMs=Date.now()-boardStarted;
 assert.equal(intro.lesson.complete,false);assert.equal(intro.lesson.language,language);assert.equal(intro.lesson.courseId,courseId);assert.equal(intro.lesson.topicId,'worksheet');assert.equal(intro.lesson.scenes.length,1);assert.deepEqual(scienceLessonIssues(intro.lesson),[]);assert.equal(JSON.stringify(intro.material),identity);
 console.log('Subject board first explanation ready',JSON.stringify({courseId,firstBoardMs}));
 const complete=await call('continue',{token:intro.token,quizToken:intro.quizToken}),completeBoardMs=Date.now()-boardStarted;
 assert.equal(complete.lesson.complete,true);assert.equal(complete.lesson.scenes.length,5);assert.deepEqual(scienceLessonIssues(complete.lesson,{allowIntro:false}),[]);assert.deepEqual({...complete.lesson,complete:false,scenes:[complete.lesson.scenes[0]]},intro.lesson);
 const controller=new ScienceController(2);controller.practiceStart(material.questions,10,intro.progress);controller.play();const beforeQuestion=structuredClone(controller.progress),turn=controller.ask();
 const answer=await call('ask',{token:complete.token,quizToken:intro.quizToken,scene:2,text:question});assert(answer.answer.length>=10);assert(!hasExcludedTopic(answer.answer));
 if(language==='ko')assert(/[가-힣]/u.test(answer.answer),'Expected Korean answer');
 else assert(!/[가-힣]/u.test(answer.answer),'An international question must not receive an unrelated Korean answer');
 assert(controller.reply(turn));assert(controller.replied(turn));controller.play();assert.equal(controller.status,'playing');assert.equal(controller.scene,2);assert.deepEqual(controller.progress,beforeQuestion);
 const scene2Seconds=mp3Seconds(await call('speech',{token:complete.token,scene:1,kind:'scene'}));assert(scene2Seconds>5);
 const answerSeconds=mp3Seconds(await call('speech',{token:complete.token,scene:2,kind:'answer',text:answer.answer}));assert(answerSeconds>1);
 for(const request of speechRequests){assert.equal(request.input,request===speechRequests[0]?complete.lesson.scenes[1].narration:answer.answer);assert(new RegExp({ko:'Korean',en:'English',fr:'French'}[language],'i').test(request.instructions),'Speech instructions must match the course language');}
 const practice=await call('practice',{token:complete.token,quizToken:intro.quizToken});assert.equal(JSON.stringify(practice.material),identity);assert.equal(practice.quizToken,intro.quizToken);
 controller.practiceStart(material.questions,1);const first=material.questions[0],wrong=(first.answerIndex+1)%4;assert.equal(controller.grade(wrong).correct,false);assert.equal(controller.grade(first.answerIndex).correct,true);
 controller.back();assert.equal(controller.scene,2);controller.practiceStart(material.questions,10);assert.equal(controller.practice.correct,1);assert(controller.next());
 const progress=structuredClone(controller.progress);progress.events.push('subject-build-in-process-attempt');
 const exported=await call('handoff',{token:complete.token,quizToken:intro.quizToken,progress,cursor:1});
 const verified=verifyScienceHandoff(exported.ticket,exported.handoffToken,SCIENCE_HANDOFF_AUDIENCE);assert(verified);assert.equal(verified.handoff.courseId,courseId);assert.equal(verified.handoff.id,worksheetId);assert.equal(JSON.stringify(verified.handoff.material),identity);assert.deepEqual(verified.handoff.lesson,complete.lesson);assert.deepEqual(verified.handoff.progress,progress);assert.equal(verified.handoff.cursor,1);
 const returnedProgress=structuredClone(progress);returnedProgress.items[1]={attempts:[material.questions[1].answerIndex],hints:0,result:'correct'};returnedProgress.events.push('subject-build-simulated-target-answer');
 snapshot={studentId:student.id,worksheet:{...originalSnapshot.worksheet,revision:2,content:{...structuredClone(material),lesson:complete.lesson},progress:returnedProgress},cursor:2};
 const beforeResume=Object.values(providerCalls).reduce((a,b)=>a+b,0);clock=Date.now()+1000;student={...student,session:'fresh-in-process-login',authenticatedAt:Math.floor(clock/1000),iat:Math.floor(clock/1000),exp:Math.floor(clock/1000)+3600};
 const resumed=await call('resume',{token:complete.token,quizToken:intro.quizToken,refreshWorksheet:true});assert.equal(resumed.syncPending,undefined);assert.deepEqual(resumed.lesson,complete.lesson);assert.equal(JSON.stringify(resumed.material),identity);assert.deepEqual(resumed.progress,returnedProgress);assert.equal(resumed.cursor,2);assert.deepEqual(resumed.source,{id:worksheetId,revision:2});
 const returned=await call('import',{transferToken:'subject-build-in-process',token:resumed.token,quizToken:resumed.quizToken});assert.deepEqual(returned.lesson,complete.lesson);assert.equal(JSON.stringify(returned.material),identity);assert.deepEqual(returned.progress,returnedProgress);
 assert.equal(Object.values(providerCalls).reduce((a,b)=>a+b,0),beforeResume,'Returning must not regenerate explanations or questions');assert.deepEqual(originalSnapshot.worksheet.progress,emptyBoardProgress());assert.equal(JSON.stringify(originalSnapshot.worksheet.content),identity);
 const result={stage:representative.stage,courseId,language,questionsPreparedMs,firstBoardMs,completeBoardMs,totalMs:Date.now()-started,providerCalls,questions:10,scenes:5,scene2Seconds:Math.round(scene2Seconds),answerSeconds:Math.round(answerSeconds),freshGeneratedQuestions:true,independentlyReviewedLesson:true,midlessonAnswer:true,controllerPauseAndContinue:true,optionalOneQuestion:true,signedHandoffVerified:true,sameQuestionsAndOrder:true,progressPreserved:true,freshLoginResume:true,regeneratedQuestions:0,recordWrites:0,speechVerification:'MP3 frame parsing and duration; no human listening',targetReturn:'in-process canonical fixture; external Site storage not contacted'};
 console.log('Subject board live case passed',JSON.stringify(result));return result;
}
const results=await runBoardVerificationCases(cases,verifyCase,{concurrency});
console.log('Subject board stage passed',JSON.stringify({stage,concurrency,courses:results.map(r=>r.courseId),representatives:results.length,allCatalogContentIndividuallyVerified:false,studentRecordWrites:0}));
