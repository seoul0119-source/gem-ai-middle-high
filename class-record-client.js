/* Keep a per-student retry queue; only acknowledged snapshots leave this device. */
(function(root){
 root.GemClassRecords=function({student,notify}){
  const key='gem-class-record-pending:'+student;
  let pending={},working=null;
  const saving=new Map();
  try{pending=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
  function persist(){try{localStorage.setItem(key,JSON.stringify(pending));return true;}catch{notify('기기 임시 저장 공간이 부족합니다. 서버 저장 확인 전에는 창을 닫지 마세요.');return false;}}
  async function save(id){
    if(saving.has(id))return saving.get(id);
    const snapshot=pending[id];if(!snapshot)return true;
    const task=(async()=>{
      try{
        const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-class-record',...snapshot}),signal:AbortSignal.timeout(30000)});
        const d=await r.json();if(!r.ok||!d.saved)throw Error(d.error||'자료실 저장 연결을 확인해 주세요.');
        if(pending[id]?.record.revision===snapshot.record.revision){delete pending[id];persist();}
        return true;
      }catch(e){notify('자료실 저장 대기 · '+e.message);return false;}
    })();
    saving.set(id,task);
    try{return await task;}finally{if(saving.get(id)===task)saving.delete(id);}
  }
  async function drain(onlyId){
    if(!onlyId&&working)return working;
    const matches=id=>!onlyId||id===onlyId;
    const task=(async()=>{
      const failed=new Set();
      while(Object.keys(pending).some(id=>matches(id)&&!failed.has(id))){
        for(const id of Object.keys(pending)){
          if(!matches(id)||failed.has(id))continue;
          if(!await save(id))failed.add(id);
        }
      }
      if(Object.keys(pending).some(matches))return false;
      if(!onlyId)notify('자료실에 문제·답변·힌트 기록이 저장되었습니다.');
      return true;
    })();
    if(!onlyId)working=task;
    try{return await task;}finally{if(working===task)working=null;}
  }
  function queue(id,permit,record,exiting=false){if(!permit||record.messages.length<2)return;pending[id]={permit,record};const local=persist();if(local)notify('자료실에 저장 중…');if(exiting){const body=JSON.stringify({action:'save-class-record',permit,record});if(new Blob([body]).size<60000)navigator.sendBeacon?.('/api/session',new Blob([body],{type:'application/json'}));}else void drain();}
  const retry=()=>{if(Object.keys(pending).length)void drain();};
  window.addEventListener('online',retry);setInterval(retry,15000);retry();
  // A worksheet handoff waits only for its own acknowledged snapshot. Old
  // failed records remain queued, and concurrent saves of one run share a task.
  return {queue,flush:id=>drain(typeof id==='string'&&id?id:undefined)};
 };
})(globalThis);
