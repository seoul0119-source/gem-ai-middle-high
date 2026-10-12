// Provider-backed checks with a fictional in-process learner and worksheet.
// This script creates no student ID, Site row, Sheet entry or public test route.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {scienceLessonIssues} from '../lib/science-board-content.js';
import {handleMaterials,validMaterial} from '../lib/materials-ai.js';
import {verifyScienceHandoff,SCIENCE_HANDOFF_AUDIENCE} from '../lib/science-handoff.js';
import {getBoardTopic} from '../whiteboard/board-courses.js';
import {emptyBoardProgress} from '../whiteboard/board-progress.js';

if(!process.env.OPENAI_API_KEY)throw Error('Existing classroom API configuration is required.');
const courseId='suneung-2027-chemistry-1',topic=getBoardTopic(courseId,'chemistry-mole');
const authenticationTime=Math.floor(Date.now()/1000);
const student={id:'CHEMISTRY_BUILD_TEST',session:'in-process-only',authenticatedAt:authenticationTime,iat:authenticationTime,exp:authenticationTime+3600};
let providerCalls=0;
const providerFetch=async(url,options)=>{
 assert(String(url).startsWith('https://api.openai.com/v1/'),'Live verifier must not call learner storage or another service');
 providerCalls++;return fetch(url,options);
};
let snapshot;
const readTransfer=async token=>{assert.equal(token,'build-verification-only');return snapshot;};
async function call(action,body={},extra={}){
 const response={headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(value){this.value=value;}};
 await handleScienceBoard({method:'POST',headers:{origin:'https://gem-build.invalid',host:'gem-build.invalid','content-type':'application/json'},body:{pilot:'science',action,courseId,...body}},response,{authenticate:async()=>student,fetcher:providerFetch,readTransfer,...extra});
 if(response.code!==200)throw Error(`Chemistry board ${action} failed (${response.code}): ${response.value}`);
 return response.headers['Content-Type']==='audio/mpeg'?response.value:JSON.parse(response.value);
}
function mp3Seconds(bytes){
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

const begin=Date.now();
// The same existing worksheet generator used by the running classrooms.
const {material}=await handleMaterials({mode:'generate',courseId,topic:topic.practiceTopic,lessonContext:JSON.stringify({title:topic.title,outline:topic.outline,facts:topic.facts}),variation:randomUUID()},{fetcher:providerFetch});
assert(validMaterial(material));
const questionsPreparedMs=Date.now()-begin,originalMaterial=structuredClone(material),sourceId=randomUUID(),initialProgress=emptyBoardProgress();
const wrong0=(material.questions[0].answerIndex+1)%4;
initialProgress.items[0]={attempts:[wrong0],hints:1,result:'open'};
initialProgress.events=['chemistry-build-existing-attempt'];
snapshot={studentId:student.id,worksheet:{id:sourceId,course:courseId,topic:topic.title,revision:1,content:material,progress:initialProgress},cursor:0};
const boardBegin=Date.now();
const intro=await call('import',{transferToken:'build-verification-only'});
assert.equal(intro.lesson.courseId,courseId);assert.equal(intro.lesson.topicId,'worksheet');assert.equal(intro.lesson.complete,false);
assert.equal(scienceLessonIssues(intro.lesson).length,0);assert.deepEqual(intro.material,originalMaterial);
assert.deepEqual(intro.progress,initialProgress);assert.equal(intro.source.id,sourceId);assert.equal(intro.source.revision,1);
const firstBoardMs=Date.now()-boardBegin;
console.log('Chemistry board first reviewed explanation',{milliseconds:firstBoardMs,sourceQuestionPreparationMs:questionsPreparedMs,title:intro.lesson.title,lines:intro.lesson.scenes[0].lines});

let firstVoiceMs,completeBoardMs;
const [complete,firstAudio]=await Promise.all([
 call('continue',{token:intro.token,quizToken:intro.quizToken}).then(value=>{completeBoardMs=Date.now()-boardBegin;return value;}),
 call('speech',{token:intro.token,scene:0,kind:'scene'}).then(value=>{firstVoiceMs=Date.now()-boardBegin;return value;})
]);
assert.equal(scienceLessonIssues(complete.lesson,{allowIntro:false}).length,0);
assert.deepEqual(complete.lesson.scenes[0],intro.lesson.scenes[0]);assert.equal(complete.lesson.id,intro.lesson.id);
const durations=[mp3Seconds(firstAudio)];
for(let index=1;index<5;index+=2){
 const batch=await Promise.all([index,index+1].filter(scene=>scene<5).map(async scene=>mp3Seconds(await call('speech',{token:complete.token,scene,kind:'scene'}))));
 durations.push(...batch);
}
const answer=await call('ask',{token:complete.token,quizToken:intro.quizToken,scene:2,text:'같은 몰 수인 두 물질은 입자 수와 질량이 모두 같나요? 몰 질량 M과 시료의 질량 m을 구별하고 각각의 단위를 말해 주세요.',history:[]});
assert(answer.answer.length>30);
assert.match(answer.answer,/(?:g\s*\/\s*mol|g\s*[·⋅]?\s*mol\s*(?:⁻¹|\^\s*-1)|그램\s*(?:퍼|\/|나누기)\s*몰|몰\s*당\s*(?:\d+(?:\.\d+)?\s*)?그램)/iu,'Chemistry reply must name the molar-mass unit, not only sample mass in grams');
const answerAudio=await call('speech',{token:complete.token,scene:2,kind:'answer',text:answer.answer});
const answerVoiceSeconds=mp3Seconds(answerAudio);
console.log('Chemistry board teacher reply',answer.answer);

const progress=structuredClone(initialProgress);
progress.items[0]={attempts:[wrong0,material.questions[0].answerIndex],hints:1,result:'correct'};
progress.items[1]={attempts:[],hints:0,result:'revealed'};
progress.events.push('chemistry-build-correct-attempt','chemistry-build-show-solution');
const exported=await call('handoff',{token:complete.token,quizToken:intro.quizToken,progress,cursor:2});
const verified=verifyScienceHandoff(exported.ticket,exported.handoffToken,SCIENCE_HANDOFF_AUDIENCE);
assert(verified);assert.equal(verified.handoff.id,sourceId);assert.equal(exported.worksheetId,sourceId);
assert.deepEqual(verified.handoff.source,{id:sourceId,revision:1});assert.equal(verified.handoff.courseId,courseId);
assert.deepEqual(verified.handoff.material,originalMaterial);assert.deepEqual(verified.handoff.lesson,complete.lesson);
assert.deepEqual(verified.handoff.progress,progress);assert.equal(verified.handoff.cursor,2);

// Reauthentication renews only the already signed exact content. Source import
// of that same worksheet must likewise restore the same scene array and ID.
student.authenticatedAt=Math.floor(Date.now()/1000);student.session='in-process-relogin-only';
const callsBeforeResume=providerCalls;
const forbidGeneration=async()=>{throw Error('Resume must not generate a lesson or question');};
const noGeneration={generateIntro:forbidGeneration,generateRemainder:forbidGeneration,generatePractice:forbidGeneration};
const resumed=await call('resume',{token:complete.token,quizToken:intro.quizToken},noGeneration);
assert.deepEqual(resumed.lesson,complete.lesson);assert.deepEqual(resumed.material,originalMaterial);
snapshot={...snapshot,worksheet:{...snapshot.worksheet,revision:2,progress,content:{...originalMaterial,lesson:complete.lesson}},cursor:2};
const refreshed=await call('resume',{token:resumed.token,quizToken:resumed.quizToken,refreshWorksheet:true},{...noGeneration,readLatest:async proof=>{
 const checked=verifyScienceHandoff(proof.ticket,proof.handoffToken,SCIENCE_HANDOFF_AUDIENCE);
 assert(checked);assert.equal(checked.handoff.id,sourceId);assert.deepEqual(checked.handoff.material,originalMaterial);
 return snapshot;
}});
assert.deepEqual(refreshed.progress,progress);assert.equal(refreshed.source.revision,2);assert.equal(refreshed.cursor,2);assert.equal(refreshed.syncPending,undefined);
const returned=await call('import',{transferToken:'build-verification-only',token:resumed.token,quizToken:resumed.quizToken},noGeneration);
assert.deepEqual(returned.lesson,complete.lesson);assert.deepEqual(returned.material,originalMaterial);
assert.deepEqual(returned.progress,progress);assert.equal(returned.source.revision,2);assert.equal(returned.cursor,2);
assert.equal(providerCalls,callsBeforeResume);
const replay=await call('speech',{token:returned.token,scene:2,kind:'scene'});
assert(mp3Seconds(replay)>5);
const narrationSeconds=Math.round(durations.reduce((sum,value)=>sum+value,0));
assert(narrationSeconds>=120&&narrationSeconds<=390,`Unexpected chemistry narration duration: ${narrationSeconds}s`);
console.log('Chemistry board generated lesson',JSON.stringify({courseId,scenes:complete.lesson.scenes}));
console.log('Chemistry board reviewed canonical questions',JSON.stringify(originalMaterial));
console.log('Chemistry board live checks passed',JSON.stringify({questionsPreparedMs,firstBoardMs,firstVoiceMs,completeBoardMs,totalMs:Date.now()-begin,providerCalls,scenes:5,questions:10,narrationSeconds,sceneSeconds:durations.map(Math.round),answerVoiceSeconds:Math.round(answerVoiceSeconds),sameWorksheet:true,freshLoginResume:true,regeneratedQuestions:0,speechVerification:'MP3 frames and duration; no human listening in build'}));
