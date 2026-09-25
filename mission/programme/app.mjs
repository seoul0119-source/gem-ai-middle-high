import {LANGS,COURSES,getCourse,getUnit} from './curriculum.mjs';
import {VERSION,validateLesson,choiceFor,savedSession} from './core.mjs';
import {label} from './labels.mjs';
import {LANGUAGES,language} from '../pc/catalog.mjs';
import {installAudioTools} from '../pc/audio-tools.mjs';
import {installDisplayV3} from './display.mjs';
import {installCloudSpeech} from './cloud-speech.mjs';
import {speechLabel} from './speech-labels.mjs';
const $=id=>document.getElementById(id),KEY=VERSION+'-session',CACHE=VERSION+'-units',query=new URLSearchParams(location.search);
let state={version:VERSION,lang:LANGS.includes(query.get('lang'))?query.get('lang'):'en',subject:query.get('subject')||'math',grade:Number(query.get('grade'))||2,unitId:null,lesson:null,index:0,minutes:40,elapsed:0,paused:true,started:false,ended:false,approved:false,revealed:{},choices:{},draft:'',audioInput:null,transcript:[]};
let cache={},view='catalog',busy=false,request=null,epoch=0,statusKey='',modelReady=false,modelLoading=false,speaking=false,speechEpoch=0,voiceTimer=0,recognition=null,dialogue=false,resumeAfter=false,followup=0,lastReply=null,history=[],saving=true;
try{const s=JSON.parse(localStorage.getItem(KEY));if(savedSession(s)){state={...state,...s,paused:true};state.minutes=Math.max(10,Math.min(90,Number(s.minutes)||40));state.elapsed=Math.max(0,Number(s.elapsed)||0);state.revealed=s.revealed&&typeof s.revealed==='object'?s.revealed:{};state.choices=s.choices&&typeof s.choices==='object'?s.choices:{};if(LANGS.includes(query.get('lang')))state.lang=query.get('lang');if(query.has('grade'))state.grade=Number(query.get('grade'));if(query.has('subject'))state.subject=query.get('subject');}const c=JSON.parse(localStorage.getItem(CACHE));if(c&&typeof c==='object')cache=c;}catch{}
if(!getCourse(state.subject,state.grade)){state.grade=2;state.subject='math';}
const T=k=>label(state.lang,k),step=()=>state.lesson?.steps[state.index],pack=()=>step()?.text[state.lang],key=()=>`${state.unitId||'none'}:${state.sessionId||'none'}:${state.index}`,revealed=()=>!!state.revealed[state.index];
function save(){state.draft=$('answer').value.slice(0,450);try{localStorage.setItem(KEY,JSON.stringify(state));saving=true;}catch{saving=false;}$('save-status').textContent=T(saving?'saved':'saveFailed');}
function cacheLesson(){try{cache[state.unitId]={version:VERSION,lesson:state.lesson,id:state.sessionId};localStorage.setItem(CACHE,JSON.stringify(cache));}catch{saving=false;$('save-status').textContent=T('saveFailed');}}
function cancelRequest(){epoch++;request?.abort();request=null;busy=false;}
function talk(on){speaking=on;dispatchEvent(new CustomEvent('gem-avatar-speaking',{detail:{speaking:on}}));}
function stopSpeech(){cloud?.cancelVoice();speechEpoch++;clearTimeout(voiceTimer);audio?.cancelVoiceWait();globalThis.speechSynthesis?.cancel();talk(false);}
function stop(){stopSpeech();audio?.stopMic();cloud?.cancelMic();cancelRequest();dialogue=false;followup=0;}
function pause(){state.paused=true;stop();render();}
function beginDialogue(){if(!dialogue)resumeAfter=state.started&&!state.paused&&!state.ended;state.paused=true;dialogue=true;followup=20;stopSpeech();save();updateControls();}
function say(message){
 stopSpeech();if(!message||document.hidden)return;$('caption').textContent=message;if(view==='lesson')recordText('teacher',message);if(Number($('volume').value)===0){audio.noteTTS('muted');return;}const v=audio.voices().find(v=>v.voiceURI===$('voices').value)||audio.voices()[0];
 if(!v||!globalThis.SpeechSynthesisUtterance){if(cloud.enabled()){void cloud.speak(message);return;}audio.noteTTS(audio.missingVoiceCode());audio.waitForVoice(()=>say(message));return;}
 if(Number($('volume').value)===0){audio.noteTTS('muted');return;}
 const token=speechEpoch,u=new SpeechSynthesisUtterance(message);u.voice=v;u.lang=v.lang;u.volume=Number($('volume').value)/100;u.rate=.9;talk(true);audio.noteTTS('requested');
 voiceTimer=setTimeout(()=>{if(token===speechEpoch){stopSpeech();audio.noteTTS('timeout');}},60000);
 u.onstart=()=>{if(token===speechEpoch)audio.noteTTS('speaking');};u.onend=()=>{if(token===speechEpoch){clearTimeout(voiceTimer);talk(false);audio.noteTTS('completed');}};u.onerror=e=>{if(token===speechEpoch){stopSpeech();audio.noteTTS(e.error||'synthesis-failed');if(cloud.enabled())void cloud.speak(message);}};
 try{speechSynthesis.speak(u);}catch{stopSpeech();audio.noteTTS('synthesis-failed');if(cloud.enabled())void cloud.speak(message);}
}
async function loadTeacher(){if(modelReady)return true;if(modelLoading)return false;modelLoading=true;$('load-avatar').disabled=true;try{const {loadAvatar}=await import('../avatar.bundle.js');await loadAvatar($('avatar'),$('stage'),s=>{$('model-status').textContent=s;});modelReady=true;$('load-panel').hidden=true;return true;}catch(e){$('model-status').textContent='GEM 3D: '+e.message;return false;}finally{modelLoading=false;$('load-avatar').disabled=false;}}
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.dir='auto';return n;}
function showPreview(){const box=$('preview-steps');box.replaceChildren();if(!state.lesson)return;state.lesson.steps.forEach((s,i)=>{const t=s.text[state.lang],a=el('article');a.append(el('h3',`${i+1}. ${T(s.kind)}`),el('p',t.narration));if(t.prompt)a.append(el('p',t.prompt));const list=el('ol');for(const o of t.options)list.append(el('li',o));if(t.options.length)a.append(list,el('p',`${'ABC'[s.answerIndex]}. ${t.explanation}`));else if(t.explanation)a.append(el('p',t.explanation));box.append(a);});}
function updateControls(){
 $('play').textContent=T(state.ended?'finished':state.paused?'continue':'pause');$('play').disabled=state.ended||busy;
 $('next').disabled=busy||state.ended||!state.started||(step()?.kind==='question'&&!revealed());$('previous').disabled=busy||state.index===0;
 $('mic').disabled=busy||!step();$('answer').disabled=busy||!!cloud?.active();$('answer-form').querySelector('button').disabled=busy||!!cloud?.active();
 $('status').textContent=T(statusKey||'ready');
}
function render(){
 document.documentElement.lang=state.lang;document.documentElement.dir=language(state.lang).dir;
 for(const n of document.querySelectorAll('[data-label]'))n.textContent=T(n.dataset.label);
 for(const b of $('languages').children)b.setAttribute('aria-pressed',String(b.dataset.lang===state.lang));
 $('grade').value=String(state.grade);$('subject').replaceChildren();for(const s of ['math','science','english','world-history'])if(getCourse(s,state.grade)){const o=el('option',T(s));o.value=s;$('subject').append(o);}$('subject').value=state.subject;$('minutes').value=String(state.minutes);
 $('catalog').hidden=view!=='catalog';$('lesson').hidden=view!=='lesson';
 const units=getCourse(state.subject,state.grade).units;$('unit-list').replaceChildren();for(const u of units){const a=el('article'),b=el('button',T(cache[u.id]&&validateLesson(cache[u.id].lesson,u.id)?'readyLesson':'generate'));a.dataset.selected=String(u.id===state.unitId);a.append(el('h3',u.title[state.lang]),b);b.className='primary';b.disabled=busy;b.onclick=()=>prepare(u.id);$('unit-list').append(a);}
 const visiblePreview=!!state.lesson&&units.some(u=>u.id===state.unitId);$('preview').hidden=!visiblePreview;if(visiblePreview)showPreview();$('resume').hidden=!state.started||state.ended;$('approve').disabled=busy;$('regenerate').disabled=busy;
 $('cancel-generation').hidden=!(busy&&view==='catalog');$('generation-status').textContent=busy&&view==='catalog'?T('generating'):statusKey?T(statusKey):T('noLesson');
 $('pilot').href=`./pc.html?sample=1&lang=${state.lang}`;
 if(step()){
  const t=pack();$('lesson-title').textContent=getUnit(state.unitId).title[state.lang];$('step-label').textContent=`${T('stage')} \u2066${state.index+1} / 6\u2069`;$('kind').textContent=T(step().kind);
  $('board-content').replaceChildren(...t.board.map(x=>el('p',x)));$('prompt').textContent=t.prompt;$('options').replaceChildren();t.options.forEach((o,i)=>{const b=el('button',`${'ABC'[i]}. ${o}`);b.type='button';b.dataset.selected=String(state.choices[state.index]===i);b.disabled=revealed()||busy;b.onclick=()=>answerChoice(i);$('options').append(b);});
  $('feedback').hidden=!revealed()&&!lastReply;
  $('feedback').textContent=lastReply?.text||(revealed()?`${T(state.choices[state.index]===step().answerIndex?'correct':'incorrect')} ${'ABC'[step().answerIndex]}. ${t.options[step().answerIndex]}\n${t.explanation}`:'');
  $('feedback').lang=lastReply?.lang||state.lang;$('caption').textContent=lastReply?.text||(revealed()?t.explanation:t.narration);$('review-hold').hidden=!revealed();
 }
 $('answer').placeholder=T('ask');$('answer').setAttribute('aria-label',T('ask'));updateControls();audio.refresh();audio.render();cloud.render();renderTranscript();save();dispatchEvent(new Event('gem-display-resize'));
}
function switchLanguage(lang){if(lang===state.lang)return;stop();state.paused=true;state.lang=lang;lastReply=null;statusKey=state.started?'languageChanged':'';render();}
async function api(body,timeout){const token=++epoch;request=new AbortController();const controller=request,timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch('./api/mission-programme.js',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify(body)});const result=await r.json();if(token!==epoch)throw new Error('stale');if(!r.ok)throw new Error(result.code||'failed');return result;}finally{clearTimeout(timer);if(token===epoch)request=null;}}
function adopt(unitId,lesson,id){stop();state={...state,unitId,lesson,sessionId:id,index:0,elapsed:0,paused:true,started:false,ended:false,approved:false,revealed:{},choices:{},draft:'',audioInput:null,transcript:[]};$('answer').value='';lastReply=null;history=[];statusKey='readyLesson';cacheLesson();render();}
async function prepare(unitId,fresh=false){
 if(busy)return;if(state.unitId===unitId&&state.lesson&&!fresh){statusKey='readyLesson';render();$('preview').scrollIntoView({block:'start',behavior:'smooth'});return;}
 if(fresh&&state.lesson&&!confirm(T('newConfirm')))return;
 if(state.started&&!state.ended&&state.unitId!==unitId&&!confirm(T('endConfirm')))return;
 const old=cache[unitId];if(!fresh&&old?.version===VERSION&&validateLesson(old.lesson,unitId)){adopt(unitId,old.lesson,old.id);return;}
 stop();busy=true;statusKey='generating';render();const token=epoch+1;
 try{const result=await api({action:'lesson',unitId,lang:state.lang,variant:crypto.randomUUID()},165000);if(!validateLesson(result.lesson,unitId))throw Error('invalid_lesson');adopt(unitId,result.lesson,crypto.randomUUID());}
 catch{if(token===epoch){busy=false;statusKey='failed';render();}}
}
function answerChoice(i){if(!step()||step().kind!=='question'||busy||revealed())return;stop();state.choices[state.index]=i;state.revealed[state.index]=true;state.paused=true;lastReply=null;statusKey='continueHold';render();say(`${T(i===step().answerIndex?'correct':'incorrect')} ${'ABC'[step().answerIndex]}. ${pack().options[step().answerIndex]}. ${pack().explanation}`);}
async function submit(event,source='text'){
 event?.preventDefault();const q=$('answer').value.trim();if(!q||busy||cloud.active()||!step())return;
 const lang=state.lang,which=key();audio.prepareSubmission(q,source);beginDialogue();recordText('student',q);const index=step().kind==='question'&&!revealed()?choiceFor(q,pack().options):-1;
 if(index>=0){answerChoice(index);audio.finishSubmission(q,lang,source);return;}
 busy=true;statusKey='thinking';render();const token=epoch+1;
 try{const r=await api({action:'question',unitId:state.unitId,lang,lesson:state.lesson,index:state.index,revealed:revealed(),question:q,history},28000);if(key()!==which||lang!==state.lang)return;busy=false;lastReply={text:r.answer,lang};history=[...history,{question:q,answer:r.answer}].slice(-3);audio.finishSubmission(q,lang,source);statusKey='questionTime';followup=20;render();say(r.answer);}
 catch{if(token===epoch){busy=false;followup=Infinity;statusKey='failed';audio.failedSubmission(q);render();}}
}
const audio=installAudioTools({languages:LANGUAGES,lang:()=>state.lang,locale:()=>language(state.lang).locale,key,T,canListen:()=>!!step()&&!busy,begin:beginDialogue,send:()=>submit(null,'voice'),stopSpeech,save,micState:r=>{recognition=r;},pauseAfterFailure:()=>{state.paused=true;followup=Infinity;},edited:()=>{if(busy)cancelRequest();beginDialogue();},inputMeta:()=>state.audioInput,setInputMeta:v=>{state.audioInput=v;}});
let cloud=null;
cloud=installCloudSpeech({micLabel:()=>T('mic'),browserMicActive:()=>!!recognition&&!cloud?.active(),lang:()=>state.lang,key,talk,begin:beginDialogue,stopBrowserMic:()=>audio.stopMic(),hasDraft:()=>audio.hasDraft(),micState:r=>{recognition=r;},update:updateControls,save,openSettings:()=>{$('audio').showModal();}});
function renderTranscript(followLatest=false){
 const L=k=>speechLabel(state.lang,k);$('transcript-title').textContent=L('transcript');$('transcript-note').textContent=L('historyNote');$('clear-transcript').textContent=L('clear');
 const box=$('transcript-messages'),previousScroll=box.scrollTop,nearBottom=box.scrollHeight-box.clientHeight-box.scrollTop<30;box.replaceChildren();
 for(const item of (Array.isArray(state.transcript)?state.transcript:[]).slice(-60)){
  if(!item||!['teacher','student'].includes(item.role)||typeof item.text!=='string'||!LANGS.includes(item.lang))continue;
  const article=el('article'),label=el('strong',`${L(item.role)} · ${language(item.lang).name}`),p=el('p',item.text.slice(0,3000));p.lang=item.lang;article.dataset.role=item.role;article.append(label,p);box.append(article);
 }
 box.scrollTop=followLatest||nearBottom?box.scrollHeight:previousScroll;
}
function recordText(role,text){
 if(!Array.isArray(state.transcript))state.transcript=[];
 const last=state.transcript.at(-1);if(last?.role===role&&last.text===text&&last.lang===state.lang)return;
 state.transcript=[...state.transcript,{role,text:text.slice(0,3000),lang:state.lang}].slice(-60);renderTranscript(true);save();
}
$('clear-transcript').onclick=()=>{state.transcript=[];renderTranscript();save();};
for(const l of LANGUAGES){const b=el('button',l.name);b.dataset.lang=l.code;b.lang=l.code;b.dir=l.dir;b.onclick=()=>switchLanguage(l.code);$('languages').append(b);}
for(let i=1;i<=12;i++){const o=el('option',String(i));o.value=String(i);$('grade').append(o);}
$('grade').onchange=()=>{cancelRequest();statusKey='';state.grade=Number($('grade').value);if(!getCourse(state.subject,state.grade))state.subject='math';render();};$('subject').onchange=()=>{cancelRequest();statusKey='';state.subject=$('subject').value;render();};$('minutes').onchange=()=>{state.minutes=Math.max(10,Math.min(90,Number($('minutes').value)||40));render();};
$('cancel-generation').onclick=()=>{cancelRequest();statusKey='cancelled';render();};$('regenerate').onclick=()=>prepare(state.unitId,true);
async function start(reset){if(!state.lesson||busy)return;stop();if(reset){state.index=0;state.revealed={};state.choices={};state.elapsed=0;state.ended=false;lastReply=null;history=[];state.transcript=[];}if(reset)$('answer').value='';state.approved=true;state.started=true;state.paused=true;view='lesson';statusKey='ready';render();if(await loadTeacher()){state.paused=false;render();say(pack().narration);}}
$('approve').onclick=()=>start(true);$('resume').onclick=()=>start(false);$('load-avatar').onclick=loadTeacher;
$('catalog-back').onclick=()=>{pause();view='catalog';const u=getUnit(state.unitId);state.grade=u.grade;state.subject=u.subject;render();};
$('end-lesson').onclick=()=>{if(confirm(T('endConfirm'))){stop();state.paused=true;state.ended=true;statusKey='finished';render();}};
$('play').onclick=()=>{if(!state.paused){pause();return;}stop();state.paused=false;statusKey='ready';render();say(revealed()?pack().explanation:pack().narration);};
function move(delta){if(busy||delta>0&&step().kind==='question'&&!revealed())return;if(state.index+delta>=6){stop();state.ended=true;state.paused=true;statusKey='finished';render();return;}stop();state.index=Math.max(0,state.index+delta);state.ended=false;lastReply=null;$('answer').value='';state.paused=false;statusKey='ready';render();say(revealed()?pack().explanation:pack().narration);}
$('next').onclick=()=>move(1);$('previous').onclick=()=>move(-1);$('repeat').onclick=()=>say(lastReply?.text||(revealed()?pack().explanation:pack().narration));$('answer-form').onsubmit=submit;$('mic').onclick=()=>cloud.useMic()?cloud.listen():audio.listen();
$('audio-open').onclick=()=>{pause();$('audio').showModal();};$('audio-close').onclick=()=>{stopSpeech();$('audio').close();};$('test-voice').onclick=()=>say(pack()?.narration||T('programme'));$('remote').onchange=()=>{stopSpeech();audio.refresh();};$('volume').oninput=()=>{if(Number($('volume').value)===0)stopSpeech();};globalThis.speechSynthesis?.addEventListener('voiceschanged',()=>audio.refresh());
$('answer').value=state.draft||'';let last=performance.now(),lastSave=0;const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
setInterval(()=>{const now=performance.now(),dt=Math.min(1,(now-last)/1000);last=now;if(document.hidden||view!=='lesson')return;if(state.started&&!state.paused&&!state.ended)state.elapsed+=dt;$('timer').textContent=`${clock(state.elapsed)} / ${clock(state.minutes*60)}`;
 if(dialogue&&!busy&&!speaking&&!recognition&&!$('audio').open&&!audio.hasDraft()&&Number.isFinite(followup)){followup-=dt;if(followup<=0){dialogue=false;if(resumeAfter&&!state.ended){state.paused=false;statusKey='ready';render();}}}if(now-lastSave>1000){save();lastSave=now;}},200);
addEventListener('pagehide',()=>{save();stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=performance.now();});
Object.defineProperty(window,'GEM_PROGRAMME',{get:()=>({version:VERSION,lang:state.lang,unitId:state.unitId,sessionId:state.sessionId,index:state.index,paused:state.paused,elapsed:state.elapsed,modelReady,view,busy,revealed:revealed(),dialogue,courseCount:COURSES.length})});
render();installDisplayV3();

