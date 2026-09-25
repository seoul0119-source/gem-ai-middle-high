// Real programme/workbook UI, input tools, state and navigation.
// Speech callbacks, teacher model and AI responses are isolated test doubles.
import fs from 'node:fs/promises';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
import {LANGS,getCourse} from './curriculum.mjs';
import {VERSION,validateLesson} from './core.mjs';
import {patchWorkbookApp} from '../patch-workbook.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'gem-next-'));
await fs.cp('mission/programme',root+'/programme',{recursive:true});
await fs.cp('mission/pc',root+'/pc',{recursive:true});
await fs.copyFile('mission/programme/index.html',root+'/programme.html');
await fs.writeFile(root+'/programme/app.mjs',patchWorkbookApp(await fs.readFile('mission/programme/app.mjs','utf8')));
await fs.writeFile(root+'/programme/display.mjs','export function installDisplayV3(){}');
await fs.writeFile(root+'/avatar.bundle.js','export async function loadAvatar(){return true;}');
const baseCore=await fs.readFile(root+'/programme/core.mjs','utf8');
const oldChoice="export function choiceFor(input,options){const n=normalize(input);const i=options.findIndex(x=>normalize(x)===n);if(i>=0)return i;const map={a:0,b:1,c:2,'ए':0,'बी':1,'सी':2};return Object.hasOwn(map,n)?map[n]:-1;}";
const beforeCore=baseCore.replace('export function choiceFor(input,options){return matchChoice(input,options);}',oldChoice);
assert.notEqual(beforeCore,baseCore);
const opts=['I will visit my friend tomorrow.','She will finish her work soon.','He might come to the party.'];
const colors={en:['red','blue','green'],fr:['rouge','bleu','vert'],ne:['रातो','नीलो','हरियो'],ur:['سرخ','نیلا','سبز'],sw:['nyekundu','buluu','kijani']};
const lesson={steps:['explain','question','activity','question','question','recap'].map((kind,index)=>({kind,answerIndex:kind==='question'?(index===1?2:index===3?1:0):-1,text:Object.fromEntries(LANGS.map(lang=>[lang,{
 narration:kind==='question'?'Choose one answer.':'Let us review this classroom example.',
 prompt:kind==='question'?(index===1?'Which sentence shows a possibility?':index===3?'Choose the second color.':'Choose the decimal one point five.'):'',
 options:kind!=='question'?[]:index===1?opts:index===3?colors[lang]:['1.5','15','-1.5'],
 explanation:kind!=='question'?'':index===1?'The sentence "He might come to the party" shows a possibility.':index===3?colors[lang][1]+' is the second choice.':'One point five is written 1.5, not 15.',
 board:[kind==='question'?'Read the three choices.':'Discuss the example together.']
 }]))}))};
