import test from 'node:test';
import assert from 'node:assert/strict';
import {generateScienceRemainder} from '../lib/science-board-content.js';
import {mixedChemistryMaterial} from './fixtures/board-chemistry-mixed.js';

const narration='같은 물질의 같은 시료에 대해 질량을 몰 질량으로 나누면 물질의 양을 구할 수 있습니다. 시료의 질량은 그램으로 나타내고 몰 질량은 그램 퍼 몰로 나타내므로 나눈 결과의 단위는 몰입니다. 계산을 시작하기 전에 구하려는 물질과 주어진 조건을 확인해 보세요. 몰 질량은 그 물질의 특성이며 실제 시료의 질량과 구별해야 합니다. 단위를 함께 쓰면 계산 관계를 확인할 수 있습니다.';
const scene=index=>({title:'개념 '+index,lines:['같은 물질의 같은 시료에서 n=m/M','m은 g, M은 g/mol, n은 mol'],narration});
const fixture=()=>({first:{id:'11111111-2222-4333-8444-555555555555',courseId:'suneung-2027-chemistry-1',topicId:'worksheet',title:'현재 10문제 개념 설명',language:'ko',complete:false,createdAt:1,scenes:[scene(1)]},candidate:{scenes:[2,3,4,5].map(scene)},material:structuredClone(mixedChemistryMaterial)});
const defect={valid:false,issues:['Clarify the amount of the specified substance, preserving the existing explanation.']},approved={valid:true,issues:[]};
const append={sceneNumber:2,field:'narration',lineIndex:-1,before:'',after:' 여기서 세는 물질의 종류도 분명히 지정합니다.'};
const missing={sceneNumber:2,field:'narration',lineIndex:-1,before:'실제 설명에 없는 비밀 문장',after:'새 문장'};
function provider(outputs){
 const calls=[];
 return {calls,fetcher:async(_url,options)=>{const request=JSON.parse(options.body);calls.push(request);assert(outputs.length,'unexpected extra provider call');const output=outputs.shift();return output instanceof Response?output:Response.json({status:'completed',output_text:JSON.stringify(output)});}};
}
const run=(f,mock)=>generateScienceRemainder(f.first,{material:f.material,fetcher:mock.fetcher});

test('invalid exact edit retries its payload once against unchanged numbered scenes before independent review',async()=>{
 const f=fixture(),before=structuredClone(f),mock=provider([f.candidate,defect,{edits:[missing]},{edits:[append]},approved]);
 const full=await run(f,mock);
 assert.deepEqual(mock.calls.map(x=>x.text.format.name),['science_board_scenes','science_board_review','science_board_scene_edits','science_board_scene_edits','science_board_review']);
 assert.deepEqual(f,before);assert.strictEqual(full.scenes[0],f.first.scenes[0]);
 const initial=JSON.parse(mock.calls[2].input[0].content),retry=JSON.parse(mock.calls[3].input[0].content),review=JSON.parse(mock.calls[4].input[0].content);
 assert.deepEqual(initial.candidateSceneNumbers,[2,3,4,5]);assert.deepEqual(retry.candidate,f.candidate);assert.deepEqual(retry.issues,defect.issues);assert.equal(retry.editFormatError,'scene_edit_target_not_found');
 assert.deepEqual(retry.originalCandidateScenes,f.candidate.scenes.map((s,i)=>({sceneNumber:i+2,...s})));assert(!mock.calls[3].input[0].content.includes(missing.before));
 assert.match(mock.calls[3].instructions,/NONE of its changes were applied/);assert.match(mock.calls[3].instructions,/prefer before empty/);
 assert.equal(full.scenes[1].narration,f.candidate.scenes[0].narration+' '+append.after);assert.deepEqual(full.scenes.slice(2),f.candidate.scenes.slice(1));
 assert.deepEqual(review.candidate.scenes,full.scenes.slice(1),'corrected content must receive independent factual review');
});

