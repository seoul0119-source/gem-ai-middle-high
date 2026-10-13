// Live regression for an imported MULTI-UNIT worksheet, unlike the narrow mole
// generation verifier. Only OpenAI is contacted; all learner data is fictional
// and in process. No student ID, Site row, Sheet entry or public route is created.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {scienceLessonIssues} from '../lib/science-board-content.js';
import {validMaterial,hasExcludedTopic} from '../lib/materials-ai.js';
import {verifyScienceHandoff,SCIENCE_HANDOFF_AUDIENCE} from '../lib/science-handoff.js';
import {emptyBoardProgress} from '../whiteboard/board-progress.js';
import {mixedChemistryMaterial} from '../tests/fixtures/board-chemistry-mixed.js';

if(!process.env.OPENAI_API_KEY)throw Error('Existing classroom API configuration is required.');
const courseId='suneung-2027-chemistry-1',material=structuredClone(mixedChemistryMaterial);
assert(validMaterial(material));assert(!hasExcludedTopic(material));
// Independent arithmetic/qualitative answer audit; the fixture documents all
// assumptions. These checks catch an accidental answer-key or option edit.
const expected=[String(35*0.75+37*0.25),'Mg²⁺',
 'NaCl은 물에서 이동 가능한 이온을 만들지만, 포도당은 주로 중성 분자로 존재한다.',
 'CO₂는 무극성 분자이고 H₂O는 극성 분자이다.',
 `${(8.8/44).toFixed(2)} mol`,`${(1*2/1).toFixed(1)} mol`,
 `${(0.50*20.0/250).toFixed(3)} mol/L`,`${(0.10*20.0/0.10).toFixed(1)} mL`,
 `+${-(2*1+4*(-2))}`,`CH${String(Math.round(2*0.30/0.20)).replace(/\d/g,digit=>'₀₁₂₃₄₅₆₇₈₉'[Number(digit)])}`];
assert.deepEqual(material.questions.map(q=>q.choices[q.answerIndex]),expected);

const at=Math.floor(Date.now()/1000),sourceId=randomUUID();
const student={id:'CHEMISTRY_MIXED_BUILD_TEST',session:'in-process-only',authenticatedAt:at,iat:at,exp:at+3600};
const initialProgress=emptyBoardProgress(),wrong0=(material.questions[0].answerIndex+1)%4;
initialProgress.items[0]={attempts:[wrong0],hints:1,result:'open'};
initialProgress.items[7]={attempts:[material.questions[7].answerIndex],hints:0,result:'correct'};
initialProgress.events=['mixed-build-prior-attempt','mixed-build-prior-correct'];
const snapshot={studentId:student.id,worksheet:{id:sourceId,course:courseId,topic:material.title,revision:1,content:material,progress:initialProgress},cursor:0};
let providerCalls=0;
const dependencies={
 authenticate:async()=>student,
 readTransfer:async token=>{assert.equal(token,'mixed-build-only');return structuredClone(snapshot);},
 fetcher:async(url,options)=>{
  assert(['https://api.openai.com/v1/responses','https://api.openai.com/v1/audio/speech'].includes(String(url)),'Only generation/review and speech provider requests are allowed');
  providerCalls++;return fetch(url,options);
 },
 generatePractice:async()=>{throw Error('An imported worksheet must not regenerate its questions');}
};
async function call(action,body={}){
 const response={headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(value){this.value=value;}};
 await handleScienceBoard({method:'POST',headers:{origin:'https://gem-build.invalid',host:'gem-build.invalid','content-type':'application/json'},body:{pilot:'science',action,courseId,...body}},response,dependencies);
 assert.equal(response.code,200,`Mixed chemistry ${action} failed: ${response.value}`);
 return response.headers['Content-Type']==='audio/mpeg'?response.value:JSON.parse(response.value);
}
function mp3Seconds(bytes){
 assert(Buffer.isBuffer(bytes),'Speech must contain MP3 bytes');
 let at=0,total=0,frames=0;
 if(bytes.subarray(0,3).toString()==='ID3')at=10+((bytes[6]&127)<<21)+((bytes[7]&127)<<14)+((bytes[8]&127)<<7)+(bytes[9]&127);
 while(at+4<=bytes.length){
  const h=bytes.readUInt32BE(at);
  if((h>>>21)!==2047){at++;continue;}
  const version=(h>>>19)&3,layer=(h>>>17)&3,rateIndex=(h>>>12)&15,sampleIndex=(h>>>10)&3,padding=(h>>>9)&1;
  if(version===1||layer!==1||rateIndex===0||rateIndex===15||sampleIndex===3){at++;continue;}
  const rates=version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
  const sample=[44100,48000,32000][sampleIndex]/(version===3?1:version===2?2:4);
  const size=Math.floor((version===3?144:72)*rates[rateIndex]*1000/sample)+padding;
  if(at+size>bytes.length)break;
  total+=(version===3?1152:576)/sample;frames++;at+=size;
 }
 assert(frames>20,'Expected playable MP3 frames from speech provider');return total;
}

