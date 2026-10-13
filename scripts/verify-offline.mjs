import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {offlineTestEnvironment} from './build-spend-guard.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const tests=readdirSync(new URL('../tests/',import.meta.url))
  .filter(name=>!name.startsWith('.')&&name.endsWith('.test.mjs'))
  .sort().map(name=>'tests/'+name);
if(!tests.length)throw Error('No offline tests were found.');
console.info('Offline regression tests only; provider credentials removed. This is not release approval.');
const result=spawnSync(process.execPath,['--test',...tests],{
  cwd:root,stdio:'inherit',env:offlineTestEnvironment(process.env)
});
if(result.error)throw result.error;
process.exit(Number.isInteger(result.status)?result.status:1);
