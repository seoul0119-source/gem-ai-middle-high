// Display-only repair. No question, answer, voice-permission or session writes.
export function installDisplayV3(){
 const shell=document.getElementById('shell'),button=document.getElementById('fullscreen');
 if(!shell||!button||shell.dataset.displayVersion==='display-v3')return;
 shell.dataset.displayVersion='display-v3';
 // Keep the legacy reference for older render closures, but expose only #play.
 const duplicate=document.getElementById('group-pause');
 if(duplicate){duplicate.hidden=true;duplicate.tabIndex=-1;duplicate.setAttribute('aria-hidden','true');}
 let active=false,mode='none',pending=false,saved=null,frame=0,timers=[];
 const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
 const french=()=>document.documentElement.lang==='fr';
 function label(){
  button.textContent=active?(french()?'⛶ Quitter le plein écran':'⛶ Exit full screen'):(french()?'⛶ Plein écran':'⛶ Full screen');
  button.setAttribute('aria-pressed',String(active));
  button.setAttribute('aria-label',active?(french()?'Quitter le plein écran':'Exit full screen'):(french()?'Plein écran':'Full screen'));
 }
 function resize(){
  if(!active)return;
  const vv=window.visualViewport;
  const height=Math.max(240,Math.round(Math.min(window.innerHeight,vv?.height||window.innerHeight)));
  shell.style.setProperty('--gem-screen-height',height+'px');
  window.dispatchEvent(new Event('gem-display-resize'));
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{resize();frame=requestAnimationFrame(resize);});}
 function settle(){
  schedule();for(const timer of timers)clearTimeout(timer);
  timers=[setTimeout(schedule,160),setTimeout(schedule,450)];
 }
 function prepare(){
  saved={x:window.scrollX,y:window.scrollY,shellScroll:shell.scrollTop,
   roomScroll:document.querySelector('.classroom')?.scrollTop||0,
   overflow:document.body.style.overflow,
   view:shell.classList.contains('board-view')?'board':shell.classList.contains('teacher-view')?'teacher':'both',
   more:document.getElementById('group-more')?.open||false};
  active=true;mode='entering';shell.classList.add('gem-presentation');
  // Entering Full screen should not inherit an invisible teacher from Board only.
  if(saved.view==='board')document.querySelector('[data-view="both"]')?.click();
  const more=document.getElementById('group-more');if(more)more.open=false;
  document.body.style.overflow='hidden';shell.scrollTop=0;
  const room=document.querySelector('.classroom');if(room)room.scrollTop=0;
  label();settle();
 }
 function cleanup(){
  if(!active)return;
  const previous=saved;active=false;mode='none';pending=false;saved=null;
  cancelAnimationFrame(frame);for(const timer of timers)clearTimeout(timer);timers=[];
  shell.classList.remove('gem-presentation','expanded');shell.style.removeProperty('--gem-screen-height');
  document.body.style.overflow=previous?.overflow||'';
  if(previous){
   if(previous.view==='board')document.querySelector('[data-view="board"]')?.click();
   const more=document.getElementById('group-more');if(more)more.open=previous.more;
  }
  label();window.dispatchEvent(new Event('gem-display-resize'));
  requestAnimationFrame(()=>{
   if(active)return;
   if(previous){shell.scrollTop=previous.shellScroll;const room=document.querySelector('.classroom');if(room)room.scrollTop=previous.roomScroll;window.scrollTo(previous.x,previous.y);}
   window.dispatchEvent(new Event('gem-display-resize'));
  });
 }
 async function toggle(){
  if(pending)return;
  if(active){
   if(fullscreenElement()===shell){
    pending=true;
    try{const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}
    catch{pending=false;return;}
    pending=false;if(fullscreenElement()!==shell)cleanup();
   }else cleanup();
   return;
  }
  pending=true;prepare();
  try{
   const request=shell.requestFullscreen||shell.webkitRequestFullscreen;
   if(typeof request!=='function')throw new Error('Fullscreen unavailable');
   await request.call(shell);
   if(fullscreenElement()!==shell)throw new Error('Fullscreen not entered');
   mode='native';
  }catch{
   if(active){mode='page';shell.classList.add('expanded');}
  }finally{pending=false;if(active){shell.scrollTop=0;label();settle();}}
 }
 button.onclick=toggle;
 function changed(){
  if(fullscreenElement()===shell){if(!active)prepare();mode='native';label();settle();}
  else if(active&&mode==='native')cleanup();
 }
 document.addEventListener('fullscreenchange',changed);
 document.addEventListener('webkitfullscreenchange',changed);
 window.addEventListener('resize',schedule);
 window.addEventListener('orientationchange',settle);
 window.visualViewport?.addEventListener('resize',schedule);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&active&&mode==='page'&&!document.querySelector('dialog[open]')){event.preventDefault();cleanup();}
 });
 new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 Object.defineProperty(window,'GEM_DISPLAY',{get:()=>({version:'display-v3',active,mode,
  visibleToggleCount:[...document.querySelectorAll('#play,#group-pause')].filter(el=>el.getClientRects().length>0&&!el.hidden).length,
  stageHeight:document.getElementById('stage')?.clientHeight||0,
  canvasHeight:document.getElementById('avatar')?.clientHeight||0})});
 label();
}
