// Display-only repair. Never write questions, drafts, voices or lesson progress.
export function installDisplayV3(){
 const shell=document.getElementById('shell'),button=document.getElementById('fullscreen');
 if(!shell||!button||shell.dataset.displayVersion==='display-v3')return;
 shell.dataset.displayVersion='display-v3';shell.dataset.fullscreenExit='exit-v1';
 const duplicate=document.getElementById('group-pause');
 if(duplicate){duplicate.hidden=true;duplicate.tabIndex=-1;duplicate.setAttribute('aria-hidden','true');}
 // This escape control remains in the viewport even after the lesson pane scrolls.
 const closeButton=document.createElement('button');closeButton.id='fullscreen-exit';
 closeButton.type='button';closeButton.textContent='✕';closeButton.hidden=true;
 const help=document.createElement('p');help.id='fullscreen-exit-status';help.hidden=true;
 help.setAttribute('role','status');shell.append(closeButton,help);
 const exitStyle=document.createElement('style');exitStyle.textContent=`
 #shell.gem-presentation>header{position:sticky;top:0;z-index:20;padding-right:max(66px,calc(env(safe-area-inset-right) + 58px))}
 #fullscreen-exit{position:fixed!important;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:10002;width:48px;min-width:48px;height:48px;min-height:48px;margin:0;padding:0;display:grid;place-items:center;border:2px solid #fff;border-radius:12px;background:#173d43;color:#fff;font:700 24px/1 Arial,sans-serif;box-shadow:0 2px 12px #0004;touch-action:manipulation;pointer-events:auto}
 #fullscreen-exit[hidden],#fullscreen-exit-status[hidden]{display:none!important}
 #fullscreen-exit:focus-visible{outline:3px solid #f4c86c;outline-offset:2px}
 #fullscreen-exit-status{position:fixed;top:max(64px,calc(env(safe-area-inset-top) + 60px));right:max(8px,env(safe-area-inset-right));z-index:10003;max-width:min(320px,calc(100vw - 16px));margin:0;padding:12px;border:1px solid #c7d9d0;border-radius:10px;background:#fff;color:#173d43;font-size:13px;line-height:1.5;box-shadow:0 3px 15px #0003}
 `;document.head.append(exitStyle);
 let active=false,mode='none',pending=false,saved=null,frame=0,timers=[];
 let wanted=false,operation=0,entryWatch=0,exitWatch=0,exiting=false;
 const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement||document.webkitCurrentFullScreenElement||null;
 const ownsNative=()=>{const element=fullscreenElement();return element===shell||!!element&&shell.contains(element);};
 const french=()=>document.documentElement.lang==='fr';
 function label(){
  const text=active?(french()?'⛶ Quitter le plein écran':'⛶ Exit full screen'):(french()?'⛶ Plein écran':'⛶ Full screen');
  // The lesson renderer also touches this button. Do not create a mutation loop.
  if(button.textContent!==text)button.textContent=text;
  button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',text);
  const exitLabel=french()?'Quitter le plein écran':'Exit full screen';
  closeButton.setAttribute('aria-label',exitLabel);closeButton.title=exitLabel;
  closeButton.hidden=!active;closeButton.disabled=false;
 }
 function resize(){
  if(!active)return;
  const vv=window.visualViewport,height=Math.max(240,Math.round(Math.min(window.innerHeight,vv?.height||window.innerHeight)));
  shell.style.setProperty('--gem-screen-height',height+'px');window.dispatchEvent(new Event('gem-display-resize'));
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{resize();frame=requestAnimationFrame(resize);});}
 function settle(){schedule();for(const timer of timers)clearTimeout(timer);timers=[setTimeout(schedule,160),setTimeout(schedule,450)];}
 function prepare(){
  if(active)return;
  saved={x:window.scrollX,y:window.scrollY,shellScroll:shell.scrollTop,roomScroll:document.querySelector('.classroom')?.scrollTop||0,
   overflow:document.body.style.overflow,view:shell.classList.contains('board-view')?'board':shell.classList.contains('teacher-view')?'teacher':'both',more:document.getElementById('group-more')?.open||false};
  active=true;mode='entering';shell.classList.add('gem-presentation');
  if(saved.view==='board')document.querySelector('[data-view="both"]')?.click();
  const more=document.getElementById('group-more');if(more)more.open=false;
  document.body.style.overflow='hidden';shell.scrollTop=0;
  const room=document.querySelector('.classroom');if(room)room.scrollTop=0;
  help.hidden=true;label();settle();
 }
 function cleanup(){
  const previous=saved;active=false;wanted=false;mode='none';pending=false;exiting=false;saved=null;
  operation++;clearTimeout(entryWatch);clearTimeout(exitWatch);cancelAnimationFrame(frame);
  for(const timer of timers)clearTimeout(timer);timers=[];
  shell.classList.remove('gem-presentation','expanded');shell.style.removeProperty('--gem-screen-height');
  if(previous)document.body.style.overflow=previous.overflow;
  if(previous){if(previous.view==='board')document.querySelector('[data-view="board"]')?.click();const more=document.getElementById('group-more');if(more)more.open=previous.more;}
  help.hidden=true;label();window.dispatchEvent(new Event('gem-display-resize'));
  requestAnimationFrame(()=>{if(active)return;if(previous){shell.scrollTop=previous.shellScroll;const room=document.querySelector('.classroom');if(room)room.scrollTop=previous.roomScroll;window.scrollTo(previous.x,previous.y);}window.dispatchEvent(new Event('gem-display-resize'));});
 }
 function pageFallback(token){
  if(token!==operation||!wanted||!active)return;
  pending=false;clearTimeout(entryWatch);mode=ownsNative()?'native':'page';
  if(mode==='page')shell.classList.add('expanded');label();settle();
 }
 function exitFailed(token){
  if(token!==operation||!active)return;
  pending=false;exiting=false;clearTimeout(exitWatch);
  if(!ownsNative()){cleanup();return;}
  // Do not claim native fullscreen is closed if the browser refused the request.
  mode='native';help.textContent=french()?'Le navigateur n’a pas quitté le plein écran. Réessayez ✕ ou utilisez la commande Retour du navigateur.':'The browser has not left full screen. Tap ✕ again or use the browser’s Back control.';
  help.hidden=false;label();
 }
 function exitPresentation(){
  // Exit must never wait for requestFullscreen()'s promise to settle.
  wanted=false;pending=false;clearTimeout(entryWatch);
  if(exiting&&ownsNative())return;
  const token=++operation;
  if(!ownsNative()){cleanup();return;}
  if(!active)prepare();wanted=false;exiting=true;mode='exiting';help.hidden=true;label();
  const methods=[document.exitFullscreen,document.webkitExitFullscreen,document.webkitCancelFullScreen].filter((fn,i,list)=>typeof fn==='function'&&list.indexOf(fn)===i);
  let attempt=0;
  function invoke(){
   if(token!==operation)return;
   if(!ownsNative()){cleanup();return;}
   if(attempt>=methods.length){exitFailed(token);return;}
   let result;
   try{result=methods[attempt++].call(document);}catch{invoke();return;}
   Promise.resolve(result).then(()=>{
    if(token!==operation)return;
    if(!ownsNative())cleanup();
    // Legacy methods may return void before the browser sends fullscreenchange.
   },()=>{if(token===operation)invoke();});
  }
  clearTimeout(exitWatch);exitWatch=setTimeout(()=>exitFailed(token),1800);invoke();
 }
 function enterPresentation(){
  if(pending)return;
  wanted=true;exiting=false;pending=true;const token=++operation;prepare();
  clearTimeout(entryWatch);entryWatch=setTimeout(()=>pageFallback(token),1800);
  const request=shell.requestFullscreen||shell.webkitRequestFullscreen||shell.webkitRequestFullScreen;
  if(typeof request!=='function'){pageFallback(token);return;}
  let result;
  try{result=request.call(shell);}catch{pageFallback(token);return;}
  Promise.resolve(result).then(()=>{
   if(token!==operation||!wanted)return;
   if(ownsNative()){clearTimeout(entryWatch);pending=false;mode='native';shell.classList.remove('expanded');label();settle();}
   // An event is authoritative; do not hold the exit button behind this promise.
  },()=>pageFallback(token));
 }
 function toggle(){if(active||ownsNative()){exitPresentation();return;}enterPresentation();}
 button.onclick=toggle;closeButton.onclick=event=>{event.preventDefault();event.stopPropagation();exitPresentation();};
 function changed(){
  if(ownsNative()){
   // A late entering event can arrive after the user already closed page expansion.
   if(!wanted){if(!active)prepare();exitPresentation();return;}
   if(!active)prepare();clearTimeout(entryWatch);pending=false;mode='native';shell.classList.remove('expanded');label();settle();
  }else if(active&&(mode==='native'||mode==='exiting'||!wanted))cleanup();
 }
 document.addEventListener('fullscreenchange',changed);document.addEventListener('webkitfullscreenchange',changed);
 const onError=()=>{if(!active)return;if(exiting)exitFailed(operation);else if(pending)pageFallback(operation);};
 document.addEventListener('fullscreenerror',onError);document.addEventListener('webkitfullscreenerror',onError);
 window.addEventListener('resize',schedule);window.addEventListener('orientationchange',settle);window.visualViewport?.addEventListener('resize',schedule);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active&&mode==='page'&&!document.querySelector('dialog[open]')){event.preventDefault();exitPresentation();}});
 new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 new MutationObserver(label).observe(button,{childList:true});
 Object.defineProperty(window,'GEM_DISPLAY',{get:()=>({version:'display-v3',exitFix:'fullscreen-exit-v1',active,mode,pending,
  visibleToggleCount:[...document.querySelectorAll('#play,#group-pause')].filter(el=>el.getClientRects().length>0&&!el.hidden).length,
  stageHeight:document.getElementById('stage')?.clientHeight||0,canvasHeight:document.getElementById('avatar')?.clientHeight||0})});
 label();
}
