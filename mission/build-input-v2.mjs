// Final runtime repair, after every existing baseline/reliability regression suite.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for(const file of ['interaction-support.mjs','input-v2-browser-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+file],{stdio:'inherit'});
await import('./build-reliability.mjs');
const dir='mission-dist';
function once(s,a,b){if(s.split(a).length!==2)throw Error('Input-v2 anchor mismatch: '+a.slice(0,150));return s.replace(a,b);}
let group=await fs.readFile(dir+'/group-classroom.mjs','utf8');
group=once(group,"from './lesson-support.mjs'","from './interaction-support.mjs'");
group=once(group,'answered:()=>{submitted=true;phaseIdle=0;}','answered:()=>{submitted=true;phaseIdle=0;phase=\'response\';scene=0;}');
group=once(group,"$('answer').disabled=!ready||!s.started||s.ended||support.busy()","$('answer').disabled=!ready");
group=once(group,"$('prompt').hidden=phase==='explain'&&!s.ended","$('prompt').hidden=false");
group=once(group,'if(!s.started||s.ended){s.index=0;','if(!s.started||s.ended){s.index=1;');
group=once(group,"$('previous').onclick=()=>{if(state().index>0)begin(state().index-1);}","$('previous').onclick=()=>{if(state().index>1)begin(state().index-1);}");
group=once(group,' support.render();persist();}',` support.render();
 $('previous').disabled=!ready||!s.started||s.index<=1||s.ended;
 const number=Math.min(10,Math.max(1,s.index));
 $('step-label').textContent=(fr?'Problème ':'Problem ')+number+' / 10 · '+h.current().title[s.lang];
 $('play').textContent=s.started&&!s.ended?(s.paused?(fr?'▶ Continuer':'▶ Continue'):(fr?'Ⅱ Pause':'Ⅱ Pause')):(s.ended&&s.index<h.steps.length-1?(fr?'▶ Reprendre cette séance':'▶ Resume this lesson'):(fr?'▶ Commencer':'▶ Start lesson'));
 $('group-end').textContent=fr?'■ Terminer la séance':'■ End lesson';
 $('group-end').disabled=!s.started||s.ended;
 persist();}`);
const oldClick="$('play').onclick=async()=>{if(state().started&&!state().ended){support.cancel();stop();h.finish();return;}if(!h.modelReady()){await $('load-avatar').onclick();if(!h.modelReady())return;}play();};";
group=once(group,oldClick,`$('play').onclick=async()=>{
 const s=state();
 if(!h.modelReady()){await $('load-avatar').onclick();if(!h.modelReady())return;}
 if(s.started&&!s.ended){if(s.paused){s.paused=false;refresh();h.speak(support.replyText()||phaseText());}else h.pause();return;}
 if(!h.modelReady()){await $('load-avatar').onclick();if(!h.modelReady())return;}
 if(s.ended&&s.index<h.steps.length-1){s.started=true;s.ended=false;s.paused=false;s.finishReason='';refresh();h.speak(support.replyText()||phaseText());return;}
 play();
};
 const endButton=document.createElement('button');endButton.id='group-end';endButton.type='button';document.querySelector('.lesson-controls').append(endButton);
 function confirmEnd(){if(!state().started||state().ended)return;stop();if(!confirm(state().lang==='fr'?'Terminer cette séance ? Pour continuer plus tard, utilisez Pause.':'End this lesson? To take a break, use Pause instead.')){state().paused=true;refresh();return;}support.cancel();state().finishReason='teacher';h.finish();}
 endButton.onclick=confirmEnd;$('end').onclick=()=>{confirmEnd();$('settings').close();};
 const originalMicClick=$('mic').onclick;
 $('mic').onclick=()=>{if(!lessonAvailable(selection))return;support.ensureInteractive();refresh();originalMicClick();};`);