test('repeated invalid edit is rejected after one format retry without another review or candidate',async()=>{
 const f=fixture(),mock=provider([f.candidate,defect,{edits:[missing]},{edits:[missing]}]);
 await assert.rejects(run(f,mock),error=>error.code==='scene_edit_target_not_found');assert.equal(mock.calls.length,4);assert.equal(mock.calls.filter(x=>x.text.format.name==='science_board_review').length,1);
});

test('overlapping edits never partly apply before their replacement payload is generated',async()=>{
 const f=fixture(),before=structuredClone(f.candidate),mock=provider([f.candidate,defect,{edits:[
  {sceneNumber:2,field:'line',lineIndex:0,before:'n=m/M',after:'m=nM'},
  {sceneNumber:3,field:'narration',lineIndex:-1,before:'같은 물질의 같은 시료',after:'새 표기'},
  {sceneNumber:3,field:'narration',lineIndex:-1,before:'같은 물질의',after:'다른 표기'}
 ]},{edits:[append]},approved]);
 const full=await run(f,mock),retry=JSON.parse(mock.calls[3].input[0].content);
 assert.equal(retry.editFormatError,'scene_edit_overlap');assert.deepEqual(retry.candidate,before);assert.deepEqual(f.candidate,before);assert.equal(full.scenes[1].lines[0],before.scenes[0].lines[0]);assert.deepEqual(full.scenes[2],before.scenes[1]);
});

test('edit retry shares the sole format-repair allowance with earlier scene format repair',async()=>{
 const f=fixture(),malformed=structuredClone(f.candidate);malformed.scenes[0].narration='짧음';
 const mock=provider([malformed,f.candidate,defect,{edits:[missing]}]);
 await assert.rejects(run(f,mock),error=>error.code==='scene_edit_target_not_found');assert.equal(mock.calls.length,4);assert.equal(mock.calls.filter(x=>x.text.format.name==='science_board_scene_edits').length,1);
});

test('edit format retry does not allow a third factual repair or bypass final rejection',async()=>{
 const f=fixture(),appendAgain={...append,sceneNumber:3},mock=provider([f.candidate,defect,{edits:[missing]},{edits:[append]},defect,{edits:[appendAgain]},defect]);
 await assert.rejects(run(f,mock),/검토를 통과/);assert.equal(mock.calls.length,7);assert.equal(mock.calls.filter(x=>x.text.format.name==='science_board_review').length,3);
});

for(const response of [
 Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}),
 Response.json({status:'incomplete',incomplete_details:{reason:'content_filter'}}),
 Response.json({error:{code:'internal_error'}},{status:500}),
 Response.json({status:'completed',output_text:'not JSON'})
])test('provider, filtered, incomplete or JSON failures in edit generation are not format-retried',async()=>{
 const f=fixture(),mock=provider([f.candidate,defect,response]);await assert.rejects(run(f,mock));assert.equal(mock.calls.length,3);
});


test('imported remainder generation, repair and review use scoped models with explicit overrides',async()=>{
 const names=['OPENAI_SCIENCE_BOARD_REMAINDER_MODEL','OPENAI_SCIENCE_BOARD_REMAINDER_REVIEW_MODEL'];
 const saved=names.map(name=>process.env[name]);
 try{
  for(const name of names)delete process.env[name];
  const f=fixture(),mock=provider([f.candidate,defect,{edits:[missing]},{edits:[append]},approved]);
  await run(f,mock);assert(mock.calls.every(call=>call.model==='gpt-5.6-terra'));
  process.env[names[0]]='remainder-generation-test';process.env[names[1]]='remainder-review-test';
  const overridden=provider([f.candidate,defect,{edits:[missing]},{edits:[append]},approved]);
  await run(f,overridden);
  assert.deepEqual(overridden.calls.map(call=>call.model),['remainder-generation-test','remainder-review-test','remainder-generation-test','remainder-generation-test','remainder-review-test']);
 }finally{names.forEach((name,index)=>{if(saved[index]===undefined)delete process.env[name];else process.env[name]=saved[index];});}
});
