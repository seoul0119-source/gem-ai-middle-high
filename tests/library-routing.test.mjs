import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/chat-final.js';
function response(){return {code:200,headers:{},body:'',status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v;return this},end(v=''){this.body=v},json(v){this.body=JSON.stringify(v);return this}}}
test('library routes reuse existing capacity while keeping independent authorization and normal classroom guard',async()=>{
 const previousFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected provider request')};
 try{
  const health=response();await handler({method:'GET',headers:{},query:{gemLibrary:'job-v1'}},health);assert.equal(health.code,200);assert.equal(JSON.parse(health.body).service,'gem-library-v1');
  const unsigned=response();await handler({method:'POST',headers:{},query:{gemLibrary:'job-v1'},body:{}},unsigned);assert.equal(unsigned.code,403);
  const cron=response();await handler({method:'GET',headers:{},query:{gemLibrary:'daily-v1'}},cron);assert.equal(cron.code,401);
  const classroom=response();await handler({method:'POST',headers:{},query:{},body:{courseId:'m1-math',messages:[]}},classroom);assert.equal(classroom.code,401);assert.equal(calls,0);
 }finally{globalThis.fetch=previousFetch}
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 for(const [path,kind] of [['job','job-v1'],['daily','daily-v1']])assert(config.routes.some(r=>r.src===`/api/library-${path}/?`&&r.dest===`/api/chat-final?gemLibrary=${kind}`));
 assert.equal(config.functions['api/chat-final.js'].maxDuration,300);
 assert(!config.functions['api/library-job.js']);assert(!config.functions['api/library-daily.js']);
});
