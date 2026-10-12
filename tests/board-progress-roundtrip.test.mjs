import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ScienceController} from '../whiteboard/science-controller.js';
import {emptyBoardProgress,normalizeBoardProgress,mergeBoardProgress} from '../whiteboard/board-progress.js';
import {BOARD_COURSES,getBoardCourse,getBoardTopic} from '../whiteboard/board-courses.js';

const questions=()=>Array.from({length:10},(_,i)=>({prompt:`몰 관계 확인 ${i+1}`,choices:['1 mol','2 mol','3 mol','4 mol'],answerIndex:i%4,hints:['질량을 확인해 보세요.','몰 질량으로 나누어 보세요.'],explanation:'주어진 질량과 몰 질량의 관계로 확인합니다.'}));
function partlyCompleted(){
 const q=questions(),c=new ScienceController(2);c.practiceStart(q);
 c.grade(1);c.grade(0);assert(c.next()); // Q1: wrong, correct.
 c.grade(0);c.grade(2);c.grade(3);assert(c.next()); // Q2: three wrong.
 c.reveal();assert(c.next()); // Q3: explicit solution, no made-up attempt.
 c.grade(0);c.grade(1); // Q4: two wrong, still open.
 return {c,q};
}

test('every attempted question survives practice navigation and a serialized classroom round trip',()=>{
 const {c,q}=partlyCompleted(),original=structuredClone(q),saved=JSON.parse(JSON.stringify(c.progress));
 assert.deepEqual(saved.items.slice(0,4),[
  {attempts:[1,0],hints:1,result:'correct'},
  {attempts:[0,2,3],hints:2,result:'revealed'},
  {attempts:[],hints:0,result:'revealed'},
  {attempts:[0,1],hints:2,result:'open'}
 ]);
 assert.deepEqual(saved.items.slice(4),emptyBoardProgress().items.slice(4));
 const restored=new ScienceController(c.scene);restored.practiceStart(q,10,saved,c.practice.index);
 assert.deepEqual(restored.progress,saved);assert.deepEqual(restored.practice,c.practice);
 assert.equal(restored.scene,2);assert.equal(restored.practice.correct,1);assert.equal(restored.practice.index,3);assert.equal(restored.practice.attempts,2);
 assert.equal(restored.grade(3).correct,true);assert.equal(restored.practice.correct,2);assert.deepEqual(restored.progress.items[3].attempts,[0,1,3]);
 assert.deepEqual(q,original);assert.deepEqual(saved.items[3].attempts,[0,1],'restored controller must not mutate the supplied snapshot');
});

test('pause, question, reply and explanation playback do not grade or reset a partial quiz',()=>{
 const {c}=partlyCompleted(),saved=structuredClone(c.progress),practice=structuredClone(c.practice);
 c.play();c.pause();const turn=c.ask();assert(c.reply(turn));assert(c.replied(turn));c.play();
 assert.equal(c.mode,'lesson');assert.equal(c.scene,2);assert.deepEqual(c.progress,saved);assert.deepEqual(c.practice,practice);
 c.practiceStart(c.questions,10,c.progress,practice.index);
 assert.deepEqual(c.practice,practice);assert.deepEqual(c.progress,saved);
});

test('switching between optional one question and ten questions keeps earlier completed work',()=>{
 const q=questions(),c=new ScienceController();c.practiceStart(q,1);c.grade(0);
 const finished=structuredClone(c.progress.items[0]);
 c.back();c.practiceStart(q,10);assert.deepEqual(c.progress.items[0],finished);assert.equal(c.practice.solved,true);assert.equal(c.practice.correct,1);
 assert(c.next());c.grade(1);assert.equal(c.practice.correct,2);
 const ledger=structuredClone(c.progress);
 c.back();c.practiceStart(q,1);assert.equal(c.practice.correct,1);assert.equal(c.practice.solved,true);assert.deepEqual(c.progress,ledger);
});

