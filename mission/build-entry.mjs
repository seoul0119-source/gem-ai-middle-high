// Operator diagnostic gate. On failure, never serve a classroom as if it passed.
import fs from 'node:fs/promises';
try { await import('./build.mjs'); }
catch(error) {
 const report={status:'FAIL',buildTime:new Date().toISOString(),message:String(error?.message||error),stack:String(error?.stack||'').slice(0,12000),lessonEnabled:false};
 await fs.mkdir('mission-dist',{recursive:true});
 await fs.writeFile('mission-dist/test-report.json',JSON.stringify(report,null,2));
 await fs.writeFile('mission-dist/index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>GEM operator diagnostics</title><body style="font-family:sans-serif;padding:35px;line-height:1.8"><h1>시험 교실 점검 중</h1><p>자동 검사에서 문제가 발견되어 수업 시작을 차단했습니다. 기존 공개 교실에는 영향을 주지 않습니다.</p><p>Operator diagnostics: <a href="./test-report.json">test report</a></p></body></html>');
 // Remove entry scripts to prevent bypassing the failed-check gate.
 await fs.rm('mission-dist/app.mjs',{force:true});
 console.error('PREVIEW DIAGNOSTIC GATE: lesson disabled',report.message);
}
