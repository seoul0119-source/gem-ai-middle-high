import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
for(const file of ['content-policy.mjs','curriculum.mjs','core.mjs','labels.mjs','speech-labels.mjs','cloud-speech.mjs','app.mjs'])execFileSync(process.execPath,['--check','mission/programme/'+file],{stdio:'inherit'});
execFileSync(process.execPath,['mission/programme/tests.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['mission/programme/speech-tests.mjs'],{stdio:'inherit'});
// Verify the live provider early, before the lengthy inherited display suite.
// The draft is a test result only and is never served as a lesson fallback.
if(process.env.OPENAI_API_KEY){
 const {runProgramme}=await import('../api/mission-programme.js');
 const live=await runProgramme({action:'lesson',unitId:'science-g2-u1',lang:'en',variant:'preview-build-verification'});
 assert.equal(live.status,200,'Live common lesson: '+(live.code||live.status));
 console.log('PROGRAMME LIVE CONTENT PASS',JSON.stringify({unitId:live.unitId,version:live.version,languages:5,stages:live.lesson.steps.length,independentReview:true}));
}else console.log('PROGRAMME LIVE CONTENT SKIP: no server key in this build environment');
await import('./programme/speech-preflight.mjs');
await import('./build-pc-audio-v2.mjs');
const hash=async file=>crypto.createHash('sha256').update(await fs.readFile('mission-dist/'+file)).digest('hex'),before={};
for(const f of ['index.html','app.mjs','sw.js','avatar.bundle.js','reliable-lessons.mjs','display-v3.mjs','pc/audio-tools.mjs'])before[f]=await hash(f);
await fs.mkdir('mission-dist/programme',{recursive:true});
for(const f of ['content-policy.mjs','curriculum.mjs','core.mjs','labels.mjs','speech-labels.mjs','cloud-speech.mjs','app.mjs','style.css'])await fs.copyFile('mission/programme/'+f,'mission-dist/programme/'+f);
await fs.cp('mission/programme/fonts','mission-dist/programme/fonts',{recursive:true,filter:src=>!src.endsWith('.base64')});
await fs.copyFile('mission/programme/index.html','mission-dist/programme.html');
// Localized copy for the new page; preserve the original sample's controller.
let display=await fs.readFile('mission-dist/display-v3.mjs','utf8');
const oldText="const text=active?(french()?'⛶ Quitter le plein écran':'⛶ Exit full screen'):(french()?'⛶ Plein écran':'⛶ Full screen');";
const oldExit="const exitLabel=french()?'Quitter le plein écran':'Exit full screen';";
assert.equal(display.split(oldText).length,2);assert.equal(display.split(oldExit).length,2);
const exitWords={en:'Exit full screen',fr:'Quitter le plein écran',ne:'पूरा पर्दाबाट बाहिर निस्कनुहोस्',ur:'پوری اسکرین سے باہر آئیں',sw:'Toka kwenye skrini nzima'};
display="import {label as programmeLabel} from './labels.mjs';\nconst exitWords="+JSON.stringify(exitWords)+";\n"+display.replace(oldText,"const text=active?(exitWords[document.documentElement.lang]||exitWords.en):programmeLabel(document.documentElement.lang,'full');").replace(oldExit,"const exitLabel=exitWords[document.documentElement.lang]||exitWords.en;");
await fs.writeFile('mission-dist/programme/display.mjs',display);

let app=await fs.readFile('mission-dist/pc/app.mjs','utf8');
function replaceOnce(old,value){assert.equal(app.split(old).length,2,'Programme entry anchor: '+old);app=app.replace(old,value);}
app="import {label as programmeLabel} from '../programme/labels.mjs';\n"+app;
replaceOnce("$('open-course').disabled=!availability.available;$('course-status').textContent=T(availability.available?'pilot':availability.status==='not-offered'?'unavailable':'planned');","$('open-course').disabled=false;$('course-status').textContent=programmeLabel(state.lang,'draftNotice');");
replaceOnce("small.textContent=s.id==='math'?`${T('pilot')}; ${T('planned')}: 1, 3–12`:T('planned');","small.textContent=programmeLabel(state.lang,'units');");
replaceOnce("$('open-course').onclick=()=>{if(!course(state.subject,state.grade).available)return;if(!state.session)newSession();state.view='lesson';render();};","$('open-course').onclick=()=>{location.href='./programme.html?'+new URLSearchParams({lang:state.lang,grade:String(state.grade),subject:state.subject});};");
app+="\nconst sampleParams=new URLSearchParams(location.search);if(sampleParams.get('sample')==='1'){state.grade=2;state.subject='math';if(LANGUAGES.some(l=>l.code===sampleParams.get('lang')))state.lang=sampleParams.get('lang');if(!state.session)newSession();state.view='lesson';render();}\n";
await fs.writeFile('mission-dist/pc/app.mjs',app);
let html=await fs.readFile('mission-dist/pc.html','utf8');html=html.replace('</head>', '<link rel="stylesheet" href="./programme/style.css"></head>');html=html.replace('GEM PC 음성 입력 수정 v2 · 인식 문자 표시/유지 · 읽기/마이크 별도 진단','GEM PC 공통 과정 시험 · 42개 과정 · 168개 단원 주제 · 교사 검토 후 수업');await fs.writeFile('mission-dist/pc.html',html);
for(const[f,h]of Object.entries(before))assert.equal(await hash(f),h,'Preserved sample changed: '+f);
await import('./programme/browser-tests.mjs');
await fs.writeFile('mission-dist/programme-report.json',JSON.stringify({status:'PASS',version:'gem-common-programme-v2',courses:42,unitThemes:168,languages:5,preserved:before,limitations:['Unit map and on-demand lesson preparation, not a reviewed complete annual curriculum','New translations and AI lesson facts require teacher review','TTS/ASR physical-device coverage is not certified','Browser test uses a provider fixture; live provider requires separate verification']},null,2));
