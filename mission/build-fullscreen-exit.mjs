// Display-only fix built from the saved dialogue version. Never deploy production here.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for(const f of ['display-v3.mjs','fullscreen-exit-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+f],{stdio:'inherit'});
// Retain the complete arithmetic, input, avatar, media, fullscreen and dialogue tests.
await import('./build-dialogue.mjs');
const out='mission-dist';
let sw=await fs.readFile(out+'/sw.js','utf8');
if(sw.split('gem-group-dialogue-v2').length!==2)throw Error('Expected saved dialogue cache version');
sw=sw.replace('gem-group-dialogue-v2','gem-group-fullscreen-exit-v1');
await fs.writeFile(out+'/sw.js',sw);
let html=await fs.readFile(out+'/index.html','utf8');
const banner='초2 자동 자료 001 · 두 그룹 합하기 · 영어/프랑스어 공용 · 새 수업/이어하기 구분';
if(!html.includes(banner))throw Error('Expected saved classroom banner');
html=html.replace(banner,'초2 전체 화면 나가기 수정 · 수업·대화 기능 유지');
await fs.writeFile(out+'/index.html',html);
await import('./fullscreen-exit-tests.mjs');
