import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMaterials} from '../lib/materials-ai.js';
const payload={purpose:'gem-materials-v1',classroom:'en',mode:'history-voice-intent',courseId:'suneung-2027-history',question:{prompt:'대장경을 다시 만든 목적은?',choices:['성리학 교육 확대','불교 신앙으로 국난 극복 기원','신분제 폐지','새 주문 창시'],answerIndex:1,hints:['private hint'],explanation:'private explanation'},message:'불교의 힘을 빌려 몽골의 침입을 막으려 했다고 생각합니다.'};
const response=value=>Response.json({status:'completed',output_text:JSON.stringify(value)});
test('sentence interpretation sees public options only and returns the selected wrong choice unchanged',async()=>{
 const calls=[];
 const r=await handleMaterials(payload,{fetcher:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return response({kind:'answer',choiceIndex:0});}});
 assert.deepEqual(JSON.parse(r.text),{kind:'answer',choiceIndex:0});assert.equal(calls.length,1);
 const data=JSON.parse(calls[0].input[0].content);assert.deepEqual(Object.keys(data),['prompt','choices','student']);assert.equal(data.choices.length,4);
 assert.doesNotMatch(JSON.stringify(calls[0]),/private hint|private explanation|answerIndex/);assert.match(calls[0].instructions,/factually WRONG/);assert.match(calls[0].instructions,/NEVER solve/);
 assert.equal(calls[0].text.format.strict,true);
});
test('questions and ambiguous sentences stay distinct from answers',async()=>{
 for(const kind of ['question','clarify']){const r=await handleMaterials(payload,{fetcher:async()=>response({kind,choiceIndex:-1})});assert.deepEqual(JSON.parse(r.text),{kind,choiceIndex:-1});}
});
test('unsupported courses and invalid model interpretations fail closed',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return response({kind:'answer',choiceIndex:8});};
 await assert.rejects(handleMaterials({...payload,courseId:'m1-science'},{fetcher}),/Invalid voice intent/);assert.equal(calls,0);
 await assert.rejects(handleMaterials(payload,{fetcher}),/Invalid voice interpretation/);
 await assert.rejects(handleMaterials(payload,{fetcher:async()=>response({kind:'question',choiceIndex:1})}),/Invalid voice interpretation/);
});
