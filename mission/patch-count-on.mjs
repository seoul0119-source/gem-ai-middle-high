// Apply only after the complete f1a3e1c fullscreen/dialogue build has passed.
import fs from 'node:fs/promises';
const out='mission-dist';
function once(s,a,b){if(s.split(a).length!==2)throw Error('Count-on anchor changed: '+a.slice(0,120));return s.replace(a,b);}
await fs.copyFile('mission/auto-count-on.mjs',out+'/auto-count-on.mjs');
// Both cards share the same heading/fact nodes. Repaint JOIN text when reactivated.
let join=await fs.readFile(out+'/auto-join.mjs','utf8');join=once(join,'  active=true;const next=',"  if(!active)signature='';active=true;const next=");await fs.writeFile(out+'/auto-join.mjs',join);
let lessons=await fs.readFile(out+'/reliable-lessons.mjs','utf8');
lessons="import {supportsCountOn,countOnCard,installAutoCountOn} from './auto-count-on.mjs';\n"+lessons;
lessons=once(lessons,'if(supportsJoin(s))return joinCard(s);','if(supportsJoin(s))return joinCard(s);if(supportsCountOn(s))return countOnCard(s);');
lessons=once(lessons,'const autoJoin=installAutoJoin(root);','const autoJoin=installAutoJoin(root);const autoCountOn=installAutoCountOn(root);');
lessons=once(lessons,'if(autoJoin.sync(active.find(s=>s.id===id),phase,scene,lang,isPaused,revealed)){','const step=active.find(s=>s.id===id);const joinActive=autoJoin.sync(step,phase,scene,lang,isPaused,revealed);const countActive=autoCountOn.sync(step,phase,scene,lang,isPaused,revealed);if(joinActive||countActive){');
lessons=once(lessons,'busy:()=>autoJoin.busy()||','busy:()=>autoCountOn.busy()||autoJoin.busy()||');
await fs.writeFile(out+'/reliable-lessons.mjs',lessons);
let input=await fs.readFile(out+'/interaction-support.mjs','utf8');
input="import {countOnReply,countOnContext} from './auto-count-on.mjs';\n"+input;
input=once(input,'const materialReply=joinReply(result,s,lang,state().reveal);','const materialReply=countOnReply(result,s,lang,state().reveal)??joinReply(result,s,lang,state().reveal);');
input=once(input,'joinContext(s,state().reveal)','(countOnContext(s,state().reveal)||joinContext(s,state().reveal))');
await fs.writeFile(out+'/interaction-support.mjs',input);
let app=await fs.readFile(out+'/app.mjs','utf8');app="import {emitCountOnCue} from './auto-count-on.mjs';\n"+app;app=once(app,'emitJoinCue(u.text,current());','emitJoinCue(u.text,current());emitCountOnCue(u.text,current());');await fs.writeFile(out+'/app.mjs',app);
let sw=await fs.readFile(out+'/sw.js','utf8');sw=once(sw,'gem-group-fullscreen-exit-v1','gem-group-auto-media-002-v2');sw=once(sw,"'./auto-join.mjs'","'./auto-join.mjs','./auto-count-on.mjs'");await fs.writeFile(out+'/sw.js',sw);
let html=await fs.readFile(out+'/index.html','utf8');html=once(html,'초2 전체 화면 나가기 수정 · 수업·대화 기능 유지','초2 자동 자료 002 · 이어 세기 · 영어/프랑스어 공용');await fs.writeFile(out+'/index.html',html);
