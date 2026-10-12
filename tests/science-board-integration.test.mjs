import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMaterials} from '../lib/materials-ai.js';
import {serveStudentPage} from '../lib/student-page.js';

test('lesson context reaches generation, independent review, repair and final review without changing legacy requests',async()=>{
 const sheet={title:'전자기 유도',questions:Array.from({length:10},(_,i)=>({prompt:`상황 ${i+1}: 자기 선속이 일정할 때 유도 기전력의 크기는?`,choices:['0 V','1 V','2 V','3 V'],answerIndex:0,hints:['시간에 따른 변화를 살펴보세요.','변화율을 비교해 보세요.'],explanation:'자기 선속의 변화율이 0이므로 유도 기전력은 0 V이다.'}))};
 const issue={question:1,reason:'Clarify the condition',fix:'State that the loop is fixed'};
 const fixed=structuredClone(sheet.questions[0]);fixed.prompt+=' 고리는 고정되어 있다.';
 const responses=[sheet,{valid:false,issues:[issue]},{replacements:[{number:1,question:fixed}]},{valid:true,issues:[]}];
 const calls=[];
 const fetcher=async(_url,options)=>{calls.push(JSON.parse(options.body));return Response.json({output_text:JSON.stringify(responses.shift())});};
 const context='수업 목표: 자기 선속 변화율과 유도 기전력의 관계. 선속이 일정하면 유도 기전력은 0이다.';
 const result=await handleMaterials({mode:'generate',courseId:'h3-science',topic:'전자기 유도',lessonContext:context},{fetcher});
 assert.equal(result.material.questions.length,10);assert.equal(result.material.questions[0].prompt,fixed.prompt);
 assert.equal(calls.length,4);
 for(const call of calls){assert(call.instructions.includes(context));assert.match(call.instructions,/untrusted data/);assert.match(call.instructions,/Restrict questions to the supplied lesson goals/);}
 let requested=false;
 await assert.rejects(handleMaterials({mode:'generate',courseId:'h3-science',topic:'전자기 유도',lessonContext:'x'.repeat(10001)},{fetcher:async()=>{requested=true;}}),/Invalid lesson context/);
 assert.equal(requested,false);
});

test('the science pilot sends an unauthenticated visitor through the existing fixed login return path',async()=>{
 const response={headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(body){this.body=body;}};
 await serveStudentPage({headers:{},query:{page:'science-board'}},response);
 assert.equal(response.code,303);assert.equal(response.headers.Location,'/?scienceboard=1');
});
