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

test('current worksheet flush bypasses a stalled unrelated record and shares in-flight saves',async()=>{
 const student='SCOPED-CLIENT',key='gem-class-record-pending:'+student;
 const record={revision:1,messages:[{role:'user',content:'Same worksheet'},{role:'assistant',content:'Keep the answer'}]};
 const old={permit:'expired',record};const storage=new Map([[key,JSON.stringify({'old-run':old})]]),calls=[];
 let releaseOld,releaseCurrent;const oldGate=new Promise(resolve=>{releaseOld=resolve;}),currentGate=new Promise(resolve=>{releaseCurrent=resolve;});
 const context={localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},window:{addEventListener(){}},setInterval(){},AbortSignal,Blob,navigator:{sendBeacon(){}},fetch:async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(body.permit==='expired'){await oldGate;return Response.json({error:'expired'},{status:403});}
  await currentGate;return Response.json({saved:true});
 }};
 vm.runInNewContext(source,context);const client=context.GemClassRecords({student,notify(){}});
 client.queue('current-run','valid',record);
 const first=client.flush('current-run'),second=client.flush('current-run');
 releaseCurrent();
 try{
  const result=await Promise.race([Promise.all([first,second]),new Promise(resolve=>setImmediate(()=>resolve('blocked-by-old-record')))]);
  assert.deepEqual(result,[true,true]);assert.equal(calls.filter(call=>call.permit==='valid').length,1);
  assert.deepEqual(JSON.parse(storage.get(key)),{'old-run':old});
 }finally{releaseOld();}
 assert.equal(await client.flush(),false,'ordinary full-queue sync still reports the expired record');
 assert.deepEqual(JSON.parse(storage.get(key)),{'old-run':old});
});
