import assert from 'node:assert/strict';
import {COURSES,LANGS,getCourse,getUnit} from './curriculum.mjs';
import {validateLesson,choiceFor,savedSession,VERSION} from './core.mjs';
import {label} from './labels.mjs';
import {runProgramme} from '../../api/mission-programme.js';
import {fixture} from './fixture.mjs';
assert.equal(COURSES.length,42);assert.equal(COURSES.flatMap(x=>x.units).length,168);const ids=new Set();for(const c of COURSES){assert.equal(c.units.length,4);for(const u of c.units){assert.ok(!ids.has(u.id));ids.add(u.id);for(const l of LANGS)assert.ok(u.title[l]?.trim());}}
for(let g=1;g<=12;g++){for(const s of ['math','science','english'])assert.ok(getCourse(s,g));assert.equal(!!getCourse('world-history',g),g>=7);}assert.equal(getUnit('invented'),null);
for(const l of LANGS)for(const k of ['units','generate','draftNotice','end','resume','cancel','languageChanged'])assert.ok(label(l,k));
const pack=fixture();assert.ok(validateLesson(pack,'science-g2-u1'));assert.equal(validateLesson(pack,'world-history-g2-u1'),false);
for(const mutate of [p=>p.steps.pop(),p=>delete p.steps[0].text.ur,p=>p.steps[1].answerIndex=3,p=>p.steps[1].text.fr.options.pop(),p=>p.steps[0].kind='question']){const p=structuredClone(pack);mutate(p);assert.equal(validateLesson(p,'science-g2-u1'),false);}
assert.equal(choiceFor('२',['2','4','6']),0);assert.equal(choiceFor('۲',['2','4','6']),0);assert.equal(choiceFor('B',['2','4','6']),1);assert.equal(choiceFor('Why is 2 different?',['2','4','6']),-1);assert.equal(choiceFor('3',['2','4','6']),-1);
assert.ok(savedSession({version:VERSION,lang:'ur',unitId:'science-g2-u1',lesson:pack,index:3}));
let calls=0,request;const fetchImpl=async(url,options)=>{calls++;request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(pack)}]}]})};};
assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'sw'},{key:'fixture-key',fetchImpl})).status,200);assert.equal(calls,1);assert.equal(request.store,false);assert.ok(request.instructions.includes('SAME numbers'));
assert.equal((await runProgramme({action:'lesson',unitId:'world-history-g2-u1',lang:'en'},{key:'fixture-key',fetchImpl})).status,400);assert.equal(calls,1);
assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'en'},{key:'',fetchImpl})).status,503);
const bad=async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]})});assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'en'},{key:'fixture-key',fetchImpl:bad})).status,502);
console.log('PASS: 42 courses, 168 unique five-language units, history grade floor, strict lesson validation, numeric answer ambiguity, provider contract and failure handling.');
