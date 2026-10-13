// Execute the shipped module with DOM/audio doubles; no physical device claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ScienceController} from '../whiteboard/science-controller.js';
import {SCIENCE_TOPICS} from '../whiteboard/science-topics.js';
import {BOARD_COURSES,getBoardCourse,getBoardTopic} from '../whiteboard/board-courses.js';
import {createBoardUi,applyBoardUi,boardCourseGroups,BOARD_UI_COPY} from '../whiteboard/board-ui.js';
import {emptyBoardProgress,normalizeBoardProgress,mergeBoardProgress} from '../whiteboard/board-progress.js';
const source=(await readFile(new URL('../whiteboard/science-classroom.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const markup=await readFile(new URL('../science-board.html',import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
class Element{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.value='';this.textContent='';this.attrs={};this.classList={toggle(){}};}append(...x){this.children.push(...x);}replaceChildren(...x){this.children=[...x];}setAttribute(k,v){this.attrs[k]=v;}querySelectorAll(){return this.children;}focus(){this.onfocus?.();}click(){if(!this.disabled)return this.onclick?.({preventDefault(){}});}remove(){this.removed=true;}}
function lesson(id='run-1',complete=false,topicId='induction',courseId='h3-science'){return{id,topicId,title:getBoardTopic(courseId,topicId).title,language:getBoardCourse(courseId).language,courseId,scenes:Array.from({length:complete?5:1},(_,i)=>({title:'Scene '+i,lines:['Key idea '+i,'Conditions '+i,'Example '+i],narration:'Explanation for this scene. '+i})),complete,createdAt:new Date().toISOString()};}
const material={title:'Acids and neutralisation',questions:Array.from({length:10},(_,i)=>({prompt:'Question '+i,choices:['First','Second','Third','Fourth'],answerIndex:i%4,hints:['First hint','Second hint'],explanation:'Solution with conditions '+i}))};
async function mount({deferContinue=false,deferPractice=false,deferAnswer=false,deferAnswerSpeech=false,deferHandoff=false,deferFlush=false,flushFailures=0,handoffReplies=[],resumeReplies=[],speechReplies=[],deferResume=false,stored=null,courseId='h3-science',worksheetId='',continueReplies=[],importReplies=[]}={}){
 const elements=new Map(),audios=[],calls=[],events=new Map(),storage=new Map(),recorded=[],submissions=[],sequence=[];let resolveContinue,resolvePractice,resolveAnswer,resolveAnswerSpeech,resolveHandoff,resolveFlush,resolveResume,runNumber=0,activeLesson=null;
 for(const m of markup.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/g)){const id=m[2].match(/\bid="([^"]+)"/)?.[1];if(id)elements.set('#'+id,new Element(m[1]));}
 elements.get('#speed').value='1';if(stored)storage.set('gem-science-board:T_TEST'+(courseId==='h3-science'?'':':course:'+courseId)+(worksheetId?':worksheet:'+worksheetId:''),JSON.stringify(stored));
 const document={body:new Element('body'),documentElement:{},querySelector:s=>{assert(elements.has(s),s);return elements.get(s);},createElement:tag=>{const el=new Element(tag);if(tag==='form')el.submit=()=>{sequence.push('submit');submissions.push({method:el.method,action:el.action,target:el.target,fields:el.children.map(c=>({name:c.name,value:c.value,type:c.type}))});};return el;},createTextNode:x=>x,addEventListener:(n,f)=>events.set(n,f),hidden:false};
 const location={href:'https://gem.example/science-board.html'+(courseId!=='h3-science'||worksheetId?'?course='+courseId:'')+(worksheetId?'&worksheet='+worksheetId+'#transfer=verified-transfer':''),reload(){}};
 class TestURL extends URL{static n=0;static createObjectURL(){return'blob:'+ ++this.n;}static revokeObjectURL(){}}
 class Audio{constructor(src){this.src=src;this.currentTime=0;this.duration=50;this.ended=false;this.playing=false;audios.push(this);}async play(){this.playing=true;}pause(){this.playing=false;}finish(){this.playing=false;this.ended=true;this.currentTime=50;this.onended?.();}}
 const fetch=async(url,options)=>{if(url==='/api/session')return Response.json({authenticated:true,student:{id:'T_TEST',name:'Student'}});const b=JSON.parse(options.body);calls.push(b);sequence.push(b.action);assert.equal(b.pilot,'science');if(b.action==='resume'){const fallback={lesson:stored?.lesson||lesson('run-'+runNumber,true),token:'renewed-token',material:stored?.quiz||material,quizToken:'renewed-quiz'},reply=resumeReplies.shift()||fallback,result=()=>reply.status?Response.json({error:reply.error},{status:reply.status}):Response.json(reply);if(deferResume)return new Promise(resolve=>{resolveResume=()=>resolve(result());});return result();}if(b.action==='handoff'){const fallback={ticket:'ticket-123',handoffToken:'signed-handoff-token',entryUrl:'https://gem-english-middle-school-math.seoul0119.chatgpt.site/api/learning/science-entry'},reply=handoffReplies.shift()||fallback,result=()=>reply.status?Response.json({error:reply.error||'handoff_unavailable'},{status:reply.status}):Response.json(reply);if(deferHandoff)return new Promise(resolve=>{resolveHandoff=()=>resolve(result());});return result();}if(b.action==='start'){runNumber++;activeLesson=lesson('run-'+runNumber,false,b.topicId,courseId);return Response.json({lesson:activeLesson,token:'token-'+runNumber});}if(b.action==='import'){const reply=importReplies.shift()||{lesson:lesson('imported',false,'worksheet',courseId),token:'imported-token',material,quizToken:'imported-quiz',source:{id:worksheetId,revision:1},progress:emptyBoardProgress(),cursor:0};activeLesson=reply.lesson;return Response.json(reply);}if(b.action==='continue'){const current=activeLesson||stored?.lesson||lesson('run-'+runNumber,false,elements.get('#topic').value,courseId),reply=continueReplies.shift()||{lesson:lesson(current.id,true,current.topicId,courseId),token:'full-token-'+runNumber};const result=()=>reply.status?Response.json({error:reply.error||'lesson_unavailable'},{status:reply.status}):Response.json(reply);if(deferContinue)return new Promise(resolve=>{resolveContinue=()=>resolve(result());});return result();}if(b.action==='practice'){const result=()=>Response.json({material,quizToken:'quiz-token-'+runNumber});if(deferPractice)return new Promise(resolve=>{resolvePractice=()=>resolve(result());});return result();}if(b.action==='ask'){const result=()=>Response.json({answer:'Here is the explanation.'});if(deferAnswer)return new Promise(resolve=>{resolveAnswer=()=>resolve(result());});return result();}if(b.action==='speech'){const failure=speechReplies.shift();if(failure)return Response.json({error:failure.error},{status:failure.status});const result=()=>new Response(new Blob(['fake mp3'],{type:'audio/mpeg'}));if(deferAnswerSpeech&&b.kind==='answer')return new Promise(resolve=>{resolveAnswerSpeech=()=>resolve(result());});return result();}throw Error('Unexpected '+b.action);};
 const createScienceRecords=()=>({start:async l=>{recorded.push(['start',l]);return true;},event:(type,payload)=>{recorded.push([type,payload]);return true;},end:async()=>true,flush:async()=>{recorded.push(['flush']);sequence.push('flush');const result=()=>{if(flushFailures>0){flushFailures--;return false;}return true;};if(deferFlush)return new Promise(resolve=>{resolveFlush=()=>resolve(result());});return result();},exit:()=>{recorded.push(['exit']);}});
 const window={addEventListener:(n,f)=>events.set(n,f)};
 const sandbox={createBoardUi,applyBoardUi,boardCourseGroups,URLSearchParams,BOARD_COURSES,getBoardCourse,getBoardTopic,emptyBoardProgress,normalizeBoardProgress,mergeBoardProgress,SCIENCE_TOPICS,ScienceController,createScienceRecords,document,window,location,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},URL:TestURL,Audio,fetch,navigator:{},AbortController,setTimeout,clearTimeout,console,Blob,FileReader:class{}};
 await vm.runInNewContext(`(async()=>{${source}\n})()`,sandbox);await settle();
 return{document,location,elements,get:s=>elements.get(s),audios,calls,events,storage,recorded,submissions,sequence,resolveResume:()=>resolveResume?.(),resolveHandoff:()=>resolveHandoff?.(),resolveFlush:()=>resolveFlush?.(),resolveContinue:()=>resolveContinue?.(),resolvePractice:()=>resolvePractice?.(),resolveAnswer:()=>resolveAnswer?.(),resolveAnswerSpeech:()=>resolveAnswerSpeech?.(),start:async()=>{await elements.get('#lesson-form').onsubmit({preventDefault(){}});await settle();},close:()=>events.get('pagehide')()};
}

