import assert from 'node:assert/strict';
import test from 'node:test';
import {bibleProduction} from '../lib/bible-production.js';

const secret = 'test-only-bible-relay-credential';
async function call(body, fetcher, header = 'Bearer ' + secret) {
  const response = {
    headers:{}, status(status) { this.code=status; return this; },
    setHeader(key,value) { this.headers[key]=value; return this; },
    end(value) { this.body=value; return this; }
  };
  await bibleProduction({method:'POST',headers:{authorization:header},body},response,{secret,providerKey:'test-provider',fetcher});
  return response;
}

test('rejects missing credentials, unknown operations, remote URLs, short keys and caller-selected models', async () => {
  const fail = () => assert.fail('unexpected external request');
  assert.equal((await call({action:'image',prompt:'abc'},fail,'')).code,401);
  for (const invalid of [
    {action:'__proto__',prompt:'abc'}, {action:'raw',prompt:'abc'},
    {action:'questions',purpose:'image',prompt:'abc'}, {action:'review',prompt:'abc',images:['https://example.com/image.jpg']},
    {action:'image',prompt:'abc',model:'custom'}, {action:'scenes',prompt:'abc',schema:{type:'array'}},
    {action:'questions',prompt:'x'.repeat(70000)}
  ]) assert.equal((await call(invalid,fail)).code,400);
});

test('forwards bounded strict-schema input without storage and returns parsed JSON', async () => {
  const schema = {type:'object',properties:{verified:{type:'boolean'}},required:['verified'],additionalProperties:false};
  const res = await call({action:'review',purpose:'bible-picture-review',schema,prompt:'Compare to the provided chapter.'},async (url,options) => {
    assert.equal(url,'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store,false); assert.equal(body.text.format.strict,true); assert.deepEqual(body.text.format.schema,schema);
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"verified":false}'}]}]});
  });
  assert.equal(res.code,200); assert.deepEqual(JSON.parse(res.body).result,{verified:false});
});

test('propagates known provider error categories without provider text or key disclosure', async () => {
  const res = await call({action:'image',prompt:'Bible lesson.'},async () => Response.json({error:{code:'insufficient_quota',message:'sensitive text'}},{status:429}));
  assert.equal(res.code,429); assert.deepEqual(JSON.parse(res.body),{code:'insufficient_quota'});
});

test('returns binary JPEG, handles incomplete model response explicitly', async () => {
  const bytes = Buffer.from([255,216,255,224,0,4,0,1,255,217]);
  const res = await call({action:'image',prompt:'A simple original Bible illustration.'},async (url,opts) => {
    assert.equal(url,'https://api.openai.com/v1/images/generations'); const payload=JSON.parse(opts.body);
    assert.equal(payload.n,1); assert.equal(payload.output_format,'jpeg');
    return Response.json({data:[{b64_json:bytes.toString('base64')}]});
  });
  assert.equal(res.code,200); assert.equal(res.headers['Content-Type'],'image/jpeg'); assert.equal(res.headers['X-Bible-Model'],'gpt-image-2'); assert.deepEqual(res.body,bytes);
  const incomplete = await call({action:'questions',prompt:'Work from the chapter.'},async () => Response.json({status:'incomplete'}));
  assert.equal(incomplete.code,502); assert.equal(JSON.parse(incomplete.body).code,'provider_response_incomplete');
});
