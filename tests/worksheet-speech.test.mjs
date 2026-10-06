import test from 'node:test';
import assert from 'node:assert/strict';
import {worksheetSpeech} from '../lib/worksheet-speech.js';
import {AiServiceError} from '../lib/ai-service-error.js';
const payload={classroom:'en',language:'ko',text:'질문을 듣고 답하세요.\nWhy did the seminar move?\nA. A registration form.\nB. Because the room needed repairs.'};
test('worksheet narration uses OpenAI audio with exact input and bilingual pronunciation instructions',async()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-server-only';
 try{let sent;const result=await worksheetSpeech(payload,async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/audio/speech');sent=JSON.parse(options.body);return new Response(new Uint8Array(200));});
 assert.equal(sent.input,payload.text);assert.equal(sent.model,'gpt-4o-mini-tts');assert.equal(sent.voice,'marin');assert.match(sent.instructions,/native American English/);assert.match(sent.instructions,/Never solve/);assert.equal(result.provider,'openai');assert.equal(Buffer.from(result.audio,'base64').length,200);
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
test('bad speech requests never call the provider; credit errors remain classified',async()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test';
 try{for(const change of [{classroom:'fr'},{language:'xx'},{text:''},{text:'x'.repeat(4097)}])await assert.rejects(worksheetSpeech({...payload,...change},()=>{throw Error('must not fetch');}),/Invalid worksheet speech/);
 await assert.rejects(worksheetSpeech(payload,async()=>Response.json({error:{code:'insufficient_quota'}},{status:429})),error=>error instanceof AiServiceError&&error.payload.code==='ai_credit_exhausted');
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
