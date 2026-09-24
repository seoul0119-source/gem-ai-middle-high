import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const root=path.resolve('mission-dist'),checks=[],layouts=[],errors=[];
let browser;
const server=http.createServer(async(req,res)=>{
 try{
  let p=new URL(req.url,'http://localhost').pathname;if(p==='/')p='/index.html';
  const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('path');
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':/\.(mjs|js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
try{
 browser=await playwright.launch({args:[...chromium.args,'--enable-unsafe-swiftshader'],executablePath:await chromium.executablePath(),headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:900},hasTouch:true});
 await context.addInitScript(()=>{
  let timer=0;
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  const list=[{name:'Local EN',lang:'en-US',voiceURI:'en',localService:true},{name:'Local FR',lang:'fr-FR',voiceURI:'fr',localService:true}];
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>list,addEventListener(){},resume(){},paused:false,cancel(){clearTimeout(timer);},speak(u){u.onstart?.();timer=setTimeout(()=>u.onend?.(),20);}}});
 });
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>{errors.push(e.message);console.error('DISPLAY V3 PAGE',e.message);});
 await page.goto(url);await page.waitForFunction(()=>window.GEM_DISPLAY?.version==='display-v3',{},{polling:100});
 await page.click('#load-avatar');await page.waitForFunction(()=>GEM_PILOT.modelReady,{},{polling:100,timeout:90000});
 assert.equal(await page.evaluate(()=>GEM_DISPLAY.visibleToggleCount),1);
 await page.click('#play');await page.waitForFunction(()=>GEM_PILOT.started&&!GEM_PILOT.paused,{},{polling:100});
 assert.equal(await page.locator('#play').innerText(),'Ⅱ Pause');
 await page.click('#play');assert.ok(await page.evaluate(()=>GEM_PILOT.paused));
 assert.ok((await page.locator('#play').innerText()).includes('Continue'));
 assert.equal(await page.locator('#group-pause').isVisible(),false);
 checks.push('Exactly one visible Start/Pause/Continue control; it still pauses and resumes. End lesson remains separate.');
 const baseline=await page.evaluate(()=>({session:GEM_RELIABILITY.sessionId,index:GEM_PILOT.index,reveal:GEM_PILOT.reveal,elapsed:GEM_PILOT.elapsed,language:GEM_PILOT.language}));
 await page.fill('#answer','keep my draft');
 async function verify(name){
  await page.waitForFunction(()=>GEM_DISPLAY.active&&GEM_DISPLAY.mode!=='entering'&&GEM_RENDER_BOUNDS?.presentation&&GEM_RENDER_BOUNDS.opaqueSamples>0&&Math.abs(GEM_RENDER_BOUNDS.width-document.getElementById('avatar').clientWidth)<1&&Math.abs(GEM_RENDER_BOUNDS.height-document.getElementById('avatar').clientHeight)<1,{},{polling:100,timeout:30000});
  const geometry=await page.evaluate(()=>{
   const c=document.getElementById('avatar'),r=c.getBoundingClientRect(),s=document.getElementById('shell'),exit=document.getElementById('fullscreen').getBoundingClientRect();
   const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return {width:r.width,height:r.height,top:r.top,bottom:r.bottom,windowHeight:innerHeight,uncovered:hit===c,exitVisible:exit.top>=0&&exit.bottom<=innerHeight+1,overflow:s.scrollWidth>s.clientWidth+1,display:GEM_DISPLAY,bounds:GEM_RENDER_BOUNDS};
  });
  assert.ok(geometry.height>=95,name+' reserved canvas height');
  assert.ok(geometry.top>=0&&geometry.bottom<=geometry.windowHeight+1,name+' canvas inside viewport');
  assert.ok(geometry.uncovered,name+' canvas not obscured');
  assert.ok(geometry.exitVisible,name+' exit control visible');
  assert.equal(geometry.overflow,false,name+' no horizontal overflow');
  assert.ok(Math.abs(geometry.bounds.headY)<1.01&&Math.abs(geometry.bounds.feetY)<1.01,name+' full teacher fits camera');
  assert.ok(Math.abs(geometry.bounds.aspect-geometry.width/geometry.height)<.02,name+' camera matches canvas');
  assert.equal(geometry.display.visibleToggleCount,1);
  assert.deepEqual(await page.evaluate(()=>({session:GEM_RELIABILITY.sessionId,index:GEM_PILOT.index,reveal:GEM_PILOT.reveal,elapsed:GEM_PILOT.elapsed,language:GEM_PILOT.language})),baseline);
  assert.equal(await page.locator('#answer').inputValue(),'keep my draft');
  layouts.push({name,mode:geometry.display.mode,canvasHeight:Math.round(geometry.height),opaqueSamples:geometry.bounds.opaqueSamples});
  await page.screenshot({path:root+'/checks/display-v3-'+name+'.png'});
 }
 for(const [name,width,height]of [['phone-portrait',390,844],['small-phone',360,640],['phone-landscape',844,390],['tv',1920,1080]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.locator('#fullscreen').tap();await verify(name);
  // Turn the phone without leaving presentation, then turn back.
  if(name==='phone-portrait'){
   await page.setViewportSize({width:844,height:390});await verify('rotation-landscape');
   await page.setViewportSize({width:390,height:844});await verify('rotation-portrait');
  }
  await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!GEM_DISPLAY.active,{},{polling:100});
  assert.equal(await page.locator('#answer').inputValue(),'keep my draft');
 }
 checks.push('Real WebGL avatar remains on-screen in phone portrait/landscape, rotation, small-phone and TV fullscreen; head/feet fit and opaque model pixels are rendered.');
 const nativeModes=layouts.map(x=>x.mode);
 // Force the unavailable-API branch to cover browsers without native fullscreen.
 await page.evaluate(()=>{document.getElementById('shell').requestFullscreen=()=>Promise.reject(new DOMException('Unsupported','NotSupportedError'));});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#fullscreen').tap();await verify('page-fallback');
 assert.equal(await page.evaluate(()=>GEM_DISPLAY.mode),'page');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!GEM_DISPLAY.active,{},{polling:100});
 checks.push('Unavailable fullscreen uses page expansion with the same visible teacher and an explicit exit; Escape exits the fallback.');
 await page.setViewportSize({width:1366,height:900});await page.locator('#group-more>summary').click();
 await page.locator('[data-view="board"]').click();assert.equal(await page.locator('#stage').isVisible(),false);
 await page.locator('#fullscreen').tap();await verify('board-only-entry');
 assert.ok(await page.locator('#stage').isVisible());
 await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!GEM_DISPLAY.active,{},{polling:100});
 assert.equal(await page.locator('#stage').isVisible(),false);
 await page.locator('[data-view="both"]').click();
 checks.push('Full screen entry from Board only restores the teacher; exit restores the previous view and settings without losing the draft or lesson.');
 await page.locator('[data-lang="fr"]').click();assert.equal(await page.evaluate(()=>GEM_DISPLAY.visibleToggleCount),1);
 await page.locator('#fullscreen').tap();assert.ok((await page.locator('#fullscreen').innerText()).includes('Quitter'));
 await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!GEM_DISPLAY.active,{},{polling:100});
 assert.deepEqual(errors,[]);
 const report=JSON.parse(await fs.readFile(root+'/test-report.json','utf8'));
 report.displayV3={status:'PASS',version:'display-v3',checks,layouts,nativeFullscreenTested:nativeModes.includes('native'),limitations:['Browser-emulated phone screen sizes, not a physical Android or iPhone test','Voice service simulated; existing audio consent and input paths unchanged']};
 await fs.writeFile(root+'/test-report.json',JSON.stringify(report,null,2));
 console.log('DISPLAY V3 PASS',JSON.stringify(report.displayV3));
}finally{if(browser)await browser.close();server.closeAllConnections?.();await new Promise(r=>server.close(r));}
