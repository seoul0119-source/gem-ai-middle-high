// Patch only the programme entry. The verified sample, speech and original lesson API are preserved.
import fs from 'node:fs/promises';
function once(text,from,to){if(text.split(from).length!==2)throw Error('Workbook anchor changed: '+from.slice(0,130));return text.replace(from,to);}
export function patchWorkbookApp(app){
 app="import {installWorkbook,workbookLabel} from './workbook.mjs';\nimport {WORKBOOK_VERSION,freshWorkbook} from './workbook-core.mjs';\n"+app;
 app=once(app,"if(!getCourse(state.subject,state.grade)){", "let workbook=null;\nif(!getCourse(state.subject,state.grade)){");
 app=once(app," const visiblePreview=", " workbook?.render();\n const visiblePreview=");
 app=once(app,"$('lesson-title').textContent=getUnit(state.unitId).title[state.lang];", "$('lesson-title').textContent=(state.workbook?workbookLabel(state.lang,'tag')+' · ':'')+getUnit(state.unitId).title[state.lang];");
 app=once(app,"fetch('./api/mission-programme.js',", "fetch(body.practice===true?'./api/mission-workbook.js':'./api/mission-programme.js',");
 app=once(app,"function adopt(unitId,lesson,id){", "function adopt(unitId,lesson,id,practice=false){");
 app=once(app,"state={...state,unitId,lesson,sessionId:id,", "state={...state,unitId,lesson,workbook:practice,sessionId:id,");
 app=once(app,"statusKey='readyLesson';cacheLesson();render();}", "statusKey='readyLesson';if(!practice)cacheLesson();render();}");
 app=once(app,"state.unitId===unitId&&state.lesson&&!fresh", "state.unitId===unitId&&state.lesson&&!state.workbook&&!fresh");
 app=once(app,"$('regenerate').onclick=()=>prepare(state.unitId,true);", "$('regenerate').onclick=()=>state.workbook?workbook.start():prepare(state.unitId,true);");
 app=once(app,"function answerChoice(i){", `async function prepareWorkbook(unitId,recentQuestions){
 if(busy)return false;
 if(state.lesson&&!confirm(T('newConfirm')))return false;
 // Preserve the old pack, choices, transcript and progress until validated success.
 stop();state.paused=true;busy=true;statusKey='generating';render();const token=epoch+1;
 try{
  const result=await api({action:'lesson',practice:true,unitId,lang:state.lang,recentQuestions},165000);
  if(token!==epoch)return false;
  if(result.workbook!==WORKBOOK_VERSION||!validateLesson(result.lesson,unitId)||!freshWorkbook(result.lesson,recentQuestions))throw Error('invalid_workbook');
  workbook.remember(unitId,result.lesson);
  adopt(unitId,result.lesson,crypto.randomUUID(),true);
  $('preview').scrollIntoView({block:'start',behavior:'smooth'});
  return true;
 }catch{if(token===epoch){busy=false;statusKey='failed';render();}return false;}
}
function answerChoice(i){`);
 app=once(app,"render();installDisplayV3();", "workbook=installWorkbook({course:()=>getCourse(state.subject,state.grade),lang:()=>state.lang,busy:()=>busy,generate:prepareWorkbook});\nrender();installDisplayV3();");
 return app;
}
export async function applyWorkbook(root='mission-dist'){
 for(const file of ['workbook.mjs','workbook-core.mjs'])await fs.copyFile('mission/programme/'+file,root+'/programme/'+file);
 const appPath=root+'/programme/app.mjs';await fs.writeFile(appPath,patchWorkbookApp(await fs.readFile(appPath,'utf8')));
 const css=`\n/* Workbook card: fifth item at desktop width; never overflows smaller screens. */
#unit-list{grid-template-columns:repeat(auto-fit,minmax(min(195px,100%),1fr));align-items:stretch}
#ai-workbook-card{border:2px solid #176e5c;background:#f1f9f4}
#ai-workbook-card p{font-size:14px;line-height:1.55;margin:0}
#ai-workbook-card small{font-size:12px;line-height:1.5;color:#455f54}
#ai-workbook-card button{white-space:normal;line-height:1.4;min-height:46px}
`;
 await fs.appendFile(root+'/programme/style.css',css);
}
