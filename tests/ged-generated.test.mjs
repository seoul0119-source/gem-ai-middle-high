import test from 'node:test';import assert from 'node:assert/strict';
import {GED_COURSES,GED_LEVELS} from '../lib/ged-courses.js';
import {loadGeneratedGed,materialGedQuestions} from '../lib/ged-generated.js';
import {replayGed} from '../lib/ged-lesson.js';
import {createGedQuestions} from '../lib/ged-bank.js';
import {hasExcludedTopic,handleMaterials} from '../lib/materials-ai.js';
process.env.OPENAI_API_KEY='ged-generated-test-only';
const fixture={title:'검토된 연습',questions:createGedQuestions('ged-high-korean','test').map(q=>({prompt:q.prompt,choices:q.choices,answerIndex:'ABCD'.indexOf(q.answer),hints:[q.hint,'글의 근거를 확인하세요.'],explanation:q.explanation}))};
test('31 course levels preserve objective grading and course identity through 10-question replay',()=>{
 assert.equal(Object.keys(GED_COURSES).length,31);
 for(const [level,count] of [['elementary',10],['middle',10],['high',11]])assert.equal(Object.values(GED_COURSES).filter(c=>c.level===level).length,count);
 for(const [id,c]of Object.entries(GED_COURSES)){
  assert.ok(c.prompt.includes('GEM 교육 기준에 따른'));assert.ok(c.prompt.includes('공식 시험 전 범위'));assert.ok(c.prompt.includes('자연선택'));assert.ok(GED_LEVELS[c.level]);
  const questions=materialGedQuestions(fixture),messages=[{role:'user',content:'시작'}];
  for(const q of questions)messages.push({role:'user',content:q.answer});
  const r=replayGed(id,'ged-v3:test',messages,questions);assert.equal(r.state.firstCorrect,10);assert.equal(r.state.records[0].stage,c.grade);
 }
});
test('persisted questions are loaded without AI, missing resume never regenerates, and no local bank fallback',async()=>{
 const previous=fetch;let calls=0;
 try{
  globalThis.fetch=async(_u,o)=>{calls++;assert.equal(JSON.parse(o.body).record.operation,'ged-read');return Response.json({material:fixture});};
  const s={id:'TEST',courseId:'ged-middle-math',courseRunId:'ged-v3:test'};
  assert.deepEqual(await loadGeneratedGed(s,false),materialGedQuestions(fixture));assert.equal(calls,1);
  globalThis.fetch=async()=>Response.json({material:null});await assert.rejects(loadGeneratedGed(s,false),/문제를 바꾸지 않고 중단/);
  globalThis.fetch=async()=>{throw Error('offline')};await assert.rejects(loadGeneratedGed(s,true),/offline/);
 }finally{globalThis.fetch=previous;}
});
test('GED scope guard rejects excluded material and tutor output even when requested',async()=>{
 assert.equal(hasExcludedTopic({explanation:'자연선택과 공통조상'}),true);
 const previous=fetch;globalThis.fetch=async()=>Response.json({output_text:'생물 진화와 자연선택을 설명합니다.'});
 try{const r=await handleMaterials({mode:'tutor',courseId:'ged-high-science',message:'설명해 주세요',question:{prompt:'인체 기관'}});assert.match(r.text,/제외/);assert.doesNotMatch(r.text,/자연선택/);}finally{globalThis.fetch=previous;}
});