test('lost-response replay merges once and a stale snapshot cannot reduce attempts, hints or score',()=>{
 const {c,q}=partlyCompleted(),before=structuredClone(c.progress),remote=structuredClone(before);
 before.events=[randomUUID()];remote.events=[...before.events,randomUUID()];
 remote.items[3]={attempts:[0,1,3],hints:2,result:'correct'};
 const returned=mergeBoardProgress(before,remote,q);assert(returned);assert.deepEqual(returned.items[3],remote.items[3]);assert.equal(returned.items.filter(i=>i.result==='correct').length,2);
 const replayed=mergeBoardProgress(returned,remote,q);assert.deepEqual(replayed,returned);
 const stale=mergeBoardProgress(returned,before,q);assert.deepEqual(stale,returned);
 assert.deepEqual(before.items[3],c.progress.items[3]);assert.equal(remote.items[3].result,'correct');
});

test('explicitly revealed work cannot be converted into a correct answer by a stale prefix extension',()=>{
 const q=questions(),saved=emptyBoardProgress(),incoming=emptyBoardProgress();
 saved.items[0]={attempts:[1],hints:1,result:'revealed'};
 incoming.items[0]={attempts:[1,0],hints:2,result:'correct'};
 const result=mergeBoardProgress(saved,incoming,q);
 assert(result);assert.deepEqual(result.items[0].attempts,[1]);assert.equal(result.items[0].result,'revealed');assert.equal(result.items.filter(i=>i.result==='correct').length,0);
 assert.equal(saved.items[0].hints,1,'normalization and merge leave caller data untouched');
});

test('divergent attempts preserve the canonical learner work instead of appending another branch',()=>{
 const q=questions(),saved=emptyBoardProgress(),incoming=emptyBoardProgress();
 saved.items[0]={attempts:[1],hints:1,result:'open'};incoming.items[0]={attempts:[2,0],hints:2,result:'correct'};
 const result=mergeBoardProgress(saved,incoming,q);assert(result);assert.deepEqual(result.items[0].attempts,[1]);assert.equal(result.items[0].result,'open');
});

test('portable progress rejects forged success, impossible extra attempts, invalid choice positions and bounds',()=>{
 const q=questions();
 for(const mutate of [
  p=>p.items[0]={attempts:[1],hints:0,result:'correct'},
  p=>p.items[0]={attempts:[0,1],hints:0,result:'open'},
  p=>p.items[0]={attempts:[1,2,3,1],hints:0,result:'revealed'},
  p=>p.items[0]={attempts:[4],hints:0,result:'open'},
  p=>p.items[0]={attempts:[],hints:3,result:'open'},
  p=>p.items[0]={attempts:[1,2,3],hints:0,result:'open'},
  p=>p.items.pop(),
  p=>p.events=Array.from({length:1001},()=>randomUUID())
 ]){const invalid=emptyBoardProgress();mutate(invalid);assert.equal(normalizeBoardProgress(invalid,q),null);}
 const explicit=emptyBoardProgress();explicit.items[0].result='revealed';assert.equal(normalizeBoardProgress(explicit,q).items[0].result,'revealed');
});

test('legacy aggregate practice does not fabricate the missing earlier choice history',()=>{
 const q=questions(),c=new ScienceController();c.practiceStart(q);c.legacyPractice=true;
 c.practice={count:10,index:3,attempts:2,solved:false,revealed:false,correct:2,selected:0};
 c.grade(3);assert.equal(c.practice.solved,true);assert.equal(c.practice.attempts,3);assert.equal(c.practice.correct,3);
 assert.deepEqual(c.progress.items[3].attempts,[],'two unknown historical choices cannot be invented from the last selected choice');
});

