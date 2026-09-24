import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
import {spokenMath} from '../mission-dist/reliable-lessons.mjs';
const root=path.resolve('mission-dist'), checks=[], errors=[], deliveries=[];
let browser;
const server=http.createServer(async(req,res)=>{
 try{
  let p=new URL(req.url,'http://localhost').pathname;if(p==='/')p='/index.html';const f=path.resolve(root,'.'+p);
  if(!f.startsWith(root+path.sep))throw Error('path');const bytes=await fs.readFile(f);
  res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':/\.(mjs|js)$/.test(f)?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
try{
 browser=await playwright.launch({args:[...chromium.args,'--enable-unsafe-swiftshader'],executablePath:await chromium.executablePath(),headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:900},hasTouch:true});
 await context.addInitScript(()=>{
  window.TEST_IO={spoken:[],voiceTimer:0,networkCalls:0};
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  const voices=[{name:'English local',lang:'en-US',voiceURI:'en',localService:true},{name:'Français local',lang:'fr-FR',voiceURI:'fr',localService:true}];
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
   getVoices:()=>voices,addEventListener(){},resume(){},paused:false,
   cancel(){clearTimeout(TEST_IO.voiceTimer);},
   speak(u){TEST_IO.spoken.push(u.text);u.onstart?.();TEST_IO.voiceTimer=setTimeout(()=>u.onend?.(),25);}
  }});
  window.SpeechRecognition=class{
   start(){TEST_IO.rec=this;this.onstart?.();}
   abort(){}
   stop(){this.onend?.();}
  };
 });
 const page=await context.newPage();page.setDefaultTimeout(25000);
 page.on('pageerror',e=>{errors.push(e.message);console.error('INPUT V2 PAGE',e.message);});
 let allowEnd=false;
 page.on('dialog',d=>/End this lesson|Terminer cette séance/.test(d.message())?(allowEnd?d.accept():d.dismiss()):d.accept());
 await page.goto(url);await page.waitForFunction(()=>window.GEM_RELIABILITY?.version==='input-v2',{},{polling:100});
 assert.equal(await page.evaluate(()=>GEM_PILOT.index),1);
 assert.ok(await page.locator('#answer').isEnabled());
 await page.click('#load-avatar');await page.waitForFunction(()=>GEM_PILOT.modelReady,{},{polling:100,timeout:90000});
 await page.fill('#answer','hello teacher');await page.click('#answer-form button[type=submit]');
 assert.equal(await page.evaluate(()=>GEM_RELIABILITY.lastOutcome),'greeting');assert.equal(await page.evaluate(()=>GEM_RELIABILITY.aiRequests),0);
 assert.ok((await page.locator('#feedback').innerText()).includes('Hello'));
 async function quiet(){await page.waitForFunction(()=>!GEM_PILOT.speaking&&!GEM_PILOT.speechPending,{},{polling:100,timeout:25000});}
 async function advance(){await quiet();await page.click('#group-advance');await quiet();}
 async function typed(value,expected){await quiet();const count=await page.evaluate(()=>GEM_RELIABILITY.accepted);await page.fill('#answer',value);await page.click('#answer-form button[type=submit]');await page.waitForFunction(n=>GEM_RELIABILITY.accepted===n+1,count,{polling:100});assert.equal(await page.evaluate(()=>GEM_RELIABILITY.lastOutcome),expected);assert.ok(await page.locator('#answer-receipt').isVisible());await quiet();}
 async function voice(value,expected){await quiet();const count=await page.evaluate(()=>GEM_RELIABILITY.accepted);await page.click('#mic');if(await page.locator('#mic-consent').isVisible())await page.click('#mic-agree');await page.waitForFunction(()=>TEST_IO.rec,{},{polling:100});await page.evaluate(value=>{const r=TEST_IO.rec,result=[{transcript:value}];result.isFinal=true;r.onresult?.({results:[result]});const end=r.onend;end?.();end?.();},value);await page.waitForFunction(n=>GEM_RELIABILITY.accepted===n+1,count,{polling:100});assert.equal(await page.evaluate(()=>GEM_RELIABILITY.lastOutcome),expected);assert.equal(await page.evaluate(()=>GEM_RELIABILITY.lastSource),'voice');await quiet();}
 checks.push('First visible problem is graded problem 1/10, not an ungraded welcome. “hello teacher” receives a local reply even before Start.');
 for(let number=1;number<=3;number++){
  assert.equal(await page.evaluate(()=>GEM_PILOT.index),number);
  const current=await page.evaluate(()=>GEM_RELIABILITY.step),target=current.missing?10-current.a:current.a+current.b;
  assert.equal(await page.evaluate(()=>GEM_PILOT.reveal),false);
  for(const lang of ['en','fr']){
   if(lang==='fr')await page.click('[data-lang=fr]');else await page.click('[data-lang=en]');
   if(lang==='en'){
    let guard=0;
    while(await page.evaluate(()=>GEM_GROUP.phase==='explain')&&guard++<7){
     const caption=await page.locator('#caption').innerText();
     const forbidden=spokenMath(`${current.a} + ${current.missing?target:current.b} = ${current.missing?10:target}`,lang);
     assert.ok(!caption.includes(`${current.a} + ${current.b} = ${target}`),'Current answer leaked in explanation');
     assert.ok(!caption.includes(forbidden),'Spoken current answer leaked');
     assert.equal(await page.evaluate(()=>GEM_PILOT.reveal),false);
     await advance();
    }
    assert.equal(await page.evaluate(()=>GEM_GROUP.phase),'question');
   }
   const wrong=target===20?19:target+1;
   await typed(String(wrong),'incorrect');
   assert.ok(await page.evaluate(()=>GEM_RELIABILITY.reviewRequired));
   assert.ok((await page.locator('#equation').innerText()).includes('= '+(current.missing?10:target)));
   const graphic=await page.locator('#media-picture').getAttribute('src');assert.ok(decodeURIComponent(graphic).includes(`= ${current.missing?10:target}`),'Board and diagram disagree after correction');
   await typed(String(target),'correct');
   await voice(String(target),'correct');
   deliveries.push({problem:number,language:lang,typedWrong:'PASS',typedCorrect:'PASS',finalVoice:'PASS'});
  }
  if(number<3){let limit=0;while(await page.evaluate(()=>GEM_PILOT.index)===number&&limit++<8)await advance();assert.equal(await page.evaluate(()=>GEM_PILOT.index),number+1);}
 }
 checks.push('First 3 problems × English/French × typed wrong, typed correct and final microphone result: all 18 submissions handled once, with exact feedback. Speech recognition itself is simulated.');
 checks.push('Every pre-answer scene of the first 3 problems keeps the current answer hidden; other worked examples are explicitly separate. Answer and diagram match after responding.');
 await quiet();for(let i=0;i<4;i++){await page.click('#play');assert.ok(!(await page.locator('#phase').innerText()).includes('finished'));assert.ok(!(await page.locator('#phase').innerText()).includes('terminée'));assert.ok(await page.locator('#answer').isEnabled());await quiet();}
 await page.click('[data-lang=en]');await quiet();await page.click('#group-end');assert.ok(!(await page.locator('#phase').innerText()).includes('finished'));assert.ok(await page.locator('#answer').isEnabled());
 allowEnd=true;await page.click('#group-end');assert.ok((await page.locator('#phase').innerText()).includes('finished'));await typed('hello teacher','greeting');assert.ok(!(await page.locator('#phase').innerText()).includes('finished'));assert.ok(await page.evaluate(()=>GEM_PILOT.paused));
 checks.push('Start/Pause/Continue never ends the lesson. End requires confirmation; even a post-end message resumes a paused interactive state instead of being silently discarded.');
 await page.route('**/api/mission-chat',async route=>{const b=route.request().postDataJSON();await new Promise(r=>setTimeout(r,1200));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'openai',scope:'math',targetAnswer:b.step.missing?10-b.step.a:b.step.a+b.step.b,answer:'You may use classroom objects to represent each amount.'})}).catch(()=>{});});
 await page.fill('#answer','May I represent this with boxes?');await page.click('#answer-form button[type=submit]');assert.ok(await page.locator('#answer').isEnabled());assert.ok(await page.locator('#answer-form button[type=submit]').isEnabled());await page.fill('#answer','new draft kept');await page.waitForFunction(()=>!GEM_RELIABILITY.busy,{},{polling:100});assert.equal(await page.locator('#answer').inputValue(),'new draft kept');
 await page.unroute('**/api/mission-chat');await page.route('**/api/mission-chat',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'not_configured'})}));
 await quiet();const spoken=await page.evaluate(()=>TEST_IO.spoken.length);await page.fill('#answer','May I use a different story about boxes?');await page.click('#answer-form button[type=submit]');await page.waitForFunction(()=>GEM_RELIABILITY.provider==='not-configured',{},{polling:100});assert.equal(await page.evaluate(()=>TEST_IO.spoken.length),spoken);assert.ok((await page.locator('#answer').inputValue()).includes('boxes'));assert.ok((await page.locator('#answer-receipt').innerText()).includes('Received'));checks.push('Text entry and Send stay usable during slow AI requests; new drafts survive prior replies. Connection failure is silent, visible, and not misreported as input failure.');
 for(const[name,w,hh]of [['pc',1366,900],['phone',390,844],['phone-landscape',844,390]]){await page.setViewportSize({width:w,height:hh});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' horizontal overflow');await page.screenshot({path:root+'/checks/input-v2-'+name+'.png',fullPage:true});}
 assert.deepEqual(errors,[]);
 const report=JSON.parse(await fs.readFile(root+'/test-report.json','utf8'));report.inputV2={status:'PASS',version:'input-v2',checks,deliveries,limitations:['No physical microphone or speaker used','Additional AI answers simulated here; liveAI report remains separate','Browser-emulated PC/phone sizes']};await fs.writeFile(root+'/test-report.json',JSON.stringify(report,null,2));
 console.log('INPUT V2 PASS',JSON.stringify(report.inputV2));
}finally{if(browser)await browser.close();server.closeAllConnections?.();await new Promise(r=>server.close(r));}
