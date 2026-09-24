// Exercise native fullscreen through the final classroom's ordinary controls.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const root=path.resolve('mission-dist'),errors=[],checks=[];
const server=http.createServer(async(req,res)=>{
 try{const p=new URL(req.url,'http://localhost').pathname;const f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep))throw Error('path');const content=await fs.readFile(f);res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':/\.(mjs|js)$/.test(f)?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream'});res.end(content);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>window.GEM_DISPLAY?.exitFix==='fullscreen-exit-v1');
 await page.fill('#answer','Keep this draft');
 const snapshot=()=>page.evaluate(()=>({index:GEM_PILOT.index,elapsed:GEM_PILOT.elapsed,paused:GEM_PILOT.paused,reveal:GEM_PILOT.reveal,session:GEM_RELIABILITY.sessionId,dialogue:GEM_RELIABILITY.dialogueActive,phase:GEM_GROUP.phase,draft:document.getElementById('answer').value,lang:document.documentElement.lang}));
 const initial=await snapshot();let nativeTested=false;
 for(const [name,width,height]of [['portrait',390,844],['small-phone',360,640],['landscape',844,390],['short-landscape',740,320]]){
  await page.setViewportSize({width,height});await page.click('#fullscreen');
  await page.waitForFunction(()=>GEM_DISPLAY.active&&['native','page'].includes(GEM_DISPLAY.mode));
  nativeTested ||= await page.evaluate(()=>GEM_DISPLAY.mode==='native');
  await page.evaluate(()=>{document.getElementById('shell').scrollTop=9999;document.querySelector('.board').scrollTop=9999;});
  const rect=await page.locator('#fullscreen-exit').boundingBox();
  assert.ok(rect&&rect.width>=44&&rect.height>=44&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=height);
  await page.locator('#fullscreen-exit').tap();
  await page.waitForFunction(()=>!GEM_DISPLAY.active&&!document.fullscreenElement&&!document.webkitFullscreenElement);
  assert.ok(await page.locator('#fullscreen-exit').isHidden());
  assert.deepEqual(await snapshot(),initial);checks.push(name+': touch exit after scrolling, with draft and lesson state preserved');
 }
 await page.setViewportSize({width:390,height:844});await page.click('[data-lang=fr]');const french=await snapshot();
 await page.click('#fullscreen');await page.waitForFunction(()=>GEM_DISPLAY.active);
 assert.match(await page.locator('#fullscreen-exit').getAttribute('aria-label'),/Quitter/);
 await page.setViewportSize({width:844,height:390});await page.click('#fullscreen');
 await page.waitForFunction(()=>!GEM_DISPLAY.active);assert.deepEqual(await snapshot(),french);
 checks.push('French labels and the original full-screen toggle work after rotation');
 assert.deepEqual(errors,[]);
 const report={status:'PASS',version:'fullscreen-exit-v1',nativeFullscreenTested:nativeTested,checks,limitations:['Browser-emulated phone dimensions and touch, not a physical Samsung or iPhone test','No added API or microphone tests']};
 const file=root+'/test-report.json',all=JSON.parse(await fs.readFile(file,'utf8'));all.fullscreenExit=report;
 await fs.writeFile(file,JSON.stringify(all,null,2));await fs.writeFile(root+'/fullscreen-exit-report.json',JSON.stringify(report,null,2));console.log('FULLSCREEN EXIT PASS',JSON.stringify(report));
}finally{if(browser)await browser.close();server.closeAllConnections?.();await new Promise(r=>server.close(r));}
