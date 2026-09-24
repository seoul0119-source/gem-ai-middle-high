// Increment 001: two automatically presented media states for the existing JOIN problem.
// No network calls, lesson generation, microphone permissions or navigation ownership.
const pair=(en,fr)=>({en,fr});
const bounded=t=>Math.max(0,Math.min(1,Number(t)||0));
export const supportsJoin=s=>s?.id==='join'&&Number.isInteger(s.a)&&Number.isInteger(s.b)&&s.a>0&&s.b>0&&s.a+s.b<=20&&s.a<=10&&s.b<=10&&!s.missing;
export function joinFrame(s,progress=0){
 if(!supportsJoin(s))throw Error('Invalid join card');
 const p=bounded(progress),e=p*p*(3-2*p);
 return Array.from({length:s.a+s.b},(_,i)=>{const second=i>=s.a,j=second?i-s.a:i;const x0=(second?358:52)+44*(j%5),y0=83+48*Math.floor(j/5);const x1=202+54*(i%5),y1=76+44*Math.floor(i/5);return{id:i,group:second?'gold':'green',x:x0+(x1-x0)*e,y:y0+(y1-y0)*e};});
}
export function joinNarration(s,lang='en'){
 if(!supportsJoin(s))return '';
 const n=s.a+s.b;
 return lang==='fr'?`Regardez les ${s.a} jetons verts et les ${s.b} jetons dorés. Regardez les deux groupes se réunir. Aucun jeton n’est ajouté et aucun jeton n’est retiré. Comptez le groupe réuni : il y a ${n} jetons. ${s.a} + ${s.b} = ${n}.`:`Look at the ${s.a} green counters and the ${s.b} gold counters. Watch the two groups move together. No counter is added and no counter is removed. Count the joined group: there are ${n} counters. ${s.a} + ${s.b} = ${n}.`;
}
export function joinCard(s){
 if(!supportsJoin(s))return null;
 return{id:`auto-join-${s.a}-${s.b}`,step:'join',version:'auto-media-001',mediaCount:2,clip:null,
  scenes:[{kind:'image',en:`Look at the two groups on the board. There are ${s.a} green counters and ${s.b} gold counters. Count only filled counters. How many are there altogether? Discuss before giving your answer.`,fr:`Regardez les deux groupes au tableau. Il y a ${s.a} jetons verts et ${s.b} jetons dorés. Comptez uniquement les jetons remplis. Combien y en a-t-il en tout ? Discutez avant de répondre.`}],
  fact:pair('Moving counters changes their position, not their total.','Déplacer les jetons change leur position, pas leur nombre total.'),
  summary:pair(joinNarration(s,'en'),joinNarration(s,'fr')),
  activity:pair(`In pairs, place ${s.a} counters and ${s.b} more. Join the groups without adding or removing anything. Explain why the total stays the same.`,`À deux, posez ${s.a} jetons, puis ${s.b} autres. Réunissez les groupes sans rien ajouter ni retirer. Expliquez pourquoi le total reste le même.`),
  alt:pair(`${s.a} green counters and ${s.b} gold counters`,`${s.a} jetons verts et ${s.b} jetons dorés`)};
}
export function joinReply(result,s,lang,revealed=false){
 if(!supportsJoin(s))return null;const f=lang==='fr',n=s.a+s.b;
 if(['incorrect','correct','explain'].includes(result.kind))return(result.kind==='incorrect'?(f?`La réponse est ${n}, et non ${result.n}. `:`The correct answer is ${n}, not ${result.n}. `):result.kind==='correct'?(f?'Oui. ':'Yes. '):'')+joinNarration(s,lang);
 if(['meaning','conservation','count-on','ten','empty'].includes(result.kind)&&!revealed)return f?`Chaque jeton rempli représente un objet. Les cases vides ne sont pas des objets. Nous avons ${s.a} jetons verts et ${s.b} jetons dorés. Les déplacer ne change pas leur nombre. Cherchez le total avec votre groupe.`:`Each filled counter represents one object. Empty spaces are not objects. We have ${s.a} green counters and ${s.b} gold counters. Moving them does not change their number. Find the total with your group.`;
 return null;
}
export function joinContext(s,revealed){
 if(!supportsJoin(s))return '';
 return JSON.stringify({card:'auto-media-001',visual:'green and gold counters join; none is added or removed',green:s.a,gold:s.b,answerVisible:!!revealed,total:revealed?s.a+s.b:'not yet shown',fact:joinCard(s).fact,rule:'Refer to these displayed counters. Before the learner answers, do not reveal the total unless an explanation or solution is explicitly requested.'});
}
export function emitJoinCue(chunk,s){
 if(!supportsJoin(s)||typeof window==='undefined')return;
 const t=String(chunk).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const cue=/^watch the two groups move together|^regardez les deux groupes se reunir/.test(t.trim())?'move':/^count the joined group|^comptez le groupe reuni/.test(t.trim())?'total':null;
 if(cue)window.dispatchEvent(new CustomEvent('gem-join-speech',{detail:{cue,a:s.a,b:s.b}}));
}
export function installAutoJoin(root){
 const $=id=>document.getElementById(id),wrap=document.createElement('div');wrap.id='auto-join-visual';wrap.hidden=true;
 root.querySelector('#media-heading').after(wrap);
 const style=document.createElement('style');style.textContent='#auto-join-visual svg{display:block;width:100%;height:auto;border-radius:12px;background:#eff7f3}#lesson-media[data-auto-card="join"] #media-fact{display:block;font-size:clamp(14px,1.2vw,20px);line-height:1.5;margin:12px 0 0}#lesson-media[data-auto-card="join"] #media-heading{font-size:clamp(17px,1.4vw,23px)}';document.head.append(style);
 let key='',step=null,lang='en',revealed=false,paused=true,p=0,armed=false,spoken=false,quiet=0,last=performance.now(),savedAt=0,signature='',pendingTotal=false,suspended=false,active=false;
 const STORAGE='gem-auto-join-frame-v1';let records={};try{const v=JSON.parse(localStorage.getItem(STORAGE));if(v&&typeof v==='object'&&!Array.isArray(v))records=v;}catch{}
 function save(){if(!key)return;records[key]={p:bounded(p),revealed};const entries=Object.entries(records).slice(-12);records=Object.fromEntries(entries);try{localStorage.setItem(STORAGE,JSON.stringify(records));}catch{}savedAt=performance.now();}
 function scaffold(){
  const slots=(base)=>Array.from({length:10},(_,i)=>`<circle cx="${base+44*(i%5)}" cy="${83+48*Math.floor(i/5)}" r="14" fill="none" stroke="#aec3b8" stroke-dasharray="4 4"/>`).join('');
  wrap.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 285" role="img" aria-labelledby="join-svg-title"><title id="join-svg-title"></title><g data-source><rect x="22" y="42" width="260" height="126" rx="14" fill="#e5f2eb"/><rect x="326" y="42" width="272" height="126" rx="14" fill="#f8f1e1"/>${slots(52)}${slots(358)}<text x="304" y="117" text-anchor="middle" font-size="26">+</text></g><rect data-combined x="160" y="42" width="302" height="${step.a+step.b>10?190:126}" rx="14" fill="#e1f0e8" stroke="#739b86" opacity="0"/><g data-counters>${joinFrame(step).map(x=>`<circle data-counter="${x.id}" data-group="${x.group}" r="16" fill="${x.group==='green'?'#126d59':'#b67924'}"/>`).join('')}</g><text data-formula x="310" y="265" text-anchor="middle" font-family="Arial,sans-serif" font-size="29" fill="#173d43"></text></svg>`;
 }
 function paint(){if(!active||!step)return;const sig=`${key}:${lang}:${revealed}:${p.toFixed(3)}`;if(signature===sig)return;signature=sig;
  for(const v of joinFrame(step,p)){const dot=wrap.querySelector(`[data-counter="${v.id}"]`);dot.setAttribute('cx',v.x.toFixed(2));dot.setAttribute('cy',v.y.toFixed(2));}
  wrap.querySelector('[data-source]').setAttribute('opacity',String(1-p));wrap.querySelector('[data-combined]').setAttribute('opacity',String(p));wrap.querySelector('[data-formula]').textContent=`${step.a} + ${step.b} = ${revealed?step.a+step.b:'?'}`;
  $('join-svg-title').textContent=joinCard(step).alt[lang]+(revealed?(lang==='fr'?` ; total ${step.a+step.b}`:`; total ${step.a+step.b}`):'');
  $('media-heading').textContent=lang==='fr'?(revealed?'2 · Réunir et vérifier':'1 · Observer les deux groupes'):(revealed?'2 · Join and check':'1 · Observe the two groups');
  $('media-fact').textContent=joinCard(step).fact[lang];$('media-fact').hidden=false;
  $('media-source').textContent=lang==='fr'?'Affichage automatique · même problème dans les deux langues':'Automatic materials · same problem in both languages';
 }
 function sync(s,phase,scene,l,isPaused,isRevealed){
  if(!supportsJoin(s)){if(active)save();active=false;wrap.hidden=true;delete root.dataset.autoCard;return false;}
  active=true;const next=`${window.GEM_RELIABILITY?.sessionId||'starting'}:${s.id}:${s.a}:${s.b}`;
  if(key!==next){if(key)save();key=next;step={...s};p=isRevealed?bounded(records[key]?.p):0;armed=false;pendingTotal=false;suspended=false;signature='';scaffold();}
  lang=l==='fr'?'fr':'en';revealed=!!isRevealed;paused=!!isPaused;if(!revealed){p=0;armed=false;pendingTotal=false;}if(paused)save();
  if(!paused&&pendingTotal){p=1;pendingTotal=false;armed=false;save();}
  root.hidden=false;root.dataset.autoCard='join';wrap.hidden=false;$('counters').hidden=true;root.querySelector('#media-picture').hidden=true;const video=root.querySelector('#media-clip');video.pause();video.hidden=true;paint();return true;
 }
 addEventListener('gem-avatar-speaking',e=>{spoken=!!e.detail?.speaking;});
 addEventListener('gem-join-speech',e=>{if(!active||!revealed||e.detail?.a!==step.a||e.detail?.b!==step.b)return;suspended=false;if(e.detail.cue==='move'){armed=true;quiet=0;}if(e.detail.cue==='total'){if(paused)pendingTotal=true;else{p=1;armed=false;save();paint();}}});
 const interrupt=()=>{if(active&&revealed){suspended=true;save();}};
 $('answer-form').addEventListener('submit',interrupt,true);document.addEventListener('gem-final-answer',interrupt,true);$('mic').addEventListener('click',interrupt,true);
 $('play').addEventListener('click',()=>{if(active&&window.GEM_PILOT?.paused){suspended=false;armed=revealed&&p<1;}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();last=performance.now();});addEventListener('pagehide',save);
 let raf=0;function tick(now){raf=requestAnimationFrame(tick);const dt=Math.min(100,now-last);last=now;if(!active||!revealed||p>=1)return;
  const input=$('answer'),blocked=paused||document.hidden||suspended||window.GEM_RELIABILITY?.busy||document.querySelector('dialog[open]')||input.value.trim()||document.activeElement===input;
  if(blocked)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){p=1;armed=false;paint();save();return;}
  if(armed&&(spoken||window.GEM_PILOT?.speechPending)){quiet=0;p=bounded(p+dt/6000);paint();}
  else if(armed){quiet+=dt;if(quiet>1100){p=1;armed=false;paint();}}
  if(now-savedAt>350)save();
 }
 raf=requestAnimationFrame(tick);addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
 Object.defineProperty(window,'GEM_AUTO_MEDIA',{get:()=>({version:'auto-media-001',active,key,progress:p,paused,armed,suspended,answerVisible:revealed,card:active?'join':null,mediaCount:active?2:0,language:lang,step:step?{id:step.id,a:step.a,b:step.b}:null,networkRequests:0})});
 return{sync,busy:()=>active&&revealed&&armed&&!paused&&!suspended&&p<1};
}
