// Preserve and verify the existing audio/3D pipeline before extending the isolated preview.
import fs from 'node:fs/promises';
await import('./build-audio-v2.mjs');
const dist='mission-dist';
for(const name of ['group-classroom.mjs','classroom-catalog.mjs','group-style.css'])await fs.copyFile('mission/'+name,dist+'/'+name);
let app=await fs.readFile(dist+'/app.mjs','utf8');
app=app.replace("const key=LESSON_ID+'-progress'","const key=LESSON_ID+'-group-progress'").replace('minutes:8,elapsed:0','minutes:40,elapsed:0').replace('[8,40].includes(p.minutes)','Number.isInteger(p.minutes)&&p.minutes>=5&&p.minutes<=180');
app+=`\nimport {installGroupClassroom} from './group-classroom.mjs';
const legacyRender=render;
const groupClassroom=installGroupClassroom({state:()=>state,current,steps,modelReady:()=>modelReady,render:()=>legacyRender(),speak,stopSpeech,stopMic,stopMicCheck,pause,finish,text,interpret,response,clearResult:()=>{result=null;}});
render=()=>{legacyRender();groupClassroom.render();};
groupClassroom.init();\n`;
await fs.writeFile(dist+'/app.mjs',app);
let html=await fs.readFile(dist+'/index.html','utf8');html=html.replace('</head>','<link rel="stylesheet" href="./group-style.css"></head>').replace('GEM · Grade 2 Global Mission Pilot','GEM · Global Mission Group Classroom').replace('운영자 진단창 수정 3차 · 초2 덧셈 · 기존 3D 선생님 · Anam/유료 AI 미사용','그룹 교실 시험판 · 20–30명 · 기존 3D 선생님 · 정식 서비스 미반영');await fs.writeFile(dist+'/index.html',html);
let sw=await fs.readFile(dist+'/sw.js','utf8');sw=sw.replace('gem-g2-shell-diagnostics-v3','gem-group-classroom-v1').replace("'./lesson.mjs'","'./lesson.mjs','./group-classroom.mjs','./classroom-catalog.mjs','./group-style.css'");await fs.writeFile(dist+'/sw.js',sw);
await import('./group-browser-tests.mjs');