const unitId=getCourse('english',6).units[0].id;assert.ok(validateLesson(lesson,unitId));
let baselineMode=false,browser;const checks=[],errors=[],results=[];
const server=http.createServer(async(req,res)=>{try{
 let pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/')pathname='/programme.html';
 const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))throw Error('path');
 const bytes=pathname==='/programme/core.mjs'?(baselineMode?beforeCore:baseCore):await fs.readFile(file);
 res.writeHead(200,{'Cache-Control':'no-store','Content-Type':file.endsWith('.html')?'text/html':/\.(mjs|js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 async function openCase(lang,isBaseline=false){
  baselineMode=isBaseline;
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.addInitScript(({version,lesson,unitId,lang})=>{
   localStorage.setItem(version+'-session',JSON.stringify({version,lang,subject:'english',grade:6,unitId,lesson,sessionId:'next-regression-'+lang,index:1,started:true,approved:true,ended:false,paused:true,minutes:40,elapsed:100,revealed:{},choices:{},transcript:[]}));
   window.NEXT_SPEECH={timer:0};window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>['en-US','fr-FR','ne-NP','ur-PK','sw-KE'].map(lang=>({lang,name:lang,voiceURI:lang,localService:true})),addEventListener(){},cancel(){clearTimeout(NEXT_SPEECH.timer);},speak(u){u.onstart?.();NEXT_SPEECH.timer=setTimeout(()=>u.onend?.(),5);}}});
   window.SpeechRecognition=class{start(){window.NEXT_MIC=this;}stop(){this.onend?.();}abort(){}};
  },{version:VERSION,lesson,unitId,lang});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  let questionCalls=0,generationCalls=0;
  await page.route('**/api/mission-programme.js',route=>{const b=route.request().postDataJSON();if(b.action==='question')questionCalls++;else generationCalls++;return route.fulfill({contentType:'application/json',body:JSON.stringify({answer:'The sentence "He might come to the party" shows a possibility.'})});});
  await page.goto(base+'/programme.html');await page.waitForFunction(()=>window.GEM_PROGRAMME);await page.click('#resume');await page.waitForFunction(()=>GEM_PROGRAMME.modelReady&&GEM_PROGRAMME.view==='lesson');
  assert.ok(await page.locator('#next').isDisabled());
  const say=async text=>{await page.click('#mic');await page.evaluate(text=>{const r=window.NEXT_MIC,result=Object.assign([{transcript:text}],{isFinal:true});r.onresult({results:[result]});r.onend?.();},text);await page.waitForFunction(()=>document.querySelector('#feedback').textContent.trim().length>0&&!GEM_PROGRAMME.busy);};
  if(isBaseline){
   await say('see he might come to the party');
   assert.equal(questionCalls,1);assert.equal(await page.evaluate(()=>GEM_PROGRAMME.revealed),false);assert.ok(await page.locator('#next').isDisabled());
   checks.push('Original parser reproduces the screenshot: "see + C option text" is treated as chat; AI explanation appears while Next remains disabled.');
   await context.close();return;
  }
  await page.fill('#answer','What does might mean?');await page.click('#answer-form button.primary');await page.waitForFunction(()=>!GEM_PROGRAMME.busy&&document.querySelector('#feedback').textContent.includes('possibility'));
  assert.equal(questionCalls,1);assert.ok(await page.locator('#next').isDisabled());
  const voiceText=({en:'see he might come to the party',fr:'C. He might come to the party.',ne:'सी He might come to the party.',ur:'سی He might come to the party.',sw:'C He might come to the party.'})[lang];
  await say(voiceText);await page.waitForFunction(()=>GEM_PROGRAMME.revealed);
  assert.equal(questionCalls,1,'A recognized choice must not request AI chat');assert.ok(await page.locator('#next').isEnabled());
  const saved=await page.evaluate(version=>JSON.parse(localStorage.getItem(version+'-session')),VERSION);assert.equal(saved.choices[1],2);assert.equal(saved.revealed[1],true);
  assert.ok((await page.locator('#transcript-messages').textContent()).includes(voiceText));
  const session=await page.evaluate(()=>GEM_PROGRAMME.sessionId);
  if(lang==='en'){
   const snap=await page.evaluate(()=>({id:GEM_PROGRAMME.sessionId,index:GEM_PROGRAMME.index,revealed:GEM_PROGRAMME.revealed}));
   await page.click('[data-lang="fr"]');assert.deepEqual(await page.evaluate(()=>({id:GEM_PROGRAMME.sessionId,index:GEM_PROGRAMME.index,revealed:GEM_PROGRAMME.revealed})),snap);assert.ok(await page.locator('#next').isEnabled());await page.click('[data-lang="en"]');
   await page.reload();await page.waitForFunction(()=>window.GEM_PROGRAMME);await page.click('#resume');await page.waitForFunction(()=>GEM_PROGRAMME.view==='lesson');assert.deepEqual(await page.evaluate(()=>({id:GEM_PROGRAMME.sessionId,index:GEM_PROGRAMME.index,revealed:GEM_PROGRAMME.revealed})),snap);assert.ok(await page.locator('#next').isEnabled());
  }
  await page.click('#next');assert.equal(await page.evaluate(()=>GEM_PROGRAMME.index),2);assert.equal(await page.evaluate(()=>GEM_PROGRAMME.sessionId),session);
  await page.click('#next');assert.equal(await page.evaluate(()=>GEM_PROGRAMME.index),3);assert.ok(await page.locator('#next').isDisabled());
  const prefix=({en:'The answer is B',fr:'La réponse est B',ne:'उत्तर बी',ur:'جواب بی',sw:'Jibu ni B'})[lang];
  await page.fill('#answer',prefix);await page.click('#answer-form button.primary');await page.waitForFunction(()=>GEM_PROGRAMME.revealed);assert.ok(await page.locator('#next').isEnabled());
  await page.click('#next');assert.equal(await page.evaluate(()=>GEM_PROGRAMME.index),4);assert.ok(await page.locator('#next').isDisabled());
  await page.fill('#answer','B. 15');await page.click('#answer-form button.primary');await page.waitForFunction(()=>GEM_PROGRAMME.revealed);
  assert.ok(await page.evaluate(()=>GEM_PROGRAMME.paused));assert.ok(await page.locator('#next').isEnabled());assert.ok((await page.locator('#feedback').textContent()).includes('1.5'));await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>GEM_PROGRAMME.index),4);
  await page.click('#next');assert.equal(await page.evaluate(()=>GEM_PROGRAMME.index),5);await page.click('#next');assert.ok(await page.locator('#next').isDisabled());
  assert.equal(generationCalls,0);results.push({language:lang,spokenOption:'PASS',typedOption:'PASS',wrongAnswerReviewThenNext:'PASS',finalStage:'PASS',unexpectedAIGradingCalls:0});
  await context.close();
 }
 await openCase('en',true);
 for(const lang of LANGS)await openCase(lang);
 assert.deepEqual(errors,[]);
 checks.push('The unchanged programme and workbook app now take spoken label + exact option text through deterministic grading, revealing the explanation and enabling manual Next.');
 checks.push('Five languages: correct speech and typed selections, wrong-answer explanation and manual Next, three question stages through the final recap.');
 checks.push('Ordinary follow-up questions do not count as answers. No extra generation calls; solved state survives language switching and reload.');
 console.log('NEXT BUTTON BROWSER PASS',JSON.stringify({status:'PASS',checks,results,limitations:['Device speech recognition/synthesis, 3D model and AI replies simulated in this focused UI test','Existing full deployment build retains its real-model, workbook, audio and fullscreen regression tests']}));
}finally{await browser?.close();server.closeAllConnections?.();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