const began=Date.now(),intro=await call('import',{transferToken:'mixed-build-only'}),firstBoardMs=Date.now()-began;
assert.equal(intro.lesson.complete,false);assert.equal(intro.lesson.scenes.length,1);
assert.equal(intro.lesson.courseId,courseId);assert.equal(intro.lesson.topicId,'worksheet');
assert.deepEqual(scienceLessonIssues(intro.lesson),[]);
assert.deepEqual(intro.material,material);assert.deepEqual(intro.progress,initialProgress);
assert.equal(intro.worksheetId,sourceId);assert.deepEqual(intro.source,{id:sourceId,revision:1});
console.log('Mixed chemistry first explanation ready',{firstBoardMs});

const complete=await call('continue',{token:intro.token,quizToken:intro.quizToken}),completeBoardMs=Date.now()-began;
assert.equal(complete.lesson.complete,true);assert.equal(complete.lesson.scenes.length,5);
assert.deepEqual(scienceLessonIssues(complete.lesson,{allowIntro:false}),[]);
assert.deepEqual({...complete.lesson,complete:false,scenes:[complete.lesson.scenes[0]]},intro.lesson,'Continuation must retain the exact identity and approved first scene');
const practice=await call('practice',{token:complete.token,quizToken:intro.quizToken});
assert.deepEqual(practice.material,material);assert.equal(practice.quizToken,intro.quizToken);
const scene2Seconds=mp3Seconds(await call('speech',{token:complete.token,scene:1,kind:'scene'}));
assert(scene2Seconds>5,'The second explanation must have a usable spoken segment');

const progress=structuredClone(initialProgress);
progress.items[0]={attempts:[wrong0,material.questions[0].answerIndex],hints:1,result:'correct'};
progress.items[1]={attempts:[],hints:0,result:'revealed'};
progress.events.push('mixed-build-correct','mixed-build-reveal');
const exported=await call('handoff',{token:complete.token,quizToken:intro.quizToken,progress,cursor:2});
const verified=verifyScienceHandoff(exported.ticket,exported.handoffToken,SCIENCE_HANDOFF_AUDIENCE);
assert(verified);assert.equal(exported.worksheetId,sourceId);assert.equal(verified.handoff.id,sourceId);
assert.equal(verified.handoff.courseId,courseId);assert.deepEqual(verified.handoff.source,{id:sourceId,revision:1});
assert.deepEqual(verified.handoff.lesson,complete.lesson);assert.deepEqual(verified.handoff.material,material);
assert.deepEqual(verified.handoff.progress,progress);assert.equal(verified.handoff.cursor,2);
assert.deepEqual(snapshot.worksheet.content,mixedChemistryMaterial);assert.deepEqual(snapshot.worksheet.progress,initialProgress);
console.log('Mixed chemistry reviewed explanation',JSON.stringify({courseId,scenes:complete.lesson.scenes}));
console.log('Mixed chemistry live checks passed',JSON.stringify({firstBoardMs,completeBoardMs,totalMs:Date.now()-began,providerCalls,topics:10,questions:10,scenes:5,scene2Seconds:Math.round(scene2Seconds),sameIntro:true,sameWorksheet:true,progressPreserved:true,regeneratedQuestions:0,speechVerification:'MP3 frames and duration; no human listening in build'}));
