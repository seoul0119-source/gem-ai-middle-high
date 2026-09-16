(function(root){
 function create(){return {current:1,items:{},uncertain:false};}
 function apply(state,event){
  if(!event){state.uncertain=true;return state;}
  if(!Number.isInteger(event.question)||event.question<1||event.question>10)return state;
  const q=state.items[event.question]||(state.items[event.question]={incorrect:0,hints:0});
  if(event.event==='incorrect')q.incorrect++;
  if(event.event==='hint')q.hints++;
  if(Number.isInteger(event.currentQuestion)&&event.currentQuestion>=1&&event.currentQuestion<=10)state.current=event.currentQuestion;
  return state;
 }
 function values(state){const q=state.items[state.current]||{incorrect:0,hints:0};return {...q,current:state.current,totalIncorrect:Object.values(state.items).reduce((s,x)=>s+x.incorrect,0),totalHints:Object.values(state.items).reduce((s,x)=>s+x.hints,0),uncertain:state.uncertain};}
 root.GemLessonCounters={create,apply,values};
})(globalThis);
