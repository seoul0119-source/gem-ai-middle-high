// Keep the deployment command short without dropping or reordering its gates.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requirePaidVerificationApproval} from './build-spend-guard.mjs';

// Default builds stop before any test, model request or generated audio.
requirePaidVerificationApproval(process.argv.slice(2));

const root=fileURLToPath(new URL('../',import.meta.url));
const tests=readdirSync(new URL('../tests/',import.meta.url))
 .filter(name=>!name.startsWith('.')&&name.endsWith('.test.mjs'))
 .sort().map(name=>'tests/'+name);
if(!tests.length)throw Error('No deployment tests were found.');
// Fresh deployment fixtures need a more precise writer/reviewer: the lighter
// runtime model repeatedly exhausted repairs on inconsistent keys or reading
// scope. Keep every gate, and strengthen these checks without changing runtime
// classroom models or any existing student's worksheet.
const verificationEnv={...process.env,OPENAI_REVIEW_MODEL:process.env.OPENAI_BUILD_REVIEW_MODEL||'gpt-5.6-sol',GEM_VERIFICATION_WRITER_MODEL:process.env.OPENAI_REVIEW_MODEL||process.env.OPENAI_MODEL||'gpt-5.6-luna'};
console.info('GEM deployment verification reviewer',verificationEnv.OPENAI_REVIEW_MODEL);
const stages=[
 ['--test',...tests],
 ['scripts/verify-board-question-routing.mjs'],
 ['scripts/verify-board-subject-stages.mjs','--stage=all','--concurrency=2'],
 ['scripts/verify-board-chemistry-mixed.mjs'],
 ['scripts/verify-science-board.mjs'],
 ['scripts/verify-board-chemistry.mjs'],
 ['scripts/verify-materials.mjs'],
 ['scripts/verify-suneung-2028.mjs','--course=suneung-2028-english'],
 ['scripts/verify-ged.mjs'],
 ['scripts/prepare-whiteboard-audio.mjs']
];
for(const args of stages){
 console.info('GEM build stage',args[0]);
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:verificationEnv});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(Number.isInteger(result.status)?result.status:1);
}
