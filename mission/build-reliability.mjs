// Checked transformations are confined to the isolated group preview.
import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
function once(source,from,to){if(source.split(from).length!==2)throw Error('Reliability anchor changed: '+from.slice(0,150));return source.replace(from,to);}
function patchGroup(g){
 g=once(g,"import {packageFor,preparedMediaAnswer,installLessonMedia} from './lesson-media.mjs';","import {packageFor,installLessonMedia} from './reliable-lessons.mjs';\nimport {createLessonSupport} from './lesson-support.mjs';");
 g=once(g,' state().minutes=selection.minutes;',` state().minutes=selection.minutes;
 const support=createLessonSupport(h,{phase:()=>phase,phaseText,refresh,stop,setExplain:()=>{phase='explain';scene=0;phaseIdle=0;submitted=false;correction=false;},answered:()=>{submitted=true;phaseIdle=0;}});`);
 g=once(g,"$('answer').disabled=!ready||!s.started||s.ended||(phase!=='response'&&!(!!packageFor(h.current().id)&&phase==='summary'))","$('answer').disabled=!ready||!s.started||s.ended||support.busy()");
 g=once(g,' persist();}\n function refresh()',' support.render();persist();}\n function refresh()');
 g=once(g,' function begin(index){scene=0;',' function begin(index){support.onStep();scene=0;');
 g=once(g,'function play(){if(!lessonAvailable(selection)||!h.modelReady())return;const s=state();','function play(){if(!lessonAvailable(selection)||!h.modelReady())return;support.ensureFresh();const s=state();');
 g=once(g,' function advancePhase(){phaseIdle=0;',' function advancePhase(){if(!support.beforeAdvance())return;phaseIdle=0;');
 g=once(g,' function switchLanguage(lang){phaseIdle=0;',' function switchLanguage(lang){support.cancel();phaseIdle=0;');
 g=once(g,'if(changed){s.index=0;','if(changed){support.reset();s.index=0;');
 g=once(g,'if(state().started&&!state().ended){stop();h.finish();return;}','if(state().started&&!state().ended){support.cancel();stop();h.finish();return;}');
 const begin=g.indexOf(" const oldRestart=$('restart').onclick;"),end=g.indexOf(' let lastAuto=',begin);if(begin<0||end<0)throw Error('Response section not found');g=g.slice(0,begin)+` $('restart').onclick=()=>{if(state().started&&!state().ended&&!confirm(tr().changed))return;stop();support.reset();phase='explain';refresh();};
 $('answer-form').onsubmit=e=>{if(!lessonAvailable(selection)){e.preventDefault();return;}support.submit(e);};
 document.addEventListener('gem-final-answer',()=>{if(state().started&&!state().ended&&!support.busy())$('answer-form').requestSubmit();});
`+g.slice(end);
 g=once(g," if($('answer').value.trim())return;",` if($('answer').value.trim())return;
 if(support.hold()||(phase==='response'&&!submitted)){countdown.textContent=support.hold()?support.waitingMessage():(s.lang==='fr'?'En attente de la réponse de la classe.':'Waiting for the class response.');return;}`);
 g=once(g,"'Progression automatique. Appuyez sur Pause pour prolonger une discussion. Micro : la réponse finale est envoyée automatiquement.'","'Les explications avancent automatiquement. Les réponses et corrections attendent la classe. Micro : envoi automatique de la réponse finale.'");
 g=once(g,"'Automatic lesson. Press Pause for more discussion time. Microphone: the final answer is sent automatically.'","'Explanations continue automatically. Answers and corrections wait for the class. Microphone: final answers are sent automatically.'");
 return g;
}
// Fail fast before running the preserved, more expensive WebGL suites.
const group=patchGroup(await fs.readFile('mission/group-classroom.mjs','utf8'));
execFileSync(process.execPath,['mission/reliability-tests.mjs'],{stdio:'inherit'});
await import('./build-group.mjs');
const out='mission-dist';
for(const name of ['tutor-core.mjs','reliable-lessons.mjs','lesson-support.mjs']){execFileSync(process.execPath,['--check','mission/'+name],{stdio:'inherit'});await fs.copyFile('mission/'+name,out+'/'+name);}
let app=await fs.readFile(out+'/app.mjs','utf8');
app=once(app,"import {spokenMath} from './lesson-media.mjs';","import {spokenMath} from './reliable-lessons.mjs';");
app=once(app,"paidRequests:0,mediaVersion:","aiRequests:window.GEM_RELIABILITY?.aiRequests||0,mediaVersion:");
app=app.replaceAll('Open-ended generative AI and school records are not connected.','Additional questions use the configured AI connection; school records are not connected.').replaceAll('L’IA générative libre et les dossiers scolaires ne sont pas connectés.','Les questions supplémentaires utilisent la connexion IA configurée ; aucun dossier scolaire n’est connecté.');
await fs.writeFile(out+'/app.mjs',app);await fs.writeFile(out+'/group-classroom.mjs',group);
let sw=await fs.readFile(out+'/sw.js','utf8');sw=once(sw,'gem-group-classroom-v6','gem-group-reliable-v1');sw=once(sw,"'./group-classroom.mjs'","'./group-classroom.mjs','./tutor-core.mjs','./reliable-lessons.mjs','./lesson-support.mjs'");await fs.writeFile(out+'/sw.js',sw);
let html=await fs.readFile(out+'/index.html','utf8');html=html.replace('그룹 교실 시험판 · 20–30명 · 기존 3D 선생님 · 정식 서비스 미반영','초2 수학 수정판 · 새 문제 · 정답·풀이 확인 · 질문응답 개선 · 정식 서비스 미반영');await fs.writeFile(out+'/index.html',html);
await import('./reliability-browser-tests.mjs');await import('./reliability-live-check.mjs');
