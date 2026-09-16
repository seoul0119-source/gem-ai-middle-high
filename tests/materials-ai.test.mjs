import {test} from 'node:test';import assert from 'node:assert/strict';import {handleMaterials,validMaterial} from '../lib/materials-ai.js';import catalog from '../lib/material-catalog.json' with {type:'json'};
const fixture={title:'Review',questions:Array.from({length:10},(_,i)=>({prompt:`What is ${i}+1?`,choices:[String(i+1),'30','40','50'],answerIndex:0,hints:['Add one.','Count the next number.'],explanation:`${i}+1=${i+1}`}))};
test('catalog covers Korean middle science and EN/FR grades and material is independently reviewed',async()=>{
 assert.ok(catalog.find(c=>c.id==='m1-science'));for(const language of ['ko','en','fr'])assert.ok(catalog.some(c=>c.language===language));assert.equal(validMaterial(fixture),true);
 const saved=globalThis.fetch;const requests=[];globalThis.fetch=async(_url,o)=>{const b=JSON.parse(o.body);requests.push(b);return Response.json({output_text:JSON.stringify(requests.length===1?fixture:{valid:true})});};
 try{const result=await handleMaterials({mode:'generate',courseId:'m1-science',topic:'상태 변화'});assert.deepEqual(result.material,fixture);assert.equal(requests.length,2);assert.match(requests[1].instructions,/Independently solve/);}finally{globalThis.fetch=saved;}
});
test('review rejects flawed sets without returning a printable worksheet',async()=>{
 const saved=globalThis.fetch;let count=0;globalThis.fetch=async()=>Response.json({output_text:JSON.stringify(++count===1?fixture:{valid:false})});try{await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:''}),/검토/);}finally{globalThis.fetch=saved;}
});

test('excluded topics in Korean, English and French are blocked before generation',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not call provider');};
 try{for(const topic of ['인류의 진화','Darwin and natural selection','La sélection naturelle'])await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic}),/제외된 주제/);}finally{globalThis.fetch=saved;}
});
test('excluded distractors and explanations are rejected before a worksheet can be saved',async()=>{
 const saved=globalThis.fetch;
 try{for(const [field,value] of [['choices','공통 조상'],['hints','human evolution'],['explanation','théorie de l’évolution']]){const bad=structuredClone(fixture);if(Array.isArray(bad.questions[0][field]))bad.questions[0][field][0]=value;else bad.questions[0][field]=value;globalThis.fetch=async()=>Response.json({output_text:JSON.stringify(bad)});await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포'}),/교육 기준/);}}finally{globalThis.fetch=saved;}
});
