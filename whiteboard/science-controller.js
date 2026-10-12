// Reuse the tested pause/question/reply state transitions from the math pilot.
import {LessonController} from './controller.js';
export class ScienceController extends LessonController {
 constructor(scene=0){super();this.scene=Number.isInteger(scene)?Math.max(0,Math.min(4,scene)):0;this.totalScenes=5;this.questions=[];this.waiting=false;}
 ended(scene,turn){if(this.mode!=='lesson'||this.status!=='playing'||this.scene!==scene||this.turn!==turn)return false;if(this.scene<this.totalScenes-1)this.scene++;else this.status='complete';return true;}
 move(scene){this.pause();this.mode='lesson';this.scene=Math.max(0,Math.min(this.totalScenes-1,scene));this.waiting=false;}
 practiceStart(questions,count=10){if(!Array.isArray(questions)||questions.length!==10||![1,10].includes(count))throw Error('invalid_practice');this.pause();this.mode='practice';this.questions=questions;this.practice={count,index:0,attempts:0,solved:false,revealed:false,correct:0,selected:null};}
 question(){return this.questions[this.practice?.index||0];}
 grade(value){const p=this.practice;if(this.mode!=='practice'||!p||p.solved||p.revealed)return{ignored:true};if(!Number.isInteger(value)||value<0||value>3)return{invalid:true};const correct=value===this.question().answerIndex;p.attempts++;p.selected=value;if(correct){p.solved=true;p.correct++;}else if(p.attempts>=3)p.revealed=true;return{correct,revealed:p.revealed,attempts:p.attempts};}
 next(){if(!super.next())return false;this.practice.selected=null;return true;}
}
