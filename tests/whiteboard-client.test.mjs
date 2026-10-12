// DOM/audio doubles exercise the shipped event handlers. This is not a browser
// or a claim to have tested physical speakers/microphones.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {LESSON,LANGUAGES,LESSON_ID,workedExample,hint} from '../whiteboard/lesson.js';import {LessonController} from '../whiteboard/controller.js';
const source=(await readFile(new URL('../whiteboard/classroom.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const markup=await readFile(new URL('../whiteboard.html',import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
class Element{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';this.attrs={};this.classList={toggle(){}};}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=[...children];}setAttribute(k,v){this.attrs[k]=v;}querySelectorAll(){return this.children;}focus(){this.onfocus?.();}}
async function mount(language,{deferAnswer=false}={}){
 const elements=new Map(),labels=[],audios=[],calls=[],events=new Map(),storage=new Map();let resolveQuestion;
 for(const m of markup.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/g)){const id=m[2].match(/\bid="([^"]+)"/)?.[1],label=m[2].match(/data-label="([^"]+)"/)?.[1];if(!id&&!label)continue;const el=new Element(m[1]);if(id)elements.set('#'+id,el);if(label){el.dataset.label=label;labels.push(el);}}
 elements.get('#speed').value='1';
 const location={href:'https://gem.example/whiteboard.html?lang='+language,reload(){}};
 const document={documentElement:{},querySelector:s=>{assert(elements.has(s),s);return elements.get(s);},querySelectorAll:()=>labels,createElement:tag=>new Element(tag),createTextNode:s=>s,addEventListener:(name,fn)=>events.set(name,fn),hidden:false};
 class TestURL extends URL{static n=0;static createObjectURL(){return 'blob:'+ ++this.n;}static revokeObjectURL(){}}
 class Audio{constructor(src){this.src=src;this.currentTime=0;this.duration=20;this.ended=false;this.playing=false;audios.push(this);}async play(){this.playing=true;}pause(){this.playing=false;}finish(){this.playing=false;this.ended=true;this.currentTime=20;this.onended?.();}}
 const fetch=async(url,options)=>{if(url==='/api/session')return Response.json({authenticated:true,student:{id:'T_TEST',name:'Learner'}});const b=JSON.parse(options.body);calls.push(b);if(b.action==='speech')return new Response(new Blob(['fake mp3'],{type:'audio/mpeg'}));if(b.action==='ask'){if(deferAnswer)return await new Promise(resolve=>{resolveQuestion=()=>resolve(Response.json({answer:'Answer in '+b.language}));});return Response.json({answer:'Answer in '+b.language});}throw Error('unexpected request');};
 const window={addEventListener:(name,fn)=>events.set(name,fn),history:{replaceState(_s,_t,url){location.href=String(url);}}};
 const sandbox={LESSON,LANGUAGES,LESSON_ID,workedExample,hint,LessonController,document,window,location,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL:TestURL,Audio,fetch,navigator:{},AbortController,setTimeout,clearTimeout,console,Blob,FileReader:class{}};
 await vm.runInNewContext(`(async()=>{${source}\n})()`,sandbox);await settle();
 return {get:s=>elements.get(s),audios,calls,events,document,storage,settle,resolveQuestion:()=>resolveQuestion?.()};
}
for(const language of LANGUAGES)test(`${language}: shipped UI stops actual audio double, answers, resumes at saved time and grades one optional problem`,async()=>{
 const f=await mount(language);assert.equal(f.get('#teacher-name').textContent,LESSON[language].teacher);assert.equal(f.get('#practice-panel').hidden,true);
 f.get('#play').onclick();await settle();const lesson=f.audios.find(a=>a.playing);assert(lesson);lesson.currentTime=7;lesson.ontimeupdate();const board=f.get('#board-svg').innerHTML;
 f.get('#question').focus();assert.equal(lesson.playing,false);assert.equal(f.get('#board-svg').innerHTML,board);f.get('#question').value='Why?';await f.get('#question-form').onsubmit({preventDefault(){}});await settle();
 assert.equal(lesson.currentTime,7);assert.equal(lesson.playing,false);assert(f.audios.at(-1).playing);assert.equal(f.get('#conversation').children.length,2);
 f.audios.at(-1).finish();f.get('#play').onclick();await settle();assert.equal(lesson.playing,true);assert.equal(lesson.currentTime,7);assert.equal(f.get('#scene-count').textContent,'1 / 6');
 f.get('#one').onclick();assert.equal(lesson.playing,false);assert.equal(f.get('#practice-panel').hidden,false);assert(f.get('#practice-heading').textContent.endsWith('1 / 1'));
 f.get('#answer').value='12';f.get('#answer-form').onsubmit({preventDefault(){}});await settle();assert.equal(f.get('#answer-form').hidden,false);assert(f.get('#feedback').textContent.startsWith(LESSON[language].ui.tryAgain));
 f.get('#answer').value='13';f.get('#answer-form').onsubmit({preventDefault(){}});await settle();assert.equal(f.get('#answer-form').hidden,true);assert.equal(f.get('#next').hidden,true);
 f.get('#back').onclick();assert.equal(f.get('#practice-panel').hidden,true);f.get('#play').onclick();await settle();assert.equal(lesson.currentTime,7);assert.equal(lesson.playing,true);
 f.events.get('pagehide')();assert.equal(lesson.playing,false);assert([...f.storage.keys()].every(x=>x.includes('T_TEST')));
});
test('late answer after language change cannot speak, overwrite the board or add conversation',async()=>{const f=await mount('ko',{deferAnswer:true});f.get('#question').value='Why?';const request=f.get('#question-form').onsubmit({preventDefault(){}});await settle();f.get('#language').value='fr';f.get('#language').onchange();f.resolveQuestion();await request;await settle();assert.equal(f.get('#teacher-name').textContent,'Simon');assert.equal(f.get('#conversation').children.length,0);assert.equal(f.audios.filter(x=>x.playing).length,0);f.events.get('pagehide')();});
test('microphone unavailable pauses the lesson and retains text input',async()=>{const f=await mount('en');f.get('#play').onclick();await settle();f.get('#mic').onclick();await settle();assert.equal(f.audios.filter(x=>x.playing).length,0);assert.equal(f.get('#status').textContent,LESSON.en.ui.micError);assert.equal(f.get('#question').disabled,false);f.events.get('pagehide')();});
