// Audio and DOM effects are deliberately outside this controller. A reply can
// never advance the lesson or grade a student's answer.
import {PRACTICE} from './lesson.js';
export class LessonController {
 constructor(scene=0){this.scene=Math.max(0,Math.min(5,Number.isInteger(scene)?scene:0));this.mode='lesson';this.status='ready';this.turn=0;this.practice=null;}
 play(){this.turn++;this.mode='lesson';this.status='playing';return this.turn;}
 pause(){this.turn++;this.status='paused';return this.turn;}
 ask(){this.turn++;this.status='thinking';return this.turn;}
 reply(turn){if(turn!==this.turn||this.status!=='thinking')return false;this.status='answering';return true;}
 replied(turn){if(turn!==this.turn)return false;this.status='paused';return true;}
 ended(scene,turn){if(this.mode!=='lesson'||this.status!=='playing'||this.scene!==scene||this.turn!==turn)return false;if(this.scene<5)this.scene++;else this.status='complete';return true;}
 move(scene){this.pause();this.mode='lesson';this.scene=Math.max(0,Math.min(5,scene));}
 practiceStart(count){if(![1,10].includes(count))throw Error('invalid_practice_count');this.pause();this.mode='practice';this.practice={count,index:0,attempts:0,solved:false,revealed:false,correct:0};}
 question(){return PRACTICE[this.practice?.index||0];}
 grade(value){if(this.mode!=='practice'||!this.practice||this.practice.solved||this.practice.revealed)return {ignored:true};const raw=String(value).trim();if(!/^\d{1,2}$/.test(raw))return {invalid:true};const correct=Number(raw)===this.question().answer;this.practice.attempts++;if(correct){this.practice.solved=true;this.practice.correct++;}return {correct};}
 reveal(){if(this.practice)this.practice.revealed=true;}
 next(){const p=this.practice;if(!p||(!p.solved&&!p.revealed))return false;if(p.index+1>=p.count)return false;p.index++;p.attempts=0;p.solved=false;p.revealed=false;return true;}
 back(){this.pause();this.mode='lesson';}
}
