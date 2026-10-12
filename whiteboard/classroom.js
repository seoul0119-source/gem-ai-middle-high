import {LESSON,LANGUAGES,LESSON_ID,workedExample,hint} from './lesson.js';
import {LessonController} from './controller.js';
const $=s=>document.querySelector(s);
let lang=LANGUAGES.includes(new URL(location.href).searchParams.get('lang'))?new URL(location.href).searchParams.get('lang'):'ko';
let controller=new LessonController(),member=null,lessonAudio=null,answerAudio=null,lessonAudioKey='',history=[],lastAnswer='',questionAbort=null,recorder=null,recordStream=null,recordTimer=null,recordEpoch=0,disposed=false;
const sceneAudio=new Map(),requests=new Set();
const content=()=>LESSON[lang],ui=()=>content().ui;
function say(text,error=false){$('#status').textContent=text;$('#status').classList.toggle('error',error);}
const key=()=>`gem-whiteboard:${LESSON_ID}:${member?.id||''}:${lang}`;
function save(){if(member)try{localStorage.setItem(key(),JSON.stringify({scene:controller.scene}));}catch{}}
function restore(fallback=0){try{const n=JSON.parse(localStorage.getItem(key())||'null')?.scene;return Number.isInteger(n)&&n>=0&&n<6?n:fallback;}catch{return fallback;}}
function stopRecording(discard=true){if(discard)recordEpoch++;clearTimeout(recordTimer);if(recorder?.state==='recording')recorder.stop();recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;$('#mic').setAttribute('aria-pressed','false');$('#mic').textContent=ui().mic;}
function stopVoice(){lessonAudio?.pause();if(answerAudio){answerAudio.pause();if(answerAudio.src.startsWith('blob:'))URL.revokeObjectURL(answerAudio.src);answerAudio=null;}}
function cancelQuestion(){questionAbort?.abort();questionAbort=null;$('#send').disabled=false;}
function pause(){stopVoice();cancelQuestion();controller.pause();save();renderControls();say(ui().paused);}
async function api(body,{signal,binary=false,language=lang,scene=controller.scene}={}){
 const abort=new AbortController();requests.add(abort);const cancelled=()=>abort.abort();signal?.addEventListener('abort',cancelled,{once:true});if(signal?.aborted)abort.abort();const timeout=setTimeout(()=>abort.abort(),50000);
 try{
  const r=await fetch('/api/whiteboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,scene,...body}),signal:abort.signal});
  if(!r.ok){if(r.status===401||r.status===403)say(ui().auth,true);throw Error('request_failed');}
  return binary?r.blob():r.json();
 }finally{requests.delete(abort);clearTimeout(timeout);signal?.removeEventListener('abort',cancelled);}
}
async function sceneUrl(language,scene){
 const id=language+':'+scene;
 if(!sceneAudio.has(id))sceneAudio.set(id,api({action:'speech',kind:'scene'},{binary:true,language,scene}).then(blob=>{if(disposed)throw Error('closed');return URL.createObjectURL(blob);}).catch(e=>{sceneAudio.delete(id);throw e;}));
 return sceneAudio.get(id);
}
function renderBoard(progress=0){
 const practice=controller.mode==='practice',q=practice?controller.question():{a:7,b:5,answer:12,bridge:3,remainder:2};
 const solved=practice&&(controller.practice.solved||controller.practice.revealed),scene=controller.scene;
 const showBlue=practice||scene>=1;
 const moved=practice?(solved?1:0):scene<2?0:scene>2?1:Math.min(1,progress*1.6);
 let svg='';
 for(let i=0;i<10;i++)svg+=`<rect x="${65+(i%5)*60}" y="${90+Math.floor(i/5)*60}" width="60" height="60" fill="none" stroke="#73929c" stroke-width="1.4"/>`;
 for(let i=0;i<q.a;i++)svg+=`<circle class="dot" cx="${95+(i%5)*60}" cy="${120+Math.floor(i/5)*60}" r="17" fill="#efc76b"/>`;
 if(showBlue)for(let i=0;i<q.b;i++){
  const sx=465+(i%4)*48,sy=120+Math.floor(i/4)*60;
  const fraction=i<q.bridge?Math.max(0,Math.min(1,(moved-i*.16)/(1-(q.bridge-1)*.16))):0;
  const dx=95+((q.a+i)%5)*60,dy=120+Math.floor((q.a+i)/5)*60;
  svg+=`<circle class="dot" cx="${sx+(dx-sx)*fraction}" cy="${sy+(dy-sy)*fraction}" r="17" fill="#69bdec"/>`;
 }
 const formula=practice?`${q.a} + ${q.b} = ${solved?q.answer:'?'}`:['7','7 + 5','7 + 3 = 10','5 = 3 + 2','10 + 2','7 + 5 = 12'][scene];
 svg+=`<text x="360" y="50" text-anchor="middle" fill="#ecf4f3" font-size="26" font-weight="650">${practice?`${q.a} + ${q.b}`:'7 + 5'}</text><text x="360" y="292" text-anchor="middle" fill="#f4d58c" font-size="38" font-weight="600">${formula}</text>`;
 if(!practice&&scene===2&&progress>.05&&progress<.65)svg+='<path d="M445 170 Q405 220 363 195" fill="none" stroke="#99d2dc" stroke-width="2" stroke-dasharray="5 5"/>';
 $('#board-svg').innerHTML=svg;$('#board-svg').setAttribute('aria-label',`${q.a} + ${q.b}${practice&&!solved?' = ?':!practice&&scene<5?'':` = ${q.answer}`}`);
}
function renderControls(){
 const playing=controller.status==='playing',practice=controller.mode==='practice';
 $('#play').textContent=controller.status==='ready'?ui().start:ui().resume;
 $('#play').disabled=!member||playing||practice;$('#pause').disabled=!member||!['playing','thinking','answering'].includes(controller.status);
 $('#replay').disabled=!member||practice;
 $('#one').disabled=!member;$('#ten').disabled=!member;$('#mic').disabled=!member;$('#question').disabled=!member;$('#send').disabled=!member||controller.status==='thinking';
 $('#practice-choice').hidden=practice;$('#practice-panel').hidden=!practice;
 $('#scene-nav').querySelectorAll('button').forEach((b,i)=>{b.disabled=practice;b.setAttribute('aria-current',i===controller.scene?'step':'false');});
}
function render(){
 const lesson=content();document.documentElement.lang=lang;document.title=`GEM · ${lesson.title}`;
 document.querySelectorAll('[data-label]').forEach(el=>{el.textContent=lesson.ui[el.dataset.label]||'';});
 $('#language').value=lang;$('#lesson-title').textContent=lesson.title;$('#lesson-subtitle').textContent=lesson.subtitle;$('#teacher-name').textContent=lesson.teacher;$('#speaker-name').textContent=lesson.teacher;$('#student-name').textContent=member?.name||'';$('#question').placeholder=lesson.ui.placeholder;
 $('#scene-label').textContent=lesson.scenes[controller.scene][0];$('#scene-count').textContent=`${controller.scene+1} / 6`;$('#narration-text').textContent=lesson.scenes[controller.scene][1];
 $('#scene-nav').replaceChildren();for(let i=0;i<6;i++){const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.title=lesson.scenes[i][0];b.setAttribute('aria-label',`${lesson.ui.step} ${i+1}: ${lesson.scenes[i][0]}`);b.onclick=()=>{pause();controller.move(i);lessonAudio=null;lessonAudioKey='';$('#audio-progress').style.width='0%';save();render();};$('#scene-nav').append(b);}
 renderBoard(lessonAudio&&Number.isFinite(lessonAudio.duration)?lessonAudio.currentTime/lessonAudio.duration:0);renderControls();renderConversation();if(controller.mode==='practice')renderPractice();
}
function renderConversation(){
 $('#conversation').replaceChildren();for(const m of history){const div=document.createElement('div');div.className='message '+m.role;const label=document.createElement('small');label.textContent=m.role==='assistant'?content().teacher:member?.name||ui().ask;const p=document.createElement('span');p.textContent=m.content;div.append(label,p);$('#conversation').append(div);}
 $('#listen-answer').hidden=!lastAnswer;$('#conversation').scrollTop=$('#conversation').scrollHeight;
}
async function playScene(restart=false){
 if(!member||disposed)return;stopRecording();stopVoice();cancelQuestion();const instance=controller,language=lang,scene=controller.scene,turn=controller.play();
 if(restart||lessonAudioKey!==language+':'+scene){lessonAudio=null;lessonAudioKey='';$('#audio-progress').style.width='0%';}
 render();say(lessonAudio?ui().playing:ui().prepareAudio);
 try{
  if(!lessonAudio){const url=await sceneUrl(language,scene);if(controller!==instance||controller.turn!==turn||lang!==language||disposed)return;lessonAudio=new Audio(url);lessonAudioKey=language+':'+scene;}
  if(lessonAudio.ended)lessonAudio.currentTime=0;
  const current=lessonAudio;current.playbackRate=Number($('#speed').value);
  current.ontimeupdate=()=>{if(controller.mode==='lesson'&&controller.scene===scene&&lang===language){const p=Number.isFinite(current.duration)?current.currentTime/current.duration:0;$('#audio-progress').style.width=`${p*100}%`;renderBoard(p);}};
  current.onended=()=>{if(controller!==instance||lang!==language||!controller.ended(scene,turn))return;save();if(controller.status==='complete'){renderControls();say(ui().complete);}else{lessonAudio=null;lessonAudioKey='';void playScene();}};
  await current.play();if(controller!==instance||controller.turn!==turn){current.pause();return;}say(ui().playing);
  if(scene<5)void sceneUrl(language,scene+1).catch(()=>{});
 }catch{if(controller===instance&&controller.turn===turn){controller.pause();renderControls();say(ui().audioError,true);}}
}
async function speakAnswer(text,turn){
 const language=lang,instance=controller;
 try{const blob=await api({action:'speech',text},{binary:true});if(controller!==instance||controller.turn!==turn||lang!==language||disposed)return;
  const url=URL.createObjectURL(blob);answerAudio=new Audio(url);answerAudio.playbackRate=Number($('#speed').value);answerAudio.onended=()=>{URL.revokeObjectURL(url);if(controller===instance&&controller.replied(turn)){renderControls();say(ui().paused);}};answerAudio.onerror=()=>{URL.revokeObjectURL(url);if(controller===instance&&controller.replied(turn)){renderControls();say(ui().audioError,true);}};
  const current=answerAudio;await current.play();if(controller!==instance||controller.turn!==turn)current.pause();
 }catch{if(controller===instance&&controller.turn===turn){controller.replied(turn);renderControls();say(ui().audioError,true);}}
}
async function ask(event){
 event?.preventDefault();const text=$('#question').value.trim();if(!text||!member)return;
 stopRecording();stopVoice();cancelQuestion();const instance=controller,turn=controller.ask(),language=lang;questionAbort=new AbortController();renderControls();say(ui().thinking);
 try{
  const body={action:'ask',text,history:history.slice(-8),...(controller.mode==='practice'?{questionId:controller.question().id}:{})};
  const d=await api(body,{signal:questionAbort.signal});if(controller!==instance||lang!==language||!controller.reply(turn))return;
  history=[...history,{role:'user',content:text},{role:'assistant',content:d.answer}].slice(-8);lastAnswer=d.answer;$('#question').value='';renderConversation();renderControls();say(ui().answering);void speakAnswer(d.answer,turn);
 }catch(e){if(controller===instance&&controller.turn===turn){controller.pause();renderControls();say(ui().networkError,true);}}
}
function renderPractice(){
 const p=controller.practice,q=controller.question();$('#practice-heading').textContent=`${ui().progress} ${p.index+1} / ${p.count}`;$('#scene-label').textContent=`${q.a} + ${q.b}`;$('#scene-count').textContent=`${p.index+1} / ${p.count}`;
 $('#narration-text').textContent=p.solved||p.revealed?workedExample(q,lang):hint(q,lang);
 $('#answer-form').hidden=p.solved||p.revealed;$('#show-solution').hidden=p.solved||p.revealed;$('#next').hidden=!(p.solved||p.revealed)||p.index+1>=p.count;
 if((p.solved||p.revealed)&&p.index+1>=p.count)say(ui().practiceDone);renderBoard();
}
function startPractice(count){pause();stopRecording();controller.practiceStart(count);$('#answer').value='';$('#feedback').textContent='';render();$('#answer').focus();}
function grade(event){
 event.preventDefault();stopVoice();const result=controller.grade($('#answer').value);if(result.ignored)return;if(result.invalid){$('#feedback').textContent=ui().invalidAnswer;return;}
 const feedback=result.correct?ui().correct+' '+workedExample(controller.question(),lang):ui().tryAgain+' '+hint(controller.question(),lang);$('#feedback').textContent=feedback;renderPractice();
 const turn=controller.ask();controller.reply(turn);renderControls();void speakAnswer(feedback,turn);
}
async function microphone(){
 if(recorder?.state==='recording'){stopRecording(false);return;}
 pause();if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){say(ui().micError,true);return;}
 const epoch=++recordEpoch,language=lang;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  if(epoch!==recordEpoch||language!==lang||disposed){stream.getTracks().forEach(t=>t.stop());return;}
  recordStream=stream;const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=async()=>{
   stream.getTracks().forEach(t=>t.stop());if(epoch!==recordEpoch||language!==lang||disposed)return;
   $('#mic').setAttribute('aria-pressed','false');$('#mic').textContent=ui().mic;const blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});if(!blob.size||blob.size>1200000){say(ui().micError,true);return;}
   say(ui().transcribing);$('#mic').disabled=true;
   try{const audio=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});const d=await api({action:'transcribe',audio,mime:blob.type},{language});if(epoch!==recordEpoch||language!==lang||disposed)return;$('#question').value=d.text;say(ui().reviewMic);$('#question').focus();say(ui().reviewMic);}catch{if(epoch===recordEpoch)say(ui().micError,true);}finally{renderControls();}
  };
  recorder.start();$('#mic').setAttribute('aria-pressed','true');$('#mic').textContent=ui().micStop;say(ui().recording);recordTimer=setTimeout(()=>stopRecording(false),20000);
 }catch{if(epoch===recordEpoch)say(ui().micError,true);}
}
$('#play').onclick=()=>void playScene();$('#pause').onclick=()=>{stopRecording();pause();};$('#replay').onclick=()=>void playScene(true);
$('#question').onfocus=()=>{if(['playing','thinking','answering'].includes(controller.status))pause();};$('#question-form').onsubmit=ask;$('#mic').onclick=()=>void microphone();
$('#one').onclick=()=>startPractice(1);$('#ten').onclick=()=>startPractice(10);$('#answer-form').onsubmit=grade;
$('#show-solution').onclick=()=>{stopVoice();controller.reveal();const text=workedExample(controller.question(),lang);$('#feedback').textContent=text;renderPractice();const turn=controller.ask();controller.reply(turn);renderControls();void speakAnswer(text,turn);};
$('#next').onclick=()=>{pause();if(controller.next()){$('#answer').value='';$('#feedback').textContent='';renderPractice();$('#answer').focus();}};
$('#back').onclick=()=>{pause();controller.back();render();say(ui().paused);};
$('#listen-answer').onclick=()=>{pause();const turn=controller.ask();controller.reply(turn);renderControls();say(ui().answering);void speakAnswer(lastAnswer,turn);};
$('#speed').onchange=()=>{if(lessonAudio)lessonAudio.playbackRate=Number($('#speed').value);if(answerAudio)answerAudio.playbackRate=Number($('#speed').value);};
$('#language').onchange=()=>{save();stopRecording();pause();const scene=controller.scene;lang=$('#language').value;controller=new LessonController(restore(scene));lessonAudio=null;lessonAudioKey='';history=[];lastAnswer='';$('#question').value='';$('#feedback').textContent='';$('#audio-progress').style.width='0%';const url=new URL(location.href);url.searchParams.set('lang',lang);window.history.replaceState(null,'',url);render();say(ui().ready);if(member)void sceneUrl(lang,controller.scene).catch(()=>{});};
$('#restart').onclick=()=>{pause();controller=new LessonController();lessonAudio=null;lessonAudioKey='';$('#audio-progress').style.width='0%';save();render();say(ui().ready);};
window.addEventListener('pagehide',()=>{disposed=true;save();stopVoice();stopRecording();cancelQuestion();requests.forEach(c=>c.abort());for(const p of sceneAudio.values())p.then(URL.revokeObjectURL).catch(()=>{});});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopRecording();pause();}});
render();say(ui().ready);
try{const r=await fetch('/api/session',{cache:'no-store'});const d=await r.json();if(!r.ok||!d.authenticated||!d.student?.id)throw Error('unauthorized');member=d.student;controller=new LessonController(restore());render();say(ui().ready);void sceneUrl(lang,controller.scene).catch(()=>{});}catch{say(ui().auth,true);const link=document.createElement('a');link.href='/?whiteboard=1&lang='+lang;link.textContent=ui().auth;$('#status').append(document.createTextNode(' '),link);}
