import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ELEMENTARY_COURSES } from '../lib/elementary-courses.js';
import { getCourse } from '../api/courses.js';
import sessionHandler from '../api/session.js';
import chatHandler from '../api/chat-final.js';
import { createSessionToken, SESSION_COOKIE } from '../lib/student-session.js';
const entries = Object.entries(ELEMENTARY_COURSES);
const response = () => ({ statusCode:200, headers:{}, body:null,
  getHeader(k){return this.headers[k];},status(c){this.statusCode=c;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(v){this.body=JSON.parse(v);} });
function request(body, student={}) {
  const token=createSessionToken({id:'BUILD_CHECK',name:'합성 검증',session:'synthetic-session',...student});
  return {method:'POST',headers:{cookie:`${SESSION_COOKIE}=${token}`},body};
}
test('32 entrance routes match browser catalog and server, with 4/4/6/6/6/6 courses',()=>{
  const context={}; vm.runInNewContext(readFileSync(new URL('../elementary-catalog.js',import.meta.url),'utf8'),context);
  const client=context.GEM_ELEMENTARY_CONFIGS;
  assert.equal(entries.length,32); assert.equal(Object.keys(client).length,32);
  const html=readFileSync(new URL('../class.html',import.meta.url),'utf8');
  for (let g=1;g<=6;g++) assert.equal(entries.filter(([,c])=>c.elementaryGrade===g).length,g<=2?4:6);
  for(const [id,c] of entries){
    assert.equal(getCourse(id),c); assert.equal(client[id].grade,c.grade);assert.equal(client[id].subject,c.subject);
    assert.equal(client[id].title,c.title);assert.equal(client[id].spokenReview,true);
    assert.equal(html.split(`data-href="/learn.html?course=${id}"`).length-1,1);
    assert.equal(c.topics.length,6);
  }
});
test('all 32 courses pass the existing signed-session start/end Sheet contract',async()=>{
  const savedFetch=globalThis.fetch, savedKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='synthetic-elementary-key';
  try {
    const calls=[];
    globalThis.fetch=async url=>{const u=new URL(url);calls.push(u);return {ok:true,text:async()=>JSON.stringify({success:true,action:u.searchParams.get('action')})};};
    for(const [id,c] of entries){
      const start=response();await sessionHandler(request({action:'start',courseId:id}),start);
      assert.equal(start.statusCode,200);assert.ok(start.body.courseRunId);
      const params=calls.at(-1).searchParams;assert.equal(params.get('subject'),c.subject);assert.equal(params.get('grade'),c.grade);assert.equal(params.get('level'),`Lv.${c.elementaryGrade}`);
      const end=response();await sessionHandler(request({action:'end',courseId:id,courseRunId:start.body.courseRunId},{courseId:id,courseRunId:start.body.courseRunId}),end);
      assert.equal(end.statusCode,200);assert.equal(calls.at(-1).searchParams.get('action'),'end');
    }
    assert.equal(calls.length,64);
  }finally{globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedKey;}
});
test('each elementary course reaches shared lesson generation, and hints use its current problem context',async()=>{
  const savedFetch=globalThis.fetch,savedKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='synthetic-elementary-key';
  try {
    let calls=[];
    globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({output_text:'문제 1/10 — 생활\n친구에게 고마움을 전하는 말을 써 보세요.\n답: (________)'})};};
    for(const [id,c] of entries){
      calls=[];const res=response();
      await chatHandler(request({courseId:id,courseRunId:'elementary-test-run',messages:[{role:'user',content:'시작'}]},{courseId:id,courseRunId:'elementary-test-run'}),res);
      assert.equal(res.statusCode,200,id);assert.ok(calls.length>=1,id);
      assert.ok(calls[0].instructions.includes(c.prompt));assert.match(res.body.text,/문제 1\/10/);
    }
    calls=[];const res=response();
    await chatHandler(request({courseId:'e1-math',courseRunId:'elementary-test-run',messages:[{role:'assistant',content:'문제 1/10 — 덧셈\n사과 두 개에 한 개를 더하면 몇 개인가요?\n답: (________)'},{role:'user',content:'힌트 주세요'}]},{courseId:'e1-math',courseRunId:'elementary-test-run'}),res);
    assert.equal(res.statusCode,200);assert.equal(calls.length,1);assert.match(calls[0].input[0].content,/사과/);assert.match(calls[0].instructions,/시도 횟수를 늘리거나/);
  }finally{globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedKey;}
});
