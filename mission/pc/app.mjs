import {LANGUAGES,SUBJECTS,language,course} from './catalog.mjs';
import {text,lessonText,answerNumber} from './i18n.mjs';
import {makeSession,validateSession} from '../reliable-lessons.mjs';
import {boardSVG} from './board.mjs';
import {installDisplayV3} from '../display-v3.mjs';
const $=id=>document.getElementById(id),KEY='gem-pc-common-five-v1',RECENT='gem-pc-common-recent-v1';
let state={lang:'en',grade:2,subject:'math',session:null,index:1,started:false,paused:true,ended:false,reveal:false,review:false,progress:0,elapsed:0,stepElapsed:0,completed:[],view:'catalog',draft:''};
let modelReady=false,loading=false,speechEpoch=0,speaking=false,speechPending=false,utterance=null,recognition=null,recordEpoch=0,micAllowed=false,request=null,requestEpoch=0,busy=false,dialogue=false,followup=0,resumeAfter=false,lastReply=null,history=[],lastTime=performance.now(),voiceProblem=false,statusKey='ready';
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&LANGUAGES.some(l=>l.code===saved.lang)&&Number.isInteger(saved.grade)&&saved.grade>=1&&saved.grade<=12){state.lang=saved.lang;state.grade=saved.grade;state.subject=SUBJECTS.some(s=>s.id===saved.subject)?saved.subject:'math';if(validateSession(saved.session)&&saved.index>=1&&saved.index<=10){for(const k of ['session','index','started','ended','reveal','review','progress','elapsed','stepElapsed','completed','draft'])if(saved[k]!==undefined)state[k]=saved[k];state.view=saved.view==='lesson'?'lesson':'catalog';state.progress=Math.max(0,Math.min(1,Number(state.progress)||0));state.elapsed=Math.max(0,Math.min(86400,Number(state.elapsed)||0));state.stepElapsed=Math.max(0,Math.min(86400,Number(state.stepElapsed)||0));state.completed=Array.isArray(state.completed)?state.completed.filter(n=>Number.isInteger(n)&&n>=1&&n<=10):[];state.paused=true;}}}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify({...state,draft:$('answer').value.slice(0,450)}));}catch{}}
const current=()=>state.session?.steps[state.index],T=k=>text(state.lang,k),pack=()=>current()?lessonText(current(),state.lang,state.reveal):null;
const time=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
function newSession(){let recent=[];try{recent=JSON.parse(localStorage.getItem(RECENT))||[];if(!Array.isArray(recent))recent=[];}catch{}state.session=makeSession(recent);Object.assign(state,{index:1,started:false,ended:false,paused:true,reveal:false,review:false,progress:0,elapsed:0,stepElapsed:0,completed:[],draft:''});$('answer').value='';lastReply=null;history=[];stopAll();try{localStorage.setItem(RECENT,JSON.stringify([...recent,state.session.first].slice(-12)));}catch{}save();}
function talk(on){speaking=on;dispatchEvent(new CustomEvent('gem-avatar-speaking',{detail:{speaking:on}}));}
function stopSpeech(){speechEpoch++;speechPending=false;utterance=null;globalThis.speechSynthesis?.cancel();talk(false);}
function stopMic(){recordEpoch++;if(recognition){const old=recognition;recognition=null;old.onresult=null;try{old.abort();}catch{}}$('mic').textContent=T('mic');}
function cancelRequest(){requestEpoch++;request?.abort();request=null;busy=false;}
function stopAll(){stopSpeech();stopMic();cancelRequest();dialogue=false;followup=0;}
function status(key){statusKey=key;$('status').textContent=T(key);}
function voiceList(){const allow=$('remote').checked;return (globalThis.speechSynthesis?.getVoices()||[]).filter(v=>v.lang.replace('_','-').toLowerCase().split('-')[0]===state.lang&&(v.localService||allow)).sort((a,b)=>Number(b.localService)-Number(a.localService));}
function updateVoices(){const old=$('voices').value,list=voiceList();$('voices').replaceChildren();for(const v of list){const o=document.createElement('option');o.value=v.voiceURI;o.textContent=`${v.name} (${v.lang})`;$('voices').append(o);}if(list.some(v=>v.voiceURI===old))$('voices').value=old;if(!list.length){const o=document.createElement('option');o.textContent=T('missingVoice');$('voices').append(o);$('voice-status').textContent=T('missingVoice');}else $('voice-status').textContent=list.map(v=>v.lang).join(' · ');}
function say(message){
 stopSpeech();$('caption').textContent=message;if(document.hidden||!message)return;
 const voice=voiceList().find(v=>v.voiceURI===$('voices').value)||voiceList()[0];
 if(!voice||!globalThis.SpeechSynthesisUtterance){voiceProblem=true;$('voice-status').textContent=T('missingVoice');status('missingVoice');return;}
 if(Number($('volume').value)===0){voiceProblem=true;return;}voiceProblem=false;
 const epoch=speechEpoch,chunks=message.match(/[^.!?۔।]+[.!?۔।]?/gu)||[message];let index=0;
 function play(){if(epoch!==speechEpoch||index>=chunks.length){if(epoch===speechEpoch){speechPending=false;talk(false);$('next').disabled=!state.started||state.ended||busy;}return;}const u=new SpeechSynthesisUtterance(chunks[index++].trim());utterance=u;u.lang=voice.lang;u.voice=voice;u.volume=Number($('volume').value)/100;u.rate=.9;speechPending=true;
 const timer=setTimeout(()=>{if(epoch===speechEpoch){voiceProblem=true;stopSpeech();status('missingVoice');}},30000);
 u.onstart=()=>{if(epoch===speechEpoch){speechPending=false;talk(true);}};u.onend=()=>{clearTimeout(timer);if(epoch!==speechEpoch)return;talk(false);play();};u.onerror=()=>{clearTimeout(timer);if(epoch===speechEpoch){voiceProblem=true;stopSpeech();status('missingVoice');}};
 try{speechSynthesis.speak(u);}catch{clearTimeout(timer);voiceProblem=true;stopSpeech();status('missingVoice');}}
 play();
}
function render(){
 const l=language(state.lang);document.documentElement.lang=l.code;document.documentElement.dir=l.dir;
 for(const e of document.querySelectorAll('[data-t]'))e.textContent=T(e.dataset.t);
 for(const b of $('languages').children)b.setAttribute('aria-pressed',String(b.dataset.lang===l.code));
 $('grade').value=String(state.grade);const before=state.subject;$('subject').replaceChildren();
 for(const s of SUBJECTS){if(state.grade<s.minGrade)continue;const o=document.createElement('option');o.value=s.id;o.textContent=T(s.id);$('subject').append(o);}if(![...$('subject').options].some(x=>x.value===before))state.subject='math';$('subject').value=state.subject;
 const availability=course(state.subject,state.grade);$('open-course').disabled=!availability.available;$('course-status').textContent=T(availability.available?'pilot':availability.status==='not-offered'?'unavailable':'planned');
 $('course-grid').replaceChildren();for(const s of SUBJECTS){const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),small=document.createElement('small');h.textContent=T(s.id);p.textContent=`${T('grade')} ${s.minGrade}–${s.maxGrade}`;small.textContent=s.id==='math'?`${T('pilot')}; ${T('planned')}: 1, 3–12`:T('planned');a.append(h,p,small);$('course-grid').append(a);}
 $('catalog').hidden=state.view!=='catalog';$('lesson').hidden=state.view!=='lesson';
 if(current()){const p=pack();$('equation').textContent=p.formula;$('step-label').textContent=`${state.index} / 10 · ${T('title')}`;$('prompt').textContent=p.ob;$('fact').textContent=p.fact;$('material-label').textContent=T(state.reveal?'solution':'observe');$('visual').innerHTML=boardSVG(current(),state.progress,state.reveal);$('caption').textContent=lastReply?.text||(state.reveal?p.solve:p.ob);$('review-hold').hidden=!state.review;}
 $('feedback').hidden=!lastReply;if(lastReply){$('feedback').textContent=lastReply.text;$('feedback').lang=lastReply.lang;}
 $('answer').placeholder=T('answer');$('answer').setAttribute('aria-label',T('answer'));
 $('play').textContent=T(state.ended?'newLesson':!state.started?'start':state.paused?'continue':'pause');$('next').disabled=!state.started||state.ended||busy||speaking||speechPending;$('repeat').disabled=!current();$('mic').textContent=T('mic');$('timer').textContent=`${time(state.elapsed)} / 40:00`;
 $('status').textContent=T(statusKey);updateVoices();save();dispatchEvent(new Event('gem-display-resize'));
}
function changeLanguage(lang){if(lang===state.lang)return;const wasRunning=state.started&&!state.paused&&!state.ended;stopAll();state.lang=language(lang).code;if(lastReply?.kind==='math')lastReply={...lastReply,text:lessonText(current(),state.lang,true).solve,lang:state.lang};else if(lastReply?.lang!==state.lang)lastReply=null;
 render();if(wasRunning)say(state.reveal?pack().solve:pack().ob);}
