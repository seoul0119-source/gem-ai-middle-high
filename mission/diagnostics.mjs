// GEM_DIAGNOSTICS_DIALOG_V3. Read-only diagnostics; no microphone/voice consent or network request.
export function installDiagnosticsDialog({refresh, stop}) {
  const $ = id => document.getElementById(id);
  if ($('audio-diagnostics-open')) return;
  const old = document.querySelector('.media-details'), raw = $('audio-diagnostic'), shell = $('shell');
  if (!old || !raw || !shell) throw new Error('Audio diagnostics markup missing');
  const trigger = document.createElement('button');
  trigger.id = 'audio-diagnostics-open'; trigger.type = 'button';
  trigger.textContent = '🔎 음성 진단 열기 · Audio diagnostics';
  trigger.setAttribute('aria-haspopup','dialog'); trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-controls','audio-diagnostics-dialog');
  const modal = document.createElement('dialog');
  modal.id = 'audio-diagnostics-dialog'; modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','audio-diagnostics-title');
  modal.innerHTML = `<div class="diagnostics-head"><h2 id="audio-diagnostics-title">음성 진단 · Audio diagnostics</h2><button id="diagnostics-close-top" type="button" autofocus>닫기 · Close ✕</button></div>
<div class="diagnostics-body"><p class="diagnostics-help" lang="ko">이 창을 캡처해 주세요. 내용을 확인하는 동안 수업은 일시정지합니다. 음성이나 마이크 권한은 자동으로 켜지지 않습니다.</p>
<p class="diagnostics-help">Read-only device checks. No recording or upload. Close this window, then resume when ready.</p>
<dl id="diagnostics-values"></dl><h3>현재 안내 · Current messages</h3><p id="diagnostics-voice"></p><p id="diagnostics-mic"></p>
<p id="diagnostics-summary"></p><p id="diagnostics-updated" role="status"></p><textarea id="diagnostics-copy-text" readonly hidden aria-label="Diagnostic text for manual copy"></textarea><p id="diagnostics-copy-status" role="status"></p></div>
<div class="diagnostics-actions"><button id="diagnostics-refresh" type="button">새로 확인 · Refresh</button><button id="diagnostics-copy" type="button">내용 복사 · Copy</button><button id="diagnostics-close" type="button">닫기 · Close</button></div>`;
  modal.querySelector('#diagnostics-summary').append(raw);
  const backdrop=document.createElement('div'); backdrop.id='diagnostics-backdrop';backdrop.hidden=true;
  old.replaceWith(trigger); shell.append(backdrop,modal);
  const style=document.createElement('style');
  style.textContent=`#audio-diagnostics-open{display:block;width:100%;min-height:48px;margin:10px 0 6px;padding:12px 14px;border:2px solid #126d59;border-radius:12px;background:#edf7f1;color:#18443b;font-size:14px;text-align:left;touch-action:manipulation;scroll-margin-bottom:160px}
#audio-diagnostics-dialog{position:fixed;inset:12px;margin:auto;width:calc(100vw - 24px);max-width:640px;height:fit-content;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);padding:0;border:1px solid #b2c7bd;border-radius:18px;color:#183b45;background:#fff;box-shadow:0 18px 60px #102c3b66;overflow:hidden;z-index:10001;overscroll-behavior:contain}
#audio-diagnostics-dialog:not([open]){display:none!important}#audio-diagnostics-dialog[open]{display:flex;flex-direction:column}#audio-diagnostics-dialog::backdrop{background:#102c3bbd}
.diagnostics-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #d4e0dd;flex-shrink:0;background:#f3f8f5}.diagnostics-head h2{margin:0!important;font-size:19px;line-height:1.4}.diagnostics-head button{flex-shrink:0}
#audio-diagnostics-dialog button{min-height:44px;font-size:13px;padding:9px 11px;touch-action:manipulation}.diagnostics-body{padding:14px 18px;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.diagnostics-help{font-size:12px;line-height:1.6;color:#50695f;margin:0 0 10px}#diagnostics-values{margin:12px 0}#diagnostics-values>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #e2eae5;font-size:13px;line-height:1.5}#diagnostics-values dt{font-weight:700}#diagnostics-values dd{margin:0;overflow-wrap:anywhere}
.diagnostics-body h3{font-size:14px;margin:18px 0 10px}#diagnostics-voice,#diagnostics-mic{padding:10px;border-radius:9px;background:#f4f8f5;font-size:13px;line-height:1.6;overflow-wrap:anywhere;white-space:pre-wrap}#diagnostics-mic{background:#fff4d8}#audio-diagnostic{font-size:11px;line-height:1.6;overflow-wrap:anywhere}#diagnostics-updated,#diagnostics-copy-status{font-size:12px;line-height:1.6}#diagnostics-copy-text{box-sizing:border-box;width:100%;min-height:140px;font-size:13px;padding:10px}
.diagnostics-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;padding:12px 16px max(12px,env(safe-area-inset-bottom));border-top:1px solid #d4e0dd;flex-shrink:0;background:#fff}.diagnostics-actions button{flex:1}#diagnostics-close{background:#126d59;color:white}#diagnostics-backdrop{position:fixed;inset:0;background:#102c3bbd;z-index:10000}
@media(max-width:430px){.diagnostics-head{padding:10px 12px}.diagnostics-head h2{font-size:16px}.diagnostics-body{padding:12px}.diagnostics-actions{padding:9px 10px max(9px,env(safe-area-inset-bottom));gap:5px}#audio-diagnostics-dialog button{font-size:12px}.diagnostics-head button{max-width:110px}}
@media(max-height:450px) and (orientation:landscape){.diagnostics-head{padding:7px 12px}.diagnostics-head h2{font-size:16px}.diagnostics-actions{padding:7px 12px}.diagnostics-body{padding:9px 14px}}
`;
  document.head.append(style);
  let lastFocus=null, fallback=false, blocked=[], oldOverflow='', timer=0, timers=[], copyEpoch=0;
  function snapshot(){
    const lang=window.GEM_PILOT?.language||document.documentElement.lang||'en';
    let list=[];try{list=Array.from(globalThis.speechSynthesis?.getVoices()||[]);}catch{}
    const available=list.filter(v=>String(v.lang).toLowerCase().replaceAll('_','-').split('-')[0]===lang);
    const labels=[['버전 · Version','diagnostics-v3'],['언어 · Language',lang==='fr'?'Français (FR)':'English (EN)'],
      ['기기 음성 · Local voices',String(available.filter(v=>v.localService===true).length)],
      ['온라인 음성 · Online voices',String(available.filter(v=>v.localService!==true).length)],
      ['온라인 음성 허용 · Permission',$('remote')?.checked?'허용 · Allowed':'차단 · Not allowed'],
      ['선택된 목소리 · Selected voice',$('voice')?.selectedOptions?.[0]?.textContent||'없음 · None'],
      ['음성인식 기능 · Recognition',(globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition)?'기능 있음 · API available':'지원 안 됨 · API unavailable'],
      ['보안 연결 · Secure context',globalThis.isSecureContext?'HTTPS / secure':'보안 연결 아님 · Insecure'],
      ['기기 연결 표시 · Network hint',navigator.onLine?'Online (service access not verified)':'Offline'],
      ['음량 · Volume',($('volume')?.value||'0')+'%']];
    const rows=$('diagnostics-values');rows.replaceChildren();
    for(const [label,value]of labels){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);rows.append(row);}
    $('diagnostics-voice').textContent=$('voice-status')?.textContent||'음성 안내 없음 · No voice message';
    $('diagnostics-mic').textContent=$('mic-status')?.textContent||'마이크 검사 전 · Microphone has not been checked';
    $('diagnostics-updated').textContent='마지막 확인 · Updated '+new Date().toLocaleTimeString();
    return ['GEM diagnostics-v3',...labels.map(([k,v])=>k+': '+v),$('diagnostics-voice').textContent,$('diagnostics-mic').textContent,raw.textContent].join('\n');
  }
  function update(){if(modal.open)snapshot();}
  function refreshNow(){refresh();snapshot();for(const t of timers)clearTimeout(t);timers=[setTimeout(update,250),setTimeout(update,1200)];}
  function afterClose(){
    if(modal.open)return;
    trigger.setAttribute('aria-expanded','false');backdrop.hidden=true;modal.classList.remove('is-fallback');
    for(const [el,inert,aria]of blocked){if(!inert)el.removeAttribute('inert');if(aria===null)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden',aria);}blocked=[];
    document.body.style.overflow=oldOverflow;fallback=false;clearTimeout(timer);for(const t of timers)clearTimeout(t);copyEpoch++;
    lastFocus?.focus?.({preventScroll:true});
  }
  function close(){if(!modal.open)return;if(fallback){modal.removeAttribute('open');afterClose();}else modal.close();}
  function open(){
    if(modal.open)return;lastFocus=document.activeElement;stop();refreshNow();
    $('diagnostics-copy-text').hidden=true;$('diagnostics-copy-status').textContent='';
    oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    try{if(typeof modal.showModal!=='function')throw new Error('Dialog API unavailable');modal.showModal();}
    catch{fallback=true;modal.setAttribute('open','');modal.classList.add('is-fallback');backdrop.hidden=false;blocked=[];for(const el of shell.children){if(el===modal||el===backdrop)continue;blocked.push([el,el.hasAttribute('inert'),el.getAttribute('aria-hidden')]);el.setAttribute('inert','');el.setAttribute('aria-hidden','true');}}
    trigger.setAttribute('aria-expanded','true');modal.querySelector('.diagnostics-body').scrollTop=0;
    $('diagnostics-close-top').focus({preventScroll:true});
  }
  trigger.addEventListener('click',open);$('diagnostics-close-top').addEventListener('click',close);$('diagnostics-close').addEventListener('click',close);backdrop.addEventListener('click',close);
  modal.addEventListener('close',afterClose);modal.addEventListener('cancel',event=>{event.preventDefault();close();});
  modal.addEventListener('click',e=>{if(e.target!==modal)return;const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'&&fallback){const items=[...modal.querySelectorAll('button,textarea:not([hidden])')].filter(el=>!el.disabled);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  $('diagnostics-refresh').addEventListener('click',refreshNow);
  $('diagnostics-copy').addEventListener('click',async()=>{const content=snapshot(),epoch=++copyEpoch;try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(content);if(epoch===copyEpoch&&modal.open)$('diagnostics-copy-status').textContent='복사했습니다 · Copied';}catch{if(epoch!==copyEpoch||!modal.open)return;const area=$('diagnostics-copy-text');area.value=content;area.hidden=false;area.focus();area.select();$('diagnostics-copy-status').textContent='복사가 차단되었습니다. 위 글을 길게 눌러 복사하거나 화면을 캡처해 주세요. · Select the text or take a screenshot.';}});
  const observer=new MutationObserver(()=>{clearTimeout(timer);if(modal.open)timer=setTimeout(update,0);});
  for(const el of [$('voice-status'),$('mic-status'),raw])if(el)observer.observe(el,{childList:true,characterData:true,subtree:true});
  globalThis.speechSynthesis?.addEventListener?.('voiceschanged',update);
  addEventListener('online',update);addEventListener('offline',update);
}
