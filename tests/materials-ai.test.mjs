import {test} from 'node:test';import assert from 'node:assert/strict';import {handleMaterials,validMaterial,materialFormatIssues,disclosesMaterialAnswer} from '../lib/materials-ai.js';import catalog from '../lib/material-catalog.json' with {type:'json'};
const fixture={title:'Review',questions:Array.from({length:10},(_,i)=>({prompt:`What is ${i}+1?`,choices:[String(i+1),'30','40','50'],answerIndex:0,hints:['Add one.','Count the next number.'],explanation:`${i}+1=${i+1}`}))};
const replacements=(sheet,...numbers)=>({replacements:numbers.map(number=>({number,question:structuredClone(sheet.questions[number-1])}))});
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
 const saved=globalThis.fetch;const requests=[];globalThis.fetch=async(_url,o)=>{const b=JSON.parse(o.body);requests.push(b);return Response.json({output_text:JSON.stringify(requests.length===1?fixture:{valid:true,issues:[]})});};
 try{const result=await handleMaterials({mode:'generate',courseId:'m1-science',topic:'상태 변화'});assert.deepEqual(result.material,fixture);assert.equal(requests.length,2);assert.match(requests[1].instructions,/Independently solve/);}finally{globalThis.fetch=saved;}
});
test('review feedback repairs only identified questions and independently checks the exact merged worksheet',async()=>{
 const saved=globalThis.fetch,requests=[],original=structuredClone(fixture),fixed=structuredClone(fixture);fixed.questions[0].explanation='Adding one to zero gives one.';
 const issue={question:1,reason:'Ambiguous option',fix:'Make the choices distinct'};
 const responses=[fixture,{valid:false,issues:[issue]},replacements(fixed,1),{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  const r=await handleMaterials({mode:'generate',courseId:'m2-history',topic:'4.19 혁명'});
  assert.deepEqual(r.material,fixed);assert.equal(r.material.title,original.title);assert.deepEqual(r.material.questions.slice(1),original.questions.slice(1));assert.deepEqual(fixture,original);
  assert.equal(requests.length,4);assert.equal(requests[2].text.format.name,'worksheet_repair');assert.match(requests[2].input[0].content,/Ambiguous option/);assert.match(requests[1].instructions,/ordinary factual knowledge/);
  assert.deepEqual(JSON.parse(requests[3].input[0].content),r.material);assert.match(requests[3].instructions,/Independently solve/);
 }finally{globalThis.fetch=saved;}
});
test('a second independently reviewed defect can be repaired, with approval required after both repairs',async()=>{
 const saved=globalThis.fetch,requests=[],once=structuredClone(fixture),twice=structuredClone(fixture);
 once.questions[0].explanation='First corrected explanation.';twice.questions[0]=structuredClone(once.questions[0]);twice.questions[4].hints=['Inspect the relevant evidence.','Compare the remaining alternatives.'];
 const responses=[fixture,{valid:false,issues:[{question:1,reason:'Incorrect explanation',fix:'Recalculate'}]},replacements(once,1),{valid:false,issues:[{question:5,reason:'Hint reveals the answer',fix:'Use indirect hints'}]},replacements(twice,5),{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  const r=await handleMaterials({mode:'generate',courseId:'m2-history',topic:'4.19 혁명'});assert.deepEqual(r.material,twice);assert.equal(requests.length,6);
  assert.deepEqual(requests.filter(r=>r.text.format.name==='worksheet_review').map(r=>JSON.parse(r.input[0].content)),[fixture,once,twice]);
  assert.equal(requests.filter(r=>r.text.format.name==='worksheet_repair').length,2);
 }finally{globalThis.fetch=saved;}
});
test('a third failed independent review never returns an unapproved worksheet or starts a third repair',async()=>{
 const saved=globalThis.fetch,requests=[],verdict={valid:false,issues:[{question:1,reason:'Wrong date',fix:'Correct it'}]};
 const responses=[fixture,verdict,replacements(fixture,1),verdict,replacements(fixture,1),verdict];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));assert.ok(responses.length,'repair budget must stay bounded');return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{await assert.rejects(handleMaterials({mode:'generate',courseId:'m2-history',topic:'4.19 혁명'}),/자동 수정.*검토/);assert.equal(requests.length,6);assert.equal(requests.filter(r=>r.text.format.name==='worksheet_review').length,3);}finally{globalThis.fetch=saved;}
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
 const responses=[bad,replacements(fixture,1),{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:'materials-fr-bac-argumentation',topic:'Argument et exemple'})).material,fixture);
  assert.equal(requests.length,3);assert.match(requests[1].input[0].content,/choices\[0\]/);assert.match(requests[1].input[0].content,/220 characters/);
  assert.match(requests[2].instructions,/Independently solve/);assert.deepEqual(JSON.parse(requests[2].input[0].content),fixture);
 }finally{globalThis.fetch=saved;}
});
test('format repair does not bypass rejection or allow more than two repairs',async()=>{
 const saved=globalThis.fetch,bad=structuredClone(fixture);bad.questions[0].choices[0]='x'.repeat(221);
 const rejected={valid:false,issues:[{question:1,reason:'Incorrect answer',fix:'Recalculate'}]};
 try{
  for(const responses of [[bad,replacements(bad,1),replacements(bad,1)],[bad,replacements(fixture,1),rejected,replacements(fixture,1),rejected]]){
   const expected=responses.length;let calls=0;globalThis.fetch=async()=>{calls++;assert.ok(responses.length,'repair budget must stay bounded');return Response.json({output_text:JSON.stringify(responses.shift())});};
   await assert.rejects(handleMaterials({mode:'generate',courseId:'materials-fr-bac-argumentation',topic:'Argument et exemple'}),/검사|검토/);assert.equal(calls,expected);
  }
 }finally{globalThis.fetch=saved;}
});
test('all deterministic format defects beyond six reach one targeted repair and a complete independent review',async()=>{
 const saved=globalThis.fetch,requests=[],bad=structuredClone(fixture),numbers=[1,2,3,4,5,6,7,8,9,10];
 for(const q of bad.questions)q.choices[0]='É'.repeat(221);
 assert.equal(materialFormatIssues(bad).length,10);assert.deepEqual(materialFormatIssues(bad).map(issue=>issue.question),numbers);
 const responses=[bad,replacements(fixture,...numbers),{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:'materials-fr-bac-argumentation',topic:'Argument et exemple'})).material,fixture);
  assert.equal(requests.length,3);assert.equal(requests[1].text.format.name,'worksheet_repair');
  assert.deepEqual(JSON.parse(requests[1].input[0].content).issues.map(issue=>issue.question),numbers);
  assert.deepEqual(JSON.parse(requests[2].input[0].content),fixture);assert.equal(requests[2].text.format.name,'worksheet_review');
 }finally{globalThis.fetch=saved;}
});
test('duplicate, missing and unauthorized replacement numbers fail closed without reviewing a partial repair',async()=>{
 const saved=globalThis.fetch,issues=[1,3].map(question=>({question,reason:'Incorrect explanation',fix:'Correct the explanation'}));
 const patches=[replacements(fixture,1,1),replacements(fixture,1,7),replacements(fixture,1,1,3),replacements(fixture,1),replacements(fixture,1,3,7),replacements(fixture,1,0),{replacements:[]}];
 try{for(const patch of patches){
  let calls=0;const responses=[fixture,{valid:false,issues},patch];globalThis.fetch=async()=>{calls++;assert.ok(responses.length,'invalid patch must stop before another provider call');return Response.json({output_text:JSON.stringify(responses.shift())});};
  await assert.rejects(handleMaterials({mode:'generate',courseId:'m2-history',topic:'4.19 혁명'}),/문항 수정 응답의 형식/);assert.equal(calls,3);
 }}finally{globalThis.fetch=saved;}
});
test('an excluded topic introduced by a targeted replacement is rejected before another review',async()=>{
 const saved=globalThis.fetch,bad=structuredClone(fixture);bad.questions[0].explanation='human evolution';let calls=0;
 const responses=[fixture,{valid:false,issues:[{question:1,reason:'Unclear explanation',fix:'Clarify the evidence'}]},replacements(bad,1)];
 globalThis.fetch=async()=>{calls++;assert.ok(responses.length,'excluded content must stop before another provider call');return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포'}),/교육 기준/);assert.equal(calls,3);}finally{globalThis.fetch=saved;}
});
test('malformed initial or final review verdicts cannot approve a worksheet or launch an unspecified repair',async()=>{
 const saved=globalThis.fetch;
 try{for(const verdict of [null,{},[],{valid:true},{valid:true,issues:null},{valid:true,issues:{}},{valid:'true',issues:[]},{valid:false,issues:[]}]){for(const finalReview of [false,true]){
  let calls=0;const responses=finalReview?[fixture,{valid:false,issues:[{question:1,reason:'Unclear explanation',fix:'Clarify the evidence'}]},replacements(fixture,1),verdict]:[fixture,verdict];
  const expected=responses.length;globalThis.fetch=async()=>{calls++;assert.ok(responses.length,'malformed review must stop before another provider call');return Response.json({output_text:JSON.stringify(responses.shift())});};
  await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포'}),/문제 검토 응답의 형식/);assert.equal(calls,expected);
 }
 }}finally{globalThis.fetch=saved;}
});
test('an expired caller deadline stops generation before a provider request',async()=>{
 const saved=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('expired deadline must not call provider');};
 try{await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포',deadline:Date.now()-1}),/검토 시간이/);assert.equal(calls,0);}finally{globalThis.fetch=saved;}
});
test('malformed overall question shape uses full-sheet repair before independent review',async()=>{
 const saved=globalThis.fetch,requests=[],bad=structuredClone(fixture);bad.questions.pop();
 const responses=[bad,fixture,{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포'})).material,fixture);assert.equal(requests.length,3);
  assert.equal(requests[1].text.format.name,'gem_material');assert.equal(requests[2].text.format.name,'worksheet_review');assert.deepEqual(JSON.parse(requests[2].input[0].content),fixture);
 }finally{globalThis.fetch=saved;}
});
test('a null GED question is repaired before novelty checking and the whole worksheet is independently reviewed',async()=>{
 const saved=globalThis.fetch,requests=[],distinct=structuredClone(fixture);
 const prompts=['식물 세포에서 광합성을 담당하는 기관은?','물질의 질량을 측정하는 도구는?','물체의 운동 방향을 바꾸는 원인은?','물이 얼 때 일어나는 상태 변화는?','전류가 흐르는 데 필요한 조건은?','생태계에서 생산자에 해당하는 생물은?','소리가 진공에서 전달되지 않는 이유는?','지구의 자전으로 나타나는 현상은?','산성 용액을 확인하는 방법은?','폐에서 산소와 이산화 탄소가 교환되는 장소는?'];
 distinct.questions.forEach((q,i)=>{q.prompt=prompts[i];});const bad=structuredClone(distinct);bad.questions[3]=null;
 const responses=[bad,replacements(distinct,4),{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));assert.ok(responses.length,'valid distinct prompts must not cause another repair');return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:'ged-middle-science',topic:'기초 과학 개념'})).material,distinct);assert.equal(requests.length,3);
  assert.equal(requests[1].text.format.name,'worksheet_repair');assert.deepEqual(JSON.parse(requests[1].input[0].content).issues.map(issue=>issue.question),[4]);
  assert.equal(requests[2].text.format.name,'worksheet_review');assert.deepEqual(JSON.parse(requests[2].input[0].content),distinct);
 }finally{globalThis.fetch=saved;}
});
test('excluded distractors and explanations are rejected before a worksheet can be saved',async()=>{
 const saved=globalThis.fetch;
 try{for(const [field,value] of [['choices','공통 조상'],['hints','human evolution'],['explanation','théorie de l’évolution']]){const bad=structuredClone(fixture);if(Array.isArray(bad.questions[0][field]))bad.questions[0][field][0]=value;else bad.questions[0][field]=value;globalThis.fetch=async()=>Response.json({output_text:JSON.stringify(bad)});await assert.rejects(handleMaterials({mode:'generate',courseId:'m1-science',topic:'세포'}),/교육 기준/);}}finally{globalThis.fetch=saved;}
});

