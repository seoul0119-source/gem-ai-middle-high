import {test} from 'node:test';import assert from 'node:assert/strict';import {handleMaterials,validMaterial,materialFormatIssues} from '../lib/materials-ai.js';import catalog from '../lib/material-catalog.json' with {type:'json'};
const fixture={title:'Review',questions:Array.from({length:10},(_,i)=>({prompt:`What is ${i}+1?`,choices:[String(i+1),'30','40','50'],answerIndex:0,hints:['Add one.','Count the next number.'],explanation:`${i}+1=${i+1}`}))};
test('credit exhaustion is distinguished from temporary rate limits, without retrying or leaking provider messages',async()=>{
 const saved=globalThis.fetch;
 try{for(const code of ['credit_balance_exhausted','rate_limit_exceeded']){
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{code,message:'private provider details'}},{status:429});};
  await assert.rejects(handleMaterials({mode:'generate',courseId:'materials-en-sat-reading-writing',topic:'words in context'}),error=>{
   assert.equal(error.name,'AiServiceError');assert.equal(error.payload.code,code==='credit_balance_exhausted'?'ai_credit_exhausted':'ai_rate_limited');assert.equal(error.payload.retryable,code!=='credit_balance_exhausted');assert.ok(!JSON.stringify(error.payload).includes('private provider details'));return true;
  });assert.equal(calls,1);
 }}finally{globalThis.fetch=saved;}
});
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
test('sheet-wide malformed hints are repaired as student text and independently reviewed without hiding defects',async()=>{
 const saved=globalThis.fetch,requests=[];
 const malformed=structuredClone(fixture);
 for(const q of malformed.questions)q.hints=['explanation**: '+q.hints[0],q.hints[1]];
 const issue={question:0,reason:'All first hints contain editorial field labels',fix:'Rewrite both hints for every question as finished indirect clues'};
 const responses=[malformed,{valid:false,issues:[issue]},fixture,{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  const result=await handleMaterials({mode:'generate',courseId:'materials-en-sat-reading-writing',topic:'words in context'});
  assert.equal(requests.length,4);
  assert.deepEqual(JSON.parse(requests[1].input[0].content),malformed);
  assert.deepEqual(JSON.parse(requests[2].input[0].content),{worksheet:malformed,issues:[issue]});
  assert.deepEqual(JSON.parse(requests[3].input[0].content),fixture);
  assert.deepEqual(result.material,fixture);
  for(const request of [requests[0],requests[2]]){
   assert.match(request.instructions,/rewrite both hints for all ten questions/);
   assert.match(request.instructions,/must not define, quote or paraphrase the correct option/);
   assert.match(request.text.format.schema.properties.questions.items.properties.hints.items.description,/finished student-facing/);
  }
 }finally{globalThis.fetch=saved;}
});

test('excluded topics in Korean, English and French are blocked before generation',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not call provider');};
 try{for(const topic of ['인류의 진화','Darwin and natural selection','La sélection naturelle'])await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic}),/제외된 주제/);}finally{globalThis.fetch=saved;}
});
test('format checks preserve text, count, uniqueness and answer-index limits with content-free feedback',()=>{
 for(const mutate of [v=>v.title=' ',v=>v.questions.pop(),v=>v.questions[1].prompt=v.questions[0].prompt,v=>v.questions[0].prompt='x'.repeat(1401),v=>v.questions[0].choices[1]=v.questions[0].choices[0],v=>v.questions[0].choices[0]='É'.repeat(221),v=>v.questions[0].answerIndex=4,v=>v.questions[0].hints.pop(),v=>v.questions[0].hints[0]='x'.repeat(351),v=>v.questions[0].explanation='x'.repeat(901),v=>v.questions[0]=null]){
  const value=structuredClone(fixture);mutate(value);assert.equal(validMaterial(value),false);assert.ok(materialFormatIssues(value).length);
  assert.ok(!JSON.stringify(materialFormatIssues(value)).includes('É'.repeat(221)));
 }
 assert.equal(validMaterial(fixture),true);
});
test('a malformed worksheet gets one format repair and must then pass independent content review',async()=>{
 const saved=globalThis.fetch,requests=[],bad=structuredClone(fixture);bad.questions[0].choices[0]='É'.repeat(221);
 const responses=[bad,fixture,{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:'materials-fr-bac-argumentation',topic:'Argument et exemple'})).material,fixture);
  assert.equal(requests.length,3);assert.match(requests[1].input[0].content,/choices\[0\]/);assert.match(requests[1].input[0].content,/220 characters/);
  assert.match(requests[2].instructions,/Independently solve/);assert.deepEqual(JSON.parse(requests[2].input[0].content),fixture);
 }finally{globalThis.fetch=saved;}
});
test('format repair does not bypass rejection or allow a second repair',async()=>{
 const saved=globalThis.fetch,bad=structuredClone(fixture);bad.questions[0].choices[0]='x'.repeat(221);
 try{
  for(const responses of [[bad,bad],[bad,fixture,{valid:false,issues:[{question:1,reason:'Incorrect answer',fix:'Recalculate'}]}]]){
   const expected=responses.length;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({output_text:JSON.stringify(responses.shift())});};
   await assert.rejects(handleMaterials({mode:'generate',courseId:'materials-fr-bac-argumentation',topic:'Argument et exemple'}),/검사|검토/);assert.equal(calls,expected);
  }
 }finally{globalThis.fetch=saved;}
});
test('excluded distractors and explanations are rejected before a worksheet can be saved',async()=>{
 const saved=globalThis.fetch;
 try{for(const [field,value] of [['choices','공통 조상'],['hints','human evolution'],['explanation','théorie de l’évolution']]){const bad=structuredClone(fixture);if(Array.isArray(bad.questions[0][field]))bad.questions[0][field][0]=value;else bad.questions[0][field]=value;globalThis.fetch=async()=>Response.json({output_text:JSON.stringify(bad)});await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포'}),/교육 기준/);}}finally{globalThis.fetch=saved;}
});
