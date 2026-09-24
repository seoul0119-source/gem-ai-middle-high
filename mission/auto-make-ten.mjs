// Automatic material 003: generated Make ten, with conserved counter identities.
const pair=(en,fr)=>({en,fr});
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
export const supportsMakeTen=s=>s?.id==='bridge-ten'&&!s.missing&&Number.isInteger(s.a)&&Number.isInteger(s.b)&&s.a>=1&&s.a<10&&s.b>=1&&s.b<=10&&s.a+s.b>10&&s.a+s.b<=20;
export function makeTenData(s){
 if(!supportsMakeTen(s))throw Error('Invalid make-ten step');
 const start=s.a,add=s.b,need=10-start,remaining=add-need,total=start+add;
 const pos=(i,right=false)=>({x:(right?354:54)+(i%5)*48,y:67+Math.floor(i/5)*50});
 const counters=[...Array.from({length:start},(_,i)=>({id:`green-${i}`,group:'start',from:pos(i),to:pos(i),move:-1})),...Array.from({length:add},(_,i)=>({id:`gold-${i}`,group:'add',from:pos(i,true),to:i<need?pos(start+i):pos(i,true),move:i<need?i:-1}))];
 return {start,add,need,remaining,total,counters};
}
export function makeTenFrame(s,progress=0){const d=makeTenData(s),p=clamp(progress);return d.counters.map(c=>{const t=c.move<0?0:clamp(p*d.need-c.move),e=t*t*(3-2*t);return {...c,progress:t,x:c.from.x+(c.to.x-c.from.x)*e,y:c.from.y+(c.to.y-c.from.y)*e+32*Math.sin(Math.PI*e)};});}
export function makeTenNarration(s,lang='en'){const d=makeTenData(s);return lang==='fr'?`Nous partons de ${d.start}. Il manque ${d.need} jetons pour remplir le cadre de dix. Regardez les jetons dorés remplir les cases vides. Prenez ${d.need} jetons parmi les ${d.add} à ajouter. Il reste ${d.remaining} jetons à côté. Dix et ${d.remaining} font ${d.total}. ${d.start} + ${d.add} = ${d.total}. Aucun jeton n’a été ajouté ni retiré.`:`We start with ${d.start}. We need ${d.need} counters to fill the ten-frame. Watch the gold counters fill the empty spaces. Take ${d.need} counters from the ${d.add} to add. There are ${d.remaining} counters left beside the full frame. Ten and ${d.remaining} make ${d.total}. ${d.start} + ${d.add} = ${d.total}. No counter has been added or removed.`;}
export function makeTenCard(s){if(!supportsMakeTen(s))return null;const d=makeTenData(s);return {id:`auto-make-ten-${d.start}-${d.add}`,step:s.id,version:'auto-media-003',mediaCount:2,clip:null,scenes:[{kind:'image',en:`The first ten-frame holds ${d.start} green counters. The other frame holds ${d.add} gold counters to add. Look at the empty spaces in the first frame. How could you make a full ten first? Discuss before answering.`,fr:`Le premier cadre contient ${d.start} jetons verts. L’autre cadre contient ${d.add} jetons dorés à ajouter. Observez les cases vides du premier cadre. Comment former dix d’abord ? Discutez avant de répondre.`}],fact:pair('Fill one ten-frame, then count the counters left beside it.','Remplissez un cadre de dix, puis comptez les jetons qui restent à côté.'),summary:pair(makeTenNarration(s,'en'),makeTenNarration(s,'fr')),activity:pair(`Show ${d.start} counters and ${d.add} more. Fill the first frame without adding or removing any counters. Explain the ten and the remaining counters to a partner.`,`Montrez ${d.start} jetons et ${d.add} autres. Remplissez le premier cadre sans ajouter ni retirer de jetons. Expliquez le groupe de dix et les jetons restants à un camarade.`),alt:pair(`Ten-frames with ${d.start} green counters and ${d.add} gold counters`,`Cadres de dix avec ${d.start} jetons verts et ${d.add} jetons dorés`)};}
export function makeTenReply(result,s,lang,revealed=false){if(!supportsMakeTen(s))return null;const f=lang==='fr',d=makeTenData(s);if(['correct','incorrect','explain'].includes(result.kind))return (result.kind==='incorrect'?(f?`La réponse est ${d.total}, et non ${result.n}. `:`The correct answer is ${d.total}, not ${result.n}. `):result.kind==='correct'?(f?'Oui. ':'Yes. '):'')+makeTenNarration(s,lang);if(['meaning','count-on','conservation','empty','ten'].includes(result.kind)&&!revealed)return f?`Le premier cadre contient ${d.start} jetons verts. Il y a ${d.add} jetons dorés à ajouter. Cherchez combien de cases sont vides dans le premier cadre. Peut-on déplacer des jetons pour le remplir sans en ajouter ni en retirer ? Discutez avec votre groupe.`:`The first frame has ${d.start} green counters. There are ${d.add} gold counters to add. Find the empty spaces in the first frame. Can you move counters to fill it without adding or removing any? Discuss with your group.`;return null;}
export function makeTenContext(s,revealed){if(!supportsMakeTen(s))return '';return JSON.stringify({card:'auto-media-003',visual:'Two ten-frames; move existing gold counters into empty spaces of first frame',first:s.a,second:s.b,answerVisible:!!revealed,total:revealed?s.a+s.b:'not yet shown',rule:'Use these exact numbers. Fill the first frame to ten, with the remaining counters beside it. No counters are created or removed. Do not reveal the total before a response unless explicitly asked for a solution.'});}
export function emitMakeTenCue(chunk,s){if(!supportsMakeTen(s)||typeof window==='undefined')return;const t=String(chunk).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();const cue=/^watch the gold counters|^regardez les jetons dores/.test(t)?'move':/^ten and|^dix et/.test(t)?'total':null;if(cue)dispatchEvent(new CustomEvent('gem-make-ten-speech',{detail:{cue,a:s.a,b:s.b}}));}
export function installAutoMakeTen(root){
 const $=id=>document.getElementById(id),wrap=document.createElement('div');wrap.id='auto-make-ten-visual';wrap.hidden=true;root.querySelector('#media-heading').after(wrap);
 const css=document.createElement('style');css.textContent='#auto-make-ten-visual svg{display:block;width:100%;height:auto;background:#eff7f3;border-radius:12px}#lesson-media[data-auto-card="bridge-ten"] #media-fact{display:block;font-size:clamp(14px,1.2vw,20px);line-height:1.5;margin:12px 0}';document.head.append(css);
 const storage='gem-auto-make-ten-frame-v1';let records={};try{const v=JSON.parse(localStorage.getItem(storage));if(v&&typeof v==='object'&&!Array.isArray(v))records=v;}catch{}
 let active=false,key='',step=null,lang='en',p=0,revealed=false,paused=true,armed=false,spoken=false,suspended=false,pendingTotal=false,last=performance.now(),savedAt=0,quiet=0,signature='';
 function save(){if(!key)return;records[key]={p:clamp(p),revealed};records=Object.fromEntries(Object.entries(records).slice(-12));try{localStorage.setItem(storage,JSON.stringify(records));}catch{}savedAt=performance.now();}
 function scaffold(){const d=makeTenData(step);wrap.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 300" role="img" aria-labelledby="make-ten-title"><title id="make-ten-title"></title>${[30,330].map(x=>`<rect x="${x}" y="42" width="240" height="100" rx="8" fill="white" stroke="#8ca99c"/>${Array.from({length:10},(_,i)=>`<rect x="${x+i%5*48}" y="${42+Math.floor(i/5)*50}" width="48" height="50" fill="none" stroke="#abc0b5"/>`).join('')}`).join('')}<text data-left x="150" y="28" text-anchor="middle" font-size="22"></text><text data-right x="450" y="28" text-anchor="middle" font-size="22"></text>${d.counters.map(c=>`<circle data-counter="${c.id}" data-group="${c.group}" r="16" fill="${c.group==='start'?'#126d59':'#b67924'}"/>`).join('')}<text data-method x="310" y="192" text-anchor="middle" font-size="21" fill="#385951"></text><text data-formula x="310" y="244" text-anchor="middle" font-size="25" fill="#173d43"></text></svg>`;}
 function paint(){if(!active||!step)return;const sig=`${key}:${lang}:${revealed}:${p.toFixed(4)}`;if(signature===sig)return;signature=sig;const d=makeTenData(step);
  for(const c of makeTenFrame(step,p)){const dot=wrap.querySelector(`[data-counter="${c.id}"]`);dot.setAttribute('cx',c.x.toFixed(2));dot.setAttribute('cy',c.y.toFixed(2));}
  wrap.querySelector('[data-left]').textContent=lang==='fr'?'Cadre de dix':'Ten-frame';wrap.querySelector('[data-right]').textContent=lang==='fr'?'À ajouter':'Counters to add';
  wrap.querySelector('[data-method]').textContent=revealed?(lang==='fr'?`${d.add} = ${d.need} + ${d.remaining}`:`${d.add} = ${d.need} + ${d.remaining}`):(lang==='fr'?'Comment remplir le premier cadre ?':'How can we fill the first frame?');
  wrap.querySelector('[data-formula]').textContent=revealed?`${d.start} + ${d.add} = 10 + ${d.remaining} = ${d.total}`:`${d.start} + ${d.add} = ?`;
  $('make-ten-title').textContent=makeTenCard(step).alt[lang]+(revealed?` ; ${d.start} + ${d.add} = ${d.total}`:'');
  $('media-heading').textContent=lang==='fr'?(revealed?'2 · Former dix et vérifier':'1 · Observer les deux cadres'):(revealed?'2 · Make ten and check':'1 · Observe the two frames');
  $('media-fact').textContent=makeTenCard(step).fact[lang];$('media-fact').hidden=false;$('media-source').textContent=lang==='fr'?'Affichage automatique · même problème dans les deux langues':'Automatic materials · same problem in both languages';
 }
 function sync(s,phase,scene,l,isPaused,isRevealed){
  if(!supportsMakeTen(s)){if(active)save();active=false;wrap.hidden=true;if(root.dataset.autoCard==='bridge-ten')delete root.dataset.autoCard;return false;}
  if(!active)signature='';active=true;const next=`${window.GEM_RELIABILITY?.sessionId||'starting'}:${s.id}:${s.a}:${s.b}`;
  if(key!==next){save();key=next;step={...s};p=isRevealed?clamp(records[key]?.p):0;armed=!!isRevealed&&p<1;pendingTotal=false;suspended=false;signature='';scaffold();}
  lang=l==='fr'?'fr':'en';revealed=!!isRevealed;paused=!!isPaused;
  if(!revealed){p=0;armed=false;pendingTotal=false;}
  // Dialogue owns the pause. On its normal/explicit return, continue this frame.
  if(!paused&&!window.GEM_RELIABILITY?.dialogueActive&&suspended){suspended=false;armed=revealed&&p<1;}
  if(!paused&&pendingTotal&&!suspended){p=1;pendingTotal=false;armed=false;}
  if(paused)save();root.hidden=false;root.dataset.autoCard='bridge-ten';wrap.hidden=false;$('counters').hidden=true;$('media-picture').hidden=true;$('media-clip').pause();$('media-clip').hidden=true;paint();return true;
 }
 addEventListener('gem-avatar-speaking',e=>{spoken=!!e.detail?.speaking;});
 addEventListener('gem-make-ten-speech',e=>{if(!active||!revealed||e.detail?.a!==step.a||e.detail?.b!==step.b)return;
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
 Object.defineProperty(window,'GEM_AUTO_MAKE_TEN',{get:()=>({version:'auto-media-003',active,key,progress:p,paused,armed,suspended,answerVisible:revealed,card:active?'bridge-ten':null,mediaCount:active?2:0,language:lang,step:step?{id:step.id,a:step.a,b:step.b}:null,networkRequests:0})});
 return {sync,busy:()=>active&&revealed&&armed&&!paused&&!suspended&&p<1};
}
