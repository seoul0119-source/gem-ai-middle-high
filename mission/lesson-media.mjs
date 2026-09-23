import {countOnClip} from './media/count-on-clip.mjs';
import {joinClip} from './media/join-clip.mjs';
// Content identity is independent of teaching language and national alignment.
export const firstPackage={id:'gem-g2-math-join-4-3',step:'join',version:1,scenes:[
 {kind:'image',en:'Look at the picture. Four green counters form one group. Three gold counters form another group. Each counter represents one object.',fr:'Regardez l’image. Quatre jetons verts forment un groupe. Trois jetons dorés forment un autre groupe. Chaque jeton représente un objet.'},
 {kind:'video',en:'Watch the two groups move together. No counter disappears, and no new counter is added. We are joining the same objects into one group.',fr:'Regardez les deux groupes se réunir. Aucun jeton ne disparaît et aucun nouveau jeton n’est ajouté. Nous réunissons les mêmes objets en un seul groupe.'},
 {kind:'fact',en:'Here is an important idea. Moving objects does not change how many there are. Touch each counter once as you count. Now we are ready to find the total.',fr:'Voici une idée importante. Déplacer les objets ne change pas leur nombre. Touchez chaque jeton une seule fois en comptant. Nous pouvons maintenant chercher le total.'}
]};
const points=[[100,80],[165,80],[100,145],[165,145],[350,80],[415,80],[380,145]];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 230"><rect width="520" height="230" rx="18" fill="#edf6ef"/>${points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="22" fill="${i<4?'#126d59':'#b67924'}"/>`).join('')}<text x="260" y="125" text-anchor="middle" font-size="42" fill="#173d43">+</text></svg>`;
const pair=(en,fr)=>({en,fr});
const numberLine=(a)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 230"><rect width="520" height="230" rx="18" fill="#edf6ef"/><path d="M55 145H465" stroke="#173d43" stroke-width="4"/>${[0,1,2].map(i=>`<path d="M${80+180*i} 135v20" stroke="#173d43" stroke-width="4"/><text x="${80+180*i}" y="190" text-anchor="middle" font-size="32" fill="#173d43">${a+i}</text>`).join('')}<path d="M80 120Q170 15 260 120M260 120Q350 15 440 120" fill="none" stroke="#b67924" stroke-width="5"/><text x="170" y="55" text-anchor="middle" font-size="26">+1</text><text x="350" y="55" text-anchor="middle" font-size="26">+1</text></svg>`;
firstPackage.image=svg;firstPackage.clip=joinClip;
firstPackage.alt=pair('Four green counters and three gold counters','Quatre jetons verts et trois jetons dorés');
firstPackage.fact=pair('Moving objects does not change their number. Count each object once.','Déplacer les objets ne change pas leur nombre. Comptez chaque objet une seule fois.');
firstPackage.summary=pair('Four plus three equals seven. We joined two groups. Do you have a question? Ask what adding means, or ask for another explanation.','Quatre plus trois font sept. Nous avons réuni deux groupes. Avez-vous une question ? Demandez ce que veut dire additionner, ou demandez une autre explication.');
export const countOnPackage={id:'gem-g2-math-count-on-8-2',step:'count-on',version:1,image:numberLine(8),exampleImage:numberLine(6),clip:countOnClip,
 alt:pair('A number line from eight to ten, with two jumps of one','Une droite de huit à dix, avec deux bonds de un'),
 fact:pair('Keep the starting number. Count only the extra steps: nine, ten.','Gardez le nombre de départ. Comptez seulement les pas ajoutés : neuf, dix.'),
 summary:pair('Eight plus two equals ten. Eight is our starting point, not the first extra step. We counted nine, then ten. Ask why we start at eight, ask for another example, or ask me to explain again.','Huit plus deux font dix. Huit est le point de départ, pas le premier pas ajouté. Nous avons compté neuf, puis dix. Demandez pourquoi on part de huit, un autre exemple, ou une nouvelle explication.'),
 scenes:[
 {kind:'image',en:'We already have eight counters. The number line starts at eight. Adding two means taking two more steps. Look at the two curved arrows. Each arrow shows one extra step.',fr:'Nous avons déjà huit jetons. La droite commence à huit. Ajouter deux, c’est avancer de deux pas. Regardez les deux flèches courbes. Chaque flèche montre un pas ajouté.'},
 {kind:'video',en:'Watch the moving dot. Start at eight. The first jump lands on nine. The second jump lands on ten. Two jumps forward add two. We did not count all eight counters again.',fr:'Regardez le point bouger. Partez de huit. Le premier bond arrive à neuf. Le deuxième arrive à dix. Deux bonds en avant ajoutent deux. Nous n’avons pas recompté les huit premiers jetons.'},
 {kind:'fact',en:'Remember: eight is the starting point. It is not an extra step. Count only the new steps: nine, ten. Show one finger for each step. Two fingers mean two extra steps.',fr:'Retenez ceci : huit est le point de départ. Ce n’est pas un pas ajouté. Comptez seulement les nouveaux pas : neuf, dix. Levez un doigt pour chaque pas. Deux doigts indiquent deux pas ajoutés.'},
 {kind:'example',en:'Here is another example on the picture. Start at six and add two. The first jump reaches seven. The second reaches eight. Six plus two equals eight. Now return to our question: eight plus two.',fr:'Voici un autre exemple sur l’image. Partez de six et ajoutez deux. Le premier bond arrive à sept. Le deuxième arrive à huit. Six plus deux font huit. Revenons maintenant à notre question : huit plus deux.'}
 ],
 activity:pair('Work in pairs. One person places eight counters and keeps that group still. The other adds two counters, one at a time, saying nine and ten. Swap roles. Explain why eight is the starting point, not an extra step.','Travaillez à deux. Une personne pose huit jetons et garde ce groupe en place. L’autre ajoute deux jetons, un à un, en disant neuf puis dix. Échangez les rôles. Expliquez pourquoi huit est le point de départ et non un pas ajouté.')};