async function loadTeacher(){if(modelReady)return true;if(loading)return false;loading=true;$('load-avatar').disabled=true;$('model-status').textContent='GEM 3D…';try{const {loadAvatar}=await import('../avatar.bundle.js');await loadAvatar($('avatar'),$('stage'),s=>{$('model-status').textContent=s;});modelReady=true;$('load-panel').hidden=true;return true;}catch(e){$('model-status').textContent=`GEM 3D: ${e.message}`;return false;}finally{loading=false;$('load-avatar').disabled=false;}}
function beginDialogue(){if(!dialogue)resumeAfter=state.started&&!state.paused&&!state.ended;state.paused=true;dialogue=true;followup=20;stopSpeech();save();$('play').textContent=T('continue');}
function resume(){cancelRequest();stopMic();dialogue=false;followup=0;state.started=true;state.ended=false;state.paused=false;status('ready');render();say(state.reveal?pack().solve:pack().ob);}
function next(){if(busy||speaking||speechPending||!current())return;stopAll();lastReply=null;if(!state.completed.includes(state.index)&&state.reveal)state.completed.push(state.index);if(state.index===10){state.ended=true;state.paused=true;status('ended');render();return;}
 state.index++;state.reveal=false;state.review=false;state.progress=0;state.stepElapsed=0;render();if(!state.paused)say(pack().ob);}