// Run the shipped browser module, not a reimplementation of its transitions.
// Audio.play() is observed here through a double; physical audibility is a
// separate live-browser check.
const browserSource=(await readFile(new URL('../whiteboard/science-classroom.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const markup=await readFile(new URL('../science-board.html',import.meta.url),'utf8');
const CHEM='suneung-2027-chemistry-1',STUDENT='BOARD-ROUNDTRIP-TEST';
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.value='';this.textContent='';this.attrs={};this.classList={toggle(){}};}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}setAttribute(key,value){this.attrs[key]=value;}querySelectorAll(){return this.children;}
 focus(){this.onfocus?.();}click(){if(!this.disabled)return this.onclick?.({preventDefault(){}});}remove(){this.removed=true;}
}
function browserSnapshot(){
 const {c,q}=partlyCompleted(),id=randomUUID(),worksheetId=randomUUID();
 const lesson={id,courseId:CHEM,topicId:'chemistry-mole',title:getBoardTopic(CHEM,'chemistry-mole').title,language:'ko',complete:true,createdAt:Date.now(),scenes:Array.from({length:5},(_,i)=>({title:'몰 개념 '+(i+1),lines:['질량과 물질의 양을 구분합니다.','물질의 양 = 질량 ÷ 몰 질량'],narration:'몰의 뜻과 몰 질량을 설명합니다. '+i}))};
 return {lesson,token:'saved-lesson-token',quiz:{title:'현재 화학Ⅰ 10문제',questions:q},quizToken:'saved-quiz-token',source:{id:worksheetId,revision:7},worksheetId,progress:structuredClone(c.progress),scene:2,mode:'practice',practice:structuredClone(c.practice),audioTime:17,audioScene:id+':2',history:[],timings:{board:2,voice:3,questions:4},savedAt:Date.now()};
}
const baseKey=(student=STUDENT,course=CHEM)=>`gem-science-board:${student}`+(course==='h3-science'?'':':course:'+course);
async function mountBoard({snapshot=browserSnapshot(),storage=new Map(),student=STUDENT,course=CHEM,worksheet=snapshot.worksheetId,transfer='',importReply,resumeReply,storeSnapshot=true}={}){
 const elements=new Map(),audios=[],calls=[],events=new Map(),recorded=[],submissions=[],sequence=[];
 for(const match of markup.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/g)){const id=match[2].match(/\bid="([^"]+)"/)?.[1];if(id)elements.set('#'+id,new Element(match[1]));}
 elements.get('#speed').value='1';
 const ownKey=baseKey(student,course)+':worksheet:'+worksheet;
 if(storeSnapshot){storage.set(baseKey(),JSON.stringify(snapshot));storage.set(baseKey()+':worksheet:'+snapshot.worksheetId,JSON.stringify(snapshot));}
 const location={href:`https://gem.example/science-board.html?course=${course}&worksheet=${worksheet}`+(transfer?'#transfer='+transfer:''),reload(){}};
 const document={body:new Element('body'),documentElement:{},querySelector:selector=>{assert(elements.has(selector),selector);return elements.get(selector);},createElement:tag=>{const el=new Element(tag);if(tag==='form')el.submit=()=>{sequence.push('submit');submissions.push({action:el.action,fields:el.children.map(v=>({name:v.name,value:v.value}))});};return el;},createTextNode:text=>text,addEventListener:(event,fn)=>events.set(event,fn),hidden:false};
 class TestURL extends URL{static number=0;static createObjectURL(){return 'blob:test-'+ ++this.number;}static revokeObjectURL(){}}
 class Audio{constructor(src){this.src=src;this.currentTime=0;this.duration=50;this.ended=false;this.playing=false;audios.push(this);}async play(){this.playing=true;}pause(){this.playing=false;}finish(){this.playing=false;this.ended=true;this.currentTime=50;this.onended?.();}}
 const defaultReply={lesson:snapshot.lesson,token:'renewed-lesson',material:snapshot.quiz,quizToken:'renewed-quiz',source:snapshot.source,progress:snapshot.progress,cursor:snapshot.practice.index};
 const fetch=async(url,options)=>{
  if(url==='/api/session')return Response.json({authenticated:true,student:{id:student,name:'검증 학생'}});
  const body=JSON.parse(options.body);calls.push(body);sequence.push(body.action);
  if(body.action==='resume')return Response.json(resumeReply||defaultReply);
  if(body.action==='import')return Response.json(importReply||defaultReply);
  if(body.action==='ask')return Response.json({answer:'질량을 몰 질량으로 나누면 물질의 양을 구할 수 있어요.'});
  if(body.action==='speech')return new Response(new Blob(['fake mp3'],{type:'audio/mpeg'}));
  if(body.action==='handoff')return Response.json({ticket:'verified-classroom-ticket',handoffToken:'signed-worksheet-token',entryUrl:'https://gem-english-middle-school-math.seoul0119.chatgpt.site/api/learning/science-entry',worksheetId:snapshot.worksheetId,courseId:course});
  throw Error('Unexpected content generation or action: '+body.action);
 };
 const createScienceRecords=options=>{assert.equal(options.studentId,student);assert.equal(options.courseId,course);return{start:async lesson=>{recorded.push(['start',lesson]);return true;},event:(type,payload)=>{recorded.push([type,payload]);return true;},flush:async()=>{sequence.push('flush');return true;},end:async()=>true,exit:()=>recorded.push(['exit'])};};
 const window={addEventListener:(event,fn)=>events.set(event,fn),history:{replaceState:(_a,_b,url)=>{location.href=url;}}};
 const sandbox={BOARD_COURSES,getBoardCourse,getBoardTopic,emptyBoardProgress,normalizeBoardProgress,mergeBoardProgress,ScienceController,createScienceRecords,document,window,location,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},URL:TestURL,URLSearchParams,Audio,fetch,navigator:{},AbortController,setTimeout,clearTimeout,console,Blob,FileReader:class{}};
 await vm.runInNewContext(`(async()=>{${browserSource}\n})()`,sandbox);await settle();
 return {get:selector=>elements.get(selector),audios,calls,storage,recorded,submissions,sequence,location,snapshot,saved:()=>JSON.parse(storage.get(ownKey)||'null'),close:()=>events.get('pagehide')?.()};
}

