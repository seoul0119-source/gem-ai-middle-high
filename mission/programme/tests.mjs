import assert from 'node:assert/strict';
import {excludedContent,scopeReply} from './content-policy.mjs';
import {COURSES,LANGS,getCourse,getUnit} from './curriculum.mjs';
import {validateLesson,choiceFor,savedSession,VERSION} from './core.mjs';
import {label} from './labels.mjs';
import {runProgramme,applyReview} from '../../api/mission-programme.js';
import {fixture} from './fixture.mjs';
assert.equal(COURSES.length,42);assert.equal(COURSES.flatMap(x=>x.units).length,168);const ids=new Set();for(const c of COURSES){assert.equal(c.units.length,4);for(const u of c.units){assert.ok(!ids.has(u.id));ids.add(u.id);for(const l of LANGS)assert.ok(u.title[l]?.trim());}}
for(let g=1;g<=12;g++){for(const s of ['math','science','english'])assert.ok(getCourse(s,g));assert.equal(!!getCourse('world-history',g),g>=7);}assert.equal(getUnit('invented'),null);
for(const l of LANGS)for(const k of ['units','generate','draftNotice','end','resume','cancel','languageChanged'])assert.ok(label(l,k));
const pack=fixture();assert.ok(validateLesson(pack,'science-g2-u1'));assert.equal(validateLesson(pack,'world-history-g2-u1'),false);
for(const mutate of [p=>p.steps.pop(),p=>delete p.steps[0].text.ur,p=>p.steps[1].answerIndex=3,p=>p.steps[1].text.fr.options.pop(),p=>p.steps[0].kind='question']){const p=structuredClone(pack);mutate(p);assert.equal(validateLesson(p,'science-g2-u1'),false);}
assert.equal(choiceFor('२',['2','4','6']),0);assert.equal(choiceFor('۲',['2','4','6']),0);assert.equal(choiceFor('B',['2','4','6']),1);assert.equal(choiceFor('Why is 2 different?',['2','4','6']),-1);assert.equal(choiceFor('3',['2','4','6']),-1);
assert.ok(savedSession({version:VERSION,lang:'ur',unitId:'science-g2-u1',lesson:pack,index:3}));
let calls=0,request;const fetchImpl=async(url,options)=>{calls++;request=JSON.parse(options.body);if(request.text.format.name==='gem_lesson_review')return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({approved:true,answerIndices:[-1,1,-1,1,1,-1]})}]}]})};return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(pack)}]}]})};};
assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'sw'},{key:'fixture-key',fetchImpl})).status,200);assert.equal(calls,2);assert.equal(request.store,false);assert.ok(request.instructions.includes('independent lesson reviewer'));assert.ok(!request.input.includes('answerIndex'));
assert.equal((await runProgramme({action:'lesson',unitId:'world-history-g2-u1',lang:'en'},{key:'fixture-key',fetchImpl})).status,400);assert.equal(calls,2);
assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'en'},{key:'',fetchImpl})).status,503);
const bad=async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]})});assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'en'},{key:'fixture-key',fetchImpl:bad})).status,502);
console.log('PASS: 42 courses, 168 unique five-language units, history grade floor, strict lesson validation, numeric answer ambiguity, provider contract and failure handling.');

// Exclusions must apply to every language and every lesson field, including
// hidden answers, cached sessions and provider follow-up output.
const excluded={en:'natural selection',fr:'évolution',ne:'प्राकृतिक छनोट',ur:'قدرتی انتخاب',sw:'mageuzi ya binadamu'};
for(const [lang,term] of Object.entries(excluded)){
 assert.ok(excludedContent(term),lang);
 for(const field of ['narration','prompt','explanation','options','board']){
  const rejected=structuredClone(pack);const text=rejected.steps[1].text[lang];
  if(Array.isArray(text[field]))text[field][0]=term;else text[field]=term;
  assert.equal(validateLesson(rejected,'science-g2-u1'),false,lang+field);
  assert.equal(savedSession({version:VERSION,lang,unitId:'science-g2-u1',lesson:rejected,index:0}),false);
 }
 assert.ok(!excludedContent(scopeReply(lang)));
}
for(const text of ['Darwinism','common ancestry','human evolution','sélection naturelle','ancêtres communs','विकासवाद','ارتقاء','nadharia ya mageuzi','uteuzi wa asili','진화론'])assert.ok(excludedContent(text),text);
for(const text of ['Plants need water.','La révolution industrielle','बिरुवाको विकास','بڑھتے ہوئے پودے','Mageuzi ya kisiasa'])assert.equal(excludedContent(text),false,text);
const fake=value=>async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
const unsafe=structuredClone(pack);unsafe.steps[5].text.sw.board=['uteuzi wa asili'];
assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'en'},{key:'test',fetchImpl:fake(unsafe)})).code,'invalid_lesson');
const question={action:'question',unitId:'science-g2-u1',lang:'fr',lesson:pack,index:0,question:'Help me understand this lesson'};
assert.equal((await runProgramme(question,{key:'test',fetchImpl:fake({answer:'La sélection naturelle'})})).answer,scopeReply('fr'));
assert.equal((await runProgramme({...question,question:'Explain common ancestry'},{key:'test',fetchImpl:()=>{throw Error('Provider must not be called');}})).answer,scopeReply('fr'));
assert.equal((await runProgramme(question,{key:'test',fetchImpl:fake({answer:'Les plantes ont besoin d’eau.'})})).answer,'Les plantes ont besoin d’eau.');
assert.equal(COURSES.some(excludedContent),false,'Static curriculum contains an excluded topic');
console.log('PASS: selected syllabus across five languages, all lesson fields, saved sessions, generation and follow-up answers.');

const wrongKey=structuredClone(pack);wrongKey.steps[4].answerIndex=2;
assert.equal(applyReview(wrongKey,{approved:true,answerIndices:[-1,1,-1,1,1,-1]}),true);assert.equal(wrongKey.steps[4].answerIndex,1);
for(const review of [{approved:false,answerIndices:[-1,1,-1,1,1,-1]},{approved:true,answerIndices:[0,1,-1,1,1,-1]},{approved:true,answerIndices:[-1,1,-1,1,3,-1]},{approved:true,answerIndices:[-1,1]}])assert.equal(applyReview(pack,review),false);
const rejectedReview=async(url,options)=>JSON.parse(options.body).text.format.name==='gem_lesson_review'?fake({approved:false,answerIndices:[-1,1,-1,1,1,-1]})():fake(pack)();
assert.equal((await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'en'},{key:'test',fetchImpl:rejectedReview})).code,'review_failed');
console.log('PASS: independent answer review, index correction, rejected ambiguous content, and provider review failures.');
