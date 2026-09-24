// End-to-end traversal: real application and VRM, simulated device speech/recognition only.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
import {makeSession} from '../mission-dist/reliable-lessons.mjs';
let seed=625;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const prepared=makeSession([],rng);prepared.progress={index:1,started:false,ended:false,reveal:false};
const root=path.resolve('mission-dist'),checks=[],deliveries=[],errors=[],external=[];let browser;
const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p==='/')p='/index.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep))throw Error('path');const bytes=await fs.readFile(f);res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':/\.(mjs|js)$/.test(f)?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
try{
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--enable-unsafe-swiftshader'],headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:900},hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(session=>{
  if(!localStorage.getItem('gem-g2-reliable-session-v1')){localStorage.setItem('gem-g2-reliable-session-v1',JSON.stringify(session));localStorage.setItem('gem-g2-recent-starts-v1',JSON.stringify([session.first]));}
  window.ALL_TEST={spoken:[],timer:0};window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'EN local test',lang:'en-US',voiceURI:'en',localService:true},{name:'FR local test',lang:'fr-FR',voiceURI:'fr',localService:true}],addEventListener(){},resume(){},paused:false,cancel(){clearTimeout(ALL_TEST.timer);},speak(u){ALL_TEST.spoken.push(u.text);u.onstart?.();ALL_TEST.timer=setTimeout(()=>u.onend?.(),/^Watch|^Regardez/.test(u.text)?450:80);}}});
  window.SpeechRecognition=class{start(){window.ALL_REC=this;this.onstart?.();}abort(){}stop(){this.onend?.();}};
 },prepared);
 const page=await context.newPage();page.setDefaultTimeout(25000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>{errors.push(e.message);console.error('ALL QUESTION PAGE',e.message);});
 page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 const wait=async(fn,arg=null,timeout=30000)=>{try{return await page.waitForFunction(fn,arg,{polling:100,timeout});}catch(e){console.error('ALL QUESTION WAIT',await page.evaluate(()=>({index:window.GEM_PILOT?.index,phase:window.GEM_GROUP?.phase,reliability:window.GEM_RELIABILITY,remaining:window.GEM_AUTO_REMAINING,field:document.getElementById('answer')?.value,caption:document.getElementById('caption')?.textContent})));throw e;}};
 const quiet=()=>wait(()=>!GEM_PILOT.speaking&&!GEM_PILOT.speechPending);
 const snapshot=()=>page.evaluate(()=>({session:GEM_RELIABILITY.sessionId,index:GEM_PILOT.index,phase:GEM_GROUP.phase,step:GEM_RELIABILITY.step}));
 const expectedSelector=id=>id==='join'?'#auto-join-visual':id==='count-on'?'#auto-count-on-visual':id==='bridge-ten'?'#auto-make-ten-visual':'#auto-remaining-visual';
 await page.goto(url);await wait(()=>window.GEM_AUTO_REMAINING);await page.click('#play');await wait(()=>GEM_PILOT.modelReady,null,90000);await page.click('#play');assert.ok(await page.evaluate(()=>GEM_PILOT.paused));
 const original=await snapshot();
 for(let number=1;number<=10;number++){
  const current=await snapshot(),s=current.step,target=s.missing?10-s.a:s.a+s.b,selector=expectedSelector(s.id);
  assert.equal(current.index,number);assert.equal(current.session,original.session);
  assert.ok(await page.locator(selector).isVisible(),'No automatic material for '+number+' '+s.id);
  const visible=await page.locator('#auto-join-visual,#auto-count-on-visual,#auto-make-ten-visual,#auto-remaining-visual').evaluateAll(nodes=>nodes.filter(e=>!e.hidden&&e.getClientRects().length).map(e=>e.id));assert.equal(visible.length,1,'Stale or missing material at '+number);
  assert.equal(await page.locator(selector+' button').count(),0);assert.equal(await page.evaluate(()=>GEM_PILOT.reveal),false);
  assert.ok((await page.locator(selector+' [data-formula]').textContent()).includes('?'),'Answer leaked at '+number);
  for(const lang of ['en','fr']){
   const beforeLanguage=await snapshot();await page.click('[data-lang='+lang+']');assert.deepEqual(await snapshot(),beforeLanguage);
   const count=await page.evaluate(()=>GEM_RELIABILITY.accepted);
   await page.fill('#answer',String(target===20?19:target+1));await page.click('#answer-form button[type=submit]');await wait(n=>GEM_RELIABILITY.accepted===n+1,count);await quiet();
   assert.equal(await page.evaluate(()=>GEM_RELIABILITY.lastOutcome),'incorrect');assert.ok(await page.evaluate(()=>GEM_RELIABILITY.reviewRequired));assert.equal(await page.evaluate(()=>GEM_PILOT.index),number);
   assert.ok((await page.locator('#feedback').textContent()).includes(String(target)));assert.ok(!(await page.locator(selector+' [data-formula]').textContent()).includes('?'));
   // Final microphone results travel through the same existing handler, not a state setter.
   await page.click('#mic');if(await page.locator('#mic-consent').isVisible())await page.click('#mic-agree');await wait(()=>window.ALL_REC);
   await page.evaluate(n=>{const result=[{transcript:String(n)}];result.isFinal=true;ALL_REC.onresult({results:[result]});ALL_REC.onend?.();},target);
   await wait(()=>GEM_RELIABILITY.lastSource==='voice'&&GEM_RELIABILITY.lastOutcome==='correct');await quiet();
   assert.equal(await page.evaluate(()=>GEM_PILOT.index),number);assert.equal(await page.evaluate(()=>GEM_RELIABILITY.reviewRequired),false);
   assert.match(await page.locator('#answer-receipt').textContent(),lang==='fr'?/Reçu/:/Received/);
   deliveries.push({problem:number,role:s.id,language:lang,typedCorrection:'PASS',finalVoice:'PASS'});
  }
  // Resume automatically plays the solution without a separate media button.
  await page.click('#play');await wait(()=>!GEM_PILOT.paused);await wait(()=>[window.GEM_AUTO_MEDIA,window.GEM_AUTO_COUNT_ON,window.GEM_AUTO_MAKE_TEN,window.GEM_AUTO_REMAINING].some(m=>m?.active&&m.progress===1),null,25000);await quiet();await page.click('#play');assert.ok(await page.evaluate(()=>GEM_PILOT.paused));
  await page.screenshot({path:root+'/checks/all-problem-'+String(number).padStart(2,'0')+'.png',fullPage:true});
  if(number===5){
   const before=await snapshot(),p=await page.evaluate(()=>GEM_AUTO_REMAINING.active?GEM_AUTO_REMAINING.progress:null);
   await page.reload();await wait(()=>window.GEM_AUTO_REMAINING);assert.deepEqual(await snapshot(),before);assert.ok(await page.evaluate(()=>GEM_PILOT.paused));assert.equal(await page.evaluate(()=>GEM_AUTO_REMAINING.active?GEM_AUTO_REMAINING.progress:null),p);
   await page.click('#load-avatar');await wait(()=>GEM_PILOT.modelReady,null,90000);
  }
  if(number<10){let attempts=0;while(await page.evaluate(()=>GEM_PILOT.index)===number&&attempts++<8){await quiet();await page.click('#group-advance');await page.waitForTimeout(200);}assert.equal(await page.evaluate(()=>GEM_PILOT.index),number+1);}
 }
 checks.push('Actual existing Next controls traverse all ten questions; each selects exactly one correct material, with no extra media controls and no initial answer exposure.');
 checks.push('All ten questions in both languages: 20 typed incorrect responses and 20 final microphone correct results receive exact feedback. No question is skipped by a response. Speech recognition is simulated.');
 checks.push('Every question automatically presents its solution after resuming, and saves the same session. Problem five reload preserves phase, numbers, material and paused state.');
 for(const[name,w,h]of [['pc',1366,900],['phone',390,844],['landscape',844,390]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.evaluate(()=>GEM_DISPLAY.visibleToggleCount),1);await page.screenshot({path:root+'/checks/all-'+name+'.png',fullPage:true});}
 await page.setViewportSize({width:390,height:844});const beforeFull=await snapshot();await page.click('#fullscreen');await wait(()=>GEM_DISPLAY.active);await page.waitForTimeout(300);const close=page.locator('#fullscreen-close');
 const exit=await close.count()?close:page.locator('button').filter({hasText:/^✕$|^×$|^X$/}).first();
 if(await exit.count())await exit.click();else await page.click('#fullscreen');await wait(()=>!GEM_DISPLAY.active);assert.deepEqual(await snapshot(),beforeFull);
 checks.push('Final question fits PC/phone/landscape; one playback toggle remains and fullscreen closes without changing the lesson.');
 const old=await page.evaluate(()=>({id:GEM_RELIABILITY.sessionId,first:GEM_RELIABILITY.first}));await page.click('#group-new-lesson');const fresh=await page.evaluate(()=>({id:GEM_RELIABILITY.sessionId,first:GEM_RELIABILITY.first}));assert.notEqual(fresh.id,old.id);assert.notEqual(fresh.first,old.first);assert.equal(await page.evaluate(()=>GEM_PILOT.index),1);assert.equal(await page.evaluate(()=>GEM_PILOT.reveal),false);assert.equal(await page.evaluate(()=>GEM_RELIABILITY.aiRequests),0);
 checks.push('Only New lesson creates a new set; the first question changes and old solutions are hidden. No additional AI or remote media requests are introduced.');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const coverage=JSON.parse(await fs.readFile(root+'/all-questions-coverage.json','utf8'));
 const report={status:'PASS',version:'all-questions-v1',checks,deliveries,coverage,limitations:['Actual VRM rendered, device speech/recognition simulated','40-minute real classroom and physical phone microphone performance not measured','Saved progress remains same-browser/same-origin, not cross-device']};
 await fs.writeFile(root+'/all-questions-report.json',JSON.stringify(report,null,2));const all=JSON.parse(await fs.readFile(root+'/test-report.json','utf8'));all.allQuestions=report;await fs.writeFile(root+'/test-report.json',JSON.stringify(all,null,2));console.log('ALL QUESTIONS BROWSER PASS',JSON.stringify(report));
}finally{if(browser)await browser.close();server.closeAllConnections?.();await new Promise(r=>server.close(r));}
