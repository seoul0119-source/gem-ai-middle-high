import test from 'node:test';
import assert from 'node:assert/strict';
import {applySceneEdits,sceneEditsSchema} from '../lib/science-scene-edits.js';

const candidate=()=>({scenes:Array.from({length:4},(_,index)=>({title:`장면 ${index+2}`,lines:['같은 물질의 시료 질량 m을 구합니다.','몰 질량 M의 단위는 g/mol입니다.'],narration:'같은 물질의 입자 수를 확인합니다. 먼저 질량을 구하고 나중에 부피를 구합니다.'}))});
const edit=(values={})=>({sceneNumber:2,field:'narration',lineIndex:-1,before:'입자 수',after:'물질의 양',...values});
const repaired=(source,edits)=>applySceneEdits(source,{edits});
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};

test('schema bounds the exact repair contract and excludes extra properties',()=>{
 assert.equal(sceneEditsSchema.additionalProperties,false);
 assert.deepEqual(sceneEditsSchema.required,['edits']);
 assert.equal(sceneEditsSchema.properties.edits.minItems,1);assert.equal(sceneEditsSchema.properties.edits.maxItems,24);
 const item=sceneEditsSchema.properties.edits.items;
 assert.equal(item.additionalProperties,false);
 assert.deepEqual(item.required,['sceneNumber','field','lineIndex','before','after']);
 assert.deepEqual(item.properties.field.enum,['line','narration']);
 assert.equal(item.properties.sceneNumber.minimum,2);assert.equal(item.properties.sceneNumber.maximum,5);
});

test('repairs mixed fields and multiple immutable spans while preserving all unrelated content',()=>{
 const input=freeze(candidate()),before=structuredClone(input);
 const response=freeze({edits:[
  edit({before:'먼저 질량',after:'먼저 물질의 양'}),
  edit({before:'나중에 부피',after:'나중에 시료 질량'}),
  edit({sceneNumber:4,field:'line',lineIndex:0,before:'시료 질량 m',after:'물질의 양 n'})
 ]});
 const result=applySceneEdits(input,response);
 assert.equal(result.scenes[0].narration,'같은 물질의 입자 수를 확인합니다. 먼저 물질의 양을 구하고 나중에 시료 질량를 구합니다.');
 assert.equal(result.scenes[2].lines[0],'같은 물질의 물질의 양 n을 구합니다.');
 assert.deepEqual(result.scenes.map(scene=>scene.title),before.scenes.map(scene=>scene.title));
 assert.deepEqual(result.scenes[1],before.scenes[1]);assert.deepEqual(result.scenes[3],before.scenes[3]);
 assert.deepEqual(result.scenes[0].lines,before.scenes[0].lines);
 assert.equal(result.scenes[2].narration,before.scenes[2].narration);
 assert.equal(result.scenes[2].lines[1],before.scenes[2].lines[1]);
 assert.deepEqual(input,before);assert.notEqual(result,input);assert.notEqual(result.scenes[1].lines,input.scenes[1].lines);
});

test('applies an append after replacements with a separating space, regardless of edit order',()=>{
 const input=freeze(candidate()),append=edit({before:'',after:'같은 시료의 양을 비교합니다.'});
 const a=repaired(input,[append,edit()]),b=repaired(input,[edit(),append]);
 assert.deepEqual(a,b);
 assert.equal(a.scenes[0].narration,input.scenes[0].narration.replace('입자 수','물질의 양')+' 같은 시료의 양을 비교합니다.');
 assert.equal(a.scenes[1].narration,input.scenes[1].narration);
});

test('uses only original spans rather than text introduced by an earlier replacement',()=>{
 const input=candidate();
 assert.throws(()=>repaired(input,[edit(),edit({before:'물질의 양',after:'새로운 양'})]),/수업 수정 내용을 확인하지 못했습니다/);
 const result=repaired(input,[edit({before:'질량',after:'부피'}),edit({before:'부피',after:'질량'})]);
 assert.equal(result.scenes[0].narration,'같은 물질의 입자 수를 확인합니다. 먼저 부피을 구하고 나중에 질량를 구합니다.');
});

test('rejects ambiguous spans, including overlapping occurrences within the original text',()=>{
 const input=candidate();input.scenes[0].narration='같은 물질, 같은 시료';
 assert.throws(()=>repaired(input,[edit({before:'같은',after:'다른'})]));
 input.scenes[0].narration='aaa';
 assert.throws(()=>repaired(input,[edit({before:'aa',after:'b'})]));
});

test('rejects overlapping edit ranges and duplicate appends but accepts adjacent spans',()=>{
 const input=candidate();input.scenes[0].narration='ABCDEF';
 for(const edits of [
  [edit({before:'ABC',after:'X'}),edit({before:'CDE',after:'Y'})],
  [edit({before:'ABC',after:'X'}),edit({before:'ABC',after:'Y'})],
  [edit({before:'',after:'X'}),edit({before:'',after:'Y'})]
 ])assert.throws(()=>repaired(input,edits));
 assert.equal(repaired(input,[edit({before:'ABC',after:'X'}),edit({before:'DEF',after:'Y'})]).scenes[0].narration,'XY');
});

test('rejects unknown targets, scene 1, invalid line indices, empty or no-op changes, and wrong shape',()=>{
 const input=candidate();
 for(const invalid of [
  {sceneNumber:1},{sceneNumber:6},{sceneNumber:2.5},{field:'title'},
  {lineIndex:0},{field:'line',lineIndex:-1},{field:'line',lineIndex:2},{field:'line',lineIndex:0.5},
  {field:'line',lineIndex:0,before:'',after:'추가'},
  {before:'not present'},{before:'입자 수',after:'입자 수'},{after:''},{after:'   '},
  {before:'x'.repeat(651)},{after:'x'.repeat(651)},{unexpected:'property'}
 ])assert.throws(()=>repaired(input,[edit(invalid)]),JSON.stringify(invalid));
 for(const response of [null,{edits:[]},{edits:Array.from({length:25},()=>edit())},{edits:[edit()],other:true},{edits:[null]}])assert.throws(()=>applySceneEdits(input,response));
 for(const source of [null,{scenes:input.scenes.slice(1)},{scenes:[...input.scenes,input.scenes[0]]},{...input,other:true},{scenes:input.scenes.map((scene,i)=>i?scene:{...scene,lines:['only one']})}])assert.throws(()=>repaired(source,[edit()]));
});

test('rejects edits whose combined result is unchanged',()=>{
 const input=candidate();input.scenes[0].narration='abc';
 assert.throws(()=>repaired(input,[edit({before:'a',after:'ab'}),edit({before:'bc',after:'c'})]));
});

test('late validation failure leaves candidate and edit response unchanged and exposes no submitted text',()=>{
 const input=freeze(candidate()),before=structuredClone(input);
 const response=freeze({edits:[edit(),edit({sceneNumber:5,before:'PRIVATE_SENTINEL_NOT_PRESENT',after:'corrected'})]});
 const savedResponse=structuredClone(response);
 assert.throws(()=>applySceneEdits(input,response),error=>{
  assert.equal(error.message,'수업 수정 내용을 확인하지 못했습니다. 다시 시도해 주세요.');
  assert(!error.message.includes('PRIVATE_SENTINEL'));return true;
 });
 assert.deepEqual(input,before);assert.deepEqual(response,savedResponse);
});
