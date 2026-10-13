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

test('a missing TOEIC picture is repaired before independent review while text-only Part 6 remains valid',async()=>{
 const bad=structuredClone(fixture),fixed=structuredClone(fixture);
 bad.questions[0].prompt='[Listening Part 1] Look at the picture and choose the correct description.';
 fixed.questions[0]={prompt:'[Listening Part 1] 그림을 보고 알맞은 설명을 고르세요.\n[TOEIC 그림 시작]\n장소: office\n인물: 1\n행동: typing-computer\n배경: desk, monitor, chair\n[TOEIC 그림 끝]',choices:['A person is typing at a computer.','A person is carrying a box.','A person is cleaning a window.','A person is reading a menu.'],answerIndex:0,hints:['Look at the person’s hands.','Compare the objects with each description.'],explanation:'The person is using the keyboard at a computer.'};
 assert.equal(materialFormatIssues(bad,true)[0].question,1);
 assert.match(materialFormatIssues(bad,true)[0].reason,/picture/);
 const reading=structuredClone(fixture);reading.questions[0].prompt='[Reading Part 6] Choose a connector. Employees may borrow a projector. ____, they must record the return time.';
 assert.deepEqual(materialFormatIssues(reading,true),[]);
 const saved=globalThis.fetch,requests=[],responses=[bad,replacements(fixed,1),{valid:true,issues:[]}];
 globalThis.fetch=async(_url,o)=>{requests.push(JSON.parse(o.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 try{
  const result=await handleMaterials({mode:'generate',courseId:'toeic',topic:'Mixed review'});
  assert.deepEqual(result.material,fixed);assert.equal(requests.length,3);
  assert.equal(requests[1].text.format.name,'worksheet_repair');
  assert.equal(requests[2].text.format.name,'worksheet_review');
  assert.deepEqual(JSON.parse(requests[2].input[0].content),fixed);
  assert.match(requests[0].instructions,/Only mention visible objects/);
  assert.match(requests[2].instructions,/Never repeat A–D choices in prompt/);
 }finally{globalThis.fetch=saved;}
});

test('reading task repair replaces the complete ambiguous item and rechecks paragraph scope, specific evidence and indirect hints',async()=>{
 const source=structuredClone(fixture);source.title='중심 생각과 뒷받침 문장';
 source.questions[0]={prompt:'비가 오는 날에는 안전하게 걸어야 합니다. 미끄러지지 않도록 천천히 걷습니다. 물웅덩이를 피해 걷고 계단에서는 난간을 잡습니다. 이 글의 중심 생각은 무엇인가요?',choices:['비 오는 날에는 천천히 걸어야 한다.','난간은 비가 올 때만 있다.','물웅덩이는 모두 깊다.','비가 오면 집 밖에 나갈 수 없다.'],answerIndex:0,hints:['천천히 걷는 행동을 생각하세요.','처음 문장을 보세요.'],explanation:'천천히 걷는 일이 중요합니다.'};
 source.questions[1]={prompt:'아침밥을 먹으면 활동할 힘을 얻습니다. 민수는 아침밥을 먹고 운동장에서 힘차게 달렸습니다. 운동장에는 큰 나무가 있습니다. 아침밥을 먹으면 힘을 얻는다는 생각을 구체적인 사례로 뒷받침하는 문장은 무엇인가요?',choices:['아침밥을 먹으면 활동할 힘을 얻습니다.','민수는 아침밥을 먹고 운동장에서 힘차게 달렸습니다.','운동장에는 큰 나무가 있습니다.','아침에는 모두 운동을 해야 합니다.'],answerIndex:0,hints:['가운데 문장을 보세요.','민수가 달린 까닭을 떠올리세요.'],explanation:'아침밥을 먹으면 힘을 얻는다는 문장이 중심 생각을 뒷받침합니다.'};
 const fixed=structuredClone(source);
 fixed.questions[0]={...fixed.questions[0],choices:['비 오는 날에는 여러 방법으로 안전하게 걸어야 한다.','비가 오면 반드시 달려야 한다.','물웅덩이의 깊이를 재야 한다.','계단에서는 눈을 감아야 한다.'],hints:['각 보기가 글에 나온 여러 행동을 함께 설명하는지 비교해 보세요.','글에 없는 내용을 보태거나 일부 행동만 말하는 보기는 아닌지 살펴보세요.'],explanation:'천천히 걷기, 물웅덩이 피하기, 난간 잡기는 모두 비 오는 날 안전하게 걷기 위한 방법입니다.'};
 fixed.questions[1]={...fixed.questions[1],answerIndex:1,hints:['말하려는 생각과 그 생각을 보여 주는 구체적인 일을 구별해 보세요.','문장이 생각을 되풀이하는지, 실제 사례를 들어 설명하는지 비교해 보세요.'],explanation:'민수가 아침밥을 먹고 힘차게 달린 일은 아침밥이 활동할 힘을 준다는 생각을 구체적으로 보여 줍니다. 첫 문장은 그 생각 자체이고 나무에 관한 문장은 관련 없는 정보입니다.'};
 const issues=[{question:1,reason:'The answer covers only walking slowly, omitting the other central safety actions; hints reveal the target.',fix:'Replace this complete question with one paragraph-wide central idea and indirect scope-comparison hints.'},{question:2,reason:'The selected answer restates the claim rather than supplying a specific supporting example; hints identify the answer sentence.',fix:'Keep exactly one specific example as the answer and use method hints without sentence positions or answer content.'}];
 const requests=[],responses=[source,{valid:false,issues},replacements(fixed,1,2),{valid:true,issues:[]}],fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length);return Response.json({output_text:JSON.stringify(responses.shift())});};
 const original=structuredClone(source),result=await handleMaterials({mode:'generate',courseId:'e3-korean',topic:'중심 생각과 뒷받침 문장 찾기'},{fetcher});
 assert.deepEqual(result.material,fixed);assert.deepEqual(source,original);assert.deepEqual(result.material.questions.slice(2),source.questions.slice(2));assert.equal(result.material.title,source.title);
 assert.equal(requests.length,4);assert.equal(requests[2].text.format.name,'worksheet_repair');assert.deepEqual(requests[2].text.format.schema.properties.replacements.items.properties.number.enum,[1,2]);assert.deepEqual(JSON.parse(requests[3].input[0].content),fixed);
 for(const request of requests){
  assert.match(request.instructions,/READING CLAIM AND EVIDENCE CONTRACT/);
  assert.match(request.instructions,/capture the scope of the entire paragraph/);
  assert.match(request.instructions,/A restatement of the claim or a summary of the whole paragraph is not specific supporting evidence/);
  assert.match(request.instructions,/Never name the location of the correct sentence/);
  assert.match(request.instructions,/ambiguity and answer-revealing hints remain rejection reasons/);
  assert.equal(request.model,(['gem_material','worksheet_repair'].includes(request.text.format.name)&&process.env.GEM_VERIFICATION_WRITER_MODEL)||process.env.OPENAI_REVIEW_MODEL||process.env.OPENAI_MODEL||'gpt-5.6-luna');
 }
});

test('reading evidence contract is scoped to language reasoning tasks and preserves the two-repair fail-closed limit',async()=>{
 for(const [courseId,topic,scoped]of [['e3-korean','중심 생각과 뒷받침 문장',true],['materials-en-sat-reading-writing','Central Ideas and Supporting Evidence',true],['materials-fr-3-2','idée principale et justification',true],['e3-korean','문장 부호 사용',false],['e3-math','중심 생각',false],['m1-science','상태 변화',false]]){
  const requests=[],responses=[fixture,{valid:true,issues:[]}],fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
  await handleMaterials({mode:'generate',courseId,topic},{fetcher});for(const request of requests)assert.equal(request.instructions.includes('READING CLAIM AND EVIDENCE CONTRACT'),scoped);
 }
 const rejected={valid:false,issues:[{question:1,reason:'Two sentences still support the claim; the hint gives the correct sentence location.',fix:'Rebuild this question with one defensible supporting sentence and two method-only hints.'}]};
 const requests=[],responses=[fixture,rejected,replacements(fixture,1),rejected,replacements(fixture,1),rejected],fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length,'no third repair may start');return Response.json({output_text:JSON.stringify(responses.shift())});};
 await assert.rejects(handleMaterials({mode:'generate',courseId:'e3-korean',topic:'중심 생각과 뒷받침 문장'},{fetcher}),/자동 수정.*검토/);
 assert.equal(requests.length,6);assert.equal(requests.filter(request=>request.text.format.name==='worksheet_repair').length,2);assert.equal(requests.filter(request=>request.text.format.name==='worksheet_review').length,3);assert(requests.every(request=>request.instructions.includes('READING CLAIM AND EVIDENCE CONTRACT')));
 assert.deepEqual(requests.filter(request=>request.text.format.name==='worksheet_review').map(request=>request.max_output_tokens),[2500,2500,2500]);
});