const worksheetId='123e4567-e89b-42d3-a456-426614174099';
const courses=['e1-math','materials-en-1-0','materials-fr-1-0'];
for(const courseId of courses){
 const language=getBoardCourse(courseId).language,ui=createBoardUi(language);
 test(`${language}: worksheet-only entry offers existing classroom and never generates a phantom lesson`,async()=>{
  const f=await mount({courseId});try{
   assert.equal(f.document.documentElement.lang,language);assert.equal(f.get('#worksheet-entry').hidden,false);assert.equal(f.get('#lesson-form').hidden,true);
   assert.equal(f.get('#new-lesson').disabled,true);assert.equal(f.get('#play').disabled,true);
   assert.equal(f.get('#worksheet-entry-link').href,'https://gem-english-middle-school-math.seoul0119.chatgpt.site/classroom?course='+courseId);
   assert.equal(f.get('#lesson-title').textContent,ui('교실에서 10문제를 준비해 주세요'));
   await f.start();f.get('#next-topic').click();assert.equal(f.calls.length,0);assert.equal(f.location.href,f.get('#worksheet-entry-link').href);
  }finally{f.close();}
 });
 test(`${language}: exact imported questions survive explanation → question → continue → practice → signed Mei handoff`,async()=>{
  const f=await mount({courseId,worksheetId});try{
   assert.equal(f.get('#topic').disabled,true);assert.equal(f.get('#board-course').disabled,true);assert.equal(f.get('#topic').children.length,1);
   assert.equal(f.get('#lesson-title').textContent,material.title+' · '+ui('현재 10문제 설명'));
   assert(f.get('#topic').children[0].textContent.includes(material.title));
   f.get('#play').click();await settle();const narration=f.audios.find(a=>a.playing);assert(narration);narration.currentTime=13;
   f.get('#question').focus();assert.equal(narration.playing,false);f.get('#question').value='Explain the key idea';await f.get('#question-form').onsubmit({preventDefault(){}});await settle();
   assert.equal(f.calls.find(c=>c.action==='ask').quizToken,'imported-quiz');assert(f.recorded.some(e=>e[0]==='dialogue'));
   f.audios.at(-1).finish();f.get('#play').click();await settle();assert.equal(narration.currentTime,13);assert(narration.playing);
   f.get('#ten').click();f.get('#choices').children[0].click();assert.equal(f.get('#feedback').textContent.startsWith(ui('정답이에요.')),true);
   const persisted=JSON.parse(f.storage.get('gem-science-board:T_TEST:course:'+courseId+':worksheet:'+worksheetId));assert.deepEqual(persisted.quiz,material);assert.equal(persisted.progress.items[0].result,'correct');
   await f.get('#handoff').onclick();assert.equal(f.submissions.length,1);const request=f.calls.find(c=>c.action==='handoff');assert.equal(request.progress.items[0].result,'correct');assert.equal(request.cursor,0);
   assert.equal(f.calls.filter(c=>c.action==='start'||c.action==='practice').length,0);assert.equal(f.calls.filter(c=>c.action==='import').length,1);
   const restored=await mount({courseId,worksheetId,stored:persisted,importReplies:[{lesson:persisted.lesson,token:'next-token',material:persisted.quiz,quizToken:'next-quiz',source:persisted.source,progress:persisted.progress,cursor:0}]});
   try{restored.get('#ten').click();assert(restored.get('#feedback').textContent.startsWith(ui('정답이에요.')));assert(!restored.calls.some(c=>['start','practice'].includes(c.action)));}finally{restored.close();}
  }finally{f.close();}
 });
 test(`${language}: no imported worksheet can be accidentally replaced by topic or course selectors`,async()=>{
  const f=await mount({courseId,worksheetId});try{
   const before=f.location.href;f.get('#topic').value='induction';f.get('#topic').onchange();assert.equal(f.get('#topic').value,'worksheet');assert.equal(f.location.href,before);
   f.get('#board-course').value='h3-science';f.get('#board-course').onchange();assert.equal(f.get('#board-course').value,courseId);assert.equal(f.location.href,before);
   f.get('#ten').click();f.get('#choices').children[0].click();f.get('#next-topic').click();await settle();assert.equal(f.submissions.length,1);assert.equal(f.calls.at(-1).action,'handoff');assert.equal(f.calls.at(-1).progress.items[0].result,'correct');
  }finally{f.close();}
 });
 if(language!=='ko')test(`${language}: visible static, loading, practice and microphone-fallback UI contain no Korean copy`,async()=>{
  const f=await mount({courseId,worksheetId});try{
   const assertLocalized=()=>{for(const [id,node] of f.elements){assert(!/[가-힣]/.test(node.textContent),`${id}: ${node.textContent}`);for(const [key,value] of Object.entries(node.attrs))assert(!/[가-힣]/.test(value),`${id}/${key}: ${value}`);}};
   assertLocalized();f.get('#play').click();await settle();assertLocalized();f.get('#mic').click();await settle();assertLocalized();
   f.get('#ten').click();f.get('#choices').children[1].click();assertLocalized();f.get('#show-solution').click();assertLocalized();
   assert.equal(f.get('#question-heading').textContent,ui('질문과 답변'));assert.equal(f.get('#pause').textContent,ui('잠깐 멈추기'));
  }finally{f.close();}
 });
}
test('imported cursor 3 → single question 0 → Mei preserves zero rather than stale imported cursor',async()=>{
 const courseId=courses[1],progress=emptyBoardProgress();progress.items[1]={attempts:[1],hints:0,result:'correct'};
 const f=await mount({courseId,worksheetId,importReplies:[{lesson:lesson('imported',true,'worksheet',courseId),token:'intro',material,quizToken:'quiz',source:{id:worksheetId,revision:2},progress,cursor:3}]});
 try{f.get('#one').click();await f.get('#handoff').onclick();const request=f.calls.find(c=>c.action==='handoff');assert.equal(request.cursor,0);assert.equal(request.progress.items[1].result,'correct');}finally{f.close();}
});
test('course picker only includes the current language and groups courses by grade',()=>{
 for(const language of ['ko','en','fr']){const groups=boardCourseGroups(BOARD_COURSES,language);assert(groups.length>1);assert(groups.length<30);assert.equal(groups.flatMap(g=>g.courses).length,BOARD_COURSES.filter(c=>c.language===language).length);for(const group of groups)assert(group.courses.every(c=>c.language===language));}
});
test('all Korean board literals and static strings have English and French translations',()=>{
 for(const match of source.matchAll(/ui\('([^']*[가-힣][^']*)'/g)){assert(BOARD_UI_COPY[match[1]],match[1]);for(const language of ['en','fr'])assert(!/[가-힣]/.test(createBoardUi(language)(match[1])),match[1]);}
});

test('restored canonical source with an older fixed-topic lesson locks navigation and signs the same worksheet',async()=>{
 const courseId='suneung-2027-chemistry-1',stored={lesson:lesson('older-board',true,'chemistry-mole',courseId),token:'old',quiz:material,quizToken:'old-quiz',source:{id:worksheetId,revision:2},worksheetId,scene:0,mode:'lesson',progress:emptyBoardProgress(),savedAt:Date.now()};
 const f=await mount({courseId,stored,resumeReplies:[{lesson:stored.lesson,token:'renewed',material,quizToken:'renewed-quiz',source:stored.source,progress:stored.progress}]});
 try{assert.equal(f.get('#topic').disabled,true);assert.equal(f.get('#board-course').disabled,true);assert(f.get('#course-home').href.endsWith('&worksheet='+worksheetId));assert(f.get('#lesson-title').textContent.includes(material.title));f.get('#one').click();f.get('#choices').children[0].click();let prevented=false;await f.get('#course-home').onclick({preventDefault(){prevented=true;}});assert(prevented);assert.equal(f.calls.at(-1).action,'handoff');assert.equal(f.calls.at(-1).progress.items[0].result,'correct');}finally{f.close();}
});