async function submit(e){e?.preventDefault();if(!current())return;const question=$('answer').value.trim();if(!question)return;beginDialogue();stopMic();cancelRequest();const token=requestEpoch,view=`${state.session.id}:${state.index}:${state.lang}`,s=current(),lang=state.lang,p=pack(),n=answerNumber(question);let reply=null,kind='chat';
 if(n!==null){state.reveal=true;state.review=n!==p.answer;state.progress=0;kind='math';reply=(n===p.answer?T('correct'):T('incorrect'))+' '+p.solve;dialogue=false;state.paused=!resumeAfter;}
 else if(/^(hello|hi|bonjour|salut|नमस्ते|سلام|ہیلو|habari|jambo)[!. ]*$/iu.test(question))reply=p.hello;
 else if(/^(repeat|say (?:it |that )?again|please say (?:it |that )?again|répète|répéter|peux-tu répéter|फेरि भन्नुहोस्|دوبارہ کہیں|sema tena)[.!? ]*$/iu.test(question))reply=lastReply?.text||$('caption').textContent||p.ob;
 else if(/multiplication|multiply|गुणन|ضرب|kuzidisha/iu.test(question))reply=p.compare;
 else if(/today|appris|आज|آج|leo/iu.test(question)){reply=p.recap+(state.completed.length?'\n'+state.completed.map(i=>{const x=state.session.steps[i];return lessonText(x,lang,true).formula;}).join('; '):'');}
 else if(/^(explain(?: again)?|explique(?: encore)?|सम्झाउनुहोस्|وضاحت کریں|eleza)[.!? ]*$/iu.test(question)){state.reveal=true;state.progress=0;reply=p.solve;kind='math';}
 if(reply){lastReply={text:reply,lang,kind};history.push({question,answer:reply,lang});history=history.slice(-4);$('answer').value='';render();say(reply);return;}
 busy=true;status('thinking');render();request=new AbortController();const controller=request,timer=setTimeout(()=>controller.abort(),20000);
 try{const res=await fetch('./api/mission-pc-chat.js',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify({lang,question,step:{a:s.a,b:s.b,missing:!!s.missing},revealed:state.reveal,history,completed:state.completed.map(i=>{const x=state.session.steps[i];return {a:x.a,b:x.b,missing:!!x.missing};})})});const data=await res.json();if(token!==requestEpoch||view!==`${state.session.id}:${state.index}:${state.lang}`)return;if(!res.ok||typeof data.answer!=='string'||data.targetAnswer!==p.answer)throw Error('Invalid additional reply');lastReply={text:data.answer,lang,kind:'chat'};history.push({question,answer:data.answer,lang});history=history.slice(-4);if($('answer').value.trim()===question)$('answer').value='';status('followup');busy=false;render();say(data.answer);}
 catch{if(token===requestEpoch){status('failed');dialogue=true;followup=Infinity;}}
 finally{clearTimeout(timer);if(token===requestEpoch){busy=false;request=null;render();}}
}
for(const l of LANGUAGES){const b=document.createElement('button');b.type='button';b.dataset.lang=l.code;b.lang=l.code;b.dir=l.dir;b.textContent=l.name;b.onclick=()=>changeLanguage(l.code);$('languages').append(b);}
for(let i=1;i<=12;i++){const o=document.createElement('option');o.value=String(i);o.textContent=String(i);$('grade').append(o);}
$('grade').onchange=()=>{state.grade=Number($('grade').value);render();};$('subject').onchange=()=>{state.subject=$('subject').value;render();};
$('open-course').onclick=()=>{if(!course(state.subject,state.grade).available)return;if(!state.session)newSession();state.view='lesson';render();};
$('catalog-back').onclick=()=>{stopAll();state.paused=true;state.view='catalog';render();};
$('new-lesson').onclick=()=>{if(state.started&&!state.ended&&!confirm(T('newConfirm')))return;newSession();render();};
$('load-avatar').onclick=loadTeacher;$('play').onclick=async()=>{if(!current())return;if(state.ended){if(!confirm(T('newConfirm')))return;newSession();}if(state.started&&!state.paused){state.paused=true;stopAll();render();return;}if(!await loadTeacher())return;resume();};
$('next').onclick=next;$('repeat').onclick=()=>{if(current())say(lastReply?.text||(state.reveal?pack().solve:pack().ob));};
$('answer-form').onsubmit=submit;$('answer').addEventListener('input',()=>{if(current())beginDialogue();});
$('mic').onclick=()=>{if(!current())return;if(recognition){try{recognition.stop();}catch{stopMic();}return;}if(!micAllowed){if(!confirm(T('micConsent')))return;micAllowed=true;}const R=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;if(!R){status('micError');return;}beginDialogue();const r=new R(),epoch=++recordEpoch;recognition=r;r.lang=language(state.lang).locale;r.continuous=false;r.interimResults=false;let sent=false;
 r.onresult=event=>{if(sent||epoch!==recordEpoch)return;const final=Array.from(event.results).filter(x=>x.isFinal!==false).map(x=>x[0].transcript).join(' ').trim();if(!final)return;sent=true;$('answer').value=final.slice(0,450);stopMic();submit();};r.onend=()=>{if(recognition===r){recognition=null;$('mic').textContent=T('mic');}};r.onerror=()=>{if(epoch===recordEpoch){stopMic();status('micError');}};try{r.start();$('mic').textContent='■';}catch{stopMic();status('micError');}};