test('state-change evidence repairs a shrinking-puddle ambiguity in the prompt and independently reviews both bounded repairs',async()=>{
 const source=structuredClone(fixture);source.title='Les changements d’état de l’eau';
 source.questions[3]={prompt:'Une petite flaque d’eau dans la cour devient plus petite pendant une journée douce. Quel changement d’état explique cette observation ?',choices:['L’évaporation','La solidification','La fusion','La condensation'],answerIndex:0,hints:['Observe ce qui change dans la situation.','Compare les états avant et après le changement proposé.'],explanation:'La flaque diminue parce que l’eau s’évapore.'};
 const partial=structuredClone(source);partial.questions[3].prompt+=' Aucune eau ne coule vers un autre endroit.';
 const fixed=structuredClone(partial);fixed.questions[3]={...fixed.questions[3],prompt:'Un adulte observe de l’eau liquide dans un récipient ouvert, imperméable et sans fuite, à température ambiante. Personne n’ajoute, ne retire ni ne renverse d’eau. Au fil des jours, la quantité d’eau liquide diminue. Quel changement d’état explique cette diminution ?',explanation:'Une partie de l’eau liquide devient de la vapeur d’eau dans l’air : c’est l’évaporation. Le récipient ne fuit pas et n’absorbe pas l’eau. L’eau ne disparaît pas : elle passe dans l’air.'};
 const first={valid:false,issues:[{question:4,reason:'The puddle can decrease because the ground absorbs the water.',fix:'Put the liquid in a controlled non-absorbing container and state the needed observation.'}]};
 const second={valid:false,issues:[{question:4,reason:'No runoff still permits absorption or infiltration into the ground.',fix:'Replace the puddle with an open impermeable container without leaks and exclude removal/spilling in the prompt.'}]};
 const requests=[],responses=[source,first,replacements(partial,4),second,replacements(fixed,4),{valid:true,issues:[]}],fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length);return Response.json({output_text:JSON.stringify(responses.shift())});};
 const original=structuredClone(source),result=await handleMaterials({mode:'generate',courseId:'materials-fr-3-1',topic:'États de l’eau : fusion, solidification, évaporation et condensation'},{fetcher});
 assert.deepEqual(source,original);assert.deepEqual(result.material,fixed);assert.deepEqual(result.material.questions.filter((_,i)=>i!==3),source.questions.filter((_,i)=>i!==3));
 assert.equal(requests.length,6);assert.equal(requests.filter(request=>request.text.format.name==='worksheet_repair').length,2);assert.deepEqual(requests.filter(request=>request.text.format.name==='worksheet_review').map(request=>JSON.parse(request.input[0].content)),[source,partial,fixed]);
 assert.match(result.material.questions[3].prompt,/imperméable et sans fuite/);assert.doesNotMatch(result.material.questions[3].hints.join(' '),/évaporation|vapeur/);
 for(const request of requests){
  assert.match(request.instructions,/PHYSICAL STATE CHANGE EVIDENCE CONTRACT/);
  assert.match(request.instructions,/Merely saying that no water flows elsewhere does NOT exclude absorption/);
  assert.match(request.instructions,/State these relevant controls in the prompt/);
  assert.match(request.instructions,/Do not require an open container’s mass to remain constant/);
  assert.match(request.instructions,/Liquids take the shape of their container/);
  assert.match(request.instructions,/Precipitation or falling rain is not itself the name of a change of state/);
  assert.match(request.instructions,/Do not burden a simple qualitative elementary task with thermodynamic equations/);
  assert.equal(request.model,(['gem_material','worksheet_repair'].includes(request.text.format.name)&&process.env.GEM_VERIFICATION_WRITER_MODEL)||process.env.OPENAI_REVIEW_MODEL||process.env.OPENAI_MODEL||'gpt-5.6-luna');
 }
 assert.deepEqual(requests.filter(request=>request.text.format.name==='worksheet_review').map(request=>request.max_output_tokens),[2500,2500,2500]);
});

