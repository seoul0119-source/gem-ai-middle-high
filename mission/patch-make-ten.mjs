// Extend the actual Count on output, preserving its full verified build chain.
import fs from 'node:fs/promises';
const out='mission-dist';
function once(s,a,b){if(s.split(a).length!==2)throw Error('Make ten anchor changed: '+a.slice(0,100));return s.replace(a,b);}
await fs.copyFile('mission/auto-make-ten.mjs',out+'/auto-make-ten.mjs');
let lessons=await fs.readFile(out+'/reliable-lessons.mjs','utf8');
lessons="import {supportsMakeTen,makeTenCard,installAutoMakeTen} from './auto-make-ten.mjs';\n"+lessons;
lessons=once(lessons,'if(supportsCountOn(s))return countOnCard(s);','if(supportsCountOn(s))return countOnCard(s);if(supportsMakeTen(s))return makeTenCard(s);');
lessons=once(lessons,'const autoCountOn=installAutoCountOn(root);','const autoCountOn=installAutoCountOn(root);const autoMakeTen=installAutoMakeTen(root);');
lessons=once(lessons,'if(joinActive||countActive){','const tenActive=autoMakeTen.sync(step,phase,scene,lang,isPaused,revealed);if(joinActive||countActive||tenActive){');
lessons=once(lessons,'busy:()=>autoCountOn.busy()||','busy:()=>autoMakeTen.busy()||autoCountOn.busy()||');
await fs.writeFile(out+'/reliable-lessons.mjs',lessons);
let input=await fs.readFile(out+'/interaction-support.mjs','utf8');input="import {makeTenReply,makeTenContext} from './auto-make-ten.mjs';\n"+input;
input=once(input,'const materialReply=countOnReply(','const materialReply=makeTenReply(result,s,lang,state().reveal)??countOnReply(');
input=once(input,'(countOnContext(s,state().reveal)||joinContext(s,state().reveal))','(makeTenContext(s,state().reveal)||countOnContext(s,state().reveal)||joinContext(s,state().reveal))');
await fs.writeFile(out+'/interaction-support.mjs',input);
let app=await fs.readFile(out+'/app.mjs','utf8');app="import {emitMakeTenCue} from './auto-make-ten.mjs';\n"+app;app=once(app,'emitCountOnCue(u.text,current());','emitCountOnCue(u.text,current());emitMakeTenCue(u.text,current());');await fs.writeFile(out+'/app.mjs',app);
let sw=await fs.readFile(out+'/sw.js','utf8');sw=once(sw,'gem-group-auto-media-002-v2','gem-group-auto-media-003');sw=once(sw,"'./auto-count-on.mjs'","'./auto-count-on.mjs','./auto-make-ten.mjs'");await fs.writeFile(out+'/sw.js',sw);
let html=await fs.readFile(out+'/index.html','utf8');html=once(html,'초2 자동 자료 002 · 이어 세기 · 영어/프랑스어 공용','초2 자동 자료 003 · 10 먼저 만들기 · 영어/프랑스어 공용');await fs.writeFile(out+'/index.html',html);
