// Add conversational pauses on top of the latest tested session, input, display and media layers.
import fs from 'node:fs/promises';
function once(s,a,b){if(s.split(a).length!==2)throw Error('Dialogue anchor changed: '+a.slice(0,120));return s.replace(a,b);}
await import('./build-auto-media.mjs');
const out='mission-dist';
let input=await fs.readFile(out+'/interaction-support.mjs','utf8');
input=once(input," const banner=document.createElement('p');",` let dialogueActive=false,dialogueMode='idle',resumeAfter=false,dialogueRemaining=20,lastNarration='';
 function beginDialogue(){if(dialogueMode==='input')return;if(busy)cancel(true);if(!dialogueActive)resumeAfter=state().started&&!state().paused&&!state().ended;lastNarration=$('caption').textContent;dialogueActive=true;dialogueMode='input';h.pause();ui.refresh();}
 function resumeDialogue(force=false){const resume=force||resumeAfter;ui.stop();cancel();lastReply=null;holdUntil=0;unresolved=false;$('answer').value='';$('answer').blur();state().paused=!resume;ui.resetClock();ui.refresh();status('ready');if(resume)h.speak(ui.phaseText());}
 function tickDialogue(dt){if(!dialogueActive||dialogueMode==='input'||dialogueMode==='error'||busy||h.mediaState().busy||h.mediaState().failed||h.mediaState().muted||document.hidden||document.querySelector('dialog[open]'))return;if(dialogueMode==='answer'){dialogueMode='followup';dialogueRemaining=20;}if(unresolved||$('answer').value.trim())return;dialogueRemaining-=dt;banner.textContent=fr()?'Autre question ? Reprise dans '+Math.ceil(dialogueRemaining)+' s. Continuer reprend la leçon.':'Another question? Returning to the lesson in '+Math.ceil(dialogueRemaining)+' s. Continue resumes now.';if(dialogueRemaining<=0)resumeDialogue();}
 const banner=document.createElement('p');`);
input=once(input,'function cancel(){epoch++;request?.abort();request=null;busy=false;}','function cancel(keepDialogue=false){epoch++;request?.abort();request=null;busy=false;if(!keepDialogue){dialogueActive=false;dialogueMode=\'idle\';}}');
input=once(input,'  const r=classify(question,s);',`  if(/multipli|\\btimes\\b|diff[eé]ren|today|aujourd|what.*learn|appris|오늘|곱하/.test(q))return {kind:'question'};
  const r=classify(question,s);`);
input=once(input,'function receive(result,reply){lastReply=',`function receive(result,reply){if(['correct','incorrect'].includes(result.kind)){dialogueActive=false;dialogueMode='idle';state().paused=!resumeAfter;}else{dialogueActive=true;dialogueMode='answer';dialogueRemaining=20;state().paused=true;}lastReply=`);
input=once(input,"state().waiting=false;ui.answered();", "state().waiting=false;if(['correct','incorrect'].includes(result.kind))ui.answered();");
input=once(input,'  ensureInteractive();ui.stop();cancel();accepted++;', '  beginDialogue();ensureInteractive();ui.stop();cancel(true);accepted++;');
input=once(input,'else reply=replyFor(result,s,lang);',`else if(result.kind==='explain'&&lastReply?.result.kind==='ai'&&lastReply.key===viewKey()){reply=lastReply.reply;result={kind:'ai'};}else reply=replyFor(result,s,lang);`);
input=once(input,'  busy=true;unresolved=true;lastReply=null;', "  dialogueMode='thinking';busy=true;unresolved=true;lastReply=null;");
input=once(input,"provider=error.message==='not_configured'", "dialogueMode='error';provider=error.message==='not_configured'");
input=once(input,'function render(){fresh.textContent=',"function render(){if(dialogueActive&&dialogueMode==='thinking')$('caption').textContent=fr()?'Je prépare une réponse…':'Preparing an answer…';fresh.textContent=");
input=once(input,"history})", "history,lessonProgress:{currentProblem:state().index,currentTitle:s.title?.[lang]||'',phase:ui.phase(),covered:h.steps.slice(1,state().index).map(x=>({a:x.a,b:x.b,missing:!!x.missing,title:x.title?.[lang]||''}))}})");
input=once(input,"version:'input-v2',sessionId:","version:'dialogue-v1',dialogueActive,dialogueMode,sessionId:");
input=once(input,'return {replyText:', 'return {beginDialogue,resumeDialogue,tickDialogue,dialogueActive:()=>dialogueActive,replyText:');
input=once(input,'hold:()=>busy||review||unresolved||performance.now()<holdUntil','hold:()=>dialogueActive||busy||review||unresolved||performance.now()<holdUntil');
await fs.writeFile(out+'/interaction-support.mjs',input);
let group=await fs.readFile(out+'/group-classroom.mjs','utf8');
group=once(group,"answered:()=>{submitted=true;phaseIdle=0;phase='response';scene=0;}","resetClock:()=>{phaseIdle=0;},answered:()=>{submitted=true;phaseIdle=0;phase='response';scene=0;}");
group=once(group,' const s=state();\n if(!h.modelReady())', ' const s=state();\n if(support.dialogueActive()){if(!h.modelReady()){await $('load-avatar').onclick();if(!h.modelReady())return;}support.resumeDialogue(true);return;}\n if(!h.modelReady())');
group=once(group,'support.ensureInteractive();refresh();originalMicClick();','support.ensureInteractive();support.beginDialogue();refresh();originalMicClick();');
group=once(group," $('answer-form').onsubmit=", " $('answer').addEventListener('input',()=>{if(lessonAvailable(selection))support.beginDialogue();});\n $('answer-form').onsubmit=");
group=once(group," if(!s.started||s.ended||s.paused||document.hidden", " support.tickDialogue(dt);\n if(!s.started||s.ended||s.paused||document.hidden");
group=group.replace('Explanations continue automatically. Answers and corrections wait for the class. Microphone: final answers are sent automatically.','Ask with Speak or Send. The lesson pauses for answers, then allows 20 seconds for more questions. Continue returns to the lesson.').replace('Les explications avancent automatiquement. Les réponses et corrections attendent la classe. Micro : envoi automatique de la réponse finale.','Posez une question avec le micro ou Envoyer. La leçon attend la réponse, puis laisse 20 secondes pour une autre question. Continuer reprend la leçon.');
await fs.writeFile(out+'/group-classroom.mjs',group);
let sw=await fs.readFile(out+'/sw.js','utf8');sw=once(sw,'gem-group-auto-media-001','gem-group-dialogue-v1');await fs.writeFile(out+'/sw.js',sw);
await import('./dialogue-browser-tests.mjs');

await import('./dialogue-live-check.mjs');
