import test from 'node:test';
import assert from 'node:assert/strict';
import {createScienceRecords} from '../whiteboard/science-records.js';
import {recordProgress,recordScore} from '../lib/record-progress.js';

function fixture(customFetch){
  const calls=[],snapshots=[],notices=[];
  let number=0;
  const fetcher=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    if(customFetch)return customFetch(body);
    return Response.json(body.action==='start'?{courseId:'h3-science',courseRunId:'run-'+(++number),recordPermit:'permit-'+number}:{success:true});
  };
  const records=createScienceRecords({studentId:'RECORD-TEST',fetcher,notify:text=>notices.push(text),recordsFactory:({student})=>{
    assert.equal(student,'RECORD-TEST');
    return {queue:(id,permit,record)=>snapshots.push({id,permit,record}),flush:async()=>true};
  }});
  return {records,calls,snapshots,notices};
}
const lesson=id=>({id,title:'운동량과 충격량',topicId:'momentum'});
const question={questionIndex:0,prompt:'질량 2 kg인 물체가 오른쪽으로 3 m/s로 움직일 때 운동량은?',choices:['오른쪽 6 kg·m/s','오른쪽 3 kg·m/s','왼쪽 6 kg·m/s','0 kg·m/s']};

test('record adapter starts only on learner action and binds snapshots to returned course run',async()=>{
  const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.records.event('question',question),false);
  assert.equal(await f.records.start(lesson('first')),true);
  assert.deepEqual(f.calls,[{action:'start',courseId:'h3-science'}]);
  f.records.event('question',{...question,lessonId:'first'});
  f.records.event('dialogue',{lessonId:'first',question:'방향도 써야 하나요?',answer:'운동량은 벡터이므로 방향도 표현해요.'});
  assert.equal(f.records.event('dialogue',{lessonId:'older',question:'late',answer:'late'}),false);
  await f.records.end();
  assert.equal(f.calls[1].action,'end');assert.equal(f.calls[1].courseRunId,'run-1');
  const last=f.snapshots.at(-1);assert.equal(last.id,'run-1');assert.equal(last.permit,'permit-1');assert.equal(last.record.status,'stopped');
  assert.equal(last.record.lessonSeed,'science-board:first');
  assert(last.record.messages.some(message=>message.content==='방향도 써야 하나요?'));
});

test('wrong attempts remain open; correct and exhausted attempts rebuild accurate report scores',async()=>{
  const f=fixture();await f.records.start(lesson('grading'));f.records.event('question',question);
  const grade={...question,answerIndex:0,explanation:'운동량은 질량과 속도의 곱이므로 오른쪽 6 kg·m/s입니다.'};
  assert(f.records.event('attempt',{...grade,selectedIndex:1,correct:false,attempts:1}));
  let state=recordProgress(f.snapshots.at(-1).record.messages);
  assert.equal(state.items[1].completed,false);assert.equal(state.items[1].incorrect,1);
  assert(f.records.event('attempt',{...grade,selectedIndex:0,correct:true,attempts:2}));
  state=recordProgress(f.snapshots.at(-1).record.messages);assert.equal(state.items[1].completed,true);assert.equal(state.items[1].result,'correct');assert.equal(state.items[1].incorrect,1);
  f.records.event('question',{...question,questionIndex:1});
  for(let attempts=1;attempts<=3;attempts++)f.records.event('attempt',{...grade,questionIndex:1,selectedIndex:2,correct:false,attempts});
  state=recordProgress(f.snapshots.at(-1).record.messages);
  assert.equal(state.items[2].result,'revealed');assert.equal(state.items[2].incorrect,3);
  assert.deepEqual(recordScore(state),{correct:1,completed:2,skipped:0,incorrect:4,hints:0});
  f.records.event('completed',{correct:10,total:10});
  assert.deepEqual(recordScore(recordProgress(f.snapshots.at(-1).record.messages)),recordScore(state));
});

test('automatically displayed wrong-answer hint is preserved without inventing a student request',async()=>{
  const f=fixture();await f.records.start(lesson('hint'));f.records.event('question',question);
  const hint='운동량을 구하는 식에 질량과 속도를 대입해 보세요.';
  f.records.event('attempt',{...question,answerIndex:0,selectedIndex:1,correct:false,attempts:1,hints:[hint,'단위와 방향도 확인해 보세요.']});
  const messages=f.snapshots.at(-1).record.messages,state=recordProgress(messages);
  assert.equal(state.items[1].hints,1);assert.equal(state.items[1].incorrect,1);assert.equal(state.items[1].completed,false);
  assert.equal(messages.at(-1).content,hint);assert(!messages.some(message=>message.role==='user'&&message.content==='힌트 보기'));
});

test('solution disclosure is completed but does not fabricate a wrong attempt or a correct answer',async()=>{
  const f=fixture();await f.records.start(lesson('solution'));f.records.event('question',question);
  f.records.event('revealed',{questionIndex:0,explanation:'운동량은 질량과 속도의 곱입니다.'});
  const state=recordProgress(f.snapshots.at(-1).record.messages);
  assert.equal(state.items[1].completed,true);assert.equal(state.items[1].result,'revealed');assert.equal(state.items[1].incorrect,0);
  assert.equal(f.records.event('attempt',{...question,answerIndex:0,selectedIndex:2,correct:true,attempts:1}),false);
});

test('overlapping new lessons serialize start/end and never reuse another lesson permit',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});let number=0;
  const f=fixture(async body=>{if(body.action==='start'){number++;if(number===1)await gate;return Response.json({courseId:'h3-science',courseRunId:'run-'+number,recordPermit:'permit-'+number});}return Response.json({success:true});});
  const first=f.records.start(lesson('one'));await Promise.resolve();await Promise.resolve();
  const second=f.records.start(lesson('two'));f.records.event('question',{...question,lessonId:'two'});
  release();assert.equal(await first,false);assert.equal(await second,true);
  assert.deepEqual(f.calls.map(call=>call.action),['start','end','start']);
  assert.equal(f.calls[1].courseRunId,'run-1');
  assert(f.snapshots.length>0);for(const snapshot of f.snapshots)assert.equal(snapshot.permit,snapshot.id.replace('run','permit'));
  const latest=f.snapshots.at(-1);assert.equal(latest.id,'run-2');assert.equal(latest.record.lessonSeed,'science-board:two');
  assert(latest.record.messages.some(message=>message.content.includes(question.prompt)));
});

test('failed session admission never queues scores with an absent or forged permit',async()=>{
  const f=fixture(async()=>Response.json({error:'등록 상태를 확인해 주세요.'},{status:403}));
  assert.equal(await f.records.start(lesson('denied')),false);
  f.records.event('question',question);await f.records.flush();await f.records.end();
  assert.equal(f.snapshots.length,0);assert.equal(f.calls.length,1);assert(f.notices.some(text=>text.includes('연결 확인 필요')));
});
