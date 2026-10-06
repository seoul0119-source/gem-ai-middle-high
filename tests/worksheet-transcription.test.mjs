import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {worksheetTranscription} from '../lib/worksheet-transcription.js';
import {AiServiceError} from '../lib/ai-service-error.js';
import {verifyReviewRequest} from '../lib/review-tutor.js';
import {REVIEW_PUBLIC_KEYS} from '../lib/review-public-keys.js';
import reviewHandler from '../api/review-tutor.js';

const audio=Buffer.alloc(256,7).toString('base64');
const payload={purpose:'gem-materials-v1',mode:'transcribe',classroom:'en',language:'ko',audio,mimeType:'audio/webm;codecs=opus',vocabulary:['에이','비','씨','디','1번','2번','3번','4번','힌트 주세요','Because the room needed repairs.']};
const privateProviderMessage='provider-private-details-and-credential';
const signingKey=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const publicKey=await webcrypto.subtle.exportKey('jwk',signingKey.publicKey);
const keys={en:publicKey,fr:publicKey};

function configureKey(t){
 const saved=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='synthetic-worksheet-transcription-key';
 t.after(()=>{if(saved===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=saved;});
}
async function signed(value){
 const body=JSON.stringify({timestamp:Date.now(),...value});
 const signature=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},signingKey.privateKey,Buffer.from(body))).toString('base64url');
 return {payload:body,signature};
}
function responseRecorder(){
 return {statusCode:200,headers:{},body:null,
  status(value){this.statusCode=value;return this;},
  setHeader(name,value){this.headers[name]=value;return this;},
  end(value){this.body=JSON.parse(value);}
 };
}
function isServiceError(code='ai_service_unavailable'){
 return error=>{
  assert.ok(error instanceof AiServiceError);
  assert.equal(error.payload.code,code);
  assert.equal(error.payload.pauseVoice,true);
  assert.doesNotMatch(JSON.stringify(error.payload),/provider-private|credential|speech_not_heard/);
  return true;
 };
}

test('worksheet STT preserves Korean/English speech and sends only public transcription context',async t=>{
 configureKey(t);
 let calls=0;
 const result=await worksheetTranscription({...payload,student:'private-student-id',runId:'private-run-id',question:{prompt:'private-question-to-solve',answer:'private-answer-key'},signature:'private-relay-signature'},async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(options.headers.Authorization,'Bearer synthetic-worksheet-transcription-key');
  const form=options.body;
  assert.equal(form.get('model'),'gpt-transcribe');
  assert.equal(form.get('response_format'),'json');
  assert.deepEqual(form.getAll('languages[]'),['ko','en']);
  assert.equal(form.has('language'),false);
  assert.deepEqual(form.getAll('keywords[]'),payload.vocabulary);
  assert.equal(form.get('file').name,'student.webm');
  assert.equal(form.get('file').type,'audio/webm');
  assert.deepEqual(Buffer.from(await form.get('file').arrayBuffer()),Buffer.from(audio,'base64'));
  assert.deepEqual([...new Set(form.keys())].sort(),['file','keywords[]','languages[]','model','prompt','response_format']);
  const publicText=[...form.values()].filter(value=>typeof value==='string').join('\n');
  assert.doesNotMatch(publicText,/private-student|private-run|private-question|private-answer|private-relay|synthetic-worksheet/);
  assert.match(form.get('prompt'),/Preserve questions, uncertainty and negation/);
  return Response.json({text:'  정답은 B입니다. Because the room needed repairs.  '});
 });
 assert.deepEqual(result,{text:'정답은 B입니다. Because the room needed repairs.',provider:'openai',model:'gpt-transcribe'});
 assert.equal(calls,1);
});

test('public keywords are single-line and never contain API-rejected angle brackets',async t=>{
 configureKey(t);
 const vocabulary=['  A  ','x < 3','x > 7','first\r\nsecond','first\nsecond','C'];
 await worksheetTranscription({...payload,vocabulary},async(_url,{body})=>{
  assert.deepEqual(body.getAll('keywords[]'),['A','first second','C']);
  assert.ok(body.getAll('keywords[]').every(word=>!/[<>\r\n]/.test(word)));
  return Response.json({text:'C'});
 });
});

