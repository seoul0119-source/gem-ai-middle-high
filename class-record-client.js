/* Keep a per-student retry queue; only acknowledged snapshots leave this device. */
(function(root){
 root.GemClassRecords=function({student,notify}){
  const key='gem-class-record-pending:'+student;
  let pending={},working=null;
  try{pending=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
  function persist(){try{localStorage.setItem(key,JSON.stringify(pending));return true;}catch{notify('기기 임시 저장 공간이 부족합니다. 서버 저장 확인 전에는 창을 닫지 마세요.');return false;}}
  async function drain(){
   if(working)return working;
   working=(async()=>{
    const failed=new Set();
    while(Object.keys(pending).some(id=>!failed.has(id))){
    for(const [id,snapshot] of Object.entries({...pending})){
     if(failed.has(id))continue;
     try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-class-record',...snapshot}),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok||!d.saved)throw Error(d.error||'자료실 저장 연결을 확인해 주세요.');if(pending[id]?.record.revision===snapshot.record.revision){delete pending[id];persist();}}
     catch(e){failed.add(id);notify('자료실 저장 대기 · '+e.message);}
    }
    }
    if(Object.keys(pending).length)return false;
    notify('자료실에 문제·답변·힌트 기록이 저장되었습니다.');return true;
   })();
   try{return await working;}finally{working=null;}
  }
  function queue(id,permit,record,exiting=false){if(!permit||record.messages.length<2)return;pending[id]={permit,record};const local=persist();if(local)notify('자료실에 저장 중…');if(exiting){const body=JSON.stringify({action:'save-class-record',permit,record});if(new Blob([body]).size<60000)navigator.sendBeacon?.('/api/session',new Blob([body],{type:'application/json'}));}else void drain();}
  const retry=()=>{if(Object.keys(pending).length)void drain();};
  window.addEventListener('online',retry);setInterval(retry,15000);retry();
  return {queue,flush:drain};
 };
})(globalThis);