test('generated question progress markers and premature answer labels trigger repair',()=>{
 const bad=structuredClone(fixture);bad.questions[0].prompt='문제 1/10 — 대화를 읽으세요.';bad.questions[1].choices[0]='정답: B';
 const issues=materialFormatIssues(bad);assert.ok(issues.some(i=>i.question===1));assert.ok(issues.some(i=>i.question===2));
 const math=structuredClone(fixture);math.questions[0].prompt='Calculate 1/10 + 3/10.';assert.equal(materialFormatIssues(math).length,0);
});
test('ordinary classes use fresh variation and reject previously studied prompts before independent review',async()=>{
 const saved=globalThis.fetch,requests=[],previous='What is 0+1?',fresh=structuredClone(fixture);fresh.questions[0].prompt='A map scale compares which two measurements?';
 // All numeric variants in the fixture must be replaced by genuinely distinct tasks.
 fresh.questions.forEach((q,i)=>q.prompt=['A map uses a scale. What does it compare?','Which material conducts electricity?','Why does ice melt in sunlight?','Where do roots absorb water?','Which organ pumps blood?','What causes a shadow outdoors?','How does a magnet attract iron?','What happens when water evaporates?','Which planet is closest to the Sun?','Why do we measure volume?'][i]);
 const responses=[fixture,{replacements:fresh.questions.map((question,i)=>({number:i+1,question}))},{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{assert.deepEqual((await handleMaterials({mode:'generate',courseId:'m1-science',topic:'',variation:'fresh-session',noveltyHistory:[previous]})).material,fresh);assert.match(requests[0].instructions,/fresh-session/);assert.match(requests[1].input[0].content,/near-duplicate/);assert.equal(requests.at(-1).text.format.name,'worksheet_review');}finally{globalThis.fetch=saved;}
});
test('open-question tutor cannot return a leaked choice or replay previous leaked replies',async()=>{
 const saved=globalThis.fetch,requests=[];globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:'정답은 B, photosynthesis입니다.'});};
 try{const result=await handleMaterials({mode:'tutor',courseId:'m1-science',question:{prompt:'Which process?',choices:['respiration','photosynthesis','melting','freezing'],result:'open'},answerGuard:{choice:'photosynthesis',label:'B'},history:[{role:'assistant',content:'정답은 B입니다.'}],message:'답을 알려주세요'});assert.doesNotMatch(result.text,/photosynthesis|정답은 B/);assert.equal(requests[0].input.length,1);assert.doesNotMatch(requests[0].instructions,/answerIndex/);}finally{globalThis.fetch=saved;}
});

test('answer protection catches short answers and final calculations without treating articles as option labels',()=>{
 for(const text of ['답은 A입니다.','The answer is 7.','3 + 4 = 7.'])assert.equal(disclosesMaterialAnswer(text,{choice:'7',label:'A'}),true,text);
 assert.equal(disclosesMaterialAnswer('융해라고 합니다.',{choice:'융해',label:'B'}),true);
 for(const text of ['Choose between the methods by checking the units.','Select a method that matches the information.'])assert.equal(disclosesMaterialAnswer(text,{choice:'7',label:'A'}),false,text);
 const bad=structuredClone(fixture);bad.questions[0].choices='invalid';bad.questions[1].hints={};assert.doesNotThrow(()=>materialFormatIssues(bad));assert.ok(materialFormatIssues(bad).length>=2);
});
