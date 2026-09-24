// Automatic material 002. Arithmetic, visuals and narration share the generated step.
const pair=(en,fr)=>({en,fr});
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
export const supportsCountOn=s=>s?.id==='count-on'&&!s.missing&&Number.isInteger(s.a)&&Number.isInteger(s.b)&&s.a>=1&&s.b>=1&&s.b<=4&&s.a+s.b<=20;
export function countOnData(s){
 if(!supportsCountOn(s))throw Error('Invalid count-on step');
 const start=s.a,total=s.a+s.b,low=Math.max(0,start-1),high=Math.min(20,total+1),x=n=>48+(n-low)*524/(high-low);
 return {start,add:s.b,total,low,high,startX:x(start),ticks:Array.from({length:high-low+1},(_,i)=>({n:low+i,x:x(low+i)})),hops:Array.from({length:s.b},(_,i)=>({id:i,from:start+i,to:start+i+1,x0:x(start+i),x1:x(start+i+1),sourceX:310+(i-(s.b-1)/2)*46}))};
}
export function countOnFrame(s,progress=0){
 const d=countOnData(s),p=clamp(progress);
 return d.hops.map(h=>{const t=clamp(p*d.add-h.id),e=t*t*(3-2*t);return {...h,progress:t,x:h.sourceX+(h.x1-h.sourceX)*e,y:53+127*e-40*Math.sin(Math.PI*e)};});
}
export function countOnNarration(s,lang='en'){
 const d=countOnData(s),sequence=d.hops.map(h=>h.to).join(', ');
 return lang==='fr'?`Gardez ${d.start} comme nombre de départ. Regardez chaque jeton doré avancer d’un pas sur la ligne. Comptez les ${d.add} pas ajoutés : ${sequence}. Le dernier nombre est ${d.total}. ${d.start} + ${d.add} = ${d.total}. Ne comptez pas le nombre de départ comme un pas ajouté.`:`Keep ${d.start} as the starting number. Watch each gold counter make one forward step on the line. Count the ${d.add} extra steps: ${sequence}. The last number is ${d.total}. ${d.start} + ${d.add} = ${d.total}. Do not count the starting number as an extra step.`;
}
export function countOnCard(s){
 if(!supportsCountOn(s))return null;const d=countOnData(s);
 return {id:`auto-count-on-${d.start}-${d.add}`,step:s.id,version:'auto-media-002',mediaCount:2,clip:null,
 scenes:[{kind:'image',en:`Start at ${d.start} on the number line. There are ${d.add} gold counters above it. Each counter will make one extra step forward. Where will you finish? Discuss before answering.`,fr:`Partez de ${d.start} sur la ligne des nombres. Il y a ${d.add} jetons dorés au-dessus. Chaque jeton fera un pas de plus vers l’avant. Où arriverez-vous ? Discutez avant de répondre.`}],
 fact:pair('Keep the starting number. Each extra counter is one forward step.','Gardez le nombre de départ. Chaque jeton ajouté correspond à un pas en avant.'),
 summary:pair(countOnNarration(s,'en'),countOnNarration(s,'fr')),
 activity:pair(`In pairs, start at ${d.start} and count ${d.add} steps forward. One learner points and the other checks each step.`,`À deux, partez de ${d.start} et comptez ${d.add} pas en avant. Une personne montre les pas, l’autre les vérifie.`),
 alt:pair(`Number line starting at ${d.start}, with ${d.add} extra counters`, `Ligne des nombres à partir de ${d.start}, avec ${d.add} jetons à ajouter`)};
}
export function countOnReply(result,s,lang,revealed=false){
 if(!supportsCountOn(s))return null;const f=lang==='fr',d=countOnData(s);
 if(['correct','incorrect','explain'].includes(result.kind))return (result.kind==='incorrect'?(f?`La réponse est ${d.total}, et non ${result.n}. `:`The correct answer is ${d.total}, not ${result.n}. `):result.kind==='correct'?(f?'Oui. ':'Yes. '):'')+countOnNarration(s,lang);
 if(['meaning','count-on','conservation','empty','ten'].includes(result.kind)&&!revealed)return f?`Gardez ${d.start} comme nombre de départ. Il y a ${d.add} jetons à ajouter. Chaque jeton correspond à un pas en avant. Le nombre de départ ne compte pas comme un pas ajouté. Cherchez le dernier nombre avec votre groupe.`:`Keep ${d.start} as the starting number. There are ${d.add} counters to add. Each counter is one forward step. The starting number does not count as an extra step. Find the last number with your group.`;
 return null;
}
export function countOnContext(s,revealed){
 if(!supportsCountOn(s))return '';
 return JSON.stringify({card:'auto-media-002',visual:'number line; one gold counter for each forward step',start:s.a,extraSteps:s.b,answerVisible:!!revealed,total:revealed?s.a+s.b:'not yet shown',rule:'Use the displayed starting number and extra steps. Do not count the starting number as an extra step. Do not reveal the answer before a response unless explicitly asked for the solution.'});
}
export function emitCountOnCue(chunk,s){
 if(!supportsCountOn(s)||typeof window==='undefined')return;
 const t=String(chunk).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const cue=/^watch each gold counter|^regardez chaque jeton dore/.test(t)?'move':/^the last number is|^le dernier nombre est/.test(t)?'total':null;
 if(cue)dispatchEvent(new CustomEvent('gem-count-on-speech',{detail:{cue,a:s.a,b:s.b}}));
}
export function installAutoCountOn(root){
 const $=id=>document.getElementById(id),wrap=document.createElement('div');wrap.id='auto-count-on-visual';wrap.hidden=true;root.querySelector('#media-heading').after(wrap);
 const css=document.createElement('style');css.textContent='#auto-count-on-visual svg{display:block;width:100%;height:auto;background:#eff7f3;border-radius:12px}#lesson-media[data-auto-card="count-on"] #media-fact{display:block;font-size:clamp(14px,1.2vw,20px);line-height:1.5;margin:12px 0}';document.head.append(css);
 const storage='gem-auto-count-on-frame-v1';let records={};try{const v=JSON.parse(localStorage.getItem(storage));if(v&&typeof v==='object'&&!Array.isArray(v))records=v;}catch{}
 let active=false,key='',step=null,lang='en',p=0,revealed=false,paused=true,armed=false,spoken=false,suspended=false,pendingTotal=false,last=performance.now(),savedAt=0,quiet=0,signature='';
 function save(){if(!key)return;records[key]={p:clamp(p),revealed};records=Object.fromEntries(Object.entries(records).slice(-12));try{localStorage.setItem(storage,JSON.stringify(records));}catch{}savedAt=performance.now();}
 function scaffold(){const d=countOnData(step);wrap.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 290" role="img" aria-labelledby="count-on-title"><title id="count-on-title"></title><rect x="190" y="22" width="240" height="63" rx="16" fill="#f8f1e1"/><path d="M 32 180 H 588 l -10 -7 m 10 7 l -10 7" fill="none" stroke="#385951" stroke-width="3"/>${d.ticks.map(t=>`<path d="M ${t.x} 174 v 14" stroke="#385951" stroke-width="2"/><text x="${t.x}" y="217" text-anchor="middle" font-size="24" fill="#173d43">${t.n}</text>`).join('')}<circle cx="${d.startX}" cy="180" r="11" fill="#126d59"/><text data-start x="${d.startX}" y="251" text-anchor="middle" font-size="20" fill="#126d59"></text>${d.hops.map(h=>`<path data-hop="${h.id}" d="M ${h.x0} 164 Q ${(h.x0+h.x1)/2} 105 ${h.x1} 164" fill="none" stroke="#b67924" stroke-width="4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle data-counter="${h.id}" r="13" fill="#b67924"/>`).join('')}<text data-formula x="310" y="281" text-anchor="middle" font-size="25" fill="#173d43"></text></svg>`;}
 function paint(){if(!active||!step)return;const sig=`${key}:${lang}:${revealed}:${p.toFixed(4)}`;if(signature===sig)return;signature=sig;
  for(const h of countOnFrame(step,p)){const c=wrap.querySelector(`[data-counter="${h.id}"]`);c.setAttribute('cx',h.x.toFixed(2));c.setAttribute('cy',h.y.toFixed(2));wrap.querySelector(`[data-hop="${h.id}"]`).setAttribute('stroke-dashoffset',String(1-h.progress));}
  wrap.querySelector('[data-start]').textContent=lang==='fr'?'Départ':'Start';wrap.querySelector('[data-formula]').textContent=`${step.a} + ${step.b} = ${revealed?step.a+step.b:'?'}`;
  $('count-on-title').textContent=countOnCard(step).alt[lang]+(revealed?` ; ${step.a} + ${step.b} = ${step.a+step.b}`:'');
  $('media-heading').textContent=lang==='fr'?(revealed?'2 · Avancer et vérifier':'1 · Observer le départ'):(revealed?'2 · Count on and check':'1 · Observe the start');
  $('media-fact').textContent=countOnCard(step).fact[lang];$('media-fact').hidden=false;$('media-source').textContent=lang==='fr'?'Affichage automatique · même problème dans les deux langues':'Automatic materials · same problem in both languages';
 }
 function sync(s,phase,scene,l,isPaused,isRevealed){
  if(!supportsCountOn(s)){if(active)save();active=false;wrap.hidden=true;if(root.dataset.autoCard==='count-on')delete root.dataset.autoCard;return false;}
  if(!active)signature='';active=true;const next=`${window.GEM_RELIABILITY?.sessionId||'starting'}:${s.id}:${s.a}:${s.b}`;
  if(key!==next){save();key=next;step={...s};p=isRevealed?clamp(records[key]?.p):0;armed=!!isRevealed&&p<1;pendingTotal=false;suspended=false;signature='';scaffold();}
  lang=l==='fr'?'fr':'en';revealed=!!isRevealed;paused=!!isPaused;
  if(!revealed){p=0;armed=false;pendingTotal=false;}
  // Dialogue owns the pause. On its normal/explicit return, continue this frame.
  if(!paused&&!window.GEM_RELIABILITY?.dialogueActive&&suspended){suspended=false;armed=revealed&&p<1;}
  if(!paused&&pendingTotal&&!suspended){p=1;pendingTotal=false;armed=false;}
  if(paused)save();root.hidden=false;root.dataset.autoCard='count-on';wrap.hidden=false;$('counters').hidden=true;$('media-picture').hidden=true;$('media-clip').pause();$('media-clip').hidden=true;paint();return true;
 }
 addEventListener('gem-avatar-speaking',e=>{spoken=!!e.detail?.speaking;});
 addEventListener('gem-count-on-speech',e=>{if(!active||!revealed||e.detail?.a!==step.a||e.detail?.b!==step.b)return;
  // Narration during a dialogue may explain, but must not advance its frozen diagram.
  if(window.GEM_RELIABILITY?.dialogueActive)return;
  suspended=false;if(e.detail.cue==='move'){armed=true;quiet=0;}if(e.detail.cue==='total'){if(paused)pendingTotal=true;else{p=1;armed=false;save();paint();}}
 });
 const interrupt=()=>{if(active&&revealed){suspended=true;pendingTotal=false;save();}};
 $('answer').addEventListener('input',interrupt,true);$('answer-form').addEventListener('submit',interrupt,true);document.addEventListener('gem-final-answer',interrupt,true);$('mic').addEventListener('click',interrupt,true);
 $('play').addEventListener('click',()=>{if(active&&window.GEM_PILOT?.paused){suspended=false;armed=revealed&&p<1;}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();last=performance.now();});addEventListener('pagehide',save);
 // SVG progress must not depend on WebGL animation-frame scheduling. Slow GPUs
 // and builder browsers can stop delivering those callbacks during dialogue.
 function tick(now){const dt=Math.min(100,now-last);last=now;if(!active||!revealed||p>=1)return;
  const input=$('answer');if(paused||suspended||document.hidden||window.GEM_RELIABILITY?.dialogueActive||window.GEM_RELIABILITY?.busy||document.querySelector('dialog[open]')||input.value.trim()||document.activeElement===input)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){p=1;armed=false;paint();save();return;}
  if(armed&&(spoken||window.GEM_PILOT?.speechPending)){quiet=0;p=clamp(p+dt/6000);paint();}else if(armed){quiet+=dt;if(quiet>1100){p=1;armed=false;paint();}}
  if(now-savedAt>350)save();
 }
 const timer=setInterval(()=>tick(performance.now()),50);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 Object.defineProperty(window,'GEM_AUTO_COUNT_ON',{get:()=>({version:'auto-media-002',active,key,progress:p,paused,armed,suspended,answerVisible:revealed,card:active?'count-on':null,mediaCount:active?2:0,language:lang,step:step?{id:step.id,a:step.a,b:step.b}:null,networkRequests:0})});
 return {sync,busy:()=>active&&revealed&&armed&&!paused&&!suspended&&p<1};
}
