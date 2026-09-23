// Temporary operator-only failure report. Failed checks never expose a usable classroom.
import fs from 'node:fs/promises';
try{await import('./build-audio-v2.mjs');}
catch(error){let completed=null;try{completed=JSON.parse(await fs.readFile('mission-dist/test-report.json','utf8'));}catch{}
const report={status:'FAIL',lessonEnabled:false,message:String(error?.message||error),stack:String(error?.stack||'').slice(0,16000),completed};
await fs.mkdir('mission-dist',{recursive:true});await fs.writeFile('mission-dist/test-report.json',JSON.stringify(report,null,2));
await fs.writeFile('mission-dist/index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>GEM test gate</title><h1>진단창 점검 중</h1><p>자동 검사 실패로 시험 수업을 차단했습니다. 기존 운영 교실은 변경되지 않았습니다.</p></html>');
await fs.rm('mission-dist/app.mjs',{force:true});console.error('DIAGNOSTICS GATE FAIL:',report.message);
}
