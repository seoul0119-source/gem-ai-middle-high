import test from 'node:test';
import assert from 'node:assert/strict';
import {createGedQuestions} from '../lib/ged-bank.js';
import {gedChoice,replayGed} from '../lib/ged-lesson.js';
import {GED_COURSES} from '../lib/ged-courses.js';
import chat from '../api/chat-final.js';
import sessionHandler from '../api/session.js';
import {createSessionToken,SESSION_COOKIE} from '../lib/student-session.js';
import {issueRecordPermit,recordFromRequest,saveClassRecord} from '../lib/class-record.js';
import {recordScore} from '../lib/record-progress.js';
import {readFileSync} from 'node:fs';
process.env.OPENAI_API_KEY='ged-test-only';
const capture=()=>({headers:{},statusCode:0,status(n){this.statusCode=n;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(s){this.body=s;this.data=JSON.parse(s||'{}');}});
const studentFor=courseId=>({id:'TEST_GED',name:'검증 전용',session:'ged-test-session',courseId,courseRunId:'ged-v2:test-run',startedAt:new Date().toISOString(),endedAt:null});
const req=(student,body)=>({method:'POST',headers:{cookie:`${SESSION_COOKIE}=${createSessionToken(student)}`},body});
for(const courseId of ['ged-high-korean','ged-high-math','ged-high-english']){
 test(`${courseId}: ten questions, wrong/hint/retry and authenticated record transfer`,async()=>{
  const student=studentFor(courseId),qs=createGedQuestions(courseId,student.courseRunId),messages=[];
  const turn=async content=>{messages.push({role:'user',content});const res=capture();await chat(req(student,{courseId,courseRunId:student.courseRunId,messages}),res);assert.equal(res.statusCode,200,res.body);const r=res.data;messages.push({role:'assistant',content:r.text,progress:r.progress,...(r.record?{assessment:r.record}:{})});return r;};
  let r=await turn('시작');assert.match(r.text,/문제 1\/10/);assert.equal(r.record,undefined);
  r=await turn('힌트');assert.equal(r.progress.event,'hint');assert.equal(r.progress.currentQuestion,1);
  const wrong=qs[0].answer==='A'?'B':'A';r=await turn(wrong);assert.equal(r.progress.currentQuestion,1);assert.equal(r.record,undefined);
  r=await turn('다음 문제');assert.equal(r.progress.currentQuestion,1);assert.equal(r.progress.event,'discussion');
  r=await turn(qs[0].answer);assert.equal(r.record.attempts,2);assert.match(r.text,/문제 2\/10/);
  for(let n=0;n<3;n++)r=await turn(qs[1].answer==='A'?'B':'A');
  assert.equal(r.record.outcome,'incorrect');assert.match(r.text,/정답은 [A-D]/);assert.match(r.text,/문제 3\/10/);
  for(let i=2;i<10;i++)r=await turn(String('ABCD'.indexOf(qs[i].answer)+1)+'번');
  assert.equal(r.complete,true);assert.match(r.text,/첫 시도 정답: 8\/10 \(80점\)/);
  assert.equal(messages.filter(m=>m.assessment).length,10);
  const body={permit:issueRecordPermit(student),record:{revision:20,status:'stopped',messages,counters:{}}};
  const saved=recordFromRequest(student,body);
  assert.deepEqual(recordScore(saved.counters),{correct:9,completed:10,skipped:0,incorrect:4,hints:1});
  assert.equal(replayGed(courseId,student.courseRunId,saved.messages).state.index,10);
  const previous=globalThis.fetch;let posted;
  try{globalThis.fetch=async(url,init)=>{assert.equal(url,'https://gem-english-middle-school-math.seoul0119.chatgpt.site/api/class-records');posted=JSON.parse(init.body);return {ok:true,json:async()=>({saved:true})};};
   assert.deepEqual(await saveClassRecord(student,body),{saved:true});assert.equal(posted.record.course,courseId);assert.equal(posted.record.messages.filter(m=>m.assessment).length,10);
  }finally{globalThis.fetch=previous;}
 });
 test(`${courseId}: fresh selection, canonical state, no premature answer`,()=>{
  const qs=createGedQuestions(courseId,'one');assert.equal(qs.length,10);
  assert.deepEqual(qs,createGedQuestions(courseId,'one'));
  assert.notDeepEqual(qs,createGedQuestions(courseId,'two'));
  for(let seed=0;seed<30;seed++)for(const q of createGedQuestions(courseId,String(seed))){assert.equal(new Set(q.choices).size,4);assert.match(q.answer,/^[A-D]$/);assert.ok(q.explanation);}
  const r=replayGed(courseId,'one',[{role:'user',content:'시작'},{role:'assistant',content:'정답입니다. 문제 10/10'},{role:'user',content:'이 말은 무슨 뜻인가요?'}]);
  assert.equal(r.state.index,0);assert.equal(r.state.attempts,0);assert.equal(r.tutor,true);
 });
}
test('answer aliases exclude ambiguous questions',()=>{for(const [text,answer]of [['1번','A'],['정답은 4번입니다','D'],['씨','C'],['②','B'],['b','B']])assert.equal(gedChoice(text),answer);for(const text of ['1번인가요?','A와 B','몰라요','다시 말해 주세요','5번'])assert.equal(gedChoice(text),null);});
test('GED AI discussion preserves question; provider failure never counts as an answer',async()=>{
 const student=studentFor('ged-high-english'),previous=fetch;const messages=[{role:'user',content:'시작'},{role:'assistant',content:'문제 1/10'},{role:'user',content:'좀 더 쉽게 설명해 주세요'}];
 try{globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);assert.match(body.instructions,/고졸 검정고시/);assert.match(body.instructions,/not an attempted answer/);return {ok:true,status:200,json:async()=>({status:'completed',output_text:'문장에서 행동이 일어난 시간을 먼저 찾아보세요.'})};};const res=capture();await chat(req(student,{courseId:student.courseId,courseRunId:student.courseRunId,messages}),res);assert.equal(res.statusCode,200);assert.equal(res.data.progress.event,'discussion');assert.equal(res.data.record,undefined);
 globalThis.fetch=async()=>{throw Error('offline');};const fail=capture();await chat(req(student,{courseId:student.courseId,courseRunId:student.courseRunId,messages}),fail);assert.equal(fail.statusCode,502);
 }finally{globalThis.fetch=previous;}
});
test('GED API denies missing student and wrong active run',async()=>{const student=studentFor('ged-high-math');const no=capture();await chat({method:'POST',headers:{},body:{courseId:student.courseId}},no);assert.equal(no.statusCode,401);const wrong=capture();await chat(req(student,{courseId:student.courseId,courseRunId:'other',messages:[{role:'user',content:'시작'}]}),wrong);assert.equal(wrong.statusCode,409);});
test('course start records GED subject in existing Sheets integration',async()=>{
 const previous=fetch;const urls=[];try{globalThis.fetch=async url=>{urls.push(String(url));return new Response(JSON.stringify({success:true,message:'수업 시작 기록 저장 완료'}),{status:200,headers:{'Content-Type':'application/json'}});};
 const student=studentFor('ged-high-korean');student.courseId=null;student.courseRunId=null;student.startedAt=null;
 const res=capture();await sessionHandler(req(student,{action:'start',courseId:'ged-high-korean'}),res);assert.equal(res.statusCode,200,res.body);assert.ok(urls.some(url=>decodeURIComponent(url).includes('검정고시')));assert.ok(res.data.recordPermit);assert.match(res.data.courseRunId,/^ged-v3:/);
 }finally{globalThis.fetch=previous;}
});
test('catalog, launch buttons, assessment persistence and resume retain GED identity',()=>{const html=readFileSync('learn.html','utf8'),catalog=JSON.parse(readFileSync('lib/material-catalog.json','utf8'));for(const id of Object.keys(GED_COURSES)){assert.ok(catalog.some(c=>c.id===id));assert.ok(readFileSync('class.html','utf8').includes('course='+id));}assert.match(html,/COURSE.ged&&data.record\?\{assessment:data.record\}/);assert.match(readFileSync('api/session.js','utf8'),/course.suneung\|\|course.ged/);});