group=once(group,"support.submit(e);","support.submit(e,'text');");
group=once(group,"document.addEventListener('gem-final-answer',()=>{if(state().started&&!state().ended&&!support.busy())$('answer-form').requestSubmit();});","document.addEventListener('gem-final-answer',()=>{if(lessonAvailable(selection))support.submit(null,'voice');});");
group=once(group,"if($('answer').value.trim())return;","if($('answer').value.trim()||document.activeElement===$('answer'))return;");
group=once(group,"$('repeat').onclick=()=>h.speak(phaseText(),true)","$('repeat').onclick=()=>h.speak(support.replyText()||phaseText(),true)");
group=once(group,"if(state().started&&!state().paused&&!state().ended)h.speak(phaseText());","if(state().started&&!state().paused&&!state().ended)h.speak(support.replyText()||phaseText());");
group=group.replaceAll('s.lang,s.paused||s.ended||!s.started)','s.lang,s.paused||s.ended||!s.started,s.reveal)').replaceAll('s.lang,false)','s.lang,false,s.reveal)');
await fs.writeFile(dir+'/group-classroom.mjs',group);
let input=await fs.readFile('mission/interaction-support.mjs','utf8');input=once(input,'return {render,submit,cancel,onStep,reset,ensureInteractive,','return {replyText:()=>lastReply?.reply||\'\',render,submit,cancel,onStep,reset,ensureInteractive,');await fs.writeFile(dir+'/interaction-support.mjs',input);
let lessons=await fs.readFile(dir+'/reliable-lessons.mjs','utf8');
const example=`function teachingExample(s){return solution(s)===5?{a:3,b:3}:{a:2,b:3};}
function exampleWords(s,lang){const e=teachingExample(s);return (lang==='fr'?'Voici un autre calcul, pas la question à résoudre : ':'This is a separate worked example, not your question: ')+explainStep(e,lang)+(lang==='fr'?' Revenons maintenant à votre question affichée.':' Now return to your question on the board.');}
`;
lessons=once(lessons,'export function packageFor(id){',example+'export function packageFor(id){');
lessons=once(lessons,"${s.missing?'?':s.b}","${s.missing?(reveal?solution(s):'?'):s.b}");
lessons=once(lessons,'exampleImage:diagram(s,true)','exampleImage:diagram(teachingExample(s),true)');
lessons=once(lessons,"kind:base?'video':'animation'","kind:'animation'");
lessons=once(lessons,'`Look at the ${10-s.a} empty spaces. These are the counters needed to complete ten.`','`Look at the empty spaces. Decide how many counters are needed to complete ten.`');
lessons=once(lessons,'`Regardez les ${10-s.a} cases vides. Ce sont les jetons nécessaires pour compléter dix.`','`Regardez les cases vides. Cherchez combien de jetons sont nécessaires pour compléter dix.`');
lessons=once(lessons,"{kind:'example',en:explainStep(s,'en'),fr:explainStep(s,'fr')}","{kind:'example',en:exampleWords(s,'en'),fr:exampleWords(s,'fr')}");
lessons=once(lessons,'function sync(id,phase,scene,lang,isPaused){','function sync(id,phase,scene,lang,isPaused,revealed=false){');
lessons=once(lessons,"const show=phase==='explain'?pack.scenes[scene]:null","const show=phase==='explain'?pack.scenes[scene]:(phase==='activity'&&revealed&&pack.clip?{kind:'video'}:null)");
lessons=once(lessons,"`${pack.id}:${phase}:${scene}`","`${pack.id}:${phase}:${scene}:${revealed}`");
lessons=once(lessons,"show?.kind==='example'?pack.exampleImage:pack.image","show?.kind==='example'?pack.exampleImage:diagram(active.find(s=>s.id===id),revealed)");
lessons=once(lessons,"lang==='fr'?'Observer et expliquer ensemble':'Explore and explain together'","show?.kind==='example'?(lang==='fr'?'Autre exemple · pas votre question':'Different example · not your question'):(lang==='fr'?'Observer et expliquer ensemble':'Explore and explain together')");
await fs.writeFile(dir+'/reliable-lessons.mjs',lessons);
let app=await fs.readFile(dir+'/app.mjs','utf8');app=once(app,"state.lang==='fr'?'■ Terminer':'■ Finish'","state.lang==='fr'?'■ Arrêter le micro':'■ Stop recording'");await fs.writeFile(dir+'/app.mjs',app);
let sw=await fs.readFile(dir+'/sw.js','utf8');sw=once(sw,'gem-group-reliable-v1','gem-group-input-v2');sw=once(sw,"'./lesson-support.mjs'","'./lesson-support.mjs','./interaction-support.mjs'");await fs.writeFile(dir+'/sw.js',sw);
let html=await fs.readFile(dir+'/index.html','utf8');html=html.replace('초2 수학 수정판 · 새 문제 · 정답·풀이 확인 · 질문응답 개선 · 정식 서비스 미반영','초2 입력 수정 v2 · 첫 문제부터 응답 · 답변 후 정답 공개 · 종료 확인');await fs.writeFile(dir+'/index.html',html);
for(const file of ['group-classroom.mjs','reliable-lessons.mjs','interaction-support.mjs','app.mjs'])execFileSync(process.execPath,['--check',dir+'/'+file],{stdio:'inherit'});
await import('./input-v2-browser-tests.mjs');