test('chemistry browser restores practice, actually calls audio play, answers a question and resumes the exact narration position',async()=>{
 const f=await mountBoard();
 try{
  assert.equal(f.get('#practice-heading').textContent,'문제 4 / 10');assert(f.get('#feedback').textContent.includes('2/3회'));
  assert.equal(f.audios.length,0);f.get('#play').click();await settle();
  const narration=f.audios.find(a=>a.playing);assert(narration,'a status label alone is insufficient');assert.equal(narration.currentTime,17);assert.equal(f.get('#practice-panel').hidden,true);
  f.get('#question').focus();assert.equal(narration.playing,false);f.get('#question').value='몰 질량은 무엇인가요?';await f.get('#question-form').onsubmit({preventDefault(){}});await settle();
  const answer=f.audios.find(a=>a.playing);assert(answer);assert.notEqual(answer,narration);const asked=f.calls.find(c=>c.action==='ask');assert.equal(asked.scene,2);assert.equal(asked.quizToken,'renewed-quiz','concept questions retain the same canonical ten-question context');assert.equal(asked.questionIndex,undefined,'a concept question must not become an answer attempt');
  answer.finish();f.get('#play').click();await settle();assert.equal(narration.playing,true);assert.equal(narration.currentTime,17);
  f.get('#ten').click();assert.equal(f.get('#practice-heading').textContent,'문제 4 / 10');assert(f.get('#feedback').textContent.includes('2/3회'));
  f.get('#choices').children[3].click();assert.equal(f.saved().progress.items[3].result,'correct');
  assert.equal(f.saved().progress.items.filter(p=>p.result==='correct').length,2);
  assert(!f.calls.some(c=>['start','continue','practice'].includes(c.action)));assert.deepEqual(f.saved().quiz,f.snapshot.quiz);
 }finally{f.close();}
});

