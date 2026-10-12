// Real provider checks for the pilot, using fictional in-process authentication.
// This never creates learner IDs, calls the Sheet, or adds a public test bypass.
import assert from 'node:assert/strict';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {scienceLessonIssues} from '../lib/science-board-content.js';
import {validMaterial} from '../lib/materials-ai.js';

if(!process.env.OPENAI_API_KEY)throw Error('Existing classroom API configuration is required.');
const now=Math.floor(Date.now()/1000);
const student={id:'SCIENCE_BUILD_TEST',session:'in-process-only',authenticatedAt:now,iat:now,exp:now+3600};
async function call(action,body={}){
 const response={headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(value){this.value=value;}};
 await handleScienceBoard({method:'POST',headers:{origin:'https://gem-build.invalid',host:'gem-build.invalid','content-type':'application/json'},body:{pilot:'science',action,...body}},response,{authenticate:async()=>student});
 if(response.code!==200)throw Error(`Science pilot ${action} failed (${response.code}): ${response.value}`);
 return response.headers['Content-Type']==='audio/mpeg'?response.value:JSON.parse(response.value);
}
// Sum MPEG Layer III frame durations, rather than infer duration from text length.
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
const intro=await call('start',{topicId:'induction'});
assert.equal(intro.lesson.complete,false);assert.equal(scienceLessonIssues(intro.lesson).length,0);
const firstBoardMs=Date.now()-begin;
console.log('Science pilot first reviewed board',{milliseconds:firstBoardMs,title:intro.lesson.title,lines:intro.lesson.scenes[0].lines});
let firstVoiceMs,questionsMs;
const [complete,practice,firstAudio]=await Promise.all([
 call('continue',{token:intro.token}),
 call('practice',{token:intro.token}).then(value=>{questionsMs=Date.now()-begin;return value;}),
 call('speech',{token:intro.token,scene:0,kind:'scene'}).then(value=>{firstVoiceMs=Date.now()-begin;return value;})
]);
assert.equal(complete.lesson.complete,true);assert.equal(scienceLessonIssues(complete.lesson,{allowIntro:false}).length,0);
assert.deepEqual(complete.lesson.scenes[0],intro.lesson.scenes[0]);assert(validMaterial(practice.material));
console.log('Science pilot generated lesson',JSON.stringify({topic:complete.lesson.topicId,scenes:complete.lesson.scenes}));
console.log('Science pilot reviewed practice',JSON.stringify(practice.material));
const durations=[mp3Seconds(firstAudio)];
for(let index=1;index<5;index+=2){
 const batch=await Promise.all([index,index+1].filter(scene=>scene<5).map(async scene=>mp3Seconds(await call('speech',{token:complete.token,scene,kind:'scene'}))));
 durations.push(...batch);
}
const answer=await call('ask',{token:complete.token,scene:2,text:'코일을 지나는 자기 선속이 변하지 않으면 유도 기전력이 생기나요?',history:[]});
assert(answer.answer.length>20);console.log('Science pilot teacher reply',answer.answer);
const totalSeconds=Math.round(durations.reduce((sum,x)=>sum+x,0));
// A bounded duration catches an unusably brief or long lecture. The interface
// describes 3–5 minutes as a target; generated speech varies with each request.
assert(totalSeconds>=120&&totalSeconds<=390,`Unexpected science narration duration: ${totalSeconds}s`);
const next=await call('start',{topicId:'momentum'});
assert.notEqual(next.lesson.id,intro.lesson.id);assert.equal(next.lesson.topicId,'momentum');
assert.equal(scienceLessonIssues(next.lesson).length,0);
console.log('Science pilot next unit',{title:next.lesson.title,lines:next.lesson.scenes[0].lines});
console.log('Science pilot live checks passed',JSON.stringify({firstBoardMs,firstVoiceMs,questionsMs,scenes:complete.lesson.scenes.length,questions:practice.material.questions.length,narrationSeconds:totalSeconds,sceneSeconds:durations.map(Math.round)}));
