// Extend the saved Make ten work; never rewrite another window's branch or remove prior gates.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out='mission-dist';
function once(text,from,to){if(text.split(from).length!==2)throw Error('All-question anchor changed: '+from.slice(0,120));return text.replace(from,to);}
for(const name of ['auto-remaining.mjs','all-questions-tests.mjs','all-questions-browser-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+name],{stdio:'inherit'});
execFileSync(process.execPath,['mission/all-questions-tests.mjs'],{stdio:'inherit'});
await import('./build-make-ten.mjs');
await fs.copyFile('mission/auto-remaining.mjs',out+'/auto-remaining.mjs');
let lessons=await fs.readFile(out+'/reliable-lessons.mjs','utf8');
lessons="import {supportsRemaining,remainingCard,installRemaining} from './auto-remaining.mjs';\n"+lessons;
lessons=once(lessons,'if(supportsMakeTen(s))return makeTenCard(s);','if(supportsMakeTen(s))return makeTenCard(s);if(supportsRemaining(s))return remainingCard(s);');
lessons=once(lessons,'const autoMakeTen=installAutoMakeTen(root);','const autoMakeTen=installAutoMakeTen(root);const autoRemaining=installRemaining(root);');
lessons=once(lessons,'if(joinActive||countActive||tenActive){','const remainingActive=autoRemaining.sync(step,phase,scene,lang,isPaused,revealed);if(joinActive||countActive||tenActive||remainingActive){');
lessons=once(lessons,'busy:()=>autoMakeTen.busy()||','busy:()=>autoRemaining.busy()||autoMakeTen.busy()||');
await fs.writeFile(out+'/reliable-lessons.mjs',lessons);
let input=await fs.readFile(out+'/interaction-support.mjs','utf8');
input="import {remainingReply,remainingContext} from './auto-remaining.mjs';\n"+input;
input=once(input,'const materialReply=makeTenReply(','const materialReply=remainingReply(result,s,lang,state().reveal)??makeTenReply(');
input=once(input,'(makeTenContext(s,state().reveal)||countOnContext(s,state().reveal)||joinContext(s,state().reveal))','(remainingContext(s,state().reveal)||makeTenContext(s,state().reveal)||countOnContext(s,state().reveal)||joinContext(s,state().reveal))');
await fs.writeFile(out+'/interaction-support.mjs',input);
let app=await fs.readFile(out+'/app.mjs','utf8');app="import {emitRemainingCue} from './auto-remaining.mjs';\n"+app;
app=once(app,'emitMakeTenCue(u.text,current());','emitMakeTenCue(u.text,current());emitRemainingCue(u.text,current());');
await fs.writeFile(out+'/app.mjs',app);
let sw=await fs.readFile(out+'/sw.js','utf8');sw=once(sw,'gem-group-auto-media-003','gem-group-all-questions-v1');sw=once(sw,"'./auto-make-ten.mjs'","'./auto-make-ten.mjs','./auto-remaining.mjs'");await fs.writeFile(out+'/sw.js',sw);
let html=await fs.readFile(out+'/index.html','utf8');html=once(html,'초2 자동 자료 003 · 10 먼저 만들기 · 영어/프랑스어 공용','초2 자동 자료 1–10 · 모든 문제 연결 · 영어/프랑스어 공용');await fs.writeFile(out+'/index.html',html);
for(const f of ['reliable-lessons.mjs','interaction-support.mjs','app.mjs'])execFileSync(process.execPath,['--check',out+'/'+f],{stdio:'inherit'});
const {makeSession,activateSession,packageFor}=await import('../mission-dist/reliable-lessons.mjs?all-questions=1');
let seed=9025,recent=[],questions=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const roles={};for(let i=0;i<120;i++){const session=makeSession(recent,random);assert.ok(!recent.slice(-12).includes(session.first));recent.push(session.first);activateSession(session.steps);for(const [index,s] of session.steps.slice(1,11).entries()){const material=packageFor(s.id);assert.ok(material,'No material at problem '+(index+1));assert.equal(material.mediaCount,2);assert.equal(material.scenes.length,1);assert.equal(material.step,s.id);for(const lang of ['en','fr']){assert.ok(material.scenes[0][lang]);assert.ok(material.summary[lang]);assert.ok(material.fact[lang]);}roles[s.id]=(roles[s.id]||0)+1;questions++;}}
assert.equal(Object.keys(roles).length,10);
await fs.writeFile(out+'/all-questions-coverage.json',JSON.stringify({version:'all-questions-v1',status:'PASS',sessions:120,questions,roles,scope:'GEM common Grade 2 addition within 20, all ten generated questions; not all Grade 2 units'},null,2));
console.log('ALL QUESTION COVERAGE PASS',JSON.stringify({sessions:120,questions,roles}));
await import('./all-questions-browser-tests.mjs');
