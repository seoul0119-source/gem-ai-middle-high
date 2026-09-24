import {execFileSync} from 'node:child_process';
for(const f of ['auto-make-ten.mjs','patch-make-ten.mjs','make-ten-browser-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+f],{stdio:'inherit'});
execFileSync(process.execPath,['mission/make-ten-tests.mjs'],{stdio:'inherit'});
await import('./build-count-on.mjs');
await import('./patch-make-ten.mjs');
for(const f of ['app.mjs','reliable-lessons.mjs','interaction-support.mjs'])execFileSync(process.execPath,['--check','mission-dist/'+f],{stdio:'inherit'});
await import('./make-ten-browser-tests.mjs');
for(const f of ['dialogue-browser-tests.mjs','fullscreen-exit-tests.mjs'])execFileSync(process.execPath,['mission/'+f],{stdio:'inherit'});