test('phase-change controls apply only to relevant science topics and never bypass final factual rejection',async()=>{
 for(const [courseId,topic,scoped]of [['e3-science','물의 상태 변화와 증발',true],['materials-en-3-1','States of matter and condensation',true],['materials-fr-3-1','Les états de l’eau',true],['materials-fr-3-2','Un texte sur les états de l’eau',false],['e3-math','곱셈',false],['m1-science','전기 회로',false]]){
  const requests=[],responses=[fixture,{valid:true,issues:[]}],fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
  await handleMaterials({mode:'generate',courseId,topic},{fetcher});for(const request of requests)assert.equal(request.instructions.includes('PHYSICAL STATE CHANGE EVIDENCE CONTRACT'),scoped);
 }
 const rejected={valid:false,issues:[{question:4,reason:'The described puddle may still infiltrate into the ground.',fix:'Use an impermeable non-leaking container and state the conditions.'}]};
 const requests=[],responses=[fixture,rejected,replacements(fixture,4),rejected,replacements(fixture,4),rejected],fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length,'no third repair or unchecked acceptance');return Response.json({output_text:JSON.stringify(responses.shift())});};
 await assert.rejects(handleMaterials({mode:'generate',courseId:'materials-fr-3-1',topic:'Évaporation de l’eau'},{fetcher}),/자동 수정.*검토/);assert.equal(requests.length,6);assert.equal(requests.filter(request=>request.text.format.name==='worksheet_repair').length,2);
});

