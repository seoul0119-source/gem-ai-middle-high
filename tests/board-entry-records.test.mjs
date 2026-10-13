import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sessionHandler from '../api/session.js';
import {getCourse} from '../api/courses.js';
import {BOARD_CATALOG} from '../whiteboard/board-catalog.js';
import {boardLoginEntry} from '../whiteboard/board-entry.js';
import {serveStudentPage} from '../lib/student-page.js';
import {createSessionToken,SESSION_COOKIE} from '../lib/student-session.js';
import {recordFromRequest,verifyRecordTransfer} from '../lib/class-record.js';

const previousKey=process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY='board-entry-records-test-only';
test.after(()=>{if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;});

const worksheet='12345678-1234-4234-8234-123456789012';
const transfer='signed-capability-for-current-worksheet-1234567890';
const baseStudent={id:'R269991',name:'Record test',session:'11111111-1111-4111-8111-111111111111'};
function response(){return {statusCode:0,headers:new Map(),body:'',status(value){this.statusCode=value;return this;},setHeader(key,value){this.headers.set(key.toLowerCase(),value);return this;},end(value=''){this.body=value;return this;}};}
function signedRequest(body,student=baseStudent){return {method:'POST',headers:{cookie:`${SESSION_COOKIE}=${createSessionToken(student)}`},body};}
function savedStudent(res){const cookie=res.headers.get('set-cookie');assert(cookie);const token=cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];return JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8'));}
async function call(body,student=baseStudent){const res=response();await sessionHandler(signedRequest(body,student),res);return res;}
function syntheticSheet(calls,{resumeRecord}={}){
  return async (raw,options={})=>{
    const url=new URL(raw);
    if(url.hostname==='gem-english-middle-school-math.seoul0119.chatgpt.site'&&url.pathname==='/api/class-records'){
      const body=JSON.parse(options.body);assert(verifyRecordTransfer(body.ticket,body.record));
      assert.equal(body.record.operation,'resume');assert.equal(body.record.student,baseStudent.id);
      calls.push({action:'resume',id:body.record.id});
      return Response.json({record:structuredClone(resumeRecord)});
    }
    assert.equal(url.hostname,'script.google.com','tests must not call any other remote service');
    const args=Object.fromEntries(url.searchParams);calls.push(args);
    if(args.action==='login')return new Response('<a href="https://gem-ai-middle-high.vercel.app/class.html?id=R269991&name=Record-test&session=22222222-2222-4222-8222-222222222222">입장</a>');
    assert(['start','end'].includes(args.action));
    return new Response(args.action==='start'?'수업 시작 기록이 저장되었습니다.':'수업이 종료되었습니다.');
  };
}

test('all trusted board classrooms survive protected-page login with their language, worksheet and transfer',async()=>{
  for(const course of BOARD_CATALOG){
    const res=response();
    await serveStudentPage({method:'GET',headers:{},query:{page:'science-board',course:course.id,worksheet}},res);
    assert.equal(res.statusCode,303);
    const login=new URL(res.headers.get('location'),'https://gem.example');
    const entry=boardLoginEntry(login.search,'#transfer='+transfer);
    assert.equal(entry.courseId,course.id);assert.equal(entry.language,course.language);
    const returned=new URL(entry.destination,'https://gem.example');
    assert.equal(returned.origin,'https://gem.example');assert.equal(returned.pathname,'/science-board.html');
    assert.equal(returned.searchParams.get('course'),course.id);assert.equal(returned.searchParams.get('worksheet'),worksheet);
    assert.equal(new URLSearchParams(returned.hash.slice(1)).get('transfer'),transfer);
  }
});

test('board login rejects unknown courses and strips untrusted routing data',()=>{
  assert.equal(boardLoginEntry('?scienceboard=1&course=https://other.example/'),null);
  assert.equal(boardLoginEntry('?scienceboard=1&course=materials-en-99-99'),null);
  assert.equal(boardLoginEntry('?course=h3-science'),null);
  assert.deepEqual(boardLoginEntry('?scienceboard=1'),{courseId:'h3-science',language:'ko',destination:'/science-board.html'});
  const entry=boardLoginEntry('?scienceboard=1&course=materials-fr-1-0&worksheet=../../bad&redirect=https://other.example/#bad','#transfer=https://other.example');
  assert.equal(entry.destination,'/science-board.html?course=materials-fr-1-0');assert.equal(entry.language,'fr');
});

test('entry page awaits trusted board navigation instead of hard-coding the two pilots',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/import\('\.\/whiteboard\/board-entry\.js'\)/);
  assert.match(html,/const boardEntry = await boardEntrance/);
  assert.match(html,/selectLanguage\(entry\.language\)/);
  assert.match(html,/const boardDestination=boardEntry\?\.destination/);
  assert.doesNotMatch(html,/\['h3-science','suneung-2027-chemistry-1'\]\.includes/);
});

