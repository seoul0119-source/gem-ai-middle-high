import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {productionSpeech,worksheetSpeech} from '../lib/worksheet-speech.js';
import {REVIEW_PUBLIC_KEYS} from '../lib/review-public-keys.js';
import handler from '../api/review-tutor.js';
const text='Observe the saved evidence carefully, compare the stated values and conditions, and explain the conclusion using the facts in the lesson. Keep the order of the supplied explanation. ';
const payload={purpose:'gem-materials-v1',mode:'production-speech',classroom:'en',timestamp:Date.now(),language:'en',text};
const audio=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(2*1024*1024,7)]);
const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const publicKey=await webcrypto.subtle.exportKey('jwk',pair.publicKey);
async function signed(value){const payload=JSON.stringify(value),signature=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,Buffer.from(payload))).toString('base64url');return {payload,signature};}
function recorder(){return {statusCode:200,headers:{},body:null,status(value){this.statusCode=value;return this;},setHeader(name,value){this.headers[name]=value;return this;},end(value){this.body=value;}};}
test('signed production speech returns bounded raw MP3 with fixed metadata and unchanged synthesis settings',async t=>{
 const saved=process.env.OPENAI_API_KEY,oldPublic=REVIEW_PUBLIC_KEYS.en;process.env.OPENAI_API_KEY='synthetic-binary-speech-key';REVIEW_PUBLIC_KEYS.en=publicKey;
 t.after(()=>{REVIEW_PUBLIC_KEYS.en=oldPublic;if(saved===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=saved;});
 const requests=[];t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/audio/speech');requests.push(JSON.parse(options.body));return new Response(audio);});
 for(const [language,voice]of [['ko','marin'],['en','marin'],['fr','cedar']]){
  const result=recorder();await handler({method:'POST',body:await signed({...payload,language,timestamp:Date.now()})},result);
  assert.equal(result.statusCode,200);assert(Buffer.isBuffer(result.body));assert.deepEqual(result.body,audio);assert.equal(result.headers['Content-Length'],String(audio.length));assert.equal(result.headers['Content-Type'],'audio/mpeg');assert.equal(result.headers['X-GEM-Speech-Provider'],'openai');assert.equal(result.headers['X-GEM-Speech-Model'],'gpt-4o-mini-tts');assert.equal(result.headers['X-GEM-Speech-Voice'],voice);assert.equal(result.headers['Cache-Control'],'no-store');
  assert.equal(requests.at(-1).input,text);assert.equal(requests.at(-1).voice,voice);assert.equal(requests.at(-1).response_format,'mp3');
 }
 const legacy=await worksheetSpeech({classroom:'en',language:'en',text});assert.equal(legacy.audio,audio.toString('base64'));assert.equal(legacy.mimeType,'audio/mpeg');assert.equal(legacy.bytes,undefined);assert.deepEqual(requests[1],requests[3],'transport change preserves the exact original synthesis request');
});
test('invalid signatures and production payloads stop before the provider without automatic retry',async t=>{
 const saved=process.env.OPENAI_API_KEY,oldPublic=REVIEW_PUBLIC_KEYS.en;process.env.OPENAI_API_KEY='synthetic-binary-speech-key';REVIEW_PUBLIC_KEYS.en=publicKey;
 t.after(()=>{REVIEW_PUBLIC_KEYS.en=oldPublic;if(saved===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=saved;});
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('provider unavailable');});
 for(const body of [{payload:JSON.stringify(payload),signature:'invalid'},await signed({...payload,timestamp:Date.now()-120000})]){const result=recorder();await handler({method:'POST',body},result);assert.equal(result.statusCode,401);}
 for(const change of [{language:'xx'},{language:'ko',text:'x'.repeat(651)},{text:'x'.repeat(1101)},{text:'short'},{voice:'untrusted'},{model:'untrusted'}]){const result=recorder();await handler({method:'POST',body:await signed({...payload,...change,timestamp:Date.now()})},result);assert.equal(result.statusCode,400);}
 assert.equal(calls,0);
 const result=recorder();await handler({method:'POST',body:await signed({...payload,timestamp:Date.now()})},result);assert.equal(result.statusCode,503);assert.equal(calls,1,'provider failure never causes a hidden second synthesis request');
 await assert.rejects(productionSpeech({...payload,classroom:'fr'},()=>{throw Error('must not call');}),/Invalid production speech/);
});