const completedProvider=value=>Response.json({status:'completed',output_text:typeof value==='string'?value:JSON.stringify(value)});
const truncatedReview=(reason='max_output_tokens')=>Response.json({status:'incomplete',incomplete_details:{reason},output_text:JSON.stringify({valid:true,issues:[]})});

test('one token-limited worksheet review retries the identical candidate and frozen model at 5000 tokens',async()=>{
 const requests=[],saved=process.env.OPENAI_REVIEW_MODEL;process.env.OPENAI_REVIEW_MODEL='review-model-before-truncation';
 const fetcher=async(_url,options)=>{
  requests.push(JSON.parse(options.body));
  if(requests.length===1)return completedProvider(fixture);
  if(requests.length===2){process.env.OPENAI_REVIEW_MODEL='changed-during-request';return truncatedReview();}
  assert.equal(requests.length,3);return completedProvider({valid:true,issues:[]});
 };
 try{
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:'e3-korean',topic:'중심 생각'},{fetcher})).material,fixture);
  assert.equal(requests.length,3);const [first,retry]=requests.slice(1);assert.equal(first.max_output_tokens,2500);assert.equal(retry.max_output_tokens,5000);assert.deepEqual({...retry,max_output_tokens:2500},first);assert.equal(retry.model,'review-model-before-truncation');assert.deepEqual(JSON.parse(retry.input[0].content),fixture);
 }finally{if(saved===undefined)delete process.env.OPENAI_REVIEW_MODEL;else process.env.OPENAI_REVIEW_MODEL=saved;}
});

test('a completed rejection after a token retry still requires ordinary targeted repair and independent rereview',async()=>{
 const fixed=structuredClone(fixture);fixed.questions[0].explanation='Adding one to zero gives one.';
 const rejected={valid:false,issues:[{question:1,reason:'Incorrect explanation',fix:'Correct the addition explanation.'}]};
 const responses=[()=>completedProvider(fixture),()=>truncatedReview(),()=>completedProvider(rejected),()=>completedProvider(replacements(fixed,1)),()=>completedProvider({valid:true,issues:[]})],requests=[];
 const fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length);return responses.shift()();};
 assert.deepEqual((await handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher})).material,fixed);
 assert.deepEqual(requests.map(request=>request.text.format.name),['gem_material','worksheet_review','worksheet_review','worksheet_repair','worksheet_review']);
 assert.deepEqual(requests.filter(request=>request.text.format.name==='worksheet_review').map(request=>request.max_output_tokens),[2500,5000,2500]);assert.deepEqual(JSON.parse(requests.at(-1).input[0].content),fixed);
});