test('English and French board runs record trusted metadata, signed transcripts and matched completion',async()=>{
  const originalFetch=globalThis.fetch;
  try{
    for(const courseId of ['materials-en-1-0','materials-en-advanced-0','materials-fr-1-0','materials-fr-bac-argumentation']){
      const course=BOARD_CATALOG.find(item=>item.id===courseId);assert(course);
      assert.equal(getCourse(courseId),null,'record support must not register new legacy chat courses');
      const calls=[];globalThis.fetch=syntheticSheet(calls);
      const start=await call({action:'start',courseId});assert.equal(start.statusCode,200,start.body);
      const data=JSON.parse(start.body),student=savedStudent(start);
      assert.equal(data.courseId,courseId);assert.equal(student.courseId,courseId);assert.equal(student.courseRunId,data.courseRunId);
      assert.equal(calls.length,1);assert.equal(calls[0].action,'start');assert.equal(calls[0].subject,course.subject);assert.equal(calls[0].course,course.subject);assert.equal(calls[0].grade,course.grade);assert.equal(calls[0].level,course.grade);
      const body={permit:data.recordPermit,record:{revision:2,status:'studying',course:'forged-course',lessonSeed:'science-board:synthetic-lesson',messages:[
        {role:'assistant',content:'Question 1/10 · Exercice 1/10',progress:{event:'question',question:1,currentQuestion:1}},
        {role:'user',content:'B'},
        {role:'assistant',content:'Try again / Réessaie',progress:{event:'incorrect',question:1,currentQuestion:1}}
      ],counters:{current:1,items:{}}}};
      const record=recordFromRequest(student,body);
      assert.equal(record.course,courseId);assert.equal(record.id,data.courseRunId);assert.equal(record.student,baseStudent.id);
      assert.equal(record.counters.items[1].incorrect,1);assert.equal(record.counters.items[1].completed,false);
      assert.throws(()=>recordFromRequest({...student,id:'R269992'},body),/학생 정보/);
      const stale=await call({action:'end',courseId,courseRunId:'different-run'},student);assert.equal(stale.statusCode,409);assert.equal(calls.length,1);
      const beacon=await call({action:'end-on-exit',courseId,courseRunId:data.courseRunId},student);assert.equal(beacon.statusCode,200);assert.equal(beacon.headers.has('set-cookie'),false);
      const ended=await call({action:'end',courseId,courseRunId:data.courseRunId},student);assert.equal(ended.statusCode,200);assert(savedStudent(ended).endedAt);
      assert.deepEqual(calls.map(item=>item.action),['start','end','end']);
      const logout=await call({action:'logout'},student);assert.equal(logout.statusCode,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);assert.equal(calls.at(-1).action,'end');
    }
  }finally{globalThis.fetch=originalFetch;}
});

test('resumed international board records retain original run, lease, transcript and progress in the save permit',async()=>{
  const originalFetch=globalThis.fetch;
  try{
    for(const courseId of ['materials-en-1-0','materials-fr-bac-argumentation']){
      const record={id:'saved-board-run',student:baseStudent.id,course:courseId,started:'2026-10-13T00:00:00Z',lease:'new-lease',revision:6,status:'stopped',messages:[{role:'user',content:'Why? Pourquoi ?'},{role:'assistant',content:'Original explanation',progress:{event:'discussion',question:2,currentQuestion:2,completed:false}}],counters:{current:2,items:{}},lessonSeed:'science-board:original'};
      const calls=[];globalThis.fetch=syntheticSheet(calls,{resumeRecord:record});
      const res=await call({action:'resume-class-record',id:record.id});assert.equal(res.statusCode,200,res.body);
      const data=JSON.parse(res.body);assert.equal(data.courseId,courseId);assert.deepEqual(data.record,record);
      const restored=recordFromRequest(savedStudent(res),{permit:data.recordPermit,record:{...record,revision:7,status:'studying'}});
      assert.equal(restored.id,record.id);assert.equal(restored.lease,record.lease);assert.equal(restored.course,courseId);assert.equal(restored.started,record.started);assert.deepEqual(restored.messages,record.messages);
      assert.deepEqual(calls.map(item=>item.action),['resume','login','start']);
      const end=await call({action:'end',courseId,courseRunId:data.courseRunId},savedStudent(res));assert.equal(end.statusCode,200);
    }
  }finally{globalThis.fetch=originalFetch;}
});

test('forged international course and unauthenticated record entry cannot cause sheet changes',async()=>{
  const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('No network expected');};
  try{
    for(const action of ['start','end','end-on-exit']){
      const res=await call({action,courseId:'materials-en-99-99',courseRunId:'forged'});assert.equal(res.statusCode,400);
    }
    const res=response();await sessionHandler({method:'POST',headers:{},body:{action:'start',courseId:'materials-en-1-0'}},res);assert.equal(res.statusCode,401);
    const restart=await call({action:'restart',courseId:'materials-en-1-0'});assert.equal(restart.statusCode,400,'legacy restart stays scoped to legacy courses');
    assert.equal(calls,0);
  }finally{globalThis.fetch=originalFetch;}
});