export const mediaPackages=[firstPackage,countOnPackage];
export const packageFor=step=>mediaPackages.find(p=>p.step===step);
export function preparedMediaAnswer(step,message,lang){
 if(step!=='count-on')return null;
 const q=message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/why.*(?:eight|8|start|count)|pourquoi.*(?:huit|8|part|compt)|^why[?!. ]*$|^pourquoi[?!. ]*$/.test(q))return lang==='fr'?'Les huit premiers jetons sont déjà comptés. En ajoutant le premier nouveau jeton, on arrive à neuf. Avec le deuxième, on arrive à dix. Compter huit comme un pas ajouté oublierait un nouveau jeton.':'The first eight counters have already been counted. Adding the first new counter brings us to nine. Adding the second brings us to ten. Counting eight as an extra step would miss one new counter.';
 if(/another example|autre exemple|다른 예/.test(q))return lang==='fr'?'Partez de six. Ajoutez un jeton : sept. Ajoutez encore un jeton : huit. Six plus deux font huit. La même méthode donne huit plus deux égale dix.':'Start with six. Add one counter: seven. Add one more: eight. Six plus two equals eight. The same method gives eight plus two equals ten.';
 if(/again|repeat|explain|encore|explique|다시/.test(q))return lang==='fr'?'Gardez huit comme point de départ. Comptez deux pas : neuf, dix. Nous avons ajouté deux, donc huit plus deux font dix.':'Keep eight as the starting point. Count two steps: nine, ten. We added two, so eight plus two equals ten.';
 return null;
}
export function installLessonMedia(){
 const root=document.createElement('section');root.id='lesson-media';root.hidden=true;
 root.innerHTML='<h3 id="media-heading"></h3><img id="media-picture"><video id="media-clip" muted playsinline preload="auto"></video><p id="media-fact"></p><small id="media-source"></small>';
 document.getElementById('counters').before(root);
 const img=root.querySelector('img'),video=root.querySelector('video'),fact=root.querySelector('#media-fact');img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);video.src=joinClip;video.muted=true;
 let key='',failed=false,playing=false;
 video.onended=()=>{playing=false;};video.onerror=()=>{failed=true;playing=false;video.hidden=true;img.hidden=false;};
 function sync(step,phase,scene,lang,paused){const pack=packageFor(step),active=!!pack;root.hidden=!active;document.getElementById('counters').hidden=active;const show=active&&phase==='explain'?pack.scenes[scene]:null;const next=show?String(scene):'overview';
 if(key!==step+':'+next){key=step+':'+next;video.pause();video.currentTime=0;failed=false;playing=false;}
 if(!active){video.pause();playing=false;return;}
 const source=show?.kind==='example'&&pack.exampleImage?pack.exampleImage:pack.image;const imageURL='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source);if(img.src!==imageURL)img.src=imageURL;if(video.getAttribute('src')!==pack.clip)video.src=pack.clip;
 root.querySelector('#media-heading').textContent=lang==='fr'?`Observer ensemble · ${show?scene+1:pack.scenes.length}/${pack.scenes.length}`:`Explore together · ${show?scene+1:pack.scenes.length}/${pack.scenes.length}`;
 img.alt=show?.kind==='example'?(lang==='fr'?'Six plus deux sur une droite graduée':'Six plus two on a number line'):pack.alt[lang];video.setAttribute('aria-label',pack.alt[lang]);
 img.hidden=!!show&&show.kind==='video'&&!failed;video.hidden=!show||show.kind!=='video'||failed;fact.hidden=!!show&&show.kind!=='fact';fact.textContent=pack.fact[lang];
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