test('compatibility fallback runs only once and omits unsupported multilingual/keyword fields',async t=>{
 configureKey(t);
 for(const firstReply of [Response.json({error:{code:'model_not_found'}},{status:404}),Response.json({text:'   '})]){
  const models=[];
  const result=await worksheetTranscription(payload,async(_url,{body})=>{
   models.push(body.get('model'));
   if(models.length===1)return firstReply;
   assert.equal(body.get('model'),'gpt-4o-transcribe');
   assert.equal(body.has('languages[]'),false);
   assert.equal(body.has('language'),false);
   assert.equal(body.has('keywords[]'),false);
   assert.match(body.get('prompt'),/Korean or English/);
   return Response.json({text:'힌트 주세요.'});
  });
  assert.deepEqual(models,['gpt-transcribe','gpt-4o-transcribe']);
  assert.deepEqual(result,{text:'힌트 주세요.',provider:'openai',model:'gpt-4o-transcribe'});
 }
});

test('empty successful results are a recognition failure after one fallback',async t=>{
 configureKey(t);
 let calls=0;
 await assert.rejects(worksheetTranscription(payload,async()=>{calls++;return Response.json({text:' '});}),error=>!(error instanceof AiServiceError)&&error.message==='speech_not_heard');
 assert.equal(calls,2);
});

test('invalid audio/vocabulary requests are rejected before the provider is called',async t=>{
 configureKey(t);
 const changes=[
  {purpose:'other'},{mode:'speech'},{classroom:'fr'},{language:'fr'},
  {audio:''},{audio:'not base64!'},{audio:Buffer.alloc(99).toString('base64')},{audio:Buffer.alloc(1_000_001).toString('base64')},
  {mimeType:'text/plain'},{vocabulary:null},{vocabulary:['']},{vocabulary:['a'.repeat(101)]},{vocabulary:Array(33).fill('A')}
 ];
 let calls=0;
 for(const change of changes)await assert.rejects(worksheetTranscription({...payload,...change},async()=>{calls++;throw Error('unexpected provider call');}),/^Error: invalid_transcription$/);
 assert.equal(calls,0);
});

test('provider transport, timeout, malformed JSON and invalid successful responses are service failures',async t=>{
 configureKey(t);
 const providers=[
  async()=>{throw Error(privateProviderMessage);},
  async()=>{throw new DOMException(privateProviderMessage,'TimeoutError');},
  async()=>new Response('<html>'+privateProviderMessage+'</html>',{status:502}),
  async()=>Response.json({unexpected:privateProviderMessage}),
  async()=>Response.json({text:123}),
  async()=>Response.json({error:{message:privateProviderMessage}},{status:503})
 ];
 for(const provider of providers){
  let calls=0;
  await assert.rejects(worksheetTranscription(payload,async(...args)=>{calls++;return provider(...args);}),isServiceError());
  assert.equal(calls,1);
 }
});

test('billing and rate-limit failures stay classified and never trigger a fallback',async t=>{
 configureKey(t);
 for(const [status,code,expected] of [[403,'insufficient_quota','ai_credit_exhausted'],[429,'credit_balance_exhausted','ai_credit_exhausted'],[429,'rate_limit_exceeded','ai_rate_limited']]){
  let calls=0;
  await assert.rejects(worksheetTranscription(payload,async()=>{calls++;return Response.json({error:{code,message:privateProviderMessage}},{status});}),isServiceError(expected));
  assert.equal(calls,1);
 }
});

test('both models share one deadline shorter than the 60-second client timeout',async t=>{
 configureKey(t);
 const controller=new AbortController(),timeouts=[],signals=[];
 t.mock.method(AbortSignal,'timeout',milliseconds=>{timeouts.push(milliseconds);return controller.signal;});
 const result=await worksheetTranscription(payload,async(_url,{signal})=>{
  signals.push(signal);
  return signals.length===1?Response.json({error:{code:'model_not_found'}},{status:404}):Response.json({text:'비'});
 });
 assert.equal(result.text,'비');
 assert.equal(timeouts.length,1,'a fallback must not reset its own deadline');
 assert.ok(timeouts[0]>0&&timeouts[0]<=50_000);
 assert.equal(signals.length,2);
 assert.equal(signals[0],controller.signal);
 assert.equal(signals[1],controller.signal);
});

