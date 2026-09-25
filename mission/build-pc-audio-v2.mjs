// Add the small PC-only repair after the intact sample and PC regression gates.
import fs from 'node:fs/promises';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {patchPCAudio,applyAudioPatch} from './patch-pc-audio-v2.mjs';
for(const f of ['pc/audio-tools.mjs','patch-pc-audio-v2.mjs','pc-audio-browser-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+f],{stdio:'inherit'});
execFileSync(process.execPath,['mission/pc-audio-unit-tests.mjs'],{stdio:'inherit'});
// Fail fast before costly baseline WebGL tests if a maintained anchor changes.
const preflight=patchPCAudio(await fs.readFile('mission/pc/app.mjs','utf8'));execFileSync(process.execPath,['--input-type=module','--check'],{input:preflight,stdio:['pipe','inherit','inherit']});
await import('./build-pc-five.mjs');
const old={};const hash=async file=>crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
for(const f of ['index.html','app.mjs','sw.js','avatar.bundle.js','reliable-lessons.mjs','interaction-support.mjs','display-v3.mjs'])old[f]=await hash('mission-dist/'+f);
await applyAudioPatch();execFileSync(process.execPath,['--check','mission-dist/pc/app.mjs'],{stdio:'inherit'});
for(const[f,h]of Object.entries(old))assert.equal(await hash('mission-dist/'+f),h,'Original sample changed: '+f);
await import('./pc-audio-browser-tests.mjs');
await fs.writeFile('mission-dist/pc-audio-v2-preserved.json',JSON.stringify({status:'PASS',base:'d1ad581990329ffde0b01c6712123fe29ecbec6b',sampleUnchanged:old},null,2));
