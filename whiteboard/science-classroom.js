import {BOARD_COURSES,getBoardCourse,getBoardTopic} from './board-courses.js';
import {emptyBoardProgress,normalizeBoardProgress,mergeBoardProgress} from './board-progress.js';
import {ScienceController} from './science-controller.js';
import {createScienceRecords} from './science-records.js';
const $=s=>document.querySelector(s);
const entry=new URL(location.href),courseId=entry.searchParams.get('course')||'h3-science',boardCourse=getBoardCourse(courseId);
const SCIENCE_TOPICS=boardCourse?.topics||[];
const requestedWorksheet=entry.searchParams.get('worksheet')||'';
const transferToken=new URLSearchParams(entry.hash.slice(1)).get('transfer')||'';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validSource=value=>value&&uuid(value.id)&&Number.isSafeInteger(value.revision)&&value.revision>=1;

let member=null,run=null,controller=new ScienceController(),records=null,epoch=0,disposed=false,starting=false,lessonAudio=null,lessonAudioKey='',answerAudio=null,questionAbort=null,recorder=null,recordStream=null,recordTimer=null,recordEpoch=0,history=[],lastAnswer='';
const requests=new Set(),audioCache=new Map();
const SCIENCE_ENTRY_URL='https://gem-english-middle-school-math.seoul0119.chatgpt.site/api/learning/science-entry';
const currentTopic=()=>getBoardTopic(courseId,$('#topic').value)||SCIENCE_TOPICS[0];
const baseStorageKey=()=>`gem-science-board:${member?.id||''}`+(courseId==='h3-science'?'':':course:'+courseId);
const storageKey=()=>{const id=run?.source?.id||run?.worksheetId||requestedWorksheet;return id?baseStorageKey()+':worksheet:'+id:baseStorageKey();};
function selectLessonTopic(lesson){if(lesson.topicId==='worksheet'&&!Array.from($('#topic').querySelectorAll('option')).some(o=>o.value==='worksheet')){const o=document.createElement('option');o.value='worksheet';o.textContent='현재 10문제에 맞춘 설명';$('#topic').append(o);}$('#topic').value=lesson.topicId;}

