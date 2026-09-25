import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';import chromium from '@sparticuz/chromium';
const root=path.resolve('mission-dist'),checks=[],errors=[];let browser;
const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p==='/')p='/pc.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep))throw Error('path');const bytes=await fs.readFile(f);res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':/\.(mjs|js)$/.test(f)?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--enable-unsafe-swiftshader'],headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await ctx.addInitScript(()=>{
  window.AUDIO_TEST={records:[],spoken:[],timer:0,voices:[{lang:'en-US',name:'Local English',voiceURI:'en',localService:true},{lang:'fr_FR',name:'Local French',voiceURI:'fr',localService:true},{lang:'ne-NP',name:'Remote Nepali mock',voiceURI:'ne-online',localService:false}],changed:[],mode:'normal'};
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>AUDIO_TEST.voices,addEventListener:(name,fn)=>{if(name==='voiceschanged')AUDIO_TEST.changed.push(fn);},cancel(){clearTimeout(AUDIO_TEST.timer);},speak(u){AUDIO_TEST.spoken.push({lang:u.lang,text:u.text});u.onstart?.();AUDIO_TEST.timer=setTimeout(()=>AUDIO_TEST.mode==='error'?u.onerror?.({error:'network'}):u.onend?.(),35);}}});
  window.SpeechRecognition=class{start(){AUDIO_TEST.records.push(this);}stop(){this.onend?.();}abort(){}};
  window.emitRecognition=(text,final)=>{const r=Object.assign([{transcript:text}],{isFinal:final});AUDIO_TEST.records.at(-1).onresult?.({results:{0:r,length:1}});};
 });
 const page=await ctx.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const wait=(fn,arg=null,timeout=30000)=>page.waitForFunction(fn,arg,{polling:50,timeout});const quiet=()=>wait(()=>!GEM_PC.speaking&&!GEM_PC.speechPending);
 await page.goto(base+'/pc.html');await wait(()=>window.GEM_PC_AUDIO);await page.click('#open-course');await page.click('#play');await wait(()=>GEM_PC.modelReady,null,90000);await quiet();await page.click('#play');assert.ok(await page.evaluate(()=>GEM_PC.paused));
 const snapshot=()=>page.evaluate(()=>({id:GEM_PC.sessionId,index:GEM_PC.index,step:GEM_PC.step}));const original=await snapshot();const target=original.step.missing?10-original.step.a:original.step.a+original.step.b;
 for(const lang of ['en','fr','ne','ur','sw']){
  await page.click('[data-lang="'+lang+'"]');assert.deepEqual(await snapshot(),original);const before=await page.evaluate(()=>GEM_PC_AUDIO.submissions);await page.click('#mic');
  assert.equal(await page.evaluate(()=>AUDIO_TEST.records.at(-1).interimResults),true);
  const value=lang==='ne'?String(target).replace(/\d/g,d=>String.fromCharCode(0x0966+Number(d))):lang==='ur'?String(target).replace(/\d/g,d=>String.fromCharCode(0x06f0+Number(d))):String(target);
  await page.evaluate(text=>emitRecognition(text,false),value);assert.equal(await page.locator('#answer').inputValue(),value);assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.submissions),before);
  await page.evaluate(text=>{window.lastResult=AUDIO_TEST.records.at(-1).onresult;window.lastEnd=AUDIO_TEST.records.at(-1).onend;emitRecognition(text,true);},value);
  assert.equal(await page.locator('#answer').inputValue(),value);assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.submissions),before);
  await wait(n=>GEM_PC_AUDIO.submissions===n+1,before);await quiet();assert.equal(await page.locator('#answer').inputValue(),value);assert.ok(!(await page.evaluate(()=>GEM_PC_AUDIO.hasDraft)));assert.equal(await page.evaluate(()=>GEM_PC.review),false);
  await page.evaluate(text=>{lastResult?.({results:[Object.assign([{transcript:text}],{isFinal:true})]});lastEnd?.();lastEnd?.();},value);await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.submissions),before+1);
 }
 checks.push('Five recognition locales: interim and final text are visible, finalized text auto-sends once after 750ms and remains visible after success. Repeated callbacks do not submit twice.');
 checks.push('Missing Nepali/Urdu/Swahili reading voices do not disable recognized text; the test simulates STT separately from available TTS voices. Actual service language support is not inferred.');
 await page.click('#mic');await page.evaluate("emitRecognition('old result',true)");let before=await page.evaluate(()=>GEM_PC_AUDIO.submissions);await page.fill('#answer','replacement draft');await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.submissions),before);assert.equal(await page.locator('#answer').inputValue(),'replacement draft');
 await page.fill('#answer','');await page.click('#mic');await page.evaluate('window.stale=AUDIO_TEST.records.at(-1).onresult');await page.click('[data-lang="en"]');await page.evaluate("stale({results:[Object.assign([{transcript:'late old language'}],{isFinal:true})]})");assert.equal(await page.locator('#answer').inputValue(),'');
 await page.click('#mic');await page.evaluate("emitRecognition('draft only',false)");await page.click('#mic');before=await page.evaluate(()=>GEM_PC_AUDIO.submissions);await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.submissions),before);assert.equal(await page.locator('#answer').inputValue(),'draft only');
 checks.push('Manual edits and language changes cancel queued/late results. Stopping with only interim text retains it for manual Send rather than grading an unfinished guess.');
 for(const code of ['not-allowed','network','audio-capture','language-not-supported','no-speech','service-not-allowed']){
  await page.fill('#answer','keep draft');await page.click('#mic');await page.evaluate(code=>AUDIO_TEST.records.at(-1).onerror({error:code}),code);assert.equal(await page.locator('#answer').inputValue(),'keep draft');assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.voices.find(v=>v.lang==='en').recognition),code);
 }
 checks.push('Permission, capture, network, no-speech and unsupported-language failures remain separate in diagnostics and preserve drafts. No failure is spoken as a lesson or claimed to be successful.');
 await page.fill('#answer','');await page.click('[data-lang="ne"]');await page.click('#audio-open');assert.equal(await page.locator('#remote').isChecked(),false);assert.equal(await page.locator('#voices option').count(),1);
 await page.check('#remote');await page.click('#test-voice');await quiet();assert.equal(await page.evaluate(()=>AUDIO_TEST.spoken.at(-1).lang),'ne-NP');await page.click('#audio-close');
 await page.click('[data-lang="ur"]');assert.equal(await page.locator('#remote').isChecked(),false);await page.click('[data-lang="ne"]');assert.equal(await page.locator('#remote').isChecked(),true);
 await page.click('[data-lang="sw"]');const spoken=await page.evaluate(()=>AUDIO_TEST.spoken.length);await page.click('#repeat');assert.equal(await page.evaluate(()=>AUDIO_TEST.spoken.length),spoken);
 await page.evaluate("AUDIO_TEST.voices.push({lang:'sw-KE',name:'Late local Swahili mock',voiceURI:'sw',localService:true});AUDIO_TEST.changed.forEach(fn=>fn())");await wait(n=>AUDIO_TEST.spoken.length>n,spoken);await quiet();assert.equal(await page.evaluate(()=>AUDIO_TEST.spoken.at(-1).lang),'sw-KE');
 checks.push('Remote browser voices require language-specific opt-in; adding the checkbox cannot invent an absent voice. A late matching voice resolves a pending playback once without a wrong-language fallback.');
 await page.evaluate("AUDIO_TEST.mode='error'");await page.click('#repeat');await quiet();assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.voices.find(v=>v.lang==='sw').tts),'network');await page.evaluate("AUDIO_TEST.mode='normal'");
 await page.click('[data-lang="en"]');await page.click('#mic');await page.evaluate(n=>emitRecognition(String(n),true),target);await wait(()=>!GEM_PC_AUDIO.queued);await quiet();assert.equal(await page.locator('#answer').inputValue(),String(target));
 await page.reload();await wait(()=>window.GEM_PC_AUDIO);assert.deepEqual(await snapshot(),original);assert.equal(await page.locator('#answer').inputValue(),String(target));assert.equal(await page.evaluate(()=>GEM_PC_AUDIO.hasDraft),false);assert.ok(await page.evaluate(()=>GEM_PC.paused));
 await page.click('#audio-open');await page.screenshot({path:root+'/checks/pc-audio-v2-diagnostics.png',fullPage:true});await page.click('#audio-close');
 const state=await snapshot();await page.click('#fullscreen');await wait(()=>GEM_DISPLAY.active);await page.click('#fullscreen-exit');await wait(()=>!GEM_DISPLAY.active);assert.deepEqual(await snapshot(),state);await page.screenshot({path:root+'/checks/pc-audio-v2-input.png',fullPage:true});
 checks.push('Sent transcript reloads with the same paused lesson and is not treated as unsent. Fullscreen exit preserves the lesson. Diagnostics show playback errors without recording or uploading audio.');
 assert.deepEqual(errors,[]);
 const report={version:'pc-audio-v2',status:'PASS',checks,limitations:['Real VRM loaded; browser speech and recognition callbacks simulated','Nepali, Urdu and Swahili hardware voices are not installed by this patch','No new cloud speech provider or paid API calls','Physical PC test required; STT service language support remains browser-dependent']};
 await fs.writeFile(root+'/pc-audio-v2-report.json',JSON.stringify(report,null,2));console.log('PC AUDIO V2 BROWSER PASS',JSON.stringify(report));
}finally{if(browser)await browser.close();server.closeAllConnections?.();await new Promise(r=>server.close(r));}
