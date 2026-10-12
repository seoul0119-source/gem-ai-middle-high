import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {SCIENCE_TOPICS,scienceLessonIssues} from '../lib/science-board-content.js';

const original=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='science-handler-test-only';
test.after(()=>{if(original===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=original;});
const time=Date.parse('2026-10-12T10:00:00.000Z');
const response=()=>({headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(body=''){this.body=body;return this;}});
const request=(body,extra={})=>({method:'POST',headers:{host:'gem.example',origin:'https://gem.example','content-type':'application/json'},body:{pilot:'science',...body},...extra});
const student=()=>({id:'TEST-'+randomUUID(),session:'private-session-'+randomUUID(),authenticatedAt:Math.floor(time/1000),exp:Math.floor(time/1000)+12*3600});
function lesson(complete=false,id=randomUUID()){
 const topic=SCIENCE_TOPICS[0];
 return {id,topicId:topic.id,title:topic.title,language:'ko',courseId:'h3-science',createdAt:time,complete,scenes:Array.from({length:complete?5:1},(_,i)=>({title:'개념 설명 '+(i+1),lines:['자기 선속이 변할 때 유도 기전력이 발생합니다.','변화를 방해하는 방향을 살펴봅니다.'],narration:('자기 선속이 변할 때 코일에 유도 기전력이 생깁니다. 렌츠 법칙으로 그 방향을 생각해 봅시다. 코일을 지나는 자기 선속이 증가하는지 감소하는지부터 확인하면 방향을 판단할 수 있습니다. ').repeat(2)}))};
}
const material=()=>({title:'전자기 유도 개념 확인',questions:Array.from({length:10},(_,i)=>({prompt:`사례 ${i+1}: 코일을 지나는 자기 선속이 일정할 때 유도 기전력은 어떻게 되나요?`,choices:['영이다.','항상 증가한다.','항상 감소한다.','무한대이다.'],answerIndex:0,hints:['시간에 따른 변화를 생각해 보세요.','자기 선속의 변화율을 살펴보세요.'],explanation:'자기 선속이 일정하면 그 변화율은 영이므로 유도 기전력도 영입니다.'}))});
async function call(body,deps,extra){const res=response();await handleScienceBoard(request(body,extra),res,deps);return res;}
function dependencies(member=student()){
 const intro=lesson();
 return {authenticate:async()=>member,now:()=>time,generateIntro:async()=>intro,generateRemainder:async old=>({...lesson(true,old.id),scenes:[old.scenes[0],...lesson(true,old.id).scenes.slice(1)]}),generatePractice:async()=>({material:material()}),ask:async()=>({answer:'자기 선속의 변화율과 코일의 방향을 함께 살펴봅시다.'})};
}
async function start(deps){const res=await call({action:'start',topicId:SCIENCE_TOPICS[0].id},deps);assert.equal(res.code,200,res.body);return JSON.parse(res.body);}
const tokenPayload=token=>JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
function signFixture(value){const encoded=Buffer.from(JSON.stringify(value)).toString('base64url'),key=createHash('sha256').update(`gem-science-board-token-v1:${process.env.OPENAI_API_KEY}`).digest();return encoded+'.'+createHmac('sha256',key).update(encoded).digest('base64url');}
function legacyFixture(token){const {subject,resumeUntil,...value}=tokenPayload(token);return signFixture({...value,v:1});}

test('science API authenticates before content generation and validates origin, method and request bounds',async()=>{
 const absent=await call({action:'start',topicId:SCIENCE_TOPICS[0].id});assert.equal(absent.code,401);
 const deps=dependencies();let calls=0;deps.generateIntro=async()=>{calls++;return lesson();};
 for(const [body,extra,status]of [
  [{action:'start',topicId:'unknown'},undefined,400],
  [{action:'start',topicId:SCIENCE_TOPICS[0].id},{headers:{host:'gem.example',origin:'https://other.example','content-type':'application/json'}},403],
  [{action:'start',topicId:SCIENCE_TOPICS[0].id},{headers:{host:'gem.example',origin:'not a URL','content-type':'application/json'}},403],
  [{action:'start',topicId:SCIENCE_TOPICS[0].id},{headers:{host:'gem.example','content-type':'text/plain'}},415],
  [{action:'start',topicId:SCIENCE_TOPICS[0].id,junk:'x'.repeat(2*1024*1024)},undefined,413],
  [{action:'unknown'},undefined,400],
  [{action:'start',topicId:SCIENCE_TOPICS[0].id},{method:'DELETE'},405]
 ]){const res=await call(body,deps,extra);assert.equal(res.code,status,res.body);}
 assert.equal(calls,0);
 const catalog=await call({},deps,{method:'GET'});assert.equal(catalog.code,200);assert.equal(JSON.parse(catalog.body).topics.length,SCIENCE_TOPICS.length);
});

test('signed lessons hide the original session, reject tampering or another owner, and expire',async()=>{
 const member=student(),deps=dependencies(member),begun=await start(deps);
 assert.equal(scienceLessonIssues(begun.lesson,{allowIntro:true}).length,0);
 const payload=JSON.parse(Buffer.from(begun.token.split('.')[0],'base64url').toString());
 assert(!JSON.stringify(payload).includes(member.session));assert(!JSON.stringify(payload).includes(member.id));
 const tampered=begun.token.slice(0,-1)+(begun.token.endsWith('A')?'B':'A');
 for(const [token,auth]of [[tampered,member],[begun.token,{...member,authenticatedAt:member.authenticatedAt-1}],[begun.token,{...member,id:'different'}]]){
  const res=await call({action:'continue',token},{...deps,authenticate:async()=>auth});assert.equal(res.code,403,res.body);assert.equal(JSON.parse(res.body).error,'invalid_lesson_token');
 }
 const rotated=await call({action:'continue',token:begun.token},{...deps,authenticate:async()=>({...member,session:'rotated-sheet-session'})});assert.equal(rotated.code,200,rotated.body);
 const expired=await call({action:'continue',token:begun.token},{...deps,now:()=>time+3*3600000});assert.equal(expired.code,410);assert.equal(JSON.parse(expired.body).error,'lesson_expired');
 const refreshed=await call({action:'continue',token:begun.token},{...deps,now:()=>time+3600000});assert.equal(refreshed.code,200);
 const finished=JSON.parse(refreshed.body),fullPayload=JSON.parse(Buffer.from(finished.token.split('.')[0],'base64url').toString());
 assert.equal(fullPayload.exp,payload.exp);assert.deepEqual(finished.lesson.scenes[0],begun.lesson.scenes[0]);
 let duplicate=0;const again=await call({action:'continue',token:finished.token},{...deps,now:()=>time+3600000,generateRemainder:async()=>{duplicate++;throw Error('should not generate');}});assert.equal(again.code,200);assert.equal(duplicate,0);
});

test('practice can start from intro and remains bound to the same completed lesson and canonical question',async()=>{
 const deps=dependencies(),begun=await start(deps);let receivedNovelty,context;
 const generated=await call({action:'practice',token:begun.token,noveltyHistory:['Earlier problem']},{...deps,generatePractice:async(current,opts)=>{assert.equal(current.complete,false);receivedNovelty=opts.noveltyHistory;return {material:material()};}});
 assert.equal(generated.code,200,generated.body);assert.deepEqual(receivedNovelty,['Earlier problem']);
 const {quizToken}=JSON.parse(generated.body),completed=JSON.parse((await call({action:'continue',token:begun.token},deps)).body);
 const answered=await call({action:'ask',token:completed.token,scene:3,text:'이 단계는 왜 필요한가요?',history:[{role:'user',content:'다시 설명해 주세요.'}],questionIndex:4,quizToken,question:{prompt:'ATTACKER QUESTION'},result:'revealed'},{...deps,ask:async(current,args)=>{context={current,args};return {answer:'변화율을 확인하고 해당 조건을 비교해 보세요.'};}});
 assert.equal(answered.code,200,answered.body);assert.equal(context.current.id,begun.lesson.id);assert.equal(context.args.scene,3);assert.equal(context.args.question.prompt,material().questions[4].prompt);assert.equal(context.args.question.result,'unresolved');assert(!JSON.stringify(context).includes('ATTACKER'));
 const other=await start({...deps,generateIntro:async()=>lesson()});const wrongLesson=await call({action:'ask',token:other.token,scene:0,text:'왜요?',questionIndex:0,quizToken},deps);assert.equal(wrongLesson.code,403);
 const wrongPurpose=await call({action:'continue',token:quizToken},deps);assert.equal(wrongPurpose.code,403);
 const corrupted=await call({action:'ask',token:begun.token,scene:0,text:'왜요?',questionIndex:0,quizToken:quizToken+'x'},deps);assert.equal(corrupted.code,403);
 for(const [progress,result]of [[{choiceIndex:0},'correct'],[{choiceIndex:1},'unresolved'],[{revealed:true},'revealed']]){
  const res=await call({action:'ask',token:begun.token,scene:0,text:'설명해 주세요.',questionIndex:0,quizToken,...progress},{...deps,ask:async(current,args)=>{assert.equal(args.question.result,result);assert.equal(args.question.answerIndex,0);return {answer:'정확한 개념을 다시 살펴봅시다.'};}});assert.equal(res.code,200,res.body);
 }
 for(const progress of [{choiceIndex:4},{choiceIndex:'0'},{revealed:'true'}])assert.equal((await call({action:'ask',token:begun.token,scene:0,text:'설명해 주세요.',questionIndex:0,quizToken,...progress},deps)).code,400);
});

test('resume reauthenticates expired v2 content without generating or replacing the exact lesson and quiz',async()=>{
 const member=student(),deps=dependencies(member),begun=await start(deps);
 const completed=JSON.parse((await call({action:'continue',token:begun.token},deps)).body),practiced=JSON.parse((await call({action:'practice',token:begun.token},deps)).body);
 const later=time+4*3600000,at=Math.floor(later/1000),fresh={...member,session:'fresh-session',authenticatedAt:at,exp:at+90};let providerCalls=0;
 const rejectProvider=async()=>{providerCalls++;throw Error('resume must not generate');};
 const resumedDeps={...deps,authenticate:async()=>fresh,now:()=>later,generateIntro:rejectProvider,generateRemainder:rejectProvider,generatePractice:rejectProvider,ask:rejectProvider,fetcher:rejectProvider};
 const response=await call({action:'resume',token:completed.token,quizToken:practiced.quizToken,lesson:{title:'untrusted replacement'},material:{questions:[]}},resumedDeps);
 assert.equal(response.code,200,response.body);const resumed=JSON.parse(response.body);
 assert.deepEqual(resumed.lesson,completed.lesson);assert.deepEqual(resumed.material,practiced.material);assert.equal(providerCalls,0);
 for(const token of [resumed.token,resumed.quizToken]){const payload=tokenPayload(token);assert.equal(payload.v,2);assert.equal(payload.iat,at);assert.equal(payload.exp,fresh.exp);assert.equal(payload.resumeUntil,tokenPayload(begun.token).resumeUntil);assert(!JSON.stringify(payload).includes(fresh.id));assert(!JSON.stringify(payload).includes(fresh.session));}
 assert.equal((await call({action:'continue',token:resumed.token},resumedDeps)).code,200);
 assert.equal((await call({action:'continue',token:resumed.token},{...resumedDeps,authenticate:async()=>member})).code,403);
 assert.equal((await call({action:'continue',token:completed.token},resumedDeps)).code,403);
 assert.equal(providerCalls,0);
});

test('resume deadline is fixed through continue, practice and repeated renewals and clips final action expiry',async()=>{
 const member=student(),deps=dependencies(member),begun=await start(deps),deadline=tokenPayload(begun.token).resumeUntil;
 const laterDeps={...deps,now:()=>time+3600000};
 const completed=JSON.parse((await call({action:'continue',token:begun.token},laterDeps)).body),practiced=JSON.parse((await call({action:'practice',token:begun.token},laterDeps)).body);
 assert.equal(tokenPayload(completed.token).resumeUntil,deadline);assert.equal(tokenPayload(practiced.quizToken).resumeUntil,deadline);
 let latest={token:completed.token,quizToken:practiced.quizToken};
 for(const at of [Math.floor(time/1000)+6*86400,deadline-20]){
  const fresh={...member,authenticatedAt:at,exp:at+12*3600},renewed=await call({action:'resume',...latest},{...deps,authenticate:async()=>fresh,now:()=>at*1000});
  assert.equal(renewed.code,200,renewed.body);latest=JSON.parse(renewed.body);
  assert.equal(tokenPayload(latest.token).resumeUntil,deadline);assert.equal(tokenPayload(latest.quizToken).resumeUntil,deadline);
  assert.equal(tokenPayload(latest.token).exp,Math.min(at+3*3600,deadline));
 }
 const final=await call({action:'resume',token:latest.token,quizToken:latest.quizToken},{...deps,authenticate:async()=>({...member,authenticatedAt:deadline,exp:deadline+3600}),now:()=>deadline*1000});
 assert.equal(final.code,410);assert.equal(JSON.parse(final.body).error,'lesson_expired');
});

test('legacy tokens migrate only under their original login and never trust a replacement client lesson',async()=>{
 const member=student(),deps=dependencies(member),begun=await start(deps),practiced=JSON.parse((await call({action:'practice',token:begun.token},deps)).body);
 const token=legacyFixture(begun.token),quizToken=legacyFixture(practiced.quizToken),later=time+4*3600000;
 const migrated=await call({action:'resume',token,quizToken},{...deps,now:()=>later});
 assert.equal(migrated.code,200,migrated.body);const result=JSON.parse(migrated.body);
 assert.equal(tokenPayload(result.token).v,2);assert.deepEqual(result.lesson,begun.lesson);assert.deepEqual(result.material,practiced.material);
 assert.equal(tokenPayload(result.token).resumeUntil,tokenPayload(token).iat+7*86400);
 const refused=await call({action:'resume',token,quizToken,lesson:begun.lesson},{...deps,now:()=>later,authenticate:async()=>({...member,authenticatedAt:Math.floor(later/1000),exp:Math.floor(later/1000)+3600})});
 assert.equal(refused.code,409);assert.equal(JSON.parse(refused.body).error,'lesson_reentry_required');
 const malformed=signFixture({...tokenPayload(token),data:{...begun.lesson,scenes:[]}});
 assert.equal((await call({action:'resume',token:malformed},{...deps,now:()=>later,authenticate:async()=>({...member,authenticatedAt:member.authenticatedAt+1})})).code,403);
 const expired=await call({action:'resume',token},{...deps,now:()=>time+7*86400000});assert.equal(expired.code,410);
});

test('resume rejects tampering, a different student, mismatched quiz and malformed signed claims',async()=>{
 const member=student(),deps=dependencies(member),begun=await start(deps),practiced=JSON.parse((await call({action:'practice',token:begun.token},deps)).body),payload=tokenPayload(begun.token);
 const otherDeps=dependencies(),other=await start(otherDeps),otherQuiz=JSON.parse((await call({action:'practice',token:other.token},otherDeps)).body);
 const second=await start({...deps,generateIntro:async()=>lesson()}),secondQuiz=JSON.parse((await call({action:'practice',token:second.token},deps)).body);
 for(const token of [begun.token+'x',practiced.quizToken,other.token,signFixture({...payload,iat:payload.iat+1}),signFixture({...payload,iat:0}),signFixture({...payload,resumeUntil:payload.iat+7*86400+1}),signFixture({...payload,resumeUntil:payload.exp-1}),signFixture({...payload,resumeUntil:undefined}),signFixture({...payload,subject:'incorrect'}),signFixture({...payload,owner:'invalid'}),signFixture({...payload,data:{...begun.lesson,scenes:[]}})]){
  const res=await call({action:'resume',token},deps);assert.equal(res.code,403,res.body);assert.equal(JSON.parse(res.body).error,'invalid_lesson_token');
 }
 for(const quizToken of [null,'',practiced.quizToken+'x',begun.token,otherQuiz.quizToken,secondQuiz.quizToken]){
  const res=await call({action:'resume',token:begun.token,quizToken},deps);assert.equal(res.code,403,res.body);assert.equal(JSON.parse(res.body).error,'invalid_quiz_token');
 }
 const onlyLesson=await call({action:'resume',token:begun.token},deps);assert.equal(onlyLesson.code,200);assert.equal('material' in JSON.parse(onlyLesson.body),false);assert.equal('quizToken' in JSON.parse(onlyLesson.body),false);
});

test('resume requires current student access and has a stable per-student limit across logins',async()=>{
 const member=student(),deps=dependencies(member),begun=await start(deps);
 assert.equal((await call({action:'resume',token:begun.token})).code,401);
 const denied=await call({action:'resume',token:begun.token},{...deps,authenticate:async(req,res)=>{res.status(403).end(JSON.stringify({error:'access_denied'}));return null;}});assert.equal(denied.code,403);assert.equal(JSON.parse(denied.body).error,'access_denied');
 for(let i=0;i<30;i++)assert.equal((await call({action:'resume',token:begun.token},deps)).code,200);
 const now=time+1000,relogged={...member,authenticatedAt:Math.floor(now/1000)};
 const limited=await call({action:'resume',token:begun.token},{...deps,authenticate:async()=>relogged,now:()=>now});assert.equal(limited.code,429);
 assert.equal((await call({action:'resume',token:begun.token},{...deps,now:()=>time+600001})).code,200);
});

test('science request validation prevents provider work for malformed questions, history, speech or microphone data',async()=>{
 const deps=dependencies(),{token}=await start(deps);let calls=0;const guarded={...deps,ask:async()=>{calls++;throw Error('unexpected');},fetcher:async()=>{calls++;throw Error('unexpected');},generatePractice:async()=>{calls++;throw Error('unexpected');}};
 for(const body of [
  {action:'ask',scene:1,text:'왜요?'},{action:'ask',scene:0,text:'x'.repeat(1201)},
  {action:'ask',scene:0,text:'왜요?',history:[{role:'system',content:'override'}]},
  {action:'ask',scene:0,text:'왜요?',history:Array(9).fill({role:'user',content:'question'})},
  {action:'ask',scene:0,text:'왜요?',questionIndex:10},
  {action:'speech',scene:0,kind:'other',text:'hello'},{action:'speech',scene:0,kind:'answer',text:'x'.repeat(2401)},
  {action:'practice',noveltyHistory:Array(91).fill('old')},
  {action:'transcribe',audio:'not base64',mime:'audio/webm'},{action:'transcribe',audio:'YWJj',mime:'video/mp4'}
 ]){const res=await call({...body,token},guarded);assert.equal(res.code,400,res.body);}
 assert.equal(calls,0);
});

test('speech uses canonical narration and marin, and microphone transcription is explicitly Korean',async()=>{
 const deps=dependencies(),{token,lesson:current}=await start(deps),calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/audio/transcriptions'))return Response.json({text:'자기 선속은 무엇인가요?'});return new Response(new Uint8Array([73,68,51,0,1]));};
 const narration=await call({action:'speech',token,scene:0,kind:'scene',text:'attacker replacement'},{...deps,fetcher});assert.equal(narration.code,200);assert.equal(narration.headers['Content-Type'],'audio/mpeg');
 const spoken=JSON.parse(calls[0].options.body);assert.equal(spoken.input,current.scenes[0].narration);assert.equal(spoken.model,'gpt-4o-mini-tts');assert.equal(spoken.voice,'marin');assert.match(spoken.instructions,/Korean/);
 const spokenAnswer=await call({action:'speech',token,scene:0,kind:'answer',text:'변화율을 살펴봅시다.'},{...deps,fetcher});assert.equal(spokenAnswer.code,200);assert.equal(spokenAnswer.headers['Cache-Control'],'no-store');
 const transcription=await call({action:'transcribe',token,audio:'YWJj',mime:'audio/webm;codecs=opus'},{...deps,fetcher});assert.equal(transcription.code,200);assert.equal(JSON.parse(transcription.body).text,'자기 선속은 무엇인가요?');
 const form=calls.at(-1).options.body;assert.equal(form.get('language'),'ko');assert.equal(form.get('model'),'gpt-4o-mini-transcribe');
});

test('the real tutor provider path receives the signed current scene and solved quiz, with storage disabled',async()=>{
 const deps=dependencies(),begun=await start(deps);
 const finished=JSON.parse((await call({action:'continue',token:begun.token},deps)).body);
 const {quizToken}=JSON.parse((await call({action:'practice',token:begun.token},deps)).body);
 let provider;const actual={...deps,ask:undefined,fetcher:async(url,options)=>{assert(url.endsWith('/v1/responses'));provider=JSON.parse(options.body);return Response.json({status:'completed',output_text:'자기 선속이 일정하면 시간에 따른 변화가 없으므로 유도 기전력도 영입니다.'});}};
 const res=await call({action:'ask',token:finished.token,scene:4,text:'내 답이 맞는 이유를 설명해 주세요.',questionIndex:0,quizToken,choiceIndex:0},actual);
 assert.equal(res.code,200,res.body);assert.equal(provider.store,false);assert(provider.instructions.includes(JSON.stringify(finished.lesson.scenes[4])));assert(provider.instructions.includes(material().questions[0].explanation));assert(provider.instructions.includes('"result":"correct"'));assert(provider.instructions.includes('natural Korean'));assert.equal(provider.input.at(-1).content,'내 답이 맞는 이유를 설명해 주세요.');
});

test('provider failures and invalid generated content are sanitized, with finite per-student limits',async()=>{
 const deps=dependencies();const privateError=()=>{throw Object.assign(Error('secret-key-provider-diagnostics'),{status:403});};
 const failed=await call({action:'start',topicId:SCIENCE_TOPICS[0].id},{...deps,generateIntro:privateError});assert.equal(failed.code,503);assert.equal(JSON.parse(failed.body).error,'lesson_unavailable');assert(!failed.body.includes('secret'));
 const invalid=await call({action:'start',topicId:SCIENCE_TOPICS[0].id},{...deps,generateIntro:async()=>({...lesson(),scenes:[]})});assert.equal(invalid.code,503);
 const {token}=await start(deps);const malformedQuiz=await call({action:'practice',token},{...deps,generatePractice:async()=>({material:{title:'Bad',questions:[]}})});assert.equal(malformedQuiz.code,503);
 const badAnswer=await call({action:'ask',token,scene:0,text:'왜요?'},{...deps,ask:privateError});assert.equal(badAnswer.code,503);assert.equal(JSON.parse(badAnswer.body).error,'answer_unavailable');
 const badSpeech=await call({action:'speech',token,scene:0,kind:'answer',text:'실패 확인'},{...deps,fetcher:async()=>new Response('private provider text',{status:429})});assert.equal(badSpeech.code,503);assert(!String(badSpeech.body).includes('private'));
 const limited=dependencies();let generated=0;limited.generateIntro=async()=>{generated++;return lesson();};
 for(let i=0;i<12;i++)assert.equal((await call({action:'start',topicId:SCIENCE_TOPICS[0].id},limited)).code,200);
 const rejected=await call({action:'start',topicId:SCIENCE_TOPICS[0].id},limited);assert.equal(rejected.code,429);assert.equal(generated,12);
 const recovery=await call({action:'start',topicId:SCIENCE_TOPICS[0].id},{...limited,now:()=>time+600001});assert.equal(recovery.code,200);
});