function say(text,error=false){$('#status').textContent=text;$('#status').classList.toggle('error',error);}
function ensureRecords(){if(run&&records&&!run.tracked){run.tracked=true;void records.start(run.lesson).catch(()=>{});}}
function record(type,payload={}){if(run&&records){ensureRecords();try{records.event(type,{lessonId:run.lesson.id,...payload});}catch{}}}
function save(){
 if(!member||!run)return;
 try{
  const saved=JSON.stringify({lesson:run.lesson,token:run.token,quiz:run.quiz,quizToken:run.quizToken,source:run.source,worksheetId:run.worksheetId,progress:controller.legacyPractice?undefined:(controller.progress||run.progress),legacyPractice:controller.legacyPractice,scene:controller.scene,mode:controller.mode,practice:controller.practice,audioTime:lessonAudio?lessonAudio.currentTime:(run.restoreTime||0),audioScene:lessonAudioKey||run.restoreScene||'',history,lastAnswer,timings:run.timings,savedAt:Date.now()});
  localStorage.setItem(storageKey(),saved);localStorage.setItem(baseStorageKey(),saved);
  if(run.lesson.topicId!=='worksheet')localStorage.setItem(baseStorageKey()+':topic:'+run.lesson.topicId,saved);
 }catch{}
}
function clearSaved(){/* A new lesson must not remove another saved course or worksheet. */}
function novelty(){try{const a=JSON.parse(localStorage.getItem(storageKey()+':history')||'[]');return Array.isArray(a)?a.filter(s=>typeof s==='string').slice(-30):[];}catch{return[];}}
function saveNovelty(material){try{localStorage.setItem(storageKey()+':history',JSON.stringify([...novelty(),...material.questions.map(q=>q.prompt)].slice(-30)));}catch{}}
function validLesson(l){return l&&typeof l.id==='string'&&l.courseId===courseId&&l.language===boardCourse?.language&&getBoardTopic(courseId,l.topicId)&&Array.isArray(l.scenes)&&l.scenes.length>=1&&l.scenes.length<=5&&l.scenes.every(s=>s&&typeof s.title==='string'&&typeof s.narration==='string'&&Array.isArray(s.lines)&&s.lines.every(x=>typeof x==='string'));}
function validQuiz(q){return q&&Array.isArray(q.questions)&&q.questions.length===10&&q.questions.every(x=>typeof x.prompt==='string'&&Array.isArray(x.choices)&&x.choices.length===4&&x.choices.every(v=>typeof v==='string')&&Number.isInteger(x.answerIndex)&&x.answerIndex>=0&&x.answerIndex<4&&typeof x.explanation==='string'&&Array.isArray(x.hints));}
function restore(key=storageKey()){
 try{
  const d=JSON.parse(localStorage.getItem(key)||'null');
  if(!d||Date.now()-d.savedAt>7*24*60*60*1000||!validLesson(d.lesson)||typeof d.token!=='string'||(requestedWorksheet&&(d.source?.id||d.worksheetId)!==requestedWorksheet))return false;
  controller=new ScienceController(d.scene);
  run={resumeRequired:true,lesson:d.lesson,token:d.token,quiz:validQuiz(d.quiz)?d.quiz:null,quizToken:typeof d.quizToken==='string'?d.quizToken:null,source:validSource(d.source)?d.source:null,worksheetId:uuid(d.worksheetId)?d.worksheetId:null,timings:d.timings||{},startedAt:Date.now(),continueBusy:false,practiceBusy:false,continueError:false,practiceError:false,restoreTime:Number.isFinite(d.audioTime)?Math.max(0,d.audioTime):0,restoreScene:d.audioScene};
  run.progress=run.quiz?normalizeBoardProgress(d.progress,run.quiz.questions):null;controller.status='paused';
  if(run.quiz&&(d.practice||run.progress)){
   const p=d.practice||{count:10,index:0};
   controller.practiceStart(run.quiz.questions,[1,10].includes(p.count)?p.count:10,run.progress||emptyBoardProgress(),p.index);
   if(!run.progress&&d.practice){controller.legacyPractice=true;controller.practice={...controller.practice,index:Math.max(0,Math.min(controller.practice.count-1,Number.isInteger(p.index)?p.index:0)),attempts:Math.max(0,Math.min(3,p.attempts||0)),solved:p.solved===true,revealed:p.revealed===true,correct:Math.max(0,Math.min(controller.practice.count,p.correct||0)),selected:Number.isInteger(p.selected)?p.selected:null};}
   if(d.mode!=='practice')controller.back();
  }
  history=Array.isArray(d.history)?d.history.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-8):[];lastAnswer=typeof d.lastAnswer==='string'?d.lastAnswer:'';selectLessonTopic(d.lesson);return true;
 }catch{return false;}
}
async function importWorksheet(){
 if(!member||!boardCourse||starting||!transferToken||!uuid(requestedWorksheet))return;
 const previous=run,oldController=controller,runEpoch=epoch;
 starting=true;if(run)run.resumeRequired=true;renderControls();
 say('교실에 저장된 같은 10문제와 풀이 상태를 확인하고 있어요.');
 const startedAt=Date.now();
 try{
  const d=await requestApi({action:'import',courseId,transferToken,...(previous?.quizToken?{token:previous.token,quizToken:previous.quizToken}:{})});
  if(disposed||epoch!==runEpoch)return;
  if(!validLesson(d.lesson)||typeof d.token!=='string'||!validQuiz(d.material)||typeof d.quizToken!=='string'||!validSource(d.source)||d.source.id!==requestedWorksheet)throw Error('invalid_worksheet');
  const incoming=normalizeBoardProgress(d.progress,d.material.questions);
  if(!incoming)throw Error('invalid_progress');
  const same=previous?.lesson.id===d.lesson.id&&JSON.stringify(previous.quiz)===JSON.stringify(d.material);
  const local=same?normalizeBoardProgress(oldController.progress||previous.progress,d.material.questions):null;
  const progress=local?mergeBoardProgress(incoming,local,d.material.questions):incoming;
  run={lesson:d.lesson,token:d.token,quiz:d.material,quizToken:d.quizToken,source:d.source,worksheetId:d.source.id,progress,cursor:Number.isInteger(d.cursor)?d.cursor:0,startedAt,timings:same?previous.timings:{},continueBusy:false,practiceBusy:false,continueError:false,practiceError:false,restoreTime:same?previous.restoreTime||0:0,restoreScene:same?previous.restoreScene||'':''};
  controller=new ScienceController(same?oldController.scene:0);
  controller.practiceStart(d.material.questions,10,progress,run.cursor);controller.back();
  if(!same){history=[];lastAnswer='';}
  selectLessonTopic(d.lesson);setMetric('board');setMetric('questions');save();render();
  const clean=new URL(location.href);clean.hash='';window.history?.replaceState?.(null,'',clean.href);
  say(same?'같은 설명과 최신 풀이 상태를 불러왔어요. ‘칠판 이어하기’를 눌러 다시 들으세요.':'현재 10문제에 맞춘 설명입니다. ‘칠판 이어하기’를 누르면 준비된 설명부터 들을 수 있어요.');
  void continueLesson();
 }catch(error){
  if(disposed||epoch!==runEpoch)return;
  if(previous){run=previous;controller=oldController;}
  say(errorMessage(error,'같은 학습지를 연결하지 못했어요. Mei 교실로 돌아가 칠판 설명 버튼을 다시 눌러 주세요. 저장된 문제와 풀이 기록은 유지됩니다.'),true);
  $('#worksheet-return').hidden=false;
 }finally{if(epoch===runEpoch){starting=false;renderControls();}}
}
function configureCourse(){
 for(const c of BOARD_COURSES){const option=document.createElement('option');option.value=c.id;option.textContent=c.title;$('#board-course').append(option);}
 $('#board-course').value=courseId;
 $('#board-course').onchange=()=>{const target=getBoardCourse($('#board-course').value);if(!target)return;save();cleanup();if(records)records.exit();location.href='/science-board.html?course='+encodeURIComponent(target.id);};
 const label=boardCourse?.title||'아직 준비되지 않은 과목';
 document.title='GEM · '+label+' 칠판';$('#course-label').textContent=label+' · 실시간 칠판';
 const home='https://gem-english-middle-school-math.seoul0119.chatgpt.site/classroom?course='+encodeURIComponent(courseId)+(uuid(requestedWorksheet)?'&worksheet='+requestedWorksheet:'');
 for(const id of ['#course-home','#practice-home']){$(id).href=courseId==='h3-science'&&!requestedWorksheet?'/learn.html?course=h3-science':home;$(id).textContent=boardCourse?.title+' 교실';}
 $('#worksheet-return').href=home;$('#worksheet-return').hidden=!requestedWorksheet;
 if(uuid(requestedWorksheet))for(const id of ['#worksheet-return','#course-home','#practice-home'])$(id).onclick=returnToWorksheet;
 $('#resume-login').href='/?scienceboard=1'+(courseId==='h3-science'?'':'&course='+encodeURIComponent(courseId))+(uuid(requestedWorksheet)?'&worksheet='+requestedWorksheet:'');
}
function stopRecording(discard=true){if(discard)recordEpoch++;clearTimeout(recordTimer);if(recorder?.state==='recording')recorder.stop();recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;$('#mic').setAttribute('aria-pressed','false');$('#mic').textContent='마이크로 질문';}
function stopVoice(){lessonAudio?.pause();if(answerAudio){answerAudio.pause();URL.revokeObjectURL(answerAudio.src);answerAudio=null;}}
function cancelQuestion(){questionAbort?.abort();questionAbort=null;}
function pause(message='멈춘 위치부터 다시 이어갈 수 있어요.'){stopVoice();cancelQuestion();controller.pause();controller.waiting=false;save();renderControls();say(message);}
function cleanup(){epoch++;stopRecording();stopVoice();cancelQuestion();for(const c of requests)c.abort();requests.clear();for(const p of audioCache.values())p.then(URL.revokeObjectURL).catch(()=>{});audioCache.clear();lessonAudio=null;lessonAudioKey='';answerAudio=null;}
async function requestApi(body,{binary=false,signal,timeout=270000}={}){const abort=new AbortController();requests.add(abort);const onAbort=()=>abort.abort();signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)abort.abort();const timer=setTimeout(()=>abort.abort(),timeout);try{const r=await fetch('/api/whiteboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pilot:'science',...body}),signal:abort.signal});if(!r.ok){const d=await r.json().catch(()=>({}));const e=Error(d.error||'request_failed');e.status=r.status;throw e;}return binary?r.blob():r.json();}finally{clearTimeout(timer);requests.delete(abort);signal?.removeEventListener('abort',onAbort);}}
const tokenErrors=new Set(['lesson_expired','quiz_expired','invalid_lesson_token','invalid_quiz_token']);
function errorMessage(e,fallback){
 if(e?.message==='lesson_reentry_required')return '이전 로그인에서 만든 수업은 다시 연결할 수 없어요. 위의 ‘새 설명 만들고 시작’을 눌러 주세요. Mei 교실에 저장된 문제와 풀이 기록은 그대로 남아 있어요.';
 if(e?.status===410)return '저장된 수업의 이어하기 기간이 지났어요. 위의 ‘새 설명 만들고 시작’을 눌러 주세요.';
 if(tokenErrors.has(e?.message))return '저장된 수업 연결을 확인하지 못했어요. 다시 연결하거나 위의 ‘새 설명 만들고 시작’을 눌러 주세요.';
 if(e?.status===401)return '로그인 시간이 지났어요. 아래 ‘학생 ID로 다시 입장’을 눌러 주세요. 칠판 위치는 이 기기에 보관됩니다.';
 if(e?.status===403)return '학생 이용 상태를 확인하지 못했어요. 학생 ID로 다시 입장해 주세요. 계속되면 선교사무실에 문의해 주세요.';
 if(e?.status===429)return '잠시 요청이 몰렸어요. 조금 뒤에 다시 눌러 주세요.';
 return fallback;
}
function renderResume(){
 const blocked=!!run?.resumeRequired,error=run?.resumeError;
 $('#resume-help').hidden=!blocked&&!run?.syncPending;
 $('#resume-message').textContent=run?.reconnecting?'저장된 설명과 문제를 다시 연결하고 있어요.':blocked?errorMessage(error,'연결을 완료하지 못했어요. 저장된 수업 다시 연결을 눌러 주세요.'):run?.syncPending?'최신 풀이 상태를 다시 확인할 수 있어요.':'';
 $('#resume-retry').disabled=!!run?.reconnecting;
 $('#resume-retry').hidden=error?.message==='lesson_reentry_required'||error?.status===410||error?.status===401;
 $('#resume-login').hidden=!(error?.status===401||error?.status===403&&!tokenErrors.has(error?.message));
}
async function reconnectRun(active=run){
 if(!active||run!==active||disposed)throw Error('closed');
 if(active.resumePromise)return active.resumePromise;
 const runEpoch=epoch,stillCurrent=()=>run===active&&epoch===runEpoch&&!disposed;
 active.resumeRequired=true;active.reconnecting=true;active.resumeError=null;renderControls();
 active.resumePromise=(async()=>{
  try{
   let d;
   // Preparation already in flight can complete while the connection renews.
   // Validate its newer tokens too instead of replacing five scenes with an intro.
   for(let attempt=0;attempt<3;attempt++){
    const token=active.token,quizToken=active.quizToken;
    d=await requestApi({action:'resume',token,...(quizToken?{quizToken}:{}),...(active.source||active.worksheetId?{refreshWorksheet:true}:{})},{timeout:45000});
    if(!stillCurrent())throw Error('closed');
    if(active.token===token&&active.quizToken===quizToken)break;
    d=null;
   }
   if(!d)throw Error('lesson_updated');
   const sourceId=active.source?.id||active.worksheetId;
   const replaced=d.lesson?.id!==active.lesson.id;
   if(!validLesson(d.lesson)||replaced&&!(d.authoritativeLesson===true&&sourceId&&d.source?.id===sourceId)||typeof d.token!=='string'||!d.token||active.quizToken&&(!validQuiz(d.material)||typeof d.quizToken!=='string'||!d.quizToken))throw Error('invalid_response');
   if(d.source&&(!validSource(d.source)||sourceId&&d.source.id!==sourceId))throw Error('worksheet_changed');
   if(active.quiz&&JSON.stringify(active.quiz)!==JSON.stringify(d.material))throw Error('worksheet_changed');
   if(d.progress&&d.material){
    const fresh=normalizeBoardProgress(d.progress,d.material.questions),local=normalizeBoardProgress(controller.progress||active.progress,d.material.questions);
    if(!fresh)throw Error('invalid_progress');
    const progress=local?mergeBoardProgress(fresh,local,d.material.questions):fresh;
    if(controller.practice){const mode=controller.mode,count=controller.practice.count,index=controller.practice.index;controller.practiceStart(d.material.questions,count,progress,index);controller.mode=mode;}
    active.progress=progress;
   }
   if(controller.practice&&d.material)controller.questions=d.material.questions;
   if(replaced){stopVoice();cancelQuestion();for(const value of audioCache.values())value.then(URL.revokeObjectURL).catch(()=>{});audioCache.clear();lessonAudio=null;lessonAudioKey='';active.restoreTime=0;active.restoreScene='';controller.move(0);active.explanationUpdated=true;}
   if(d.source){active.source=d.source;active.worksheetId=d.source.id;}
   active.syncPending=d.syncPending===true;
   active.lesson=d.lesson;active.token=d.token;
   if(d.material){active.quiz=d.material;active.quizToken=d.quizToken;}
   active.resumeRequired=false;active.resumeError=null;save();
   return true;
  }catch(error){
   if(stillCurrent()){active.resumeError=error;stopVoice();controller.pause();say(errorMessage(error,'연결을 완료하지 못했어요. 저장된 수업 다시 연결을 눌러 주세요.'),true);}
   throw error;
  }finally{
   active.reconnecting=false;active.resumePromise=null;
   if(stillCurrent())render();
  }
 })();
 return active.resumePromise;
}
async function resumeSavedLesson(){
 const active=run;
 try{await reconnectRun(active);if(run!==active||disposed)return;say(active.explanationUpdated?'다른 탭에서 저장한 최신 설명을 불러왔어요. 문제와 풀이 기록은 유지되며 설명은 첫 장부터 들을 수 있어요.':active.syncPending?'저장된 설명은 다시 들을 수 있어요. Mei 교실의 최신 풀이 상태는 아직 확인하지 못했습니다. 다시 연결을 눌러 갱신해 주세요.':'저장된 수업을 불러왔어요. ‘칠판 이어하기’를 누르면 설명 음성이 시작됩니다.');void continueLesson();void preparePractice();}catch{}
}
async function api(body,options={}){
 const active=run,runEpoch=epoch;
 try{return await requestApi(body,options);}
 catch(error){
  if(!active||run!==active||epoch!==runEpoch||disposed||options.signal?.aborted)throw error;
  if(!tokenErrors.has(error?.message)){
   if(error?.status===401||error?.status===403){active.resumeRequired=true;active.resumeError=error;stopVoice();controller.pause();renderControls();say(errorMessage(error,''),true);}
   throw error;
  }
  await reconnectRun(active);
  if(run!==active||epoch!==runEpoch||disposed||options.signal?.aborted)throw Error('closed');
  return requestApi({...body,token:active.token,...(body.quizToken?{quizToken:active.quizToken}:{})},options);
 }
}
function setMetric(name){if(run&&run.timings[name]===undefined){run.timings[name]=Math.round((Date.now()-run.startedAt)/100)/10;renderTimings();save();}}
function renderTimings(){const t=run?.timings||{},items=[['board','첫 칠판'],['voice','첫 음성 재생'],['questions','10문제 준비']];$('#timings').textContent=items.map(([k,label])=>`${label}: ${t[k]===undefined?'준비 중':`${t[k]}초`}`).join(' · ');}
function renderPreparation(){if(!run){$('#preparation').textContent='';$('#retry-preparation').hidden=true;return;}const a=run.lesson.complete?'설명 5장 준비 완료':run.continueError?'이어서 설명 준비를 다시 시도해 주세요.':'이어서 들을 설명을 준비하고 있어요.';const b=run.quiz?'10문제 준비 완료':run.practiceError?'10문제 준비를 다시 시도해 주세요.':'10문제를 만들고 검토하고 있어요.';$('#preparation').textContent=a+' · '+b;$('#retry-preparation').hidden=!(run.continueError||run.practiceError);$('#retry-preparation').disabled=run.resumeRequired||run.continueBusy||run.practiceBusy;$('#practice-status').textContent=run.quiz?'문제 풀이는 선택입니다. 한 문제 또는 10문제를 골라 보세요.':'설명을 듣는 동안 같은 단원의 10문제를 준비합니다. 문제 풀이는 선택입니다.';}
function renderControls(){const ready=!!member&&!!run&&!run.resumeRequired,practice=controller.mode==='practice',handoffBusy=!!run?.handoffBusy;$('#new-lesson').disabled=!member||starting||!boardCourse||!!requestedWorksheet||currentTopic()?.id==='worksheet';$('#new-lesson').textContent=starting?'첫 설명 준비 중…':currentTopic()?.id==='worksheet'?'현재 10문제 설명':'새 설명 만들고 시작';$('#topic').disabled=!member||starting;$('#play').disabled=!ready||handoffBusy||controller.status==='playing';$('#pause').disabled=!ready||handoffBusy||!['playing','thinking','answering'].includes(controller.status);$('#replay').disabled=!ready||handoffBusy;$('#one').disabled=!ready||handoffBusy||!run.quiz;$('#ten').disabled=!ready||handoffBusy||!run.quiz;$('#one').textContent=controller.practice?.count===1?'한 문제 이어풀기':'한 문제 풀기';$('#ten').textContent=controller.practice?.count===10?'10문제 이어풀기 · 선택':'10문제 풀기 · 선택';$('#question').disabled=!ready||handoffBusy;$('#mic').disabled=!ready||handoffBusy;$('#send').disabled=!ready||handoffBusy||controller.status==='thinking';$('#practice-choice').hidden=practice;$('#practice-panel').hidden=!practice;$('#scene-nav').querySelectorAll('button').forEach((b,i)=>{b.disabled=!ready||handoffBusy||practice||!run.lesson.scenes[i];b.setAttribute('aria-current',i===controller.scene?'step':'false');});$('#listen-answer').disabled=!ready||handoffBusy;$('#back').disabled=!ready||handoffBusy;$('#next').disabled=!ready||handoffBusy;$('#show-solution').disabled=!ready||handoffBusy;$('#choices').querySelectorAll('button').forEach(b=>{b.disabled=!ready||handoffBusy||!!controller.practice?.solved||!!controller.practice?.revealed;});renderHandoff();renderResume();}

function handoffReady(){return !!member&&!!run&&!run.resumeRequired&&run.lesson.complete===true&&run.lesson.scenes.length===5&&!!run.quiz&&typeof run.quizToken==='string'&&!!run.quizToken;}
function renderHandoff(){const ready=handoffReady(),busy=!!run?.handoffBusy;for(const id of ['#handoff','#handoff-complete']){$(id).disabled=!ready||busy;$(id).textContent=busy?'같은 문제로 교실 연결 중…':'Mei 선생님과 같은 10문제로 수업하기';}$('#handoff-help').textContent=ready?'지금 준비된 10문제로 수업합니다. 교실로 이동한 뒤 선생님 연결 버튼을 눌러 주세요.':run?.resumeRequired?'저장된 칠판 수업의 연결을 먼저 확인해 주세요.':run?'설명 5장과 10문제를 준비하고 있어요. 모두 준비되면 선생님 교실로 이어갈 수 있습니다.':'단원을 골라 설명을 시작하면, 같은 10문제로 선생님과 수업할 수 있어요.';$('#handoff-status').textContent=run?.handoffMessage||'';$('#handoff-status').classList.toggle('error',!!run?.handoffError);}
async function returnToWorksheet(event){
 // Without a restored/imported run, the ordinary link is the recovery route.
 // Once work exists, every link to this worksheet must use the signed handoff.
 if(!run||!uuid(requestedWorksheet))return;
 event.preventDefault();
 if(disposed)return;
 if((run.source?.id||run.worksheetId)!==requestedWorksheet){say('현재 칠판의 학습지 연결을 확인하지 못했어요. 저장된 수업을 다시 연결한 뒤 이동해 주세요.',true);return;}
 if(run.handoffBusy){say(run.handoffMessage||'같은 문제와 풀이 기록을 교실에 연결하고 있어요. 잠시 기다려 주세요.');return;}
 if(starting){say('같은 학습지의 설명과 풀이 상태를 확인하고 있어요. 확인을 마친 뒤 다시 눌러 주세요.');return;}
 if(!member||run.resumeRequired||run.reconnecting){renderResume();say(run.reconnecting?'저장된 설명과 문제를 다시 연결하고 있어요. 연결을 마친 뒤 다시 눌러 주세요.':errorMessage(run.resumeError,'풀이 기록을 함께 전달하려면 저장된 수업을 먼저 다시 연결해 주세요.'),true);return;}
 if(!handoffReady()){say(run.continueError||run.practiceError?'같은 설명과 문제의 준비를 완료하지 못했어요. ‘준비 다시 시도’를 눌러 주세요. 풀이 기록은 이 기기에 남아 있습니다.':'설명 5장과 같은 10문제를 준비하고 있어요. 풀이 기록을 함께 전달할 수 있도록 준비가 끝난 뒤 다시 눌러 주세요.');return;}
 const active=run;
 await handoffToTeacher();
 if(run===active&&!disposed&&active.handoffError)say(active.handoffMessage,true);
}
async function handoffToTeacher(){
 if(!handoffReady()||run.handoffBusy||disposed)return;
 const active=run,runEpoch=epoch;active.handoffBusy=true;active.handoffError=false;active.handoffMessage='설명을 잠시 멈추고 학습 기록을 저장하고 있어요.';stopRecording();pause();renderControls();
 const stillCurrent=()=>run===active&&epoch===runEpoch&&!disposed;
 try{
  const flushed=records?await records.flush():true;
  if(!stillCurrent())return;
  if(flushed===false)throw Error('record_flush_failed');
  active.handoffMessage='Mei 선생님 교실에 같은 10문제를 연결하고 있어요.';renderHandoff();
  const data=await api({action:'handoff',token:active.token,quizToken:active.quizToken,...(!controller.legacyPractice?{progress:controller.progress||active.progress||emptyBoardProgress(),cursor:controller.practice?.index||active.cursor||0}:{})},{timeout:90000});
  if(!stillCurrent())return;
  if(data.entryUrl!==SCIENCE_ENTRY_URL||typeof data.ticket!=='string'||!data.ticket.trim()||data.ticket.length>2048||typeof data.handoffToken!=='string'||!data.handoffToken.trim()||data.handoffToken.length>384*1024)throw Error('invalid_handoff');
  if(data.worksheetId){if(!uuid(data.worksheetId)||data.courseId!==courseId)throw Error('invalid_handoff');active.worksheetId=data.worksheetId;}
  stopRecording();stopVoice();save();
  const form=document.createElement('form');form.method='POST';form.action=SCIENCE_ENTRY_URL;form.target='_self';form.hidden=true;
  for(const [name,value] of [['ticket',data.ticket],['handoffToken',data.handoffToken]]){const field=document.createElement('input');field.type='hidden';field.name=name;field.value=value;form.append(field);}
  document.body.append(form);active.handoffMessage='교실로 이동합니다. 들어가면 선생님 연결 버튼을 눌러 주세요.';renderHandoff();
  try{form.submit();}catch(error){form.remove();throw error;}
 }catch(error){if(stillCurrent()){active.handoffBusy=false;active.handoffError=true;active.handoffMessage=error.message==='record_flush_failed'?'학습 기록 저장을 확인하지 못했어요. 현재 설명과 문제는 남아 있습니다. 연결 버튼을 다시 눌러 주세요.':errorMessage(error,'교실 연결을 완료하지 못했어요. 현재 설명과 문제는 그대로 남아 있습니다. 연결 버튼을 다시 눌러 주세요.');renderControls();}}
}

function renderBoard(progress=0){const lines=run?.lesson.scenes[controller.scene]?.lines||['다음 설명을 준비하고 있어요. 잠시만 기다려 주세요.'];$('#board-lines').replaceChildren();const visible=Math.max(1,Math.min(lines.length,1+Math.floor(progress*lines.length*1.5)));for(const text of lines.slice(0,visible)){const li=document.createElement('li');li.textContent=text;$('#board-lines').append(li);}}
function renderConversation(){$('#conversation').replaceChildren();for(const m of history){const div=document.createElement('div');div.className='message '+m.role;const label=document.createElement('small');label.textContent=m.role==='assistant'?'Mei':member?.name||'나';const p=document.createElement('span');p.textContent=m.content;div.append(label,p);$('#conversation').append(div);}$('#listen-answer').hidden=!lastAnswer;$('#conversation').scrollTop=$('#conversation').scrollHeight;}
function render(){if(member)$('#student-name').textContent=member.name||'';$('#topic-description').textContent=currentTopic()?.description||'';if(run){$('#lesson-title').textContent=run.lesson.title;const scene=run.lesson.scenes[controller.scene];$('#scene-label').textContent=scene?.title||'이어질 설명 준비 중';$('#scene-count').textContent=`${controller.scene+1} / 5`;$('#narration-text').textContent=scene?.narration||'준비가 끝나면 다음 설명을 들을 수 있어요.';renderBoard(lessonAudio&&Number.isFinite(lessonAudio.duration)?lessonAudio.currentTime/lessonAudio.duration:0);renderTimings();}$('#scene-nav').replaceChildren();for(let i=0;i<5;i++){const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label',`설명 ${i+1}: ${run?.lesson.scenes[i]?.title||'준비 중'}`);b.onclick=()=>{pause();controller.move(i);if(run){run.restoreTime=0;run.restoreScene='';}lessonAudio=null;lessonAudioKey='';$('#audio-progress').style.width='0%';save();render();};$('#scene-nav').append(b);}renderControls();renderPreparation();renderConversation();if(controller.mode==='practice')renderPractice();}
async function sceneUrl(scene){const active=run,key=active.lesson.id+':'+scene,runEpoch=epoch;if(!active.lesson.scenes[scene])throw Error('scene_pending');if(!audioCache.has(key))audioCache.set(key,api({action:'speech',token:active.token,scene,kind:'scene'},{binary:true,timeout:120000}).then(blob=>{if(disposed||epoch!==runEpoch||run!==active)throw Error('closed');return URL.createObjectURL(blob);}).catch(e=>{audioCache.delete(key);throw e;}));return audioCache.get(key);}
async function playScene(restart=false){if(!member||!run||run.resumeRequired||run.handoffBusy||disposed)return;ensureRecords();stopRecording();stopVoice();cancelQuestion();const instance=controller,active=run,runEpoch=epoch,scene=controller.scene,turn=controller.play();controller.waiting=false;save();if(restart||lessonAudioKey!==active.lesson.id+':'+scene){lessonAudio=null;lessonAudioKey='';$('#audio-progress').style.width='0%';}render();if(!active.lesson.scenes[scene]){controller.waiting=true;say(active.continueError?'이어질 설명 준비를 다시 시도해 주세요.':'다음 설명을 준비하고 있어요. 준비되면 이어서 들려드릴게요.');return;}say(lessonAudio?'설명을 이어갑니다.':'칠판을 보면서 잠시 기다려 주세요. 설명 음성을 준비합니다.');try{if(!lessonAudio){const url=await sceneUrl(scene);if(controller!==instance||controller.turn!==turn||run!==active||epoch!==runEpoch||disposed)return;lessonAudio=new Audio(url);lessonAudioKey=active.lesson.id+':'+scene;if(!restart&&active.restoreScene===lessonAudioKey&&active.restoreTime>0){const seconds=active.restoreTime;try{lessonAudio.currentTime=seconds;}catch{}const restoredAudio=lessonAudio;restoredAudio.onloadedmetadata=()=>{try{restoredAudio.currentTime=Math.min(seconds,Math.max(0,restoredAudio.duration-0.1));}catch{}};active.restoreTime=0;}}if(lessonAudio.ended)lessonAudio.currentTime=0;const current=lessonAudio;current.playbackRate=Number($('#speed').value);current.ontimeupdate=()=>{if(run===active&&controller.mode==='lesson'&&controller.scene===scene){const p=Number.isFinite(current.duration)?current.currentTime/current.duration:0;$('#audio-progress').style.width=`${p*100}%`;renderBoard(p);}};current.onerror=()=>{if(run!==active||controller!==instance||controller.turn!==turn)return;current.pause();active.restoreTime=current.currentTime||0;active.restoreScene=active.lesson.id+':'+scene;audioCache.delete(active.restoreScene);URL.revokeObjectURL(current.src);lessonAudio=null;lessonAudioKey='';controller.pause();controller.waiting=false;renderControls();say('음성이 중단되었어요. 설명 글을 읽거나 ‘칠판 이어하기’를 눌러 다시 들을 수 있어요.',true);};current.onended=()=>{if(run!==active||controller!==instance||!controller.ended(scene,turn))return;save();if(controller.status==='complete'){renderControls();say('설명을 모두 들었어요. 문제를 풀거나 다음 단원을 선택해 보세요.');}else{lessonAudio=null;lessonAudioKey='';void playScene();}};await current.play();if(run!==active||controller!==instance||controller.turn!==turn){current.pause();return;}setMetric('voice');active.recordedScenes ||= new Set();if(!active.recordedScenes.has(scene)){active.recordedScenes.add(scene);record('explanation',{title:active.lesson.scenes[scene].title,text:active.lesson.scenes[scene].narration});}say('설명을 듣는 중입니다. 언제든 질문하거나 멈출 수 있어요.');if(active.lesson.scenes[scene+1])void sceneUrl(scene+1).catch(()=>{});}catch(e){if(run===active&&controller===instance&&controller.turn===turn){controller.pause();renderControls();say(errorMessage(e,'음성을 재생하지 못했어요. 칠판과 설명 글은 읽을 수 있습니다. ‘칠판 이어하기’를 다시 눌러 주세요.'),true);}}}
async function continueLesson(){const active=run,runEpoch=epoch;if(!active||active.resumeRequired||active.lesson.complete||active.continueBusy)return;active.continueBusy=true;active.continueError=false;renderPreparation();try{const d=await api({action:'continue',token:active.token,...(active.quizToken?{quizToken:active.quizToken}:{})});if(run!==active||epoch!==runEpoch||disposed)return;if(!validLesson(d.lesson)||d.lesson.id!==active.lesson.id||d.lesson.scenes.length!==5||!d.lesson.complete||typeof d.token!=='string')throw Error('invalid_response');active.lesson=d.lesson;active.token=d.token;save();render();if(controller.waiting&&controller.status==='playing')void playScene();else if(active.lesson.scenes[controller.scene+1])void sceneUrl(controller.scene+1).catch(()=>{});}catch(e){if(run===active&&epoch===runEpoch){active.continueError=true;say(errorMessage(e,'이어서 들을 설명을 준비하지 못했어요. ‘준비 다시 시도’를 눌러 주세요.'),true);}}finally{if(run===active){active.continueBusy=false;renderPreparation();}}}
async function preparePractice(){const active=run,runEpoch=epoch;if(!active||active.resumeRequired||active.quiz||active.practiceBusy)return;active.practiceBusy=true;active.practiceError=false;renderPreparation();try{const d=await api({action:'practice',token:active.token,noveltyHistory:novelty()});if(run!==active||epoch!==runEpoch||disposed)return;if(!validQuiz(d.material)||typeof d.quizToken!=='string')throw Error('invalid_response');active.quiz=d.material;active.quizToken=d.quizToken;active.progress=emptyBoardProgress();saveNovelty(d.material);setMetric('questions');save();renderControls();}catch(e){if(run===active&&epoch===runEpoch){active.practiceError=true;say(errorMessage(e,'10문제를 준비하지 못했어요. 설명은 계속 들을 수 있습니다. ‘준비 다시 시도’를 눌러 주세요.'),true);}}finally{if(run===active){active.practiceBusy=false;renderPreparation();}}}
async function newLesson(event){event?.preventDefault();if(!member||starting||!boardCourse||requestedWorksheet)return;const topic=currentTopic();if(topic?.id==='worksheet')return;cleanup();if(records)void records.end().catch(()=>{});const runEpoch=epoch;starting=true;run=null;controller=new ScienceController();history=[];lastAnswer='';$('#question').value='';$('#feedback').textContent='';$('#audio-progress').style.width='0%';clearSaved();render();say('첫 설명을 만들고 확인하고 있어요. 준비되는 대로 칠판을 보여드립니다.');const startedAt=Date.now();try{const d=await api({action:'start',courseId,topicId:topic.id});if(epoch!==runEpoch||disposed)return;if(!validLesson(d.lesson)||typeof d.token!=='string')throw Error('invalid_response');run={lesson:d.lesson,token:d.token,quiz:null,quizToken:null,startedAt,timings:{},continueBusy:false,practiceBusy:false,continueError:false,practiceError:false};setMetric('board');save();render();ensureRecords();void continueLesson();void preparePractice();void playScene();}catch(e){if(epoch===runEpoch)say(errorMessage(e,'첫 설명을 준비하지 못했어요. ‘새 설명 만들고 시작’을 다시 눌러 주세요.'),true);}finally{if(epoch===runEpoch){starting=false;renderControls();}}}
async function speakAnswer(text,turn){const active=run,instance=controller,runEpoch=epoch;try{const blob=await api({action:'speech',token:active.token,scene:Math.min(controller.scene,active.lesson.scenes.length-1),kind:'answer',text},{binary:true,timeout:120000});if(run!==active||controller!==instance||controller.turn!==turn||epoch!==runEpoch||disposed)return;const url=URL.createObjectURL(blob),current=new Audio(url);answerAudio=current;current.playbackRate=Number($('#speed').value);current.onended=()=>{URL.revokeObjectURL(url);if(run===active&&controller===instance&&controller.replied(turn)){renderControls();say('답변을 들었어요. ‘칠판 이어하기’를 누르면 설명으로 돌아갑니다.');}};current.onerror=()=>{URL.revokeObjectURL(url);if(controller===instance&&controller.replied(turn)){renderControls();say('답변 글은 준비됐지만 음성을 재생하지 못했어요. ‘답변 다시 듣기’를 눌러 주세요.',true);}};await current.play();if(run!==active||controller!==instance||controller.turn!==turn)current.pause();}catch(e){if(run===active&&controller===instance&&controller.turn===turn){controller.replied(turn);renderControls();say(errorMessage(e,'답변 글은 준비됐지만 음성을 재생하지 못했어요. ‘답변 다시 듣기’를 눌러 주세요.'),true);}}}
async function ask(event){event?.preventDefault();const text=$('#question').value.trim();if(!text||!run||!member||run.resumeRequired||run.handoffBusy)return;stopRecording();stopVoice();cancelQuestion();const active=run,instance=controller,turn=controller.ask(),runEpoch=epoch;questionAbort=new AbortController();renderControls();say('Mei 선생님이 질문을 살펴보고 있어요.');try{const d=await api({action:'ask',token:active.token,scene:Math.min(controller.scene,active.lesson.scenes.length-1),text,history:history.slice(-8),...(active.quizToken?{quizToken:active.quizToken}:{}),...(controller.mode==='practice'?{questionIndex:controller.practice.index,quizToken:active.quizToken,...(Number.isInteger(controller.practice.selected)?{choiceIndex:controller.practice.selected}:{}),revealed:controller.practice.revealed}:{})},{signal:questionAbort.signal});if(run!==active||controller!==instance||epoch!==runEpoch||!controller.reply(turn))return;history=[...history,{role:'user',content:text},{role:'assistant',content:d.answer}].slice(-8);lastAnswer=d.answer;$('#question').value='';record('dialogue',{question:text,answer:d.answer});save();renderConversation();renderControls();say('답변입니다. 답변 후 원할 때 칠판 설명을 이어가세요.');void speakAnswer(d.answer,turn);}catch(e){if(run===active&&controller===instance&&controller.turn===turn){controller.pause();renderControls();say(errorMessage(e,'답변을 가져오지 못했어요. 질문은 남겨 두었습니다. 다시 보내 주세요.'),true);}}}
function practicePayload(){const q=controller.question();return{questionIndex:controller.practice.index,prompt:q.prompt,choices:q.choices,answerIndex:q.answerIndex,explanation:q.explanation,hints:q.hints};}
function renderPractice(){const p=controller.practice,q=controller.question(),done=p.solved||p.revealed;$('#practice-heading').textContent=`문제 ${p.index+1} / ${p.count}`;$('#practice-prompt').textContent=q.prompt;$('#choices').replaceChildren();q.choices.forEach((choice,i)=>{const b=document.createElement('button'),n=document.createElement('span'),v=document.createElement('span');b.type='button';n.textContent=String(i+1);v.textContent=choice;b.append(n,v);b.disabled=done||!!run?.resumeRequired||!!run?.handoffBusy;b.setAttribute('aria-pressed',p.selected===i?'true':'false');if(done&&i===q.answerIndex)b.className='correct-choice';else if(p.selected===i&&i!==q.answerIndex)b.className='wrong-choice';b.onclick=()=>grade(i);$('#choices').append(b);});$('#show-solution').hidden=done;$('#next').hidden=!done||p.index+1>=p.count;$('#practice-done').hidden=!done||p.index+1<p.count;if(done){$('#feedback').textContent=(p.solved?'정답이에요.':'풀이를 확인해 보세요.')+`\n정답: ${q.answerIndex+1}번 · ${q.choices[q.answerIndex]}\n${q.explanation}`;}else if(p.attempts){$('#feedback').textContent=`다시 생각해 보세요. (${p.attempts}/3회)\n${q.hints[Math.min(p.attempts-1,q.hints.length-1)]||'칠판 설명에서 핵심 관계를 다시 확인해 보세요.'}`;}else $('#feedback').textContent='답을 선택해 주세요. 최대 3번 도전할 수 있어요.';if(done&&p.index+1>=p.count)$('#practice-summary').textContent=`${p.count}문제를 마쳤어요. 직접 맞힌 문제 ${p.correct}개 · 풀이를 확인한 문제 ${p.count-p.correct}개`;}
function startPractice(count){if(!run?.quiz||run.resumeRequired||run.handoffBusy)return;pause();stopRecording();const resuming=controller.practice?.count===count&&controller.questions.length===10;if(resuming)controller.mode='practice';else controller.practiceStart(run.quiz.questions,count,controller.progress||run.progress||emptyBoardProgress(),count===10?(run.cursor||0):0);render();if(!resuming)record('question',practicePayload());save();say(resuming?'풀던 문제를 불러왔어요. 답을 고르거나 칠판 설명을 다시 들을 수 있어요.':'답을 골라 보세요. 질문하거나 칠판 설명으로 돌아갈 수도 있어요.');}
function practiceCompleted(){const p=controller.practice;if((p.solved||p.revealed)&&p.index+1>=p.count){record('completed',{correct:p.correct,total:p.count});say('문제 풀이를 마쳤어요. 다음 단원을 선택하거나 교실로 돌아갈 수 있어요.');}}
function grade(index){if(run?.resumeRequired||run?.handoffBusy)return;stopVoice();cancelQuestion();controller.pause();const result=controller.grade(index);if(result.ignored||result.invalid)return;record('attempt',{...practicePayload(),selectedIndex:index,correct:result.correct,attempts:result.attempts});save();renderPractice();renderControls();practiceCompleted();}
async function microphone(){if(recorder?.state==='recording'){stopRecording(false);return;}if(!run||run.resumeRequired||run.handoffBusy)return;pause();if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){say('이 브라우저에서는 마이크를 사용할 수 없어요. 질문을 글로 입력해 주세요.',true);return;}const recEpoch=++recordEpoch,active=run;try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});if(recEpoch!==recordEpoch||run!==active||disposed){stream.getTracks().forEach(t=>t.stop());return;}recordStream=stream;const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));const device=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorder=device;const chunks=[];device.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};device.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());if(recEpoch!==recordEpoch||run!==active||disposed)return;$('#mic').setAttribute('aria-pressed','false');$('#mic').textContent='마이크로 질문';const blob=new Blob(chunks,{type:device.mimeType||mime||'audio/webm'});if(!blob.size||blob.size>1200000){say('녹음이 너무 길거나 비어 있어요. 짧게 다시 말해 주세요.',true);return;}say('말씀하신 질문을 글로 옮기고 있어요.');$('#mic').disabled=true;try{const audio=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});const d=await api({action:'transcribe',token:active.token,scene:Math.min(controller.scene,active.lesson.scenes.length-1),audio,mime:blob.type});if(recEpoch!==recordEpoch||run!==active||disposed)return;$('#question').value=d.text;$('#question').focus();say('인식된 질문을 확인하고 ‘질문 보내기’를 눌러 주세요.');}catch(e){if(recEpoch===recordEpoch&&run===active)say(errorMessage(e,'음성을 글로 옮기지 못했어요. 다시 녹음하거나 글로 입력해 주세요.'),true);}finally{if(run===active)renderControls();}};device.start();$('#mic').setAttribute('aria-pressed','true');$('#mic').textContent='녹음 끝내기';say('질문을 말해 주세요. 다시 누르면 녹음이 끝납니다.');recordTimer=setTimeout(()=>stopRecording(false),20000);}catch{if(recEpoch===recordEpoch)say('마이크 권한을 확인하거나 질문을 글로 입력해 주세요.',true);}}
function clearRunForTopic(){if(requestedWorksheet){save();location.href='/science-board.html?course='+encodeURIComponent(courseId)+'&topic='+encodeURIComponent($('#topic').value);return;}save();cleanup();if(records)void records.end().catch(()=>{});run=null;controller=new ScienceController();history=[];lastAnswer='';$('#question').value='';$('#lesson-title').textContent=currentTopic()?.title||'과목을 확인해 주세요';$('#scene-label').textContent='새 단원';$('#scene-count').textContent='0 / 5';$('#board-lines').replaceChildren();const line=document.createElement('li');line.textContent='‘새 설명 만들고 시작’을 눌러 주세요.';$('#board-lines').append(line);$('#narration-text').textContent='첫 설명부터 준비하고, 이어서 설명과 문제를 만듭니다.';$('#audio-progress').style.width='0%';render();if(!requestedWorksheet&&restore(baseStorageKey()+':topic:'+currentTopic().id)){render();void resumeSavedLesson();}else say('새 단원을 선택했어요. 시작 버튼을 누르면 설명을 만듭니다.');}
for(const t of SCIENCE_TOPICS){const o=document.createElement('option');o.value=t.id;o.textContent=t.title;$('#topic').append(o);}$('#topic').value=SCIENCE_TOPICS.some(t=>t.id===entry.searchParams.get('topic'))?entry.searchParams.get('topic'):SCIENCE_TOPICS[0]?.id||'';
$('#resume-retry').onclick=resumeSavedLesson;
$('#handoff').onclick=handoffToTeacher;$('#handoff-complete').onclick=handoffToTeacher;
$('#lesson-form').onsubmit=newLesson;$('#topic').onchange=clearRunForTopic;$('#play').onclick=()=>void playScene();$('#pause').onclick=()=>{stopRecording();pause();};$('#replay').onclick=()=>void playScene(true);$('#question').onfocus=()=>{if(['playing','thinking','answering'].includes(controller.status))pause();};$('#question-form').onsubmit=ask;$('#mic').onclick=()=>void microphone();$('#one').onclick=()=>startPractice(1);$('#ten').onclick=()=>startPractice(10);$('#back').onclick=()=>void playScene();$('#next').onclick=()=>{pause();if(controller.next()){renderPractice();record('question',practicePayload());save();}};$('#show-solution').onclick=()=>{stopVoice();cancelQuestion();controller.pause();controller.reveal();record('revealed',practicePayload());save();renderPractice();renderControls();practiceCompleted();};$('#next-topic').onclick=()=>{const i=SCIENCE_TOPICS.findIndex(t=>t.id===run?.lesson.topicId);$('#topic').value=SCIENCE_TOPICS[(i+1)%SCIENCE_TOPICS.length].id;clearRunForTopic();$('#topic').focus();};$('#retry-preparation').onclick=()=>{void continueLesson();void preparePractice();};$('#listen-answer').onclick=()=>{if(!lastAnswer||!run||run.resumeRequired)return;pause();const turn=controller.ask();controller.reply(turn);renderControls();void speakAnswer(lastAnswer,turn);};$('#speed').onchange=()=>{if(lessonAudio)lessonAudio.playbackRate=Number($('#speed').value);if(answerAudio)answerAudio.playbackRate=Number($('#speed').value);};
window.addEventListener('pagehide',()=>{save();disposed=true;cleanup();if(records)records.exit();});window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopRecording();pause();if(records)void records.flush().catch(()=>{});}});
configureCourse();render();
if(!boardCourse||requestedWorksheet&&!uuid(requestedWorksheet))say('선택한 과목 또는 학습지 주소를 확인해 주세요. 교실에서 칠판 설명을 다시 열어 주세요.',true);
else try{
 const r=await fetch('/api/session',{cache:'no-store'}),d=await r.json();
 if(!r.ok||!d.authenticated||!d.student?.id)throw Error('unauthorized');
 member=d.student;records=createScienceRecords({studentId:member.id,courseId,notify:text=>{$('#record-status').textContent=typeof text==='string'?text:'';}});
 const restored=restore(!requestedWorksheet&&entry.searchParams.get('topic')?baseStorageKey()+':topic:'+$('#topic').value:storageKey());render();
 if(transferToken&&uuid(requestedWorksheet))void importWorksheet();
 else if(restored){say('지난 칠판 수업을 확인하고 있어요.');void resumeSavedLesson();}
 else if(requestedWorksheet){say('Mei 교실에서 이 학습지의 칠판 설명 버튼을 눌러 주세요. 같은 10문제를 가져옵니다.');$('#new-lesson').disabled=true;}
 else say('단원을 고르고 ‘새 설명 만들고 시작’을 눌러 주세요.');
}catch{say('교실 입구에서 학생 ID로 다시 입장해 주세요.',true);const a=document.createElement('a');a.href=$('#resume-login').href;a.textContent='학생 ID로 입장';$('#status').append(document.createTextNode(' '),a);}
