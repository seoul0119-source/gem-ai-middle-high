import {joinClip} from './media/join-clip.mjs';
// Content identity is independent of teaching language and national alignment.
export const firstPackage={id:'gem-g2-math-join-4-3',step:'join',version:1,scenes:[
 {kind:'image',en:'Look at the picture. Four green counters form one group. Three gold counters form another group. Each counter represents one object.',fr:'Regardez l’image. Quatre jetons verts forment un groupe. Trois jetons dorés forment un autre groupe. Chaque jeton représente un objet.'},
 {kind:'video',en:'Watch the two groups move together. No counter disappears, and no new counter is added. We are joining the same objects into one group.',fr:'Regardez les deux groupes se réunir. Aucun jeton ne disparaît et aucun nouveau jeton n’est ajouté. Nous réunissons les mêmes objets en un seul groupe.'},
 {kind:'fact',en:'Here is an important idea. Moving objects does not change how many there are. Touch each counter once as you count. Now we are ready to find the total.',fr:'Voici une idée importante. Déplacer les objets ne change pas leur nombre. Touchez chaque jeton une seule fois en comptant. Nous pouvons maintenant chercher le total.'}
]};
const points=[[100,80],[165,80],[100,145],[165,145],[350,80],[415,80],[380,145]];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 230"><rect width="520" height="230" rx="18" fill="#edf6ef"/>${points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="22" fill="${i<4?'#126d59':'#b67924'}"/>`).join('')}<text x="260" y="125" text-anchor="middle" font-size="42" fill="#173d43">+</text></svg>`;
export function installLessonMedia(){
 const root=document.createElement('section');root.id='lesson-media';root.hidden=true;
 root.innerHTML='<h3 id="media-heading"></h3><img id="media-picture"><video id="media-clip" muted playsinline preload="auto"></video><p id="media-fact"></p><small id="media-source"></small>';
 document.getElementById('counters').before(root);
 const img=root.querySelector('img'),video=root.querySelector('video'),fact=root.querySelector('#media-fact');img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);video.src=joinClip;video.muted=true;
 let key='',failed=false,playing=false;
 video.onended=()=>{playing=false;};video.onerror=()=>{failed=true;playing=false;video.hidden=true;img.hidden=false;};
 function sync(step,phase,scene,lang,paused){const active=step===firstPackage.step;root.hidden=!active;document.getElementById('counters').hidden=active;const show=active&&phase==='explain'?firstPackage.scenes[scene]:null;const next=show?show.kind:'overview';
 if(key!==step+':'+next){key=step+':'+next;video.pause();video.currentTime=0;failed=false;playing=false;}
 if(!active){video.pause();playing=false;return;}
 root.querySelector('#media-heading').textContent=lang==='fr'?`Observer ensemble · ${show?scene+1:3}/3`:`Explore together · ${show?scene+1:3}/3`;
 img.alt=lang==='fr'?'Quatre jetons verts et trois jetons dorés':'Four green counters and three gold counters';video.setAttribute('aria-label',lang==='fr'?'Les deux groupes se réunissent':'Two groups joining together');
 img.hidden=!!show&&show.kind==='video'&&!failed;video.hidden=!show||show.kind!=='video'||failed;fact.hidden=!!show&&show.kind!=='fact';fact.textContent=lang==='fr'?'À retenir : déplacer les objets ne change pas leur nombre. Comptez chaque objet une seule fois.':'Remember: moving objects does not change their number. Count each object once.';
 root.querySelector('#media-source').textContent=lang==='fr'?'Illustration et vidéo GEM · même contenu dans les deux langues':'GEM diagram and video · same content in both languages';
 if(paused||video.hidden){video.pause();playing=false;}else if(!video.ended&&!playing){playing=true;video.play().catch(()=>{failed=true;playing=false;video.hidden=true;img.hidden=false;});}
 }
 return {sync,busy:()=>playing&&!video.ended};
}
export function spokenMath(message,lang){
 const en=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
 const fr=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf','vingt'];
 return message.replace(/(\d+)\s*\+\s*\?\s*=\s*(\d+)/g,(_,a,b)=>lang==='fr'?`${a} plus combien font ${b}`:`${a} plus what equals ${b}`).replace(/\b\d{1,2}\b/g,n=>(lang==='fr'?fr:en)[Number(n)]??n).replace(/\+/g,' plus ').replace(/=/g,lang==='fr'?' font ':' equals ').replace(/[“”"]/g,'');
}
