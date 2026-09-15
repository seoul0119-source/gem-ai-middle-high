import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {verifyReviewRequest,reviewModelRequest,reviewOutput} from '../lib/review-tutor.js';
test('review relay validates the entire signed request, classroom and timestamp',async()=>{
 const key=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const keys={en:await webcrypto.subtle.exportKey('jwk',key.publicKey)};
 const p={purpose:'gem-math-review-v1',classroom:'en',timestamp:Date.now(),message:'what is a unit rate?'};
 const payload=JSON.stringify(p),signature=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,Buffer.from(payload))).toString('base64url');
 assert.equal((await verifyReviewRequest({payload,signature},keys)).message,p.message);
 assert.equal(await verifyReviewRequest({payload:payload.replace('unit','constant'),signature},keys),null);
 assert.equal(await verifyReviewRequest({payload,signature},{fr:keys.en}),null);
 assert.equal(await verifyReviewRequest({payload,signature:'bad'},keys),null);
 const expired=JSON.stringify({...p,timestamp:Date.now()-120000});
 const oldSig=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,Buffer.from(expired))).toString('base64url');
 assert.equal(await verifyReviewRequest({payload:expired,signature:oldSig},keys),null);
});
test('different questions and follow-ups reach the model unchanged with saved exercise context',()=>{
 const base={classroom:'en',grade:'6',question:{prompt:'A cyclist travels 36 kilometres in 4 hours at a constant rate.',answer:'9',attempts:['8km']},history:[{role:'user',content:'What is a unit rate?'},{role:'assistant',content:'A rate for one unit, such as one hour.'}]};
 const unit=reviewModelRequest({...base,message:'what is a unit rate'});
 const constant=reviewModelRequest({...base,message:'what is the meaning of constant?'});
 assert.equal(unit.input.at(-1).content,'what is a unit rate');
 assert.equal(constant.input.at(-1).content,'what is the meaning of constant?');
 assert.equal(constant.input[0].content,base.history[0].content);
 assert.match(constant.instructions,/36 kilometres/);assert.match(constant.instructions,/NEVER grade/);assert.equal(constant.store,false);
 assert.match(reviewModelRequest({...base,classroom:'fr',message:'Peux-tu expliquer autrement ?'}).instructions,/Default language: French/);
 assert.equal(reviewOutput({output:[{content:[{type:'output_text',text:'A different explanation.'}]}]}),'A different explanation.');
});