$('audio-open').onclick=()=>{state.paused=true;stopAll();render();$('audio').showModal();};$('audio-close').onclick=()=>{stopSpeech();$('audio').close();};$('test-voice').onclick=()=>say(current()?pack().hello:T('programme'));$('remote').onchange=()=>{stopSpeech();updateVoices();};$('volume').oninput=()=>{if(Number($('volume').value)===0)stopSpeech();};
globalThis.speechSynthesis?.addEventListener('voiceschanged',updateVoices);
let lastSave=0;setInterval(()=>{const now=performance.now(),dt=Math.min(1,(now-lastTime)/1000);lastTime=now;if(document.hidden||state.view!=='lesson'||!current())return;
 if(state.started&&!state.paused&&!state.ended&&!busy){state.elapsed+=dt;state.stepElapsed+=dt;$('timer').textContent=`${time(state.elapsed)} / 40:00`;if(state.reveal&&state.progress<1){state.progress=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,state.progress+dt/7);$('visual').innerHTML=boardSVG(current(),state.progress,true);}if(!state.review&&state.reveal&&state.progress===1&&state.stepElapsed>=240&&!speaking&&!speechPending&&!$('answer').value.trim())next();}
 if(dialogue&&!busy&&!speaking&&!speechPending&&!voiceProblem&&!recognition&&!$('audio').open&&!$('answer').value.trim()&&Number.isFinite(followup)){followup-=dt;if(followup<=0){dialogue=false;if(resumeAfter)resume();}}
 if(now-lastSave>1000){save();lastSave=now;}},100);
addEventListener('pagehide',()=>{save();stopAll();});document.addEventListener('visibilitychange',()=>{if(document.hidden){state.paused=true;stopAll();save();}lastTime=performance.now();});
$('answer').value=typeof state.draft==='string'?state.draft:'';
Object.defineProperty(window,'GEM_PC',{get:()=>({version:'pc-five-v1',lang:state.lang,grade:state.grade,subject:state.subject,sessionId:state.session?.id,index:state.index,step:current()?{id:current().id,a:current().a,b:current().b,missing:!!current().missing}:null,reveal:state.reveal,review:state.review,progress:state.progress,paused:state.paused,elapsed:state.elapsed,modelReady,dialogue,busy,speaking,speechPending,readiness:course(state.subject,state.grade).status})});
render();installDisplayV3();
