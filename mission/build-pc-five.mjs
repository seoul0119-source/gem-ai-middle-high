// Separate PC entry after the complete verified classroom build. Existing output is not patched.
import fs from 'node:fs/promises';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
for(const f of ['pc/app.mjs','pc/board.mjs','pc/catalog.mjs','pc/i18n.mjs','pc-browser-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+f],{stdio:'inherit'});
execFileSync(process.execPath,['--check','api/mission-pc-chat.js'],{stdio:'inherit'});
execFileSync(process.execPath,['mission/pc/tests.mjs'],{stdio:'inherit'});
await import('./build-all-questions.mjs');
const hashes={};const hash=async f=>crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex');for(const f of ['index.html','app.mjs','sw.js','reliable-lessons.mjs','interaction-support.mjs','display-v3.mjs'])hashes[f]=await hash('mission-dist/'+f);
await fs.mkdir('mission-dist/pc',{recursive:true});for(const f of ['app.mjs','board.mjs','catalog.mjs','i18n.mjs','style.css'])await fs.copyFile('mission/pc/'+f,'mission-dist/pc/'+f);
// Align language-pack method selection with the exact reused visual role.
let pack=await fs.readFile('mission-dist/pc/i18n.mjs','utf8');const old="const method=s.missing?'missing':s.id==='swap'?'swap':a<10&&a+b>10?'ten':b<=4||a===10?'count':'join';";assert.equal(pack.split(old).length,2);pack=pack.replace(old,"const method=s.missing?'missing':s.id==='join'?'join':s.id==='count-on'?'count':s.id==='swap'?'swap':a<10&&a+b>10?'ten':b<=4||a===10?'count':'join';");await fs.writeFile('mission-dist/pc/i18n.mjs',pack);
// A word such as 'multiplication' or 'today' is not a complete intent.
// Keep exact number/replay/greeting handlers local, but send nuanced questions with context.
let app=await fs.readFile('mission-dist/pc/app.mjs','utf8');const lines=app.split('\n');const broad=lines.filter(line=>line.startsWith(' else if(/multiplication|')||line.startsWith(' else if(/today|'));assert.equal(broad.length,2);app=lines.filter(line=>!broad.includes(line)).join('\n');assert.equal(app.split('stopAll();state.lang').length,2);app=app.replace('stopAll();state.lang',"stopAll();status('ready');state.lang");await fs.writeFile('mission-dist/pc/app.mjs',app);
for(const f of ['app.mjs','i18n.mjs'])execFileSync(process.execPath,['--check','mission-dist/pc/'+f],{stdio:'inherit'});
await fs.copyFile('mission/pc/index.html','mission-dist/pc.html');
for(const[f,h]of Object.entries(hashes))assert.equal(await hash('mission-dist/'+f),h,'Existing runtime unexpectedly altered');
await import('./pc-browser-tests.mjs');
await fs.writeFile('mission-dist/pc-original-preserved.json',JSON.stringify({status:'PASS',base:'11203e490d6ce24f6c76875dcff4aa3568c709b3',unchangedOutputHashes:hashes},null,2));