test('the one truncation retry budget is shared across candidate repairs and a second truncation fails closed',async()=>{
 const rejected={valid:false,issues:[{question:1,reason:'Incorrect explanation',fix:'Correct it.'}]};
 for(const responses of [
  [()=>completedProvider(fixture),()=>truncatedReview(),()=>truncatedReview()],
  [()=>completedProvider(fixture),()=>truncatedReview(),()=>completedProvider(rejected),()=>completedProvider(replacements(fixture,1)),()=>truncatedReview()]
 ]){
  const expected=responses.length,requests=[],fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length,'no second token retry');return responses.shift()();};
  await assert.rejects(handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher}),/끝까지/);assert.equal(requests.length,expected);assert.equal(requests.filter(request=>request.max_output_tokens===5000).length,1);
 }
});

test('a final-review token retry can use at most seven calls without extending the two content repairs',async()=>{
 const rejected={valid:false,issues:[{question:1,reason:'Incorrect explanation',fix:'Correct it.'}]};
 const responses=[()=>completedProvider(fixture),()=>completedProvider(rejected),()=>completedProvider(replacements(fixture,1)),()=>completedProvider(rejected),()=>completedProvider(replacements(fixture,1)),()=>truncatedReview(),()=>completedProvider(rejected)],requests=[];
 const fetcher=async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length,'no third repair or second retry');return responses.shift()();};
 await assert.rejects(handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher}),/자동 수정.*검토/);assert.equal(requests.length,7);assert.equal(requests.filter(request=>request.text.format.name==='worksheet_repair').length,2);assert.deepEqual(requests.filter(request=>request.text.format.name==='worksheet_review').map(request=>request.max_output_tokens),[2500,2500,2500,5000]);
});

test('filtering, unknown incomplete reasons, failed statuses and HTTP failures cannot approve or retry a review',async()=>{
 const failures=[()=>truncatedReview('content_filter'),()=>truncatedReview('unknown'),()=>Response.json({status:'incomplete',output_text:JSON.stringify({valid:true,issues:[]})}),...['failed','cancelled','queued','in_progress','mystery',null].map(status=>()=>Response.json({status,output_text:JSON.stringify({valid:true,issues:[]})})),()=>Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},error:{code:'rate_limit_exceeded'}},{status:429})];
 for(const failure of failures){let calls=0;const fetcher=async()=>++calls===1?completedProvider(fixture):failure();await assert.rejects(handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher}));assert.equal(calls,2);}
});

test('generation, tutoring and repair truncation never consume a worksheet-review retry',async()=>{
 let generationCalls=0;await assert.rejects(handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher:async()=>{generationCalls++;return truncatedReview();}}),/끝까지/);assert.equal(generationCalls,1);
 let tutorCalls=0;await assert.rejects(handleMaterials({mode:'tutor',courseId:'e3-math',question:fixture.questions[0],message:'Explain this.'},{fetcher:async()=>{tutorCalls++;return truncatedReview();}}),/끝까지/);assert.equal(tutorCalls,1);
 const responses=[()=>completedProvider(fixture),()=>completedProvider({valid:false,issues:[{question:1,reason:'Incorrect explanation',fix:'Correct it.'}]}),()=>truncatedReview()],requests=[];
 await assert.rejects(handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher:async(_url,options)=>{requests.push(JSON.parse(options.body));assert(responses.length);return responses.shift()();}}),/끝까지/);assert.equal(requests.length,3);assert.equal(requests.at(-1).text.format.name,'worksheet_repair');
});

