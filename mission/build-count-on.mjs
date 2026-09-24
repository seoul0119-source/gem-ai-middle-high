import {execFileSync} from 'node:child_process';
for(const f of ['auto-count-on.mjs','patch-count-on.mjs','count-on-browser-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+f],{stdio:'inherit'});
execFileSync(process.execPath,['mission/count-on-tests.mjs'],{stdio:'inherit'});
// Never replace or bypass the final verified fullscreen-exit build.
await import('./build-fullscreen-exit.mjs');
await import('./patch-count-on.mjs');
for(const f of ['app.mjs','reliable-lessons.mjs','interaction-support.mjs'])execFileSync(process.execPath,['--check','mission-dist/'+f],{stdio:'inherit'});
await import('./count-on-browser-tests.mjs');
// Recheck these high-risk integrations against the final, extended classroom.
for(const f of ['dialogue-browser-tests.mjs','fullscreen-exit-tests.mjs'])execFileSync(process.execPath,['mission/'+f],{stdio:'inherit'});
