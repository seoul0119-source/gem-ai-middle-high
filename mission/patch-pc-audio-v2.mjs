import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
export function patchPCAudio(app) {
 function once(from,to){assert.equal(app.split(from).length,2,'Audio patch anchor: '+from.slice(0,100));app=app.replace(from,to);}
 function section(begin,end,replacement){const a=app.indexOf(begin),b=app.indexOf(end,a+begin.length);assert.ok(a>=0&&b>a,begin);app=app.slice(0,a)+replacement+'\n'+app.slice(b);}
 app="import {installAudioTools} from './audio-tools.mjs';\n"+app;
 once("let modelReady=false,","let voiceTimer=0;\nlet modelReady=false,");
 once("'stepElapsed','completed','draft']","'stepElapsed','completed','draft','audioInput']");
 once("function stopSpeech(){speechEpoch++;","function stopSpeech(){clearTimeout(voiceTimer);audioIO.cancelVoiceWait();speechEpoch++;");
 section('function stopMic(){','function cancelRequest()','function stopMic(){audioIO.stopMic();}');
 section('function voiceList(){','function say(message)','function voiceList(){return audioIO.voices();}\nfunction updateVoices(){audioIO.refresh();}');
 once("stopSpeech();$('caption').textContent=message;","stopSpeech();if(recognition)stopMic();$('caption').textContent=message;");
 once("if(!voice||!globalThis.SpeechSynthesisUtterance){voiceProblem=true;$('voice-status').textContent=T('missingVoice');status('missingVoice');return;}","if(!voice||!globalThis.SpeechSynthesisUtterance){voiceProblem=true;audioIO.noteTTS(audioIO.missingVoiceCode());status('missingVoice');audioIO.waitForVoice(()=>say(message));return;}");
 once("if(Number($('volume').value)===0){voiceProblem=true;return;}voiceProblem=false;","if(Number($('volume').value)===0){voiceProblem=true;audioIO.noteTTS('muted');return;}voiceProblem=false;audioIO.noteTTS('requested');");
 once("speechPending=false;talk(false);$('next').disabled","speechPending=false;talk(false);audioIO.noteTTS('completed');$('next').disabled");
 once("const timer=setTimeout(()=>{if(epoch===speechEpoch){voiceProblem=true;stopSpeech();status('missingVoice');}},30000);","const timer=voiceTimer=setTimeout(()=>{if(epoch===speechEpoch){voiceProblem=true;stopSpeech();audioIO.noteTTS('timeout');status('missingVoice');}},30000);");
 once("speechPending=false;talk(true);}};u.onend","speechPending=false;talk(true);audioIO.noteTTS('speaking');}};u.onend");
 once("u.onerror=()=>{clearTimeout(timer);if(epoch===speechEpoch){voiceProblem=true;stopSpeech();status('missingVoice');}};","u.onerror=event=>{clearTimeout(timer);if(epoch===speechEpoch){voiceProblem=true;stopSpeech();audioIO.noteTTS(event.error||'synthesis-failed');status('missingVoice');}};");
 once("try{speechSynthesis.speak(u);}catch{clearTimeout(timer);voiceProblem=true;stopSpeech();status('missingVoice');}","try{speechSynthesis.speak(u);}catch{clearTimeout(timer);voiceProblem=true;stopSpeech();audioIO.noteTTS('synthesis-failed');status('missingVoice');}");
 once("$('status').textContent=T(statusKey);updateVoices();save();","$('status').textContent=T(statusKey);updateVoices();audioIO.render();save();");
 once('async function submit(e){',"async function submit(e,source='text'){");
 once("const question=$('answer').value.trim();if(!question)return;beginDialogue();","const question=$('answer').value.trim();if(!question)return;audioIO.prepareSubmission(question,source);beginDialogue();");
 once("$('answer').value='';render();say(reply);return;","audioIO.finishSubmission(question,lang,source);render();say(reply);return;");
 once("if($('answer').value.trim()===question)$('answer').value='';status('followup');","audioIO.finishSubmission(question,lang,source);status('followup');");
 once("catch{if(token===requestEpoch){status('failed');","catch{if(token===requestEpoch){audioIO.failedSubmission(question);status('failed');");
 once('for(const l of LANGUAGES){',`const audioIO=installAudioTools({
 languages:LANGUAGES,lang:()=>state.lang,locale:()=>language(state.lang).locale,
 key:()=>String(state.session?.id||'none')+':'+state.index,T,
 canListen:()=>!!current(),begin:beginDialogue,send:()=>submit(null,'voice'),stopSpeech,save,
 micState:r=>{recognition=r;},pauseAfterFailure:()=>{state.paused=true;followup=Infinity;},
 edited:()=>{if(busy)cancelRequest();},inputMeta:()=>state.audioInput,setInputMeta:value=>{state.audioInput=value;}
 });
for(const l of LANGUAGES){`);
 section("$('mic').onclick=()=>{","$('audio-open').onclick","$('mic').onclick=()=>audioIO.listen();");
 assert.equal(app.split("!$('answer').value.trim()").length,3);app=app.replaceAll("!$('answer').value.trim()","!audioIO.hasDraft()");return app;
}
export async function applyAudioPatch(out='mission-dist'){
 await fs.copyFile('mission/pc/audio-tools.mjs',out+'/pc/audio-tools.mjs');
 const original=await fs.readFile(out+'/pc/app.mjs','utf8');await fs.writeFile(out+'/pc/app.mjs',patchPCAudio(original));
 let html=await fs.readFile(out+'/pc.html','utf8');const old='GEM PC 공통 과정 · 5개 언어 1차 시험 · 초2 덧셈 연결 · 신규 번역/기기 음성 검토 필요';
 assert.ok(html.includes(old));html=html.replace(old,'GEM PC 음성 입력 수정 v2 · 인식 문자 표시/유지 · 읽기/마이크 별도 진단');await fs.writeFile(out+'/pc.html',html);
}
