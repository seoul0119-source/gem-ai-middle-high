import assert from 'node:assert/strict';
import {runSpeech} from '../../api/mission-speech.js';
import {speechLabel} from './speech-labels.mjs';
let calls=0;
const fetchImpl=async(url,init)=>{calls++;if(url.endsWith('/speech')){const p=JSON.parse(init.body);assert.equal(p.model,'gpt-4o-mini-tts');assert.equal(p.voice,'coral');return new Response(new Uint8Array([73,68,51,1]));}assert.ok(init.body instanceof FormData);assert.equal(init.body.get('model'),'whisper-1');assert.equal(init.body.get('response_format'),'verbose_json');return Response.json({text:'Habari darasa.',duration:3,segments:[{no_speech_prob:.01}]});};
const opts={key:'fixture',fetchImpl};
for(const lang of ['en','fr','ne','ur','sw']){
 const speech=await runSpeech({action:'speak',lang,text:'test',consent:true},opts);assert.equal(speech.status,200);assert.equal(speech.mime,'audio/mpeg');assert.ok(speechLabel(lang,'notice').includes('OpenAI'));
 const transcribe=await runSpeech({action:'transcribe',lang,consent:true,mime:'audio/webm;codecs=opus',audio:Buffer.alloc(100,1).toString('base64')},opts);assert.equal(transcribe.text,'Habari darasa.');
}
const before=calls;
for(const body of [{action:'speak',lang:'sw',text:'hello'}, {action:'speak',lang:'bad',text:'hello',consent:true},{action:'speak',lang:'sw',text:'a'.repeat(3001),consent:true},{action:'transcribe',lang:'sw',audio:'?',mime:'audio/webm',consent:true}])assert.equal((await runSpeech(body,opts)).status,400);
assert.equal(calls,before);
const valid={action:'transcribe',lang:'sw',consent:true,mime:'audio/webm',audio:Buffer.alloc(100,1).toString('base64')};
assert.equal((await runSpeech(valid,{key:'fixture',fetchImpl:async()=>Response.json({text:'hallucinated',duration:2,segments:[{no_speech_prob:.98}]})})).code,'no_speech');
assert.equal((await runSpeech(valid,{key:'fixture',fetchImpl:async()=>Response.json({text:'a'.repeat(451),duration:2})})).code,'too_long');
assert.equal((await runSpeech(valid,{key:'fixture',fetchImpl:async()=>Response.json({text:'hello',duration:36})})).code,'too_long');
assert.equal((await runSpeech(valid,{key:'fixture',fetchImpl:async()=>new Response('',{status:429})})).status,429);
assert.equal((await runSpeech(valid,{key:''})).code,'not_configured');
console.log('PROGRAMME SPEECH TESTS PASS: consent, five languages, multipart transcription, silence/length bounds, provider errors');
