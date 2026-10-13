// Explicit 2026-10-14 release of Korean captions and teacher identity only.
// General paid release verification remains separately guarded in build.mjs.
import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {offlineTestEnvironment} from './build-spend-guard.mjs';
import {LANGUAGES,LESSON} from '../whiteboard/lesson.js';
import {sceneAudioFilename} from '../lib/whiteboard-handler.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/'+n);
if(!tests.length)throw Error('No regression tests found.');
const result=spawnSync(process.execPath,['--import','./scripts/no-network-tests.mjs','--test',...tests],{cwd:root,stdio:'inherit',env:offlineTestEnvironment(process.env)});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
// Preserve the existing sample-class narration. Never generate new paid audio.
const target=new URL('../generated-whiteboard/',import.meta.url);
mkdirSync(target,{recursive:true});
let count=0;
for(const language of LANGUAGES){
 for(let scene=0;scene<LESSON[language].scenes.length;scene++){
  const filename=sceneAudioFilename(language,scene);
  const cached=new URL('../.vercel/cache/whiteboard-audio/'+filename,import.meta.url);
  const bytes=readFileSync(cached);
  if(bytes.length<1000||bytes.length>4000000)throw Error('Invalid existing narration: '+filename);
  copyFileSync(cached,new URL(filename,target));count++;
 }
}
console.log(`Scoped UI release verified; ${count} existing narration files reused; no paid AI calls.`);