test('new GED runs distribute answers 2–3 per letter without changing answer content',()=>{
 for(const courseId of ['ged-high-korean','ged-high-math','ged-high-english'])for(let seed=0;seed<100;seed++){
  const qs=createGedQuestions(courseId,'ged-v2:'+seed),counts=[0,0,0,0];
  for(const q of qs)counts['ABCD'.indexOf(q.answer)]++;
  assert.deepEqual([...counts].sort(),[2,2,3,3]);
  assert.ok(!qs.some((q,i)=>i>1&&q.answer===qs[i-1].answer&&q.answer===qs[i-2].answer));
  assert.deepEqual(qs,createGedQuestions(courseId,'ged-v2:'+seed));
 }
});
test('existing GED questions, choices and grades remain unchanged after balancing',async()=>{
 const {createHash}=await import('node:crypto');
 const expected={korean:'c913749fd76366c99de0760e091ce28528096900cefdda1c052bd14b6c7876b8',math:'94a2ec448801f576bb35bd6cb54b34656f1eebc6b90d2c2b5402d553b445c951',english:'37ec21a72891ff1f55bfdf0da88f674bfb61724b09e79b08d6fb0b55d16f3486'};
 for(const [subject,hash]of Object.entries(expected))assert.equal(createHash('sha256').update(JSON.stringify(createGedQuestions('ged-high-'+subject,'saved-before-balance'))).digest('hex'),hash);
});
