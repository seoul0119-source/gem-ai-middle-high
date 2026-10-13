import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {runBoardVerificationCases} from '../scripts/board-verification-runner.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('verification defaults to one case at a time and returns every result in course order',async()=>{
 const pending=[deferred(),deferred(),deferred()],started=[];
 const run=runBoardVerificationCases([0,1,2],async index=>{started.push(index);await pending[index].promise;return `course-${index}`;});
 await settle();assert.deepEqual(started,[0]);pending[0].resolve();await settle();assert.deepEqual(started,[0,1]);
 pending[1].resolve();await settle();assert.deepEqual(started,[0,1,2]);pending[2].resolve();
 assert.deepEqual(await run,['course-0','course-1','course-2']);
});

test('concurrency two caps simultaneous provider work while preserving all six steps inside each case',async()=>{
 const flow=['generate-ten','explanation','ask','continue','handoff','records'],events=new Map(),pending=new Map();let active=0,maximum=0;
 const run=runBoardVerificationCases(['ko-math','ko-language','ko-history'],async course=>{
  events.set(course,[]);
  for(const step of flow){
   active++;maximum=Math.max(maximum,active);events.get(course).push(step);
   const request=deferred();pending.set(course,request);await request.promise;pending.delete(course);active--;
  }
  return course;
 },{concurrency:2});
 await settle();assert.equal(active,2);assert.equal(events.has('ko-history'),false);
 for(let step=0;step<flow.length;step++){pending.get('ko-math').resolve();pending.get('ko-language').resolve();await settle();}
 assert.equal(active,1);assert(events.has('ko-history'));
 for(let step=0;step<flow.length;step++){pending.get('ko-history').resolve();await settle();}
 assert.deepEqual(await run,['ko-math','ko-language','ko-history']);assert.equal(maximum,2);assert.equal(active,0);
 for(const steps of events.values())assert.deepEqual(steps,flow);
});

test('a failed case waits for its running sibling, rejects the whole gate and never starts later cases',async()=>{
 const sibling=deferred(),failure=new Error('independent review rejected'),started=[];let finished=false;
 const run=runBoardVerificationCases([0,1,2],index=>{
  started.push(index);if(index===0)throw failure;
  return sibling.promise.then(()=>{finished=true;return index;});
 },{concurrency:2});
 let gateSettled=false;const observed=run.then(()=>{gateSettled=true;},error=>{gateSettled=true;throw error;});
 const rejected=assert.rejects(observed,error=>error===failure);
 await settle();assert.deepEqual(started,[0,1]);assert.equal(gateSettled,false);assert.equal(finished,false);
 sibling.resolve();await rejected;assert.equal(finished,true);assert.equal(gateSettled,true);assert.deepEqual(started,[0,1]);
});

test('both simultaneous failures are retained and invalid concurrency starts no work',async()=>{
 const first=new Error('first review'),second=new Error('second review'),called=[];
 await assert.rejects(runBoardVerificationCases([0,1,2],async index=>{called.push(index);throw [first,second][index];},{concurrency:2}),error=>error instanceof AggregateError&&error.errors[0]===first&&error.errors[1]===second);
 assert.deepEqual(called,[0,1]);
 for(const concurrency of [0,3,-1,1.5,'2',NaN])await assert.rejects(runBoardVerificationCases([0],()=>{throw Error('must not run');},{concurrency}),RangeError);
});

test('CLI dry-run exposes the same representatives with sequential default or explicit two',()=>{
 const run=args=>JSON.parse(execFileSync(process.execPath,['scripts/verify-board-subject-stages.mjs',...args,'--dry-run'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}));
 const sequential=run(['--stage=ko']),parallel=run(['--stage=ko','--concurrency=2']);
 assert.equal(sequential.concurrency,1);assert.equal(parallel.concurrency,2);assert.deepEqual(parallel.cases,sequential.cases);assert.equal(parallel.cases.length,3);
 const international=run(['--stage=international','--concurrency=2']);assert.deepEqual(international.cases.map(c=>c.language),['en','fr']);
});
