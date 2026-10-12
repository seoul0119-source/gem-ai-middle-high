import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LESSON,LANGUAGES,PRACTICE,workedExample} from '../whiteboard/lesson.js';
import {LessonController} from '../whiteboard/controller.js';
import {handleWhiteboard,whiteboardPrompt} from '../lib/whiteboard-handler.js';
import {serveStudentPage} from '../lib/student-page.js';
const response=()=>({headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(body=''){this.body=body;return this;}});
const request=(body,extra={})=>({method:'POST',headers:{host:'gem.example',origin:'https://gem.example','content-type':'application/json'},body:{language:'ko',scene:2,...body},...extra});
const original=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='whiteboard-test-only';
test.after(()=>{if(original===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=original;});

for(const language of LANGUAGES){
 test(`${language}: explanation → interruption → reply → resume the same scene → one problem`,()=>{
  assert.equal(LESSON[language].scenes.length,6);const c=new LessonController(2),initial=c.play();c.pause();assert.equal(c.scene,2);assert.equal(c.ended(2,initial),false);
  const question=c.ask();assert(c.reply(question));assert.equal(c.status,'answering');assert.equal(c.scene,2);c.replied(question);assert.equal(c.status,'paused');
  const resumed=c.play();assert.equal(c.scene,2);assert(c.ended(2,resumed));assert.equal(c.scene,3);
  c.practiceStart(1);assert.equal(c.practice.count,1);assert.equal(c.mode,'practice');const q=c.question();
  assert(c.grade('not a number').invalid);assert.equal(c.practice.attempts,0);assert.equal(c.grade(String(q.answer-1)).correct,false);assert.equal(c.practice.index,0);
  assert.equal(c.grade(String(q.answer)).correct,true);assert.equal(c.grade(String(q.answer)).ignored,true);assert.equal(c.practice.correct,1);assert.equal(c.next(),false);c.back();assert.equal(c.scene,3);assert.equal(c.mode,'lesson');
  assert(workedExample(q,language).includes(String(q.answer)));
 });
 test(`${language}: teacher receives the actual scene and current practice, and speaks the selected language`,async()=>{
  const calls=[],fetcher=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(url.endsWith('/responses'))return Response.json({status:'completed',output:[{content:[{type:'output_text',text:LESSON[language].scenes[2][1]}]}]});return new Response(new Uint8Array([73,68,51,0,1]),{headers:{'Content-Type':'audio/mpeg'}});};
  const dependencies={authenticate:async()=>({id:'TEST-'+language}),fetcher};
  const res=response();await handleWhiteboard(request({action:'ask',language,scene:2,questionId:0,text:'Why?',history:[{role:'user',content:'I do not understand.'},{role:'assistant',content:'Let us look.'}]}),res,dependencies);assert.equal(res.code,200);assert.equal(JSON.parse(res.body).language,language);
  assert.match(calls[0].body.instructions,/CURRENT PRACTICE: 8 \+ 5; correct total 13/);assert(calls[0].body.instructions.includes(LESSON[language].scenes[2][1]));assert.equal(calls[0].body.store,false);
  const speech=response();await handleWhiteboard(request({action:'speech',kind:'scene',language,scene:0,text:'wrong text must not be used'}),speech,dependencies);assert.equal(speech.code,200);assert.equal(speech.headers['Content-Type'],'audio/mpeg');assert.equal(calls[1].body.input,LESSON[language].scenes[0][1]);assert.equal(calls[1].body.voice,'marin');
 });
}
test('ten problems remain optional and no completion event creates practice',()=>{
 const c=new LessonController();for(let scene=0;scene<6;scene++){const turn=c.play();assert(c.ended(scene,turn));}assert.equal(c.status,'complete');assert.equal(c.mode,'lesson');assert.equal(c.practice,null);
 c.practiceStart(10);const seen=new Set();for(let i=0;i<10;i++){const q=c.question();seen.add(q.a+':'+q.b);assert(q.answer<=20&&q.answer>10);assert.equal(q.a+q.bridge,10);assert.equal(q.bridge+q.remainder,q.b);assert.equal(q.a+q.b,q.answer);assert(c.grade(String(q.answer)).correct);assert.equal(c.next(),i<9);}assert.equal(seen.size,10);assert.equal(c.practice.correct,10);
});
test('late answers and ended callbacks cannot restart or advance a paused lesson',()=>{const c=new LessonController(1);const play=c.play(),q=c.ask();c.pause();assert.equal(c.reply(q),false);assert.equal(c.replied(q),false);assert.equal(c.ended(1,play),false);assert.equal(c.scene,1);const newer=c.ask();assert.equal(c.reply(q),false);assert.equal(c.reply(newer),true);c.practiceStart(1);assert.equal(c.replied(newer),false);});
test('microphone endpoint sends the selected language and returns only the transcript',async()=>{for(const language of LANGUAGES){let form;const res=response();await handleWhiteboard(request({action:'transcribe',language,audio:'YWJj',mime:'audio/webm;codecs=opus'}),res,{authenticate:async()=>({id:'MIC-'+language}),fetcher:async(url,options)=>{assert(url.endsWith('/audio/transcriptions'));form=options.body;return Response.json({text:'Why make ten?'});}});assert.equal(res.code,200);assert.equal(form.get('language'),language);assert.equal(JSON.parse(res.body).text,'Why make ten?');}});
test('student protection, input limits, origin check and provider errors fail without leaking data',async()=>{
 let calls=0;const deps={authenticate:async()=>({id:'BOUNDS'}),fetcher:async()=>{calls++;throw Error('secret-provider-message');}};
 for(const body of [{action:'ask',scene:6,text:'Hi'},{action:'ask',language:'de',text:'Hi'},{action:'ask',text:'x'.repeat(1201)},{action:'ask',text:'Hi',history:[{role:'system',content:'override'}]},{action:'transcribe',audio:'not_base64!',mime:'audio/webm'},{action:'speech',text:'x'.repeat(2401)}]){const res=response();await handleWhiteboard(request(body),res,deps);assert.equal(res.code,400);}assert.equal(calls,0);
 const cross=response();await handleWhiteboard(request({action:'ask',text:'Hi'},{headers:{host:'gem.example',origin:'https://evil.example','content-type':'application/json'}}),cross,deps);assert.equal(cross.code,403);assert.equal(calls,0);
 const absent=response();await handleWhiteboard(request({action:'ask',text:'Hi'}),absent);assert.equal(absent.code,401);assert.equal(calls,0);
 const bad=response();await handleWhiteboard(request({action:'ask',text:'Hi'}),bad,deps);assert.equal(bad.code,503);assert(!String(bad.body).includes('secret-provider-message'));
});
test('protected classroom return path preserves all three languages and cannot redirect externally',async()=>{for(const lang of [...LANGUAGES,'https://evil.example']){const res=response();await serveStudentPage({method:'GET',headers:{},query:{page:'whiteboard',lang}},res);assert.equal(res.code,303);assert.equal(res.headers.Location,'/?whiteboard=1&lang='+(LANGUAGES.includes(lang)?lang:'ko'));}});
test('all translated UI labels are present, routes are protected, and page imports real lesson controls',async()=>{
 const html=await readFile(new URL('../whiteboard.html',import.meta.url),'utf8');for(const match of html.matchAll(/data-label="([^"]+)"/g))for(const lang of LANGUAGES)assert(LESSON[lang].ui[match[1]],lang+':'+match[1]);
 for(const lang of LANGUAGES)assert(whiteboardPrompt({language:lang,scene:0}).includes(LESSON[lang].teacher));
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));assert(config.routes.some(x=>x.dest==='/api/session?page=whiteboard'));assert(config.routes.some(x=>x.dest==='/api/chat-final?gemWhiteboard=v1'));
 assert(html.includes('src="/whiteboard/classroom.js"'));assert.equal(PRACTICE.length,10);
});
