// Small, fail-closed source transformation for the isolated operator preview.
// The production branch is not modified. Generated app source is included in the preview.
import fs from 'node:fs/promises';
function replaceOnce(s,from,to){if(!s.includes(from))throw Error('Audio patch anchor missing: '+from.slice(0,90));return s.replace(from,to);}
let app=await fs.readFile('mission/app.mjs','utf8');
if(!app.includes('// GEM_MEDIA_FIX_V2')){
 const speech=await fs.readFile('mission/speech-controls.inc.js','utf8'),mic=await fs.readFile('mission/mic-controls.inc.js','utf8');
 const start=app.indexOf('function stopSpeech(){'),end=app.indexOf('function drawCounters(){');if(start<0||end<=start)throw Error('Missing speech block');app=app.slice(0,start)+speech+'\n'+app.slice(end);
 const mstart=app.indexOf('function startMic(){'),mend=app.indexOf("$('mic').onclick",mstart);if(mstart<0||mend<=mstart)throw Error('Missing microphone block');app=app.slice(0,mstart)+mic+'\n'+app.slice(mend);
 app=replaceOnce(app,"if(state.paused){notice(text('paused')+' · '+text('resume'));return;}speak(current().speech[state.lang]+' '+current().prompt[state.lang]);","speak(current().speech[state.lang]+' '+current().prompt[state.lang],true);");
 app=replaceOnce(app,'speak(response(result,current(),state.lang));', 'speak(response(result,current(),state.lang),true);');
 app=replaceOnce(app,"if(due&&!speaking&&!rec&&$('auto').checked)","if(due&&!speaking&&!speechPending&&!rec&&!micChecking&&$('auto').checked)");
 app=replaceOnce(app,"$('remote').onchange=()=>{stopSpeech();updateVoices();};$('voice').onchange=()=>stopSpeech();","$('remote').onchange=()=>{stopSpeech();voiceDiagnostic='';saveAudioPreferences();updateVoices();};$('voice').onchange=()=>{stopSpeech();voiceDiagnostic='';selectedVoices[state.lang]=$('voice').value;saveAudioPreferences();updateVoices();};");
 app=replaceOnce(app,"if(Number($('volume').value)===0)stopSpeech();};$('rate').onchange=()=>stopSpeech();","if(Number($('volume').value)===0)stopSpeech();saveAudioPreferences();};$('rate').onchange=()=>{stopSpeech();saveAudioPreferences();};");
 app=replaceOnce(app,"$('voice-test').onclick=()=>speak(state.lang==='fr'?'Bonjour. Un, deux, trois. Nous allons apprendre ensemble.':'Hello. One, two, three. We will learn together.',true);","$('voice-test').onclick=soundTest;");
 app=replaceOnce(app,"$('mic').onclick=()=>{if(!state.started||state.ended)return;","$('mic').onclick=()=>{if(!state.started||state.ended){micStatus(state.lang==='fr'?'Commencez la séance avant de parler.':'Start the lesson before speaking.');return;}");
 app=replaceOnce(app,"if(document.hidden&&state.started&&!state.paused)pause();","if(document.hidden){stopSpeech();stopMic();stopMicCheck();if(state.started&&!state.paused)pause();}");
 app=replaceOnce(app,"stopSpeech();stopMic();save();","stopSpeech();stopMic();stopMicCheck();save();");
 app=replaceOnce(app,"globalThis.speechSynthesis?.addEventListener('voiceschanged',updateVoices)","globalThis.speechSynthesis?.addEventListener?.('voiceschanged',updateVoices)");
 app=replaceOnce(app,"paidRequests:0,scope:","paidRequests:0,mediaVersion:'audio-v2',voiceCounts:{local:allVoices().filter(v=>v.localService===true).length,online:allVoices().filter(v=>v.localService!==true).length},recognitionAvailable:Boolean(globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition),speechPending,speaking,scope:");
 const setup=`
$('sound-test').onclick=soundTest;$('enable-voice').onclick=()=>$('voice-consent').showModal();
$('voice-cancel').onclick=()=>$('voice-consent').close();$('voice-allow').onclick=()=>{$('remote').checked=true;voiceDiagnostic='';saveAudioPreferences();$('voice-consent').close();updateVoices();soundTest();};
$('mic-check').onclick=checkMicrophone;
try{const p=JSON.parse(localStorage.getItem('gem-g2-audio-v2'));if(p){$('remote').checked=p.remote===true;selectedVoices=p.voices&&typeof p.voices==='object'?p.voices:{};if(Number.isFinite(p.volume))$('volume').value=String(Math.max(0,Math.min(100,p.volume)));if(['0.8','0.9','1'].includes(p.rate))$('rate').value=p.rate;$('volume-out').textContent=$('volume').value+'%';}}catch{}
for(const delay of [150,700,1700])setTimeout(updateVoices,delay);
`;
 app=replaceOnce(app,"render();if(restored)notice(text('saved'));",setup+"render();if(restored)notice(text('saved'));");
 await fs.writeFile('mission/app.mjs',app);
 let html=await fs.readFile('mission/index.html','utf8');
 html=replaceOnce(html,'<small id="voice-status" role="status"></small>',`<div class="media-actions"><button id="sound-test" type="button">🔊 Test voice</button><button id="enable-voice" type="button" hidden>Enable browser voice</button><button id="mic-check" type="button">🎤 Check microphone</button><small class="media-guide" lang="ko">음성이 없으면 ‘음성 허용’ · PC 마이크는 ‘Check microphone’으로 신호 검사</small></div><small id="voice-status" role="status"></small><small id="mic-status" role="status"></small><meter id="mic-level" min="0" max="1" value="0" aria-label="Local microphone input level" hidden></meter><details class="media-details"><summary>음성 진단 · Audio diagnostics</summary><small id="audio-diagnostic"></small><p lang="ko">목소리가 없으면 Settings에서 온라인 음성을 허용하거나 기기에 영어·프랑스어 음성을 설치해야 합니다. 마이크 신호 검사는 5초 동안 이 기기에서만 처리하며 녹음·전송하지 않습니다. 말하기의 문자 변환은 별도 브라우저 음성인식 서비스입니다.</p></details>`);
 html=replaceOnce(html,'<div id="notice"',`<dialog id="voice-consent"><h2>🔊 음성 사용 · Browser voice</h2><p id="voice-consent-text"></p><p lang="ko">브라우저 온라인 음성을 허용하면 수업 문장이 음성 제공업체로 전달될 수 있고 인터넷 데이터가 사용됩니다. 유료 GEM·Anam API는 추가하지 않습니다. 이 기기에 허용 여부를 저장하며 설정에서 취소할 수 있습니다.</p><button id="voice-allow" class="primary">Allow and test</button><button id="voice-cancel">Keep local voices</button></dialog><div id="notice"`);
 html=replaceOnce(html,'운영자 1차 시험 ·','운영자 음성 수정 2차 ·');
 await fs.writeFile('mission/index.html',html);
 await fs.appendFile('mission/style.css',`\n/* Audio v2: visible actions, persistent errors, no hidden permission requirements. */\n.media-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px}.media-actions button{font-size:12px;min-height:44px;padding:8px 12px}.media-actions .media-guide{margin:0;flex:1;min-width:180px}.media-details{font-size:11px;color:#51675d;line-height:1.5;margin-top:4px}.media-details summary{cursor:pointer;min-height:26px;display:flex;align-items:center}.media-details p{max-width:720px}.interaction #mic-status:not(:empty){padding:7px 10px;background:#fff2d4;color:#4f3c15;border-radius:8px;font-size:12px}#mic-level{width:min(360px,90%);height:19px;margin:5px 0}.interaction #voice-status{font-size:12px}.media-actions .media-guide{font-size:11px}@media(max-width:650px){.media-actions{gap:5px}.media-actions button{font-size:11px;padding:8px 9px}.media-guide{width:100%}}\n`);
 let avatar=await fs.readFile('mission/avatar.mjs','utf8');
 avatar=replaceOnce(avatar,"if(head)head.rotation.y=Math.sin(elapsed*.55)*.025;","if(head){head.rotation.y=Math.sin(elapsed*.55)*.045;head.rotation.x=(speaking?Math.sin(elapsed*1.5)*.045:Math.sin(elapsed*.8)*.009);}const chest=bone('chest');if(chest){chest.rotation.x=Math.sin(elapsed*1.7)*.012;chest.rotation.y=speaking?Math.sin(elapsed*1.1)*.027:0;}");
 avatar=replaceOnce(avatar,"right.rotation.z=1.18-(speaking?(Math.sin(elapsed*2.2)+1)*.07:0);","right.rotation.z=1.18-(speaking?(Math.sin(elapsed*1.9)+1)*.13:0);right.rotation.x=speaking?Math.sin(elapsed*1.2)*.08:0;const forearm=bone('rightLowerArm');if(forearm)forearm.rotation.y=speaking?.3:.12;");
 await fs.writeFile('mission/avatar.mjs',avatar);
 let lesson=await fs.readFile('mission/lesson.mjs','utf8');
 const ti=lesson.indexOf("case 'ten':"),te=lesson.indexOf("case 'example':",ti);if(ti<0||te<0)throw Error('Missing ten response');lesson=lesson.slice(0,ti)+lesson.slice(ti,te).replaceAll('explain(8,7,lang)','detail')+lesson.slice(te);await fs.writeFile('mission/lesson.mjs',lesson);
 const sw=await fs.readFile('mission/sw.js','utf8');await fs.writeFile('mission/sw.js',sw.replace('gem-g2-shell-v2','gem-g2-shell-audio-v2'));
}
await import('./build.mjs');
await import('./audio-browser-tests.mjs');
