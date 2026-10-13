// Authorized 2026-10-14 UI releases: captions, teacher identity, and classroom entrance routing.
// General paid release verification remains separately guarded in build.mjs.
import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {offlineTestEnvironment} from './build-spend-guard.mjs';
import {LANGUAGES,LESSON} from '../whiteboard/lesson.js';
import {sceneAudioFilename} from '../lib/whiteboard-handler.js';
const root=fileURLToPath(new URL('../',import.meta.url));
// These 18 clips were copied from the existing approved production output.
// Verify the saved bytes before running checks; no generation or cache fallback.
const manifest=JSON.parse(readFileSync(new URL('./whiteboard-audio-manifest.json',import.meta.url),'utf8'));
const expected=LANGUAGES.flatMap(language=>LESSON[language].scenes.map((_,scene)=>sceneAudioFilename(language,scene)));
if(manifest.clips.length!==expected.length)throw Error('Unexpected narration manifest.');
for(const filename of expected){
 const entry=manifest.clips.find(clip=>clip.filename===filename);
 const bytes=readFileSync(new URL('../generated-whiteboard/'+filename,import.meta.url));
 if(!entry||bytes.length!==entry.bytes||bytes.length<1000||bytes.length>4000000||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Invalid existing narration: '+filename);
}
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/'+n);
if(!tests.length)throw Error('No regression tests found.');
const result=spawnSync(process.execPath,['--import','./scripts/no-network-tests.mjs','--test',...tests],{cwd:root,stdio:'inherit',env:offlineTestEnvironment(process.env)});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
console.log(`Scoped UI release verified; ${expected.length} existing narration files reused; no paid AI calls.`);
