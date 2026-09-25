// PC speech-input visibility and per-language voice diagnostics. No added provider/API.
export function readRecognition(results) {
 const final=[],interim=[];
 for(let i=0;i<(results?.length||0);i++){const r=results[i],text=String(r?.[0]?.transcript||'').trim();if(text)(r.isFinal===true?final:interim).push(text);}
 return {final:final.join(' '),interim:interim.join(' '),text:[...final,...interim].join(' ')};
}
export function voiceInventory(list,lang,allow=false) {
 const match=list.filter(v=>String(v.lang||'').replaceAll('_','-').toLowerCase().split('-')[0]===lang);
 return {local:match.filter(v=>v.localService===true),online:match.filter(v=>v.localService!==true),usable:match.filter(v=>v.localService===true||allow).sort((a,b)=>Number(b.localService===true)-Number(a.localService===true))};
}
const WORDS={
 en:{listening:'Listening…',stop:'Stop recording',recognized:'Recognized',sent:'Sent',draft:'Check the text, then Send.',none:'No final transcript received. Please try again or type.',error:'Microphone'},
 fr:{listening:'Écoute…',stop:'Arrêter le micro',recognized:'Reconnu',sent:'Envoyé',draft:'Vérifiez le texte, puis Envoyer.',none:'Aucun texte final reçu. Réessayez ou écrivez.',error:'Microphone'},
 ne:{listening:'सुन्दै छ…',stop:'रेकर्ड रोक्नुहोस्',recognized:'पहिचान भएको',sent:'पठाइयो',draft:'पाठ जाँचेर पठाउनुहोस्।',none:'अन्तिम पाठ प्राप्त भएन। फेरि प्रयास गर्नुहोस् वा लेख्नुहोस्।',error:'माइक्रोफोन'},
 ur:{listening:'سن رہا ہے…',stop:'ریکارڈنگ روکیں',recognized:'پہچانا گیا',sent:'بھیج دیا گیا',draft:'متن دیکھیں، پھر بھیجیں۔',none:'حتمی متن موصول نہیں ہوا۔ دوبارہ کوشش کریں یا لکھیں۔',error:'مائیکروفون'},
 sw:{listening:'Inasikiliza…',stop:'Acha kurekodi',recognized:'Imetambuliwa',sent:'Imetumwa',draft:'Kagua maandishi, kisha Tuma.',none:'Maandishi ya mwisho hayakupatikana. Jaribu tena au andika.',error:'Maikrofoni'}
};
const ERRORS={
 'not-allowed':'마이크 권한 차단 · microphone permission denied',
 'service-not-allowed':'음성인식 서비스 차단 · recognition service blocked',
 'language-not-supported':'선택 언어 인식 미지원 · selected recognition language unsupported',
 'audio-capture':'마이크 입력 장치 오류 · microphone capture failed',
 network:'음성 서비스 연결 실패 · speech service network failure',
 'no-speech':'말소리 감지 안 됨 · no speech detected',
 'no-result':'인식 문장 없음 · no transcript returned',
 'unsupported-api':'브라우저 음성인식 기능 없음 · recognition API unavailable',
 timeout:'음성 서비스 응답 시간 초과 · speech service timeout',
 aborted:'음성인식 취소 · recognition cancelled',
 'no-voice':'선택 언어 목소리 미제공 · no matching voice exposed by this browser',
 'online-disabled':'온라인 목소리만 있음, 허용 필요 · matching online voice needs consent',
 'voice-unavailable':'선택한 목소리 사용 불가 · selected voice unavailable',
 'language-unavailable':'선택 언어 읽기 미지원 · selected reading language unavailable',
 'synthesis-unavailable':'읽기 서비스 사용 불가 · speech synthesis unavailable',
 'audio-busy':'오디오 사용 중 · audio device busy',
 'audio-hardware':'오디오 장치 오류 · audio hardware error',
 'synthesis-failed':'읽기 서비스 오류 · speech synthesis failed',
 interrupted:'음성 재생 중단 · playback interrupted',canceled:'음성 재생 취소 · playback cancelled',
 muted:'음량 0 · muted',requested:'읽기 요청 · playback requested',speaking:'읽는 중 · speaking',
 completed:'재생 완료 이벤트 확인 · playback completed event',listening:'인식 대기 · listening',
 recognized:'최종 문자 수신 · final text received',interim:'임시 문자만 수신 · interim text only',sent:'문자 전달 · text sent','not-tested':'미검사 · not tested'
};
export function installAudioTools(h) {
 const $=id=>document.getElementById(id),field=$('answer'),mic=$('mic'),panel=$('audio');
 const settingsKey='gem-pc-audio-settings-v2';let preferences={};
 try{const p=JSON.parse(localStorage.getItem(settingsKey));if(p&&typeof p==='object')preferences=p;}catch{}
 let langShown='',lastKey=h.key(),consumed=null,receiptState=null,initialized=false;
 let turn=null,sequence=0,queue=0,waitVoice=null,voiceWaitTimer=0,consented=false,submissionCount=0;
 const lastTTS={},lastSTT={};
 const receipt=document.createElement('p');receipt.id='pc-transcript-receipt';receipt.dir='auto';receipt.setAttribute('role','status');receipt.hidden=true;$('answer-form').after(receipt);
 const diag=document.createElement('section');diag.id='pc-audio-diagnostics';
 diag.innerHTML='<h3>음성 진단 · Audio diagnostics</h3><p>목소리 목록과 마이크 인식은 별개입니다. 숫자 0은 이 브라우저가 제공하는 목소리가 없다는 뜻입니다. 마이크는 실제 인식 결과로 확인합니다.</p><div style="overflow:auto"><table><thead><tr><th>Language</th><th>기기 / Local</th><th>온라인 / Online</th><th>허용 / Allowed</th><th>읽기 / TTS</th><th>인식 / STT</th></tr></thead><tbody></tbody></table></div><p>온라인 허용은 목록에 있는 목소리만 사용하게 합니다. 없는 목소리를 설치하거나 새 유료 서비스를 연결하지 않습니다.</p><button id="pc-refresh-voices" type="button">새로 확인 · Refresh</button>';
 panel.append(diag);const style=document.createElement('style');style.textContent='#pc-transcript-receipt{padding:9px 12px;background:#e5f2ec;border-inline-start:4px solid #146b58;border-radius:6px;font-size:15px;line-height:1.6;overflow-wrap:anywhere}#pc-audio-diagnostics{margin-top:16px}#pc-audio-diagnostics table{border-collapse:collapse;width:100%;font-size:12px}#pc-audio-diagnostics th,#pc-audio-diagnostics td{padding:8px;border-bottom:1px solid #cadad0;text-align:start;vertical-align:top}#audio{max-width:min(920px,94vw)}#voice-status{white-space:pre-wrap}#answer[data-mic-state="interim"]{border-color:#ab7625}#answer[data-mic-state="sent"]{border-color:#146b58}';document.head.append(style);
 function W(){return WORDS[h.lang()]||WORDS.en;}
 function detail(code){return ERRORS[code]||String(code).slice(0,60);}
 function allVoices(){try{return Array.from(globalThis.speechSynthesis?.getVoices()||[]);}catch{return [];}}
 function pref(lang=h.lang()){return preferences[lang]&&typeof preferences[lang]==='object'?preferences[lang]:{};}
 function remember(){preferences[h.lang()]={online:$('remote').checked,voice:$('voices').value,volume:Number($('volume').value)};try{localStorage.setItem(settingsKey,JSON.stringify(preferences));}catch{}}
 function voices(){return voiceInventory(allVoices(),h.lang(),$('remote').checked).usable;}
 function drawDiagnostics(){
  const rows=diag.querySelector('tbody');rows.replaceChildren();const list=allVoices();
  for(const l of h.languages){const v=voiceInventory(list,l.code),tr=document.createElement('tr');tr.dataset.lang=l.code;
   const items=[l.name,v.local.length,v.online.length,l.code===h.lang()?$('remote').checked:pref(l.code).online===true,detail(lastTTS[l.code]||'not-tested'),detail(lastSTT[l.code]||'not-tested')];
   for(const x of items){const td=document.createElement('td');td.textContent=typeof x==='boolean'?(x?'Yes':'No'):String(x);tr.append(td);}rows.append(tr);
  }
 }
 function refresh(){
  const lang=h.lang();if(langShown!==lang){langShown=lang;const p=pref();$('remote').checked=p.online===true;if(Number.isFinite(p.volume))$('volume').value=String(Math.max(0,Math.min(100,p.volume)));}
  const inventory=voiceInventory(allVoices(),lang,$('remote').checked),old=$('voices').value||pref().voice;
  $('voices').replaceChildren();for(const v of inventory.usable){const o=document.createElement('option');o.value=v.voiceURI;o.textContent=`${v.name} (${v.lang})`;$('voices').append(o);}
  if(inventory.usable.some(v=>v.voiceURI===old))$('voices').value=old;
  const code=!inventory.usable.length?(inventory.online.length?'online-disabled':'no-voice'):null;
  if(code){const o=document.createElement('option');o.value='';o.textContent=h.T('missingVoice');$('voices').append(o);}
  $('voice-status').textContent=`${h.locale()} · Local ${inventory.local.length} / Online ${inventory.online.length}\n${code?detail(code):detail(lastTTS[lang]||'not-tested')}`;
  drawDiagnostics();
  if(waitVoice&&inventory.usable.length&&waitVoice.key===`${h.key()}:${lang}`&&!turn&&!document.hidden){const pending=waitVoice;waitVoice=null;clearTimeout(voiceWaitTimer);queueMicrotask(()=>{if(pending.key===`${h.key()}:${h.lang()}`&&!turn&&!document.hidden)pending.retry();});}
 }
 function cancelVoiceWait(){waitVoice=null;clearTimeout(voiceWaitTimer);}
 function waitForVoice(retry){cancelVoiceWait();waitVoice={key:`${h.key()}:${h.lang()}`,retry};voiceWaitTimer=setTimeout(()=>{waitVoice=null;},4000);}
 function noteTTS(code){lastTTS[h.lang()]=code;refresh();}
 function missingVoiceCode(){const v=voiceInventory(allVoices(),h.lang(),$('remote').checked);return !v.usable.length&&v.online.length?'online-disabled':'no-voice';}
 function paintReceipt(){receipt.hidden=!receiptState;if(receiptState){receipt.lang=receiptState.lang;receipt.textContent=receiptState.message;}}
 function showReceipt(message,lang=h.lang()){receiptState={message,lang};paintReceipt();}
 function hasDraft(){const value=field.value.trim();return !!value&&(!consumed||consumed.value!==value||consumed.key!==h.key());}
 function stopMic(){
  sequence++;clearTimeout(queue);queue=0;if(turn){const t=turn;turn=null;clearTimeout(t.watch);clearTimeout(t.stopWatch);t.r.onresult=null;t.r.onend=null;t.r.onerror=null;try{t.r.abort();}catch{}}
  h.micState(null);mic.textContent=h.T('mic');mic.setAttribute('aria-pressed','false');
 }
 function render(){
  if(!initialized){initialized=true;const m=h.inputMeta?.();if(m&&m.key===h.key()&&m.value===field.value.trim()&&m.status==='sent'){consumed={value:m.value,key:m.key};showReceipt(`${W().sent}: ${m.value}`,m.lang);}}
  if(lastKey!==h.key()){if(consumed&&field.value.trim()===consumed.value)field.value='';consumed=null;receiptState=null;h.setInputMeta?.(null);lastKey=h.key();paintReceipt();}
  mic.textContent=turn?W().stop:h.T('mic');mic.setAttribute('aria-pressed',String(!!turn));
 }
 function prepareSubmission(question,source='text'){
  stopMic();submissionCount++;showReceipt(`${W().sent}: ${question}`);field.dataset.micState='sending';return {question,source};
 }
 function finishSubmission(question,lang,source='text'){
  if(field.value.trim()!==question)return;consumed={value:question,key:h.key()};
  if(source==='voice'){field.dataset.micState='sent';h.setInputMeta?.({key:h.key(),value:question,status:'sent',lang});}
  else{field.value='';consumed=null;delete field.dataset.micState;h.setInputMeta?.(null);}
  showReceipt(`${(WORDS[lang]||WORDS.en).sent}: ${question}`,lang);h.save();
 }
 function failedSubmission(question){if(consumed?.value===question)consumed=null;h.setInputMeta?.(null);field.dataset.micState='draft';h.save();}
 function failCapture(t,code){if(turn!==t)return;lastSTT[t.lang]=code;showReceipt(`${W().error}: ${detail(code)}`);stopMic();h.pauseAfterFailure();refresh();h.save();}
 function finishCapture(t){
  if(turn!==t||t.finished)return;t.finished=true;clearTimeout(t.watch);clearTimeout(t.stopWatch);
  const final=t.final.trim(),hadFinal=!!final,visible=(hadFinal?`${t.base} ${final}`:`${t.base} ${t.interim}`).trim().slice(0,450);
  field.value=visible;stopMic();
  if(!hadFinal){field.dataset.micState='draft';lastSTT[t.lang]=t.interim?'interim':'no-result';showReceipt(t.interim?`${W().draft} ${visible}`:W().none);h.pauseAfterFailure();refresh();h.save();return;}
  field.dataset.micState='final';lastSTT[t.lang]='recognized';showReceipt(`${W().recognized}: ${visible}`);refresh();h.save();
  const ticket=sequence;queue=setTimeout(()=>{queue=0;if(sequence!==ticket||h.key()!==t.key||h.lang()!==t.lang||document.hidden||field.value.trim()!==visible)return;lastSTT[t.lang]='sent';h.send();},750);
 }
 function listen(){
  if(!h.canListen())return;
  if(turn){const t=turn;if(t.stopping)return;t.stopping=true;try{t.r.stop();if(turn===t)t.stopWatch=setTimeout(()=>finishCapture(t),3500);}catch{finishCapture(t);}return;}
  if(!consented){if(!confirm(h.T('micConsent')))return;consented=true;}
  const R=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
  if(!R){lastSTT[h.lang()]='unsupported-api';showReceipt(detail('unsupported-api'));refresh();return;}
  const base=hasDraft()?field.value.trim():'';stopMic();cancelVoiceWait();h.begin();
  let r;try{r=new R();}catch{lastSTT[h.lang()]='unsupported-api';showReceipt(detail('unsupported-api'));refresh();return;}
  const t={r,lang:h.lang(),key:h.key(),base,final:'',interim:'',finished:false,stopping:false,watch:0,stopWatch:0};turn=t;consumed=null;h.setInputMeta?.(null);h.micState(r);
  r.lang=h.locale();r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
  field.value=base;field.dataset.micState='listening';showReceipt(W().listening);lastSTT[t.lang]='listening';render();refresh();
  r.onresult=event=>{if(turn!==t||t.lang!==h.lang()||t.key!==h.key()||t.finished)return;
   const out=readRecognition(event.results);t.final=out.final;t.interim=out.interim;
   field.value=`${base} ${out.text}`.trim().slice(0,450);field.dataset.micState=out.interim?'interim':'final';showReceipt(`${W().recognized}: ${field.value}`);h.save();
   if(out.final&&!out.interim)finishCapture(t);
  };
  r.onend=()=>finishCapture(t);r.onerror=e=>failCapture(t,e.error||'no-result');t.watch=setTimeout(()=>failCapture(t,'timeout'),30000);
  try{r.start();}catch(e){failCapture(t,e.name==='NotAllowedError'?'not-allowed':'audio-capture');}
 }
 field.addEventListener('input',()=>{stopMic();consumed=null;h.setInputMeta?.(null);field.dataset.micState='draft';h.edited?.();});
 $('remote').addEventListener('change',()=>{cancelVoiceWait();remember();refresh();});
 $('voices').addEventListener('change',()=>{h.stopSpeech();remember();refresh();});
 $('volume').addEventListener('input',remember);$('pc-refresh-voices').onclick=()=>refresh();
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();cancelVoiceWait();}});addEventListener('pagehide',()=>{stopMic();cancelVoiceWait();});
 Object.defineProperty(window,'GEM_PC_AUDIO',{get:()=>({version:'pc-audio-v2',language:h.lang(),locale:h.locale(),recognizing:!!turn,queued:!!queue,submissions:submissionCount,hasDraft:hasDraft(),voices:h.languages.map(l=>{const v=voiceInventory(allVoices(),l.code);return {lang:l.code,local:v.local.length,online:v.online.length,onlineAllowed:l.code===h.lang()?$('remote').checked:pref(l.code).online===true,tts:lastTTS[l.code]||'not-tested',recognition:lastSTT[l.code]||'not-tested'};})})});
 return {voices,refresh,render,stopMic,listen,hasDraft,prepareSubmission,finishSubmission,failedSubmission,noteTTS,missingVoiceCode,waitForVoice,cancelVoiceWait};
}
