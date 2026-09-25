import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import {workbookFixture} from './workbook-fixture.mjs';
import {WORKBOOK_VERSION,questionKeys} from './workbook-core.mjs';
const root=path.resolve('mission-dist'),errors=[],checks=[];let browser;
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep))throw Error('path');res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':/\.(mjs|js)$/.test(f)?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream'});res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{
 const chromium=(await import('@sparticuz/chromium')).default;
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--enable-unsafe-swiftshader'],headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};window.WB_SPOKEN=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>['en-US','fr-FR'].map(lang=>({lang,name:lang,voiceURI:lang,localService:true})),addEventListener(){},cancel(){},speak(u){WB_SPOKEN.push(u.text);u.onstart?.();setTimeout(()=>u.onend?.(),5);}}});window.SpeechRecognition=class{start(){window.WB_MIC=this;}stop(){this.onend?.();}abort(){}};});
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));let confirm=true;page.on('dialog',d=>confirm?d.accept():d.dismiss());
 let calls=[],seed=1,mode='success',pending=null,lastLesson=null,ordinaryCalls=0;
 await page.route('**/api/mission-workbook.js',async route=>{const body=route.request().postDataJSON();calls.push(body);if(mode==='slow'){pending=route;return;}if(mode==='fail')return route.fulfill({status:503,contentType:'application/json',body:'{"code":"network"}'});const lesson=mode==='duplicate'?lastLesson:workbookFixture(++seed*10);lastLesson=lesson;return route.fulfill({contentType:'application/json',body:JSON.stringify({workbook:WORKBOOK_VERSION,unitId:body.unitId,lesson})});});
 await page.route('**/api/mission-programme.js',route=>{ordinaryCalls++;const body=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify(body.action==='question'?{answer:'Let us talk about this example.'}:{unitId:body.unitId,lesson:workbookFixture(90)})});});
 const snapshot=()=>page.evaluate(()=>({session:GEM_PROGRAMME.sessionId,index:GEM_PROGRAMME.index,unit:GEM_PROGRAMME.unitId,revealed:GEM_PROGRAMME.revealed,elapsed:GEM_PROGRAMME.elapsed}));
 await page.goto(base+'/programme.html?lang=en&grade=4&subject=science');await page.waitForFunction(()=>window.GEM_PROGRAMME);
 assert.equal(await page.locator('#grade').inputValue(),'4');assert.equal(await page.locator('#subject').inputValue(),'science');assert.equal(await page.locator('#unit-list article').count(),5);assert.equal(await page.locator('#ai-workbook').count(),1);assert.equal(calls.length,0);
 for(const lang of ['fr','ne','ur','sw','en']){await page.click('[data-lang='+lang+']');assert.ok(await page.locator('#ai-workbook').isVisible());assert.equal(calls.length,0);}
 await page.click('#ai-workbook');await page.waitForFunction(()=>!GEM_PROGRAMME.busy&&!!GEM_PROGRAMME.sessionId);assert.equal(calls.length,1);assert.equal(calls[0].unitId,'science-g4-u1');assert.equal(await page.locator('#preview-steps article').count(),6);assert.equal(ordinaryCalls,0);
 const first=await snapshot();const firstKeys=questionKeys(lastLesson);
 await page.click('#approve');await page.waitForFunction(()=>GEM_PROGRAMME.modelReady,null,{polling:100,timeout:90000});await page.click('#next');assert.equal(await page.evaluate(()=>GEM_PROGRAMME.index),1);assert.ok(await page.locator('#feedback').isHidden());await page.locator('#options button').first().click();assert.ok(await page.evaluate(()=>GEM_PROGRAMME.revealed));assert.equal(await page.evaluate(()=>GEM_PROGRAMME.index),1);
 await page.click('#mic');await page.evaluate(()=>WB_MIC.onresult({results:[Object.assign([{transcript:'Please explain the lesson'}],{isFinal:true})]}));await page.waitForFunction(()=>!GEM_PROGRAMME.busy&&document.getElementById('transcript-messages').textContent.includes('Please explain the lesson'));
 assert.ok((await page.locator('#answer').inputValue()).includes('Please explain the lesson'));
 await page.click('#fullscreen');await page.waitForFunction(()=>GEM_DISPLAY.active);await page.click('#fullscreen-exit');await page.waitForFunction(()=>!GEM_DISPLAY.active);
 await page.click('#catalog-back');const saved=await snapshot();
 await page.reload();await page.waitForFunction(()=>window.GEM_PROGRAMME);assert.deepEqual(await snapshot(),saved);assert.equal(calls.length,1);
 for(const lang of ['fr','ne','ur','sw','en']){await page.click('[data-lang='+lang+']');assert.deepEqual(await snapshot(),saved);assert.equal(calls.length,1);}
 await page.click('#resume');await page.waitForFunction(()=>GEM_PROGRAMME.modelReady,null,{polling:100,timeout:90000});assert.equal(await page.evaluate(()=>GEM_PROGRAMME.sessionId),first.session);await page.click('#catalog-back');
 checks.push('Fifth workbook card uses the visible Grade 4 science selection. It opens the existing preview/classroom, audio receipt, transcript and fullscreen flow; reload/language/Continue make no new generation call.');
 confirm=false;await page.click('#ai-workbook');assert.equal(calls.length,1);confirm=true;
 mode='fail';const beforeFailure=await snapshot();await page.click('#ai-workbook');await page.waitForFunction(()=>!GEM_PROGRAMME.busy);assert.deepEqual(await snapshot(),beforeFailure);assert.ok(await page.locator('#preview').isVisible());
 mode='slow';await page.click('#ai-workbook');await page.waitForFunction(()=>GEM_PROGRAMME.busy);assert.ok(await page.locator('#ai-workbook').isDisabled());const during=calls.length;await page.evaluate(()=>document.getElementById('ai-workbook').click());assert.equal(calls.length,during);await page.click('#cancel-generation');assert.deepEqual(await snapshot(),beforeFailure);
 if(pending){await pending.fulfill({contentType:'application/json',body:JSON.stringify({workbook:WORKBOOK_VERSION,unitId:calls.at(-1).unitId,lesson:workbookFixture(99)})}).catch(()=>{});pending=null;}await page.waitForTimeout(150);assert.deepEqual(await snapshot(),beforeFailure);
 checks.push('Confirmation cancel, server failure, slow-request cancellation and late response preserve the prior pack/progress; double-click cannot issue a second generation.');
 mode='success';
 for(let n=2;n<=5;n++){const oldId=(await snapshot()).session;await page.click('#ai-workbook');await page.waitForFunction(old=>!GEM_PROGRAMME.busy&&GEM_PROGRAMME.sessionId!==old,oldId);assert.equal(calls.at(-1).unitId,'science-g4-u'+((n-1)%4+1));}
 assert.deepEqual(calls.at(-1).recentQuestions,firstKeys);
 checks.push('Successful clicks rotate the four units within the selected grade/subject. Returning to a unit submits its recent question fingerprints, without reusing the normal unit cache.');
 await page.selectOption('#grade','6');assert.equal(await page.locator('#subject option[value="world-history"]').count(),0);await page.selectOption('#grade','7');await page.selectOption('#subject','world-history');await page.click('#ai-workbook');await page.waitForFunction(()=>!GEM_PROGRAMME.busy);assert.equal(calls.at(-1).unitId,'world-history-g7-u1');
 for(const lang of ['en','fr','ne','ur','sw']){await page.click('[data-lang='+lang+']');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await fs.mkdir(root+'/checks',{recursive:true});await page.screenshot({path:root+'/checks/workbook-'+lang+'.png',fullPage:true});}
 checks.push('World history stays unavailable below Grade 7; the card follows changed subject/grade and renders in five languages without horizontal overflow.');
 assert.deepEqual(errors,[]);const report={status:'PASS',version:WORKBOOK_VERSION,checks,generationRequests:calls.length,limitations:['Speech/recognition and content provider simulated in browser tests; the existing 3D model was loaded','Each workbook uses the current six-stage format: three questions, explanation, activity and recap','Recent exact-content checks cannot certify every semantic paraphrase; teacher review remains required']};await fs.writeFile(root+'/workbook-report.json',JSON.stringify(report,null,2));console.log('WORKBOOK BROWSER PASS',JSON.stringify(report));
}finally{if(browser)await browser.close();server.closeAllConnections?.();await new Promise(r=>server.close(r));}