test('an expired shared deadline prevents fallback and discards late provider text',async t=>{
 configureKey(t);
 for(const lateResponse of [Response.json({error:{code:'model_not_found'}},{status:404}),Response.json({text:'B'})]){
  const controller=new AbortController();
  const timeoutMock=t.mock.method(AbortSignal,'timeout',()=>controller.signal);
  let calls=0;
  await assert.rejects(worksheetTranscription(payload,async()=>{
   calls++;
   controller.abort(new DOMException('deadline elapsed','TimeoutError'));
   return lateResponse;
  }),isServiceError());
  assert.equal(calls,1);
  timeoutMock.mock.restore();
 }
});

test('the relay signs the entire large audio payload and rejects tampering',async()=>{
 const request=await signed({...payload,audio:Buffer.alloc(1_000_000,7).toString('base64')});
 assert.ok(request.payload.length>40_000&&request.payload.length<1_500_000);
 const verified=await verifyReviewRequest(request,keys);
 assert.equal(Buffer.from(verified.audio,'base64').length,1_000_000);
 const changed=JSON.parse(request.payload);
 changed.audio=(changed.audio[0]==='A'?'B':'A')+changed.audio.slice(1);
 assert.equal(Boolean(await verifyReviewRequest({...request,payload:JSON.stringify(changed)},keys)),false);
 assert.equal(Boolean(await verifyReviewRequest({...request,signature:'invalid'},keys)),false);
});

test('large-payload permission is limited to worksheet transcription and the 1.5 MB ceiling',async()=>{
 const largeAudio=Buffer.alloc(40_000,7).toString('base64');
 for(const change of [
  {purpose:'gem-materials-v1',mode:'speech'},
  {purpose:'gem-materials-v1',mode:'generate'},
  {purpose:'gem-math-review-v1',mode:'korean-display-v1'},
  {purpose:'gem-math-review-v1',mode:'transcribe'},
  {purpose:'gem-materials-v1',mode:'transcribe',classroom:'fr'}
 ])assert.equal(await verifyReviewRequest(await signed({...payload,audio:largeAudio,...change}),keys),null);
 assert.equal(await verifyReviewRequest(await signed({...payload,audio:'A'.repeat(1_500_000)}),keys),null);
 const expired=await signed({...payload,audio:largeAudio,timestamp:Date.now()-120_000});
 assert.equal(await verifyReviewRequest(expired,keys),null);
 const ordinary=await signed({purpose:'gem-math-review-v1',classroom:'en',message:'What is a unit rate?'});
 assert.equal((await verifyReviewRequest(ordinary,keys)).message,'What is a unit rate?');
});

test('the signed HTTP relay distinguishes service errors, empty speech and invalid requests',async t=>{
 configureKey(t);
 const cases=[
  {name:'transport failure',reply:()=>{throw Error(privateProviderMessage);},status:503,code:'ai_service_unavailable',calls:1},
  {name:'non-JSON provider outage',reply:()=>new Response(privateProviderMessage,{status:502}),status:503,code:'ai_service_unavailable',calls:1},
  {name:'credit exhaustion',reply:()=>Response.json({error:{code:'insufficient_quota',message:privateProviderMessage}},{status:403}),status:503,code:'ai_credit_exhausted',calls:1},
  {name:'empty speech',reply:()=>Response.json({text:''}),status:422,code:'speech_not_heard',calls:2},
  {name:'invalid audio type',change:{mimeType:'text/plain'},reply:()=>{throw Error('must not call');},status:400,code:'invalid_transcription',calls:0}
 ];
 for(const scenario of cases)await t.test(scenario.name,async child=>{
  const saved=REVIEW_PUBLIC_KEYS.en;REVIEW_PUBLIC_KEYS.en=publicKey;
  child.after(()=>{REVIEW_PUBLIC_KEYS.en=saved;});
  let calls=0;
  child.mock.method(globalThis,'fetch',async()=>{calls++;return scenario.reply();});
  const result=responseRecorder();
  await reviewHandler({method:'POST',body:await signed({...payload,...scenario.change})},result);
  assert.equal(result.statusCode,scenario.status);
  assert.equal(result.body.code,scenario.code);
  assert.equal(calls,scenario.calls);
  assert.equal(result.headers['Cache-Control'],'no-store');
  assert.doesNotMatch(JSON.stringify(result.body),/provider-private|credential/);
  if(scenario.status===503){
   assert.equal(result.body.pauseVoice,true);
   assert.doesNotMatch(result.body.error,/다시 말씀|음성을 확인/);
  }else assert.equal(result.body.pauseVoice,undefined);
 });
});
