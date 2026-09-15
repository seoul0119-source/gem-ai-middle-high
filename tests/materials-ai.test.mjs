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
