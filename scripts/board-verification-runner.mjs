// A case owns its sequential six-step flow. Parallelism is only between
// independent classrooms and is capped at two, including during failure.
export async function runBoardVerificationCases(cases,verifyCase,{concurrency=1}={}){
 if(![1,2].includes(concurrency))throw new RangeError('Verification concurrency must be 1 or 2.');
 const results=[];
 for(let offset=0;offset<cases.length;offset+=concurrency){
  const batch=cases.slice(offset,offset+concurrency);
  // Capture synchronous throws as well as promise failures, and await every
  // started sibling before failing the gate. Never launch another batch after
  // a rejection, retry a case, or accept only the successful subset.
  const settled=await Promise.allSettled(batch.map(item=>Promise.resolve().then(()=>verifyCase(item))));
  const errors=settled.filter(item=>item.status==='rejected').map(item=>item.reason);
  if(errors.length===1)throw errors[0];
  if(errors.length)throw new AggregateError(errors,'Multiple representative classroom verifications failed.');
  results.push(...settled.map(item=>item.value));
 }
 return results;
}
