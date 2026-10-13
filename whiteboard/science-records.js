import {createBoardUi} from './board-ui.js';
import {getBoardCourse} from './board-courses.js';
/* Reuse the existing signed classroom record path. Creating this adapter does
 * not start a tracked class; only an explicit learner start does. */
export function createScienceRecords({studentId,courseId='h3-science',notify=()=>{},fetcher=globalThis.fetch,recordsFactory=globalThis.GemClassRecords}={}){
  const course=getBoardCourse(courseId);if(!course)throw Error('unsupported_board_course');const ui=createBoardUi(course.language);
  let selected=null,active=null,client=null,operation=Promise.resolve();
  const sequence=task=>{const result=operation.then(task,task);operation=result.catch(()=>{});return result;};
  const say=text=>{try{notify(typeof text==='string'&&text.startsWith('자료실 저장 대기')?ui('학습 기록 저장 대기'):ui(text));}catch{}};
  async function request(payload){
    const response=await fetcher('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
    const data=await response.json();
    if(!response.ok)throw Error(typeof data.error==='string'?data.error:ui('학습 기록 연결을 확인해 주세요.'));
    return data;
  }
  const text=(value,max=16000)=>typeof value==='string'?value.slice(0,max):'';
  function snapshot(slot,status='studying',exiting=false){
    if(!client||!slot.runId||!slot.permit||slot.messages.length<2)return;
    client.queue(slot.runId,slot.permit,{revision:++slot.revision,status,lessonSeed:'science-board:'+slot.id,messages:structuredClone(slot.messages),counters:{current:slot.question+1,items:{},uncertain:false}},exiting);
  }
  async function close(slot){
    if(!slot||active!==slot)return true;
    snapshot(slot,'stopped');
    let saved=true;
    try{saved=await client.flush();}catch{saved=false;say(ui('학습 기록은 이 기기에 보관되어 있으며 다시 연결되면 저장합니다.'));}
    try{await request({action:'end',courseId,courseRunId:slot.runId});}
    catch{say(ui('수업 종료 기록의 연결을 확인해 주세요. 풀이 기록은 유지됩니다.'));saved=false;}
    active=null;
    return saved;
  }
  function start(lesson){
    if(!studentId||!lesson||(lesson.courseId&&lesson.courseId!==courseId)||typeof lesson.id!=='string'||!lesson.id.trim()||lesson.id.length>140||typeof recordsFactory!=='function'){
      say(ui('학습 기록 연결을 준비하지 못했습니다.'));return Promise.resolve(false);
    }
    const slot={id:lesson.id,title:text(lesson.title||lesson.topicId,300),messages:[],question:0,revision:0,runId:'',permit:''};
    slot.messages.push({role:'user',content:course.title+' · '+ui('칠판 수업 시작: {title}',{title:slot.title})},{role:'assistant',content:ui('{title} — 개념 설명과 선택형 10문제 수업',{title:slot.title}),progress:{event:'discussion',question:1,currentQuestion:1}});
    selected=slot;
    return sequence(async()=>{
      if(selected!==slot)return false;
      if(active)await close(active);
      if(selected!==slot)return false;
      try{
        const data=await request({action:'start',courseId});
        if(data.courseId!==courseId||typeof data.courseRunId!=='string'||!data.courseRunId||typeof data.recordPermit!=='string'||!data.recordPermit)throw Error(ui('학습 기록의 과목 정보를 확인하지 못했습니다.'));
        slot.runId=data.courseRunId;slot.permit=data.recordPermit;active=slot;
        client ||= recordsFactory({student:studentId,notify:say});
        if(selected===slot)snapshot(slot);
        return selected===slot;
      }catch(error){say(ui('학습 기록 연결 확인 필요'));return false;}
    });
  }
  function event(type,payload={}){
    const slot=selected;
    if(!slot||(payload.lessonId&&payload.lessonId!==slot.id))return false;
    const indexed=['question','attempt','revealed','hint'].includes(type);
    const index=payload.questionIndex;
    if(indexed&&(!Number.isInteger(index)||index<0||index>9))return false;
    const question=indexed?index+1:slot.question+1;
    const progress=(event,completed=false)=>({event,question,currentQuestion:question,...(completed?{completed:true}:{})});
    let messages=[];
    if(type==='question'){
      if(!text(payload.prompt)||!Array.isArray(payload.choices)||payload.choices.length!==4||payload.choices.some(choice=>typeof choice!=='string'))return false;
      slot.question=index;
      messages=[{role:'assistant',content:ui('문제 {number}/10',{number:question})+'\n'+text(payload.prompt,1400)+'\n'+payload.choices.map((choice,i)=>'ABCD'[i]+'. '+text(choice,220)).join('\n'),progress:progress('question')}];
    }else if(type==='attempt'){
      if(!Number.isInteger(payload.selectedIndex)||payload.selectedIndex<0||payload.selectedIndex>3||!Number.isInteger(payload.answerIndex)||payload.answerIndex<0||payload.answerIndex>3||!Number.isInteger(payload.attempts)||payload.attempts<1||payload.attempts>3)return false;
      const correct=payload.selectedIndex===payload.answerIndex;
      if(typeof payload.correct==='boolean'&&payload.correct!==correct)return false;
      const complete=correct||payload.attempts===3;
      const feedback=correct?ui('정답입니다. ')+text(payload.explanation,900):complete?ui('3회 도전을 마쳤습니다. 정답: ')+'ABCD'[payload.answerIndex]+'. '+text(payload.explanation,900):ui('정답이 아닙니다. 다시 생각해 보세요.');
      messages=[{role:'user',content:'ABCD'[payload.selectedIndex]+(Array.isArray(payload.choices)&&typeof payload.choices[payload.selectedIndex]==='string'?'. '+text(payload.choices[payload.selectedIndex],220):'')},{role:'assistant',content:feedback,progress:progress(correct?'correct':'incorrect',complete),...(complete?{assessment:{question,outcome:correct?'correct':'incorrect',attempts:payload.attempts}}:{})}];
      if(!complete&&Array.isArray(payload.hints)&&payload.hints.length){const hint=text(payload.hints[Math.min(payload.attempts-1,payload.hints.length-1)],900);if(hint)messages.push({role:'assistant',content:hint,progress:progress('hint')});}
    }else if(type==='revealed'){
      messages=[{role:'user',content:ui('풀이 보기')},{role:'assistant',content:ui('풀이를 확인했습니다. ')+text(payload.explanation,900),progress:progress('discussion',true)}];
    }else if(type==='hint'){
      if(!text(payload.text||payload.hint))return false;
      messages=[{role:'user',content:ui('힌트 보기')},{role:'assistant',content:text(payload.text||payload.hint,900),progress:progress('hint')}];
    }else if(type==='dialogue'){
      if(!text(payload.question)||!text(payload.answer))return false;
      messages=[{role:'user',content:text(payload.question,1200)},{role:'assistant',content:text(payload.answer,2400),progress:progress('discussion')}];
    }else if(type==='explanation'){
      if(!text(payload.text))return false;
      messages=[{role:'assistant',content:text(payload.title,300)+'\n'+text(payload.text,4000),progress:progress('discussion')}];
    }else if(type==='completed'){
      // Scores are rebuilt from actual question/attempt events on the server.
      // A summary click must never mark unseen or unanswered questions correct.
      messages=[{role:'assistant',content:ui('이번 문제 풀이를 마쳤습니다.'),progress:progress('discussion')}];
    }else return false;
    const next=[...slot.messages,...messages];
    if(next.length>380||new TextEncoder().encode(JSON.stringify(next)).length>220000){say(ui('수업 기록이 길어졌습니다. 현재 기록을 저장한 뒤 새 수업을 시작해 주세요.'));return false;}
    slot.messages=next;snapshot(slot);return true;
  }
  function flush(){return sequence(async()=>{if(selected&&active===selected)snapshot(selected);return client?client.flush():true;});}
  function end(){const slot=selected;selected=null;return sequence(()=>close(slot));}
  function exit(){const slot=selected;selected=null;if(!slot)return;if(active!==slot){void sequence(()=>close(slot));return;}snapshot(slot,'stopped',true);const body=new Blob([JSON.stringify({action:'end-on-exit',courseId,courseRunId:slot.runId})],{type:'application/json'});if(!globalThis.navigator?.sendBeacon?.('/api/session',body))void fetcher('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});active=null;}
  return {start,event,flush,end,exit};
}
