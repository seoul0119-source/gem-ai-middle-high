import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync('class-record-client.js','utf8');
test('failed save remains in student queue, newer in-flight snapshot is saved before flush returns',async()=>{
 const storage=new Map(),calls=[],notices=[];let fail=true,gate=null;
 const context={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{addEventListener(){}},setInterval(){},AbortSignal,Blob,navigator:{sendBeacon(){}},fetch:async(url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);if(fail)throw Error('offline');if(gate){const wait=gate;gate=null;await wait;}return {ok:true,json:async()=>({saved:true})};}};
 vm.runInNewContext(source,context);const client=context.GemClassRecords({student:'TEST_A',notify:m=>notices.push(m)});
 const record={revision:1,messages:[{role:'assistant',content:'7/12'},{role:'user',content:'힌트'}]};client.queue('run','permit',record);assert.equal(await client.flush(),false);assert.ok(storage.get('gem-class-record-pending:TEST_A').includes('7/12'));
 fail=false;let release;gate=new Promise(r=>release=r);const flush=client.flush();client.queue('run','permit',{...record,revision:2,messages:[...record.messages,{role:'assistant',content:'5/6'}]});release();assert.equal(await flush,true);assert.equal(calls.at(-1).record.revision,2);assert.equal(storage.get('gem-class-record-pending:TEST_A'),'{}');
 assert.equal(storage.has('gem-class-record-pending:TEST_B'),false);
});