test('same worksheet returns from Mei with its newer progress and retains the board scene, time and all question identities',async()=>{
 const snapshot=browserSnapshot(),incoming=structuredClone(snapshot.progress);incoming.items[3]={attempts:[0,1,3],hints:2,result:'correct'};
 const reply={lesson:snapshot.lesson,token:'returned-lesson',material:snapshot.quiz,quizToken:'returned-quiz',source:{id:snapshot.worksheetId,revision:8},progress:incoming,cursor:4};
 const f=await mountBoard({snapshot,transfer:'single-use-worksheet-transfer',importReply:reply});
 try{
  assert.equal(f.calls.filter(c=>c.action==='import').length,1);assert(!f.calls.some(c=>['start','practice','continue'].includes(c.action)));
  assert.equal(f.location.href.includes('#'),false);assert.deepEqual(f.saved().progress,incoming);assert.equal(f.saved().source.revision,8);
  f.get('#play').click();await settle();assert.equal(f.audios.find(a=>a.playing).currentTime,17);assert.equal(f.get('#scene-count').textContent,'3 / 5');
  f.get('#ten').click();assert.equal(f.get('#practice-heading').textContent,'문제 5 / 10');
  await f.get('#handoff').click();await settle();
  const handoff=f.calls.find(c=>c.action==='handoff');assert.deepEqual(handoff.progress,incoming);assert.equal(handoff.cursor,4);
  assert.equal(f.submissions.length,1);assert(f.sequence.indexOf('flush')<f.sequence.indexOf('handoff'));assert(f.sequence.indexOf('handoff')<f.sequence.indexOf('submit'));
  assert.deepEqual(f.saved().quiz,snapshot.quiz);assert.equal(f.saved().worksheetId,snapshot.worksheetId);
 }finally{f.close();}
});

test('browser Back refreshes the canonical worksheet progress while retaining its exact explanation and audio position',async()=>{
 const snapshot=browserSnapshot(),latest=structuredClone(snapshot.progress);latest.items[3]={attempts:[0,1,3],hints:2,result:'correct'};
 const f=await mountBoard({snapshot,resumeReply:{lesson:snapshot.lesson,token:'renewed-lesson',material:snapshot.quiz,quizToken:'renewed-quiz',source:{id:snapshot.worksheetId,revision:8},progress:latest,cursor:4}});
 try{
  const resume=f.calls.find(c=>c.action==='resume');assert.equal(resume.refreshWorksheet,true,'signed restoration must ask for current worksheet work after browser Back');
  assert.deepEqual(f.saved().progress,latest);assert.equal(f.saved().source.revision,8);assert.equal(f.saved().progress.items.filter(p=>p.result==='correct').length,2);
  assert.deepEqual(f.saved().quiz,snapshot.quiz);assert.deepEqual(f.saved().lesson,snapshot.lesson);
  f.get('#play').click();await settle();assert.equal(f.audios.find(a=>a.playing).currentTime,17);assert.equal(f.get('#scene-count').textContent,'3 / 5');
  assert(!f.calls.some(c=>['start','continue','practice'].includes(c.action)));
 }finally{f.close();}
});

test('a mismatched renewal cannot replace the questions or clear the existing attempts',async()=>{
 const snapshot=browserSnapshot(),replacement=structuredClone(snapshot.quiz);replacement.questions[3].prompt='UNRELATED REPLACEMENT';
 const f=await mountBoard({snapshot,resumeReply:{lesson:snapshot.lesson,token:'unexpected-renewal',material:replacement,quizToken:'unexpected-quiz'}});
 try{
  assert.equal(f.get('#play').disabled,true);assert.equal(f.get('#handoff').disabled,true);assert.equal(f.audios.length,0);
  assert.deepEqual(f.saved().quiz,snapshot.quiz);assert.deepEqual(f.saved().progress,snapshot.progress);assert(!f.calls.some(c=>['start','practice','continue'].includes(c.action)));
 }finally{f.close();}
});

test('course, student and requested worksheet cannot restore one another’s saved board data',async()=>{
 const snapshot=browserSnapshot(),storage=new Map([[baseKey(),JSON.stringify(snapshot)],[baseKey()+':worksheet:'+snapshot.worksheetId,JSON.stringify(snapshot)]]);
 for(const options of [{student:'OTHER-STUDENT'},{course:'h3-science'},{worksheet:randomUUID()}]){
  const f=await mountBoard({snapshot,storage,storeSnapshot:false,...options});
  try{assert.equal(f.calls.length,0);assert.equal(f.audios.length,0);assert.equal(f.get('#play').disabled,true);assert.equal(f.get('#new-lesson').disabled,true);}finally{f.close();}
 }
 assert.deepEqual(JSON.parse(storage.get(baseKey()+':worksheet:'+snapshot.worksheetId)),snapshot);
});
