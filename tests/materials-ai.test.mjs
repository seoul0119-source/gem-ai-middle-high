import {test} from 'node:test';import assert from 'node:assert/strict';import {handleMaterials,validMaterial} from '../lib/materials-ai.js';import catalog from '../lib/material-catalog.json' with {type:'json'};
const fixture={title:'Review',questions:Array.from({length:10},(_,i)=>({prompt:`What is ${i}+1?`,choices:[String(i+1),'30','40','50'],answerIndex:0,hints:['Add one.','Count the next number.'],explanation:`${i}+1=${i+1}`}))};
test('SAT, ACT, IB and Bac pathways generate, review and tutor with their selected preparation scope',async()=>{
 const courses=catalog.filter(c=>c.practiceFocus);
 assert.equal(courses.length,15);
 assert.equal(new Set(catalog.map(c=>c.id)).size,catalog.length);
 for(const prefix of ['materials-en-sat-','materials-en-act-','materials-en-ib-','materials-fr-bac-'])assert.ok(courses.some(c=>c.id.startsWith(prefix)));
 const saved=globalThis.fetch;
 try{for(const course of courses){
  const requests=[];
  globalThis.fetch=async(_url,o)=>{const b=JSON.parse(o.body);requests.push(b);return Response.json({output_text:requests.length===3?'Method explanation':JSON.stringify(requests.length===1?fixture:{valid:true,issues:[]})});};
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:course.id,topic:''})).material,fixture);
  assert.equal((await handleMaterials({mode:'tutor',courseId:course.id,question:fixture.questions[0],message:'Explain the method.'})).text,'Method explanation');
  for(const r of requests){assert.ok(r.instructions.includes(course.practiceFocus));assert.ok(r.instructions.includes(course.subject));}
  assert.ok(requests[0].instructions.includes(course.language==='fr'?'in French':'in English'));
  assert.ok(requests[1].instructions.includes('not a full official exam'));
 }}finally{globalThis.fetch=saved;}
});
test('catalog covers Korean middle science and EN/FR grades and material is independently reviewed',async()=>{
 assert.ok(catalog.find(c=>c.id==='m1-science'));for(const language of ['ko','en','fr'])assert.ok(catalog.some(c=>c.language===language));assert.equal(validMaterial(fixture),true);
 const saved=globalThis.fetch;const requests=[];globalThis.fetch=async(_url,o)=>{const b=JSON.parse(o.body);requests.push(b);return Response.json({output_text:JSON.stringify(requests.length===1?fixture:{valid:true})});};
 try{const result=await handleMaterials({mode:'generate',courseId:'m1-science',topic:'상태 변화'});assert.deepEqual(result.material,fixture);assert.equal(requests.length,2);assert.match(requests[1].instructions,/Independently solve/);}finally{globalThis.fetch=saved;}
});
test('review feedback repairs the candidate and independently checks it again',async()=>{
 const saved=globalThis.fetch,requests=[];const fixed=structuredClone(fixture);fixed.title='Corrected worksheet';
 const responses=[fixture,{valid:false,issues:[{question:1,reason:'Ambiguous option',fix:'Make the choices distinct'}]},fixed,{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{const r=await handleMaterials({mode:'generate',courseId:'m2-history',topic:'4.19 혁명'});assert.equal(r.material.title,fixed.title);assert.equal(requests.length,4);assert.match(requests[2].input[0].content,/Ambiguous option/);assert.match(requests[1].instructions,/ordinary factual knowledge/);}finally{globalThis.fetch=saved;}
});
test('a second failed review never returns an unapproved printable worksheet',async()=>{
 const saved=globalThis.fetch;let count=0;globalThis.fetch=async()=>Response.json({output_text:JSON.stringify(++count%2?fixture:{valid:false,issues:[{question:1,reason:'Wrong date',fix:'Correct it'}]})});
 try{await assert.rejects(handleMaterials({mode:'generate',courseId:'m2-history',topic:'4.19 혁명'}),/자동 수정.*검토/);assert.equal(count,4);}finally{globalThis.fetch=saved;}
});

test('excluded topics in Korean, English and French are blocked before generation',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not call provider');};
 try{for(const topic of ['인류의 진화','Darwin and natural selection','La sélection naturelle'])await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic}),/제외된 주제/);}finally{globalThis.fetch=saved;}
});
test('excluded distractors and explanations are rejected before a worksheet can be saved',async()=>{
 const saved=globalThis.fetch;
 try{for(const [field,value] of [['choices','공통 조상'],['hints','human evolution'],['explanation','théorie de l’évolution']]){const bad=structuredClone(fixture);if(Array.isArray(bad.questions[0][field]))bad.questions[0][field][0]=value;else bad.questions[0][field]=value;globalThis.fetch=async()=>Response.json({output_text:JSON.stringify(bad)});await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포'}),/교육 기준/);}}finally{globalThis.fetch=saved;}
});
