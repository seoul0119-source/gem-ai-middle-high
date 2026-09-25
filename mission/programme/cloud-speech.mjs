import {speechLabel} from './speech-labels.mjs';
export function installCloudSpeech(h){
 const $=id=>document.getElementById(id),L=key=>speechLabel(h.lang(),key);
 const setting=document.createElement('section');setting.id='cloud-speech-settings';
 setting.innerHTML='<label class="check"><input id="cloud-speech" type="checkbox"><span id="cloud-label"></span></label><p id="cloud-notice"></p><p id="cloud-diagnostics" role="status"></p>';
 $('audio').querySelector('h2').after(setting);
 const status=document.createElement('p');status.id='cloud-speech-status';status.setAttribute('role','status');$('answer-form').after(status);
 const player=document.createElement('audio');player.id='cloud-player';player.controls=true;player.hidden=true;player.preload='none';status.after(player);
 let enabled=false,voice=null,mic=null,sequence=0,code='',voiceCode='',micCode='',url='',lastLang=h.lang(),cache=new Map();
 const required=()=>['ne','ur','sw'].includes(h.lang());
 const active=()=>!!mic;
 function render(){
  if(lastLang!==h.lang()){lastLang=h.lang();code='';voiceCode='';micCode='';}
  document.querySelector('[data-label=voiceNote]').textContent=L('browser');$('cloud-label').textContent=L('enable');$('cloud-notice').textContent=L('notice');
  status.hidden=!required()&&!enabled&&!code;status.textContent=L(code||(enabled?'ready':'off'));
  $('cloud-diagnostics').textContent=`AI TTS: ${voiceCode||'not tested'} · AI STT: ${micCode||'not tested'}`;
  if(mic){$('mic').textContent=L(mic.phase==='recording'?'stop':mic.phase);$('mic').setAttribute('aria-pressed','true');}
 }
 function statusCode(value){code=value;render();}
 function disposePlayer(){player.onplay=null;player.onpause=null;player.onended=null;player.onerror=null;player.pause();player.removeAttribute('src');player.load();player.hidden=true;if(url)URL.revokeObjectURL(url);url='';}
 function cancelVoice(){sequence++;voice?.controller.abort();voice=null;disposePlayer();h.talk(false);}
 function cleanup(t){clearTimeout(t.timer);t.stream?.getTracks().forEach(track=>track.stop());if(t.recorder){t.recorder.onstop=null;t.recorder.ondataavailable=null;t.recorder.onerror=null;if(t.recorder.state!=='inactive')try{t.recorder.stop();}catch{}}}
 function cancelMic(){if(mic){const t=mic;mic=null;t.controller?.abort();cleanup(t);h.micState(null);h.update();}render();}
 async function request(body,controller){
  const timeout=setTimeout(()=>controller.abort(),55000);
  try{const res=await fetch('./api/mission-speech.js',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({...body,consent:true})});const data=await res.json();if(!res.ok)throw Error(data.code||'failed');return data;}finally{clearTimeout(timeout);}
 }
 async function speak(text){
  if(!enabled){if(required())statusCode('off');return false;}
  cancelVoice();const token=sequence,lang=h.lang(),key=lang+':'+text;const controller=new AbortController();voice={controller};voiceCode='requested';h.talk(true);statusCode('ready');
  try{
   let blob=cache.get(key);if(!blob){const result=await request({action:'speak',lang,text},controller);const bytes=Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0));blob=new Blob([bytes],{type:result.mime});if(blob.size>3000000)throw Error('invalid_audio');cache.set(key,blob);while(cache.size>12||[...cache.values()].reduce((n,b)=>n+b.size,0)>8000000)cache.delete(cache.keys().next().value);}
   if(sequence!==token||!enabled||h.lang()!==lang||document.hidden)return true;
   url=URL.createObjectURL(blob);player.src=url;player.volume=Number($('volume').value)/100;player.hidden=false;
   player.onplay=()=>{if(sequence===token){voiceCode='playing';h.talk(true);statusCode('ready');}};
   player.onpause=()=>{h.talk(false);};player.onended=()=>{h.talk(false);voiceCode='completed';render();};player.onerror=()=>{h.talk(false);voiceCode='playback failed';statusCode('failed');};
   try{await player.play();}catch{voiceCode='press play';statusCode('play');}
  }catch(e){if(sequence===token&&enabled){voiceCode=e.name==='AbortError'?'timeout':e.message;statusCode('failed');h.talk(false);}}
  finally{if(sequence===token)voice=null;}return true;
 }
 async function listen(){
  if(mic){if(mic.phase==='recording')mic.recorder.stop();return;}
  if(!enabled){statusCode('off');h.openSettings();return;}
  h.stopBrowserMic();h.begin();cancelVoice();
  if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){micCode='recording unavailable';statusCode('failed');return;}
  const t={lang:h.lang(),key:h.key(),base:h.hasDraft()?$('answer').value.trim():'',phase:'starting',chunks:[],controller:new AbortController()};mic=t;h.micState(t);h.update();statusCode('starting');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(mic!==t){stream.getTracks().forEach(track=>track.stop());return;}t.stream=stream;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('format unavailable');
   const recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000});t.recorder=recorder;t.phase='recording';t.size=0;
   recorder.ondataavailable=e=>{if(mic!==t)return;if(e.data.size){t.chunks.push(e.data);t.size+=e.data.size;if(t.size>2000000){micCode='too_long';cancelMic();statusCode('limit');}}};
   recorder.onerror=()=>{if(mic===t){micCode='recording failed';cancelMic();statusCode('failed');}};
   recorder.onstop=async()=>{
    if(mic!==t)return;clearTimeout(t.timer);stream.getTracks().forEach(track=>track.stop());t.phase='processing';statusCode('processing');
    try{
     const blob=new Blob(t.chunks,{type:mime});t.chunks=[];if(blob.size<100)throw Error('no_speech');
     const encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
     if(mic!==t||!enabled)return;
     const result=await request({action:'transcribe',lang:t.lang,mime,audio:encoded},t.controller);
     if(mic!==t||h.lang()!==t.lang||h.key()!==t.key||!enabled||document.hidden)return;
     const value=[t.base,result.text].filter(Boolean).join(' ');if(value.length>450)throw Error('too_long');
     micCode='text received';cancelMic();$('answer').value=value;$('answer').dispatchEvent(new Event('input',{bubbles:true}));$('answer').dataset.micState='final';h.save();statusCode('review');$('answer').focus();
    }catch(e){if(mic===t){micCode=e.message;cancelMic();statusCode(e.message==='no_speech'?'noSpeech':e.message==='too_long'?'limit':'failed');}}
   };
   recorder.start(500);t.timer=setTimeout(()=>{if(mic===t&&recorder.state==='recording')recorder.stop();},30000);micCode='recording';statusCode('recording');
  }catch(e){if(mic===t){micCode=e.name||'failed';cancelMic();statusCode('failed');}}
 }
 $('cloud-speech').onchange=()=>{enabled=$('cloud-speech').checked;cancelVoice();cancelMic();h.stopBrowserMic();statusCode(enabled?'ready':'off');};
 $('volume').addEventListener('input',()=>{player.volume=Number($('volume').value)/100;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelVoice();cancelMic();}});
 addEventListener('pagehide',()=>{cancelVoice();cancelMic();cache.clear();});
 render();return {speak,listen,cancelVoice,cancelMic,render,active,enabled:()=>enabled,useMic:()=>required()||enabled&&!(globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition)};
}
