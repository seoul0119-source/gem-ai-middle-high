// Reuse the tested pause/question/reply state transitions from the math pilot.
import {LessonController} from './controller.js';
import {emptyBoardProgress,normalizeBoardProgress} from './board-progress.js';
export class ScienceController extends LessonController {
 constructor(scene=0){super();this.scene=Number.isInteger(scene)?Math.max(0,Math.min(4,scene)):0;this.totalScenes=5;this.questions=[];this.waiting=false;this.progress=null;this.legacyPractice=false;}
 ended(scene,turn){if(this.mode!=='lesson'||this.status!=='playing'||this.scene!==scene||this.turn!==turn)return false;if(this.scene<this.totalScenes-1)this.scene++;else this.status='complete';return true;}
 move(scene){this.pause();this.mode='lesson';this.scene=Math.max(0,Math.min(this.totalScenes-1,scene));this.waiting=false;}
 practiceStart(questions,count=10,progress,cursor=0){
  if(!Array.isArray(questions)||questions.length!==10||![1,10].includes(count))throw Error('invalid_practice');
  const same=JSON.stringify(this.questions)===JSON.stringify(questions);
  const ledger=progress===undefined?(same&&this.progress?this.progress:emptyBoardProgress()):normalizeBoardProgress(progress,questions);
  if(!ledger)throw Error('invalid_progress');
  this.pause();this.mode='practice';this.questions=questions;this.progress=ledger;this.legacyPractice=false;
  this.practice={count,index:Math.max(0,Math.min(count-1,Number.isInteger(cursor)?cursor:0)),attempts:0,solved:false,revealed:false,correct:0,selected:null};this.refreshPractice();
 }
 refreshPractice(){
  if(!this.practice||!this.progress||this.legacyPractice)return;
  const p=this.practice,item=this.progress.items[p.index];
  p.attempts=item.attempts.length;p.solved=item.result==='correct';p.revealed=item.result==='revealed';p.selected=item.attempts.at(-1)??null;
  p.correct=this.progress.items.slice(0,p.count).filter(x=>x.result==='correct').length;
 }
 question(){return this.questions[this.practice?.index||0];}
 grade(value){const p=this.practice;if(this.mode!=='practice'||!p||p.solved||p.revealed)return{ignored:true};if(!Number.isInteger(value)||value<0||value>3)return{invalid:true};const correct=value===this.question().answerIndex;
  const item=this.progress?.items[p.index];
  // Legacy snapshots kept only a count and last choice. Do not invent their
  // missing choices; preserve that UI summary until the next question.
  if(item&&item.attempts.length===p.attempts){item.attempts.push(value);item.result=correct?'correct':item.attempts.length>=3?'revealed':'open';item.hints=Math.min(2,item.hints+(correct?0:1));}
  p.attempts++;p.selected=value;if(correct){p.solved=true;p.correct++;}else if(p.attempts>=3)p.revealed=true;return{correct,revealed:p.revealed,attempts:p.attempts};}
 reveal(){const p=this.practice;if(!p||p.solved||p.revealed)return;super.reveal();if(this.progress)this.progress.items[p.index].result='revealed';}
 next(){if(!super.next())return false;this.practice.selected=null;if(!this.legacyPractice)this.refreshPractice();return true;}
}
