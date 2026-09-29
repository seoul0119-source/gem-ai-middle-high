import {GED_COURSES,GED_NOTICE,GED_DESCRIPTION} from './ged-courses.js';
import {loadGeneratedGed} from './ged-generated.js';
import {createGedQuestions} from './ged-bank.js';
import {handleMaterials} from './materials-ai.js';

export function gedChoice(value) {
 const text=String(value||'').trim().replace(/[.!。]$/,'').trim();
 const m=text.match(/^(?:(?:정답|답)(?:은|는)?\s*)?([A-Da-d1-4①②③④])(?:\s*번)?(?:입니다|이에요|예요)?$/);
 if(m){const v=m[1].toUpperCase();return /[A-D]/.test(v)?v:'ABCD'['1234①②③④'.indexOf(v)%4];}
 return ({'에이':'A','비':'B','씨':'C','시':'C','디':'D','일 번':'A','이 번':'B','삼 번':'C','사 번':'D','일번':'A','이번':'B','삼번':'C','사번':'D'})[text]||null;
}
const start=/^(?:안녕하세요[.!]?\s*)?(?:시작|시작하기|수업\s*시작|start|시작해\s*주세요|수업\s*시작해\s*주세요)[.!?。]?$/i;
const hint=/^(?:힌트(?:\s*주세요)?|모르겠어요|잘\s*모르겠어요|hint)[.!?。]?$/i;
const repeat=/^(?:다시(?:\s*(?:말해\s*주세요|읽어\s*주세요))?|한\s*번\s*더|repeat)[.!?。]?$/i;
const next=/^(?:다음(?:\s*문제)?|새\s*문제|next)[.!?。]?$/i;
function render(q,index,attempts) {
 return `문제 ${index+1}/10 · ${q.topic} · 도전 ${attempts+1}/3\n${q.prompt}\n\n${q.choices.map((c,i)=>`${'ABCD'[i]}. ${c}`).join('\n')}\n\n답: (________)`;
}
// Replay student input against canonical questions. Assistant claims and
// client-supplied scores never drive grading or progress. Saved full transcripts
// can therefore resume without storing a second, incompatible lesson state.
export function replayGed(courseId, runId, messages, savedQuestions) {
 const questions=savedQuestions||createGedQuestions(courseId,runId),state={index:0,attempts:0,started:false,correct:0,firstCorrect:0,records:[]};
 let result;
 for(const message of messages){
  if(message?.role!=='user')continue;
  const input=String(message.content||'').trim();
  const index=state.index,q=questions[index];
  const progress={event:'discussion',question:Math.min(index+1,10),currentQuestion:Math.min(index+1,10),completed:false};
  result={text:'',progress,question:q,input};
  if(!state.started){state.started=true;result.text=GED_NOTICE+'\n'+GED_DESCRIPTION+'\n\n'+render(q,index,0);result.progress.event='question';continue;}
  if(index>=10){result.text='이번 검정고시 수업을 마쳤습니다. 새 수업 버튼을 누르면 다시 연습할 수 있습니다.';result.complete=true;continue;}
  if(start.test(input)||repeat.test(input)||next.test(input)){result.text=(next.test(input)?'현재 문제에 먼저 답해 주세요.\n\n':'')+render(q,index,state.attempts);continue;}
  if(hint.test(input)){result.text=`힌트: ${q.hint}\n\n`+render(q,index,state.attempts);result.progress.event='hint';continue;}
  const exactOption=q.choices.findIndex(c=>c.trim().toLocaleLowerCase()===input.toLocaleLowerCase());
  const choice=gedChoice(input)||(exactOption>=0?'ABCD'[exactOption]:null);
  if(!choice){result.tutor=true;result.text='';continue;}
  state.attempts++;
  const correct=choice===q.answer,completed=correct||state.attempts===3;
  result.progress.event=correct?'correct':'incorrect';result.progress.completed=completed;
  if(!completed){result.text=`아직 정답이 아닙니다. ${q.hint}\n\n`+render(q,index,state.attempts);continue;}
  const record={question:index+1,stage:GED_COURSES[courseId]?.grade||'검정고시',topic:q.topic,scope:'direct',outcome:correct?'correct':'incorrect',attempts:state.attempts,weakType:state.attempts>1?q.topic:''};
  state.records.push(record);if(correct)state.correct++;if(correct&&state.attempts===1)state.firstCorrect++;
  result.record=record;
  result.text=(correct?'정답입니다.':'세 번의 도전을 마쳤습니다.')+` 정답은 ${q.answer}입니다.\n${q.explanation}`;
  state.index++;state.attempts=0;result.progress.currentQuestion=Math.min(state.index+1,10);
  if(state.index<10)result.text+='\n\n'+render(questions[state.index],state.index,0);
  else{result.complete=true;result.text+=`\n\n이번 검정고시 수업을 마쳤습니다.\n첫 시도 정답: ${state.firstCorrect}/10 (${state.firstCorrect*10}점)\n재도전 포함 정답: ${state.correct}/10\n이 점수는 10문제 연습 결과이며 실제 시험의 합격 판정이 아닙니다.`;}
 }
 return {...result,state,questions};
}
export async function handleGedLesson({student,messages}) {
 if(!Array.isArray(messages)||messages.length<1||messages.length>400||messages.some(m=>!['assistant','user'].includes(m?.role)||typeof m.content!=='string'||m.content.length>16000))throw Error('수업 대화를 확인하지 못했습니다. 자료실에서 이어하거나 새 수업을 시작해 주세요.');
 const generated=String(student.courseRunId).startsWith('ged-v3:');
 const questions=generated?await loadGeneratedGed(student,!messages.some(m=>m.role==='assistant')):undefined;
 const r=replayGed(student.courseId,student.courseRunId,messages,questions);
 if(!r)throw Error('수업 메시지를 입력해 주세요.');
 if(r.tutor){
  const q=r.question;
  const reply=await handleMaterials({mode:'tutor',courseId:student.courseId,message:r.input.slice(0,2000),history:messages.slice(0,-1).slice(-12),question:{prompt:q.prompt,choices:q.choices,hints:[q.hint],result:'open'}});
  r.text=`문제 ${r.state.index+1}/10 · 풀이 도움\n${reply.text}\n\n같은 문제를 이어서 풀어 주세요. 답은 A~D 또는 1~4번으로 입력할 수 있습니다.\n답: (________)`;
 }
 return {text:r.text,progress:r.progress,...(r.record?{record:r.record}:{}),complete:!!r.complete};
}
