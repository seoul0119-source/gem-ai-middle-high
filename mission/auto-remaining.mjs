// Automatic material coverage for the seven remaining generated question roles.
// The existing JOIN, Count on and Make ten controllers remain authoritative for their roles.
const pair=(en,fr)=>({en,fr});
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const IDS=new Set(['complete-ten','together','pair','story','practice','swap','check']);
export const supportsRemaining=s=>IDS.has(s?.id)&&Number.isInteger(s.a)&&Number.isInteger(s.b)&&s.a>=1&&s.a<=10&&s.b>=1&&s.b<=10&&s.a+s.b<=20&&(s.id!=='complete-ten'||(s.missing===true&&s.a+s.b===10));
export function remainingData(s){
 if(!supportsRemaining(s))throw Error('Unsupported remaining question');
 const answer=s.missing?10-s.a:s.a+s.b;
 const method=s.missing?'missing':s.id==='swap'?'swap':s.a<10&&s.a+s.b>10?'ten':s.b<=4||s.a===10?'count':'join';
 const pos=(i,right=false)=>({x:(right?354:54)+(i%5)*48,y:67+Math.floor(i/5)*50});
 const need=s.missing?10-s.a:Math.max(0,10-s.a),rest=s.b-need;
 let counters=[];
 if(method==='count'){
  const low=Math.max(0,s.a-1),high=Math.min(20,s.a+s.b+1),x=n=>48+(n-low)*524/(high-low);
  counters=Array.from({length:s.b},(_,i)=>({id:`gold-${i}`,group:'add',from:{x:310+(i-(s.b-1)/2)*46,y:55},to:{x:x(s.a+i+1),y:171},move:i}));
  return {method,answer,total:s.a+s.b,need,rest,start:s.a,add:s.b,counters,low,high,ticks:Array.from({length:high-low+1},(_,i)=>({n:low+i,x:x(low+i)})),startX:x(s.a)};
 }
 for(let i=0;i<s.a;i++){
  const from=s.missing?{x:pos(i).x+150,y:pos(i).y}:pos(i);
  counters.push({id:`green-${i}`,group:'start',from,to:method==='swap'?pos(i,true):from,move:method==='swap'?0:-1});
 }
 for(let i=0;i<s.b;i++){
  const from=s.missing?{x:104+i*46,y:208}:pos(i,true);
  let to=from,move=-1;
  if(method==='missing'){to={x:pos(s.a+i).x+150,y:pos(s.a+i).y};move=i;}
  else if(method==='swap'){to=pos(i);move=0;}
  else if(method==='ten'){if(i<need){to=pos(s.a+i);move=i;}}
  else {to=pos(s.a+i);move=i;}
  counters.push({id:`gold-${i}`,group:'add',from,to,move});
 }
 return {method,answer,total:s.a+s.b,need,rest,start:s.a,add:s.b,counters};
}
export function remainingFrame(s,progress=0,revealed=true){
 const d=remainingData(s),p=clamp(progress),moves=d.method==='swap'?1:d.method==='ten'?d.need:d.add;
 return d.counters.filter(c=>revealed||d.method!=='missing'||c.group==='start').map(c=>{
  const t=c.move<0?0:clamp(p*moves-c.move),e=t*t*(3-2*t);
  return {...c,progress:t,x:c.from.x+(c.to.x-c.from.x)*e,y:c.from.y+(c.to.y-c.from.y)*e+((d.method==='count'?-35:24)*Math.sin(Math.PI*e))};
 });
}
const FACTS={
 missing:pair('Count the empty spaces to find how many more are needed.','Comptez les cases vides pour trouver combien de jetons ajouter.'),
 ten:pair('Move some of the extra counters to complete ten; the total does not change.','Déplacez des jetons pour former dix : le total ne change pas.'),
 count:pair('The starting number is not an extra step.','Le nombre de départ ne compte pas comme un pas ajouté.'),
 join:pair('Joining groups does not create or remove objects.','Réunir les groupes ne crée ni ne retire d’objets.'),
 swap:pair('Changing the order of the groups does not change the total.','Changer l’ordre des groupes ne change pas le total.')
};
export function remainingNarration(s,lang='en'){
 const d=remainingData(s),f=lang==='fr';
 if(d.method==='missing')return f?`Le cadre contient ${d.start} jetons. Il manque ${d.answer} jetons pour remplir les dix cases. Regardez les nouveaux jetons remplir les cases vides. Nous ajoutons ${d.answer} jetons, un par case vide. Vérifions le résultat : ${d.start} + ${d.answer} = 10.`:`The frame has ${d.start} counters. We need ${d.answer} more to fill all ten spaces. Watch the new counters fill the empty spaces. Add ${d.answer} counters, one to each empty space. Check the result: ${d.start} + ${d.answer} = 10.`;
 if(d.method==='ten')return f?`Nous avons ${d.start} jetons et ${d.add} autres. Il manque ${d.need} jetons au premier cadre. Regardez les jetons dorés se déplacer pour former dix. Déplaçons ${d.need} jetons : ${d.rest} restent à côté. Vérifions le résultat : 10 + ${d.rest} = ${d.total}. Donc ${d.start} + ${d.add} = ${d.total}. Aucun jeton n’a disparu.`:`We have ${d.start} counters and ${d.add} more. The first frame needs ${d.need} counters. Watch the gold counters move to make ten. Move ${d.need} counters; ${d.rest} remain beside the frame. Check the result: 10 + ${d.rest} = ${d.total}. So ${d.start} + ${d.add} = ${d.total}. No counter disappeared.`;
 if(d.method==='count'){const seq=Array.from({length:d.add},(_,i)=>d.start+i+1).join(', ');return f?`Gardez ${d.start} comme nombre de départ. Regardez chaque jeton avancer d’un pas. Comptez les ${d.add} pas ajoutés : ${seq}. Vérifions le résultat : ${d.start} + ${d.add} = ${d.total}. Le nombre de départ n’est pas un pas ajouté.`:`Keep ${d.start} as the starting number. Watch each counter move one step forward. Count the ${d.add} extra steps: ${seq}. Check the result: ${d.start} + ${d.add} = ${d.total}. The starting number is not an extra step.`;}
 if(d.method==='swap')return f?`Voici ${d.start} jetons verts et ${d.add} jetons dorés. Regardez les deux groupes échanger leurs places. Nous avons les mêmes jetons, dans un autre ordre. Vérifions le résultat : ${d.start} + ${d.add} = ${d.total}, et ${d.add} + ${d.start} = ${d.total}.`:`Here are ${d.start} green counters and ${d.add} gold counters. Watch the two groups swap places. They are the same counters in a different order. Check the result: ${d.start} + ${d.add} = ${d.total}, and ${d.add} + ${d.start} = ${d.total}.`;
 return f?`Voici ${d.start} jetons verts et ${d.add} jetons dorés. Regardez les deux groupes se réunir dans le premier cadre. Comptez chaque jeton rempli une seule fois. Vérifions le résultat : ${d.start} + ${d.add} = ${d.total}.`:`Here are ${d.start} green counters and ${d.add} gold counters. Watch the two groups join in the first frame. Count each filled counter once. Check the result: ${d.start} + ${d.add} = ${d.total}.`;
}
export function remainingCard(s){
 if(!supportsRemaining(s))return null;
 const d=remainingData(s);
 let opening=d.method==='missing'?pair(`The ten-frame has ${d.start} filled spaces. Look at the empty spaces. How many counters must we add to make ten? Discuss before answering.`,`Le cadre de dix contient ${d.start} cases remplies. Regardez les cases vides. Combien de jetons faut-il ajouter pour former dix ? Discutez avant de répondre.`):d.method==='swap'?pair(`Look at the group of ${d.start} and the group of ${d.add}. Imagine swapping the groups. Would any counters be added or taken away? Find the total before answering.`,`Regardez le groupe de ${d.start} et celui de ${d.add}. Imaginez que leurs places s’échangent. Ajoute-t-on ou retire-t-on des jetons ? Cherchez le total avant de répondre.`):pair(`Look at ${d.start} counters and ${d.add} more on the board. Choose a way to add them. Use the picture to explain your thinking before giving the total.`,`Regardez ${d.start} jetons et ${d.add} autres au tableau. Choisissez une méthode pour les additionner. Utilisez le schéma pour expliquer votre raisonnement avant de donner le total.`);
 if(s.id==='story')opening=pair(`${s.speech?.en||opening.en} Each mark in the picture stands for one object in this story.`,`${s.speech?.fr||opening.fr} Chaque marque du schéma représente un objet de cette histoire.`);
 if(s.id==='pair')opening=pair(`${opening.en} One partner explains and the other checks.`,`${opening.fr} Un camarade explique, l’autre vérifie.`);
 if(s.id==='check')opening=pair(`${opening.en} Tell your teacher why your method works.`,`${opening.fr} Expliquez à l’enseignant pourquoi votre méthode fonctionne.`);
 return {id:`auto-all-${s.id}-${s.a}-${s.b}`,step:s.id,version:'all-questions-v1',method:d.method,mediaCount:2,clip:null,
  scenes:[{kind:'image',en:opening.en,fr:opening.fr}],fact:FACTS[d.method],summary:pair(remainingNarration(s,'en'),remainingNarration(s,'fr')),
  activity:s.activity||pair('Explain your method to a partner.','Expliquez votre méthode à un camarade.'),
  alt:d.method==='missing'?pair(`Ten-frame with ${d.start} filled spaces; find the missing addend.`,`Cadre de dix avec ${d.start} cases remplies ; cherchez le nombre à ajouter.`):pair(`${d.start} and ${d.add}; use the displayed ${d.method} method.`,`${d.start} et ${d.add} ; utilisez la méthode illustrée.`)};
}
export function remainingReply(result,s,lang,revealed=false){
 if(!supportsRemaining(s))return null;const d=remainingData(s),f=lang==='fr';
 if(['correct','incorrect','explain'].includes(result.kind))return (result.kind==='incorrect'?(f?`La réponse attendue est ${d.answer}, et non ${result.n}. `:`The correct answer is ${d.answer}, not ${result.n}. `):result.kind==='correct'?(f?'Oui. ':'Yes. '):'')+remainingNarration(s,lang);
 if(['meaning','conservation','count-on','ten','empty'].includes(result.kind)&&!revealed)return d.method==='missing'?(f?`Le cadre a dix cases, dont ${s.a} remplies. Comptez les cases vides sans compter les jetons déjà présents. Donnez le nombre à ajouter, pas le nombre total de cases.`:`The frame has ten spaces, with ${s.a} filled. Count the empty spaces, not the counters already present. Give the number to add, not the total number of spaces.`):remainingCard(s).scenes[0][lang]+' '+FACTS[d.method][lang];
 return null;
}
export function remainingContext(s,revealed){
 if(!supportsRemaining(s))return '';
 const d=remainingData(s);return JSON.stringify({material:'all-questions-v1',role:s.id,method:d.method,start:s.a,add:s.missing?'unknown':s.b,answerVisible:!!revealed,answer:revealed?d.answer:'hidden',fact:FACTS[d.method],instruction:'Refer to this diagram and these numbers. For missing addend, the answer is how many to add, not ten. Do not expose the hidden answer unless explicitly asked for a solution.'});
}
export function emitRemainingCue(chunk,s){
 if(!supportsRemaining(s)||typeof window==='undefined')return;
 const t=String(chunk).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const cue=/^watch |^regardez (?:les|chaque)/.test(t)?'move':/^check the result|^verifions le resultat/.test(t)?'total':null;
 if(cue)dispatchEvent(new CustomEvent('gem-remaining-speech',{detail:{cue,id:s.id,a:s.a,b:s.b}}));
}
export function installRemaining(root){
 const $=id=>document.getElementById(id),wrap=document.createElement('div');wrap.id='auto-remaining-visual';wrap.hidden=true;root.querySelector('#media-heading').after(wrap);
 const css=document.createElement('style');css.textContent='#auto-remaining-visual svg{display:block;width:100%;height:auto;border-radius:12px;background:#eff7f3}#lesson-media[data-material-owner="remaining"] #media-fact{display:block;font-size:clamp(14px,1.2vw,20px);line-height:1.5;margin:12px 0}';document.head.append(css);
 const storage='gem-auto-remaining-frame-v1';let records={};try{const v=JSON.parse(localStorage.getItem(storage));if(v&&typeof v==='object'&&!Array.isArray(v))records=v;}catch{}
 let active=false,key='',step=null,lang='en',p=0,revealed=false,paused=true,armed=false,spoken=false,suspended=false,pendingTotal=false,last=performance.now(),savedAt=0,quiet=0,signature='';
 function save(){if(!key)return;records[key]={p:clamp(p),revealed};records=Object.fromEntries(Object.entries(records).slice(-24));try{localStorage.setItem(storage,JSON.stringify(records));}catch{}savedAt=performance.now();}
 function scaffold(){
  const d=remainingData(step),frame=x=>`<rect x="${x}" y="42" width="240" height="100" rx="8" fill="#fff" stroke="#8ca99c"/>${Array.from({length:10},(_,i)=>`<rect x="${x+i%5*48}" y="${42+Math.floor(i/5)*50}" width="48" height="50" fill="none" stroke="#abc0b5"/>`).join('')}`;
  const base=d.method==='count'?`<line x1="38" y1="171" x2="584" y2="171" stroke="#54796b" stroke-width="3"/>${d.ticks.map(t=>`<line x1="${t.x}" y1="165" x2="${t.x}" y2="182" stroke="#54796b"/><text x="${t.x}" y="204" text-anchor="middle" font-size="21">${t.n}</text>`).join('')}<circle cx="${d.startX}" cy="171" r="16" fill="#126d59"/><text x="${d.startX}" y="133" text-anchor="middle" font-size="20">${d.start}</text>`:d.method==='missing'?frame(180):frame(30)+frame(330);
  wrap.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 300" role="img" aria-labelledby="remaining-title"><title id="remaining-title"></title>${base}<text data-caption x="310" y="25" text-anchor="middle" font-size="19" fill="#385951"></text><g data-dots>${remainingFrame(step,p,revealed).map(c=>`<circle data-counter="${c.id}" data-group="${c.group}" r="16" fill="${c.group==='start'?'#126d59':'#b67924'}"/>`).join('')}</g><text data-detail x="310" y="244" text-anchor="middle" font-size="20" fill="#385951"></text><text data-formula x="310" y="282" text-anchor="middle" font-size="26" fill="#173d43"></text></svg>`;
 }
 function paint(){
  if(!active||!step)return;const sig=`${key}:${lang}:${revealed}:${p.toFixed(4)}`;if(signature===sig)return;signature=sig;
  const d=remainingData(step),f=lang==='fr';for(const c of remainingFrame(step,p,revealed)){const dot=wrap.querySelector(`[data-counter="${c.id}"]`);if(dot){dot.setAttribute('cx',c.x.toFixed(2));dot.setAttribute('cy',c.y.toFixed(2));}}
  wrap.querySelector('[data-caption]').textContent=step.id==='story'?(f?'Chaque marque représente un objet de l’histoire.':'Each mark represents one object in the story.'):(f?'Observez, expliquez, puis vérifiez.':'Observe, explain, then check.');
  wrap.querySelector('[data-detail]').textContent=!revealed?'':d.method==='ten'?`${sNum(step.b)} = ${d.need} + ${d.rest}`:d.method==='missing'?(f?`${d.answer} jetons à ajouter`:`${d.answer} counters to add`):d.method==='count'?Array.from({length:step.b+1},(_,i)=>step.a+i).join(' → '):d.method==='swap'?`${step.b} + ${step.a} = ${d.total}`:(f?'Les mêmes jetons, réunis.':'The same counters, joined.');
  wrap.querySelector('[data-formula]').textContent=step.missing?`${step.a} + ${revealed?d.answer:'?'} = 10`:`${step.a} + ${step.b} = ${revealed?d.total:'?'}`;
  $('remaining-title').textContent=remainingCard(step).alt[lang]+(revealed?` ; ${d.answer}`:'');
  $('media-heading').textContent=(f?(revealed?'2 · Vérifier la méthode':'1 · Observer le problème'):(revealed?'2 · Check the method':'1 · Observe the problem'));
  $('media-fact').textContent=FACTS[d.method][lang];$('media-fact').hidden=false;
  $('media-source').textContent=f?'Matériel automatique · lié au problème affiché':'Automatic materials · linked to the displayed question';
 }
 function sNum(n){return String(n);}
 function sync(s,phase,scene,l,isPaused,isRevealed){
  if(!supportsRemaining(s)){if(active)save();active=false;wrap.hidden=true;if(root.dataset.materialOwner==='remaining'){delete root.dataset.materialOwner;if(root.dataset.autoCard===step?.id)delete root.dataset.autoCard;}return false;}
  const next=`${window.GEM_RELIABILITY?.sessionId||'starting'}:${s.id}:${s.a}:${s.b}`;const nextReveal=!!isRevealed;
  if(!active)signature='';active=true;
  if(next!==key){save();key=next;step={...s};p=nextReveal?clamp(records[key]?.p):0;armed=nextReveal&&p<1;revealed=nextReveal;pendingTotal=false;suspended=false;signature='';scaffold();}
  if(revealed!==nextReveal){revealed=nextReveal;if(revealed){armed=p<1;quiet=0;}else{p=0;armed=false;}signature='';scaffold();}
  lang=l==='fr'?'fr':'en';const wasPaused=paused;paused=!!isPaused;
  if(!revealed){p=0;armed=false;pendingTotal=false;}
  if(!paused&&!window.GEM_RELIABILITY?.dialogueActive&&suspended){suspended=false;armed=revealed&&p<1;}
  if(!paused&&!suspended&&pendingTotal){p=1;armed=false;pendingTotal=false;}
  if(paused&&!wasPaused)save();root.hidden=false;root.dataset.autoCard=s.id;root.dataset.materialOwner='remaining';wrap.hidden=false;$('counters').hidden=true;$('media-picture').hidden=true;$('media-clip').pause();$('media-clip').hidden=true;paint();return true;
 }
 addEventListener('gem-avatar-speaking',e=>{spoken=!!e.detail?.speaking;});
 addEventListener('gem-remaining-speech',e=>{if(!active||!revealed||e.detail?.id!==step.id||e.detail.a!==step.a||e.detail.b!==step.b||window.GEM_RELIABILITY?.dialogueActive)return;suspended=false;if(e.detail.cue==='move'){armed=true;quiet=0;}if(e.detail.cue==='total'){if(paused)pendingTotal=true;else{p=1;armed=false;save();paint();}}});
 const interrupt=()=>{if(active&&revealed){suspended=true;save();}};
 $('answer').addEventListener('input',interrupt,true);$('answer-form').addEventListener('submit',interrupt,true);document.addEventListener('gem-final-answer',interrupt,true);$('mic').addEventListener('click',interrupt,true);
 $('play').addEventListener('click',()=>{if(active&&window.GEM_PILOT?.paused){suspended=false;armed=revealed&&p<1;}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();last=performance.now();});addEventListener('pagehide',save);
 const timer=setInterval(()=>{
  const now=performance.now(),dt=Math.min(150,now-last);last=now;if(!active||!revealed||p>=1)return;
  const input=$('answer');if(paused||document.hidden||suspended||window.GEM_RELIABILITY?.dialogueActive||window.GEM_RELIABILITY?.busy||document.querySelector('dialog[open]')||input.value.trim()||document.activeElement===input)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){p=1;armed=false;paint();save();return;}
  if(armed){if(spoken||window.GEM_PILOT?.speechPending)quiet=0;else quiet+=dt;p=clamp(p+dt/6500);paint();if(now-savedAt>500||p===1)save();}
 },50);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 Object.defineProperty(window,'GEM_AUTO_REMAINING',{get:()=>({version:'all-questions-v1',active,key,progress:p,paused,armed,suspended,answerVisible:revealed,method:active?remainingData(step).method:null,mediaCount:active?2:0,language:lang,step:step?{id:step.id,a:step.a,b:step.b,missing:!!step.missing}:null,networkRequests:0})});
 return {sync,busy:()=>active&&revealed&&armed&&!paused&&!suspended&&p<1};
}