test('a token retry needs ten seconds remaining and keeps the original invocation deadline',async()=>{
 const savedNow=Date.now,savedTimeout=AbortSignal.timeout;
 try{
  for(const remaining of [9999,25000]){
   let clock=1791867600000,calls=0;const started=clock,timeouts=[];Date.now=()=>clock;AbortSignal.timeout=ms=>{timeouts.push(ms);return savedTimeout(ms);};
   const fetcher=async()=>{calls++;if(calls===1)return completedProvider(fixture);if(calls===2){clock=started+145000-remaining;return truncatedReview();}assert.equal(calls,3);return completedProvider({valid:true,issues:[]});};
   const run=handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher});
   if(remaining<10000){await assert.rejects(run,/끝까지/);assert.equal(calls,2);}else{assert.deepEqual((await run).material,fixture);assert.equal(calls,3);assert.deepEqual(timeouts,[55000,55000,25000]);}
  }
 }finally{Date.now=savedNow;AbortSignal.timeout=savedTimeout;}
});

test('deployment fixtures can keep the normal fast writer while every independent review uses the stronger reviewer',async()=>{
 const saved={review:process.env.OPENAI_REVIEW_MODEL,writer:process.env.GEM_VERIFICATION_WRITER_MODEL};
 try{
  process.env.OPENAI_REVIEW_MODEL='independent-review-model';process.env.GEM_VERIFICATION_WRITER_MODEL='fast-fixture-writer';
  const rejected={valid:false,issues:[{question:4,reason:'Check the answer index.',fix:'Keep the question and solve its choices.'}]};
  const responses=[fixture,rejected,replacements(fixture,4),{valid:true,issues:[]}],requests=[];
  const fetcher=async(_url,options)=>{const request=JSON.parse(options.body);requests.push(request);return completedProvider(responses.shift());};
  assert.deepEqual((await handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher})).material,fixture);
  assert.deepEqual(requests.map(r=>[r.text.format.name,r.model]),[['gem_material','fast-fixture-writer'],['worksheet_review','independent-review-model'],['worksheet_repair','fast-fixture-writer'],['worksheet_review','independent-review-model']]);
  delete process.env.GEM_VERIFICATION_WRITER_MODEL;
  const defaults=[];const values=[fixture,{valid:true,issues:[]}];await handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈'},{fetcher:async(_url,o)=>{defaults.push(JSON.parse(o.body));return completedProvider(values.shift());}});
  assert(defaults.every(r=>r.model==='independent-review-model'),'runtime retains its existing model selection without the build opt-in');
 }finally{for(const [key,value]of [['OPENAI_REVIEW_MODEL',saved.review],['GEM_VERIFICATION_WRITER_MODEL',saved.writer]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('only trusted verification dependencies extend bounded time, without changing classroom or caller deadlines',async()=>{
 const savedNow=Date.now,savedTimeout=AbortSignal.timeout;
 try{
  for(const build of [false,true]){
   let clock=1791867600000,calls=0;const started=clock,timeouts=[];
   Date.now=()=>clock;AbortSignal.timeout=ms=>{timeouts.push(ms);return savedTimeout(ms);};
   const fetcher=async()=>{calls++;if(calls===1){clock=started+200000;return completedProvider(fixture);}return completedProvider({valid:true,issues:[]});};
   const run=handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈',generationTimeoutMs:999999,requestTimeoutMs:999999},{fetcher,...(build?{generationTimeoutMs:999999,requestTimeoutMs:999999}:{})});
   if(build){assert.deepEqual((await run).material,fixture);assert.deepEqual(timeouts,[90000,90000]);assert.equal(calls,2);}
   else{await assert.rejects(run,/검토 시간이/);assert.deepEqual(timeouts,[55000]);assert.equal(calls,1);}
  }
  let clock=1791867600000,calls=0;Date.now=()=>clock;
  await assert.rejects(handleMaterials({mode:'generate',courseId:'e3-math',topic:'덧셈',deadline:clock+5000},{generationTimeoutMs:300000,requestTimeoutMs:90000,fetcher:async()=>{calls++;clock+=6000;return completedProvider(fixture);}}),/검토 시간이/);assert.equal(calls,1);
 }finally{Date.now=savedNow;AbortSignal.timeout=savedTimeout;}
});
