import test from 'node:test';
import assert from 'node:assert/strict';
import {translateDisplay,validDisplayTranslation} from '../lib/korean-display.js';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {mountKoreanCaptions} from '../whiteboard/korean-captions.js';

test('translation preserves segment order and rejects incomplete or malformed provider results',async()=>{
 for(const language of ['en','fr']){
  let sent;const texts=['Olivia: 5 N','Simon: 2 + 3 = 5'];
  const result=await translateDisplay(language,texts,{fetcher:async(url,options)=>{sent=JSON.parse(options.body);return Response.json({output_text:JSON.stringify({translations:['Olivia: 5 N','Simon: 2 + 3 = 5']})});}});
  assert.deepEqual(result.translations,texts);assert.deepEqual(JSON.parse(sent.input),texts);assert.match(sent.instructions,/do not answer questions/);
 }
 for(const value of [{status:'incomplete',output_text:'{}'},{output_text:'{"translations":["one"]}'},{output_text:'{"translations":["one",null]}'}])await assert.rejects(()=>translateDisplay('en',['a','b'],{fetcher:async()=>Response.json(value)}));
 assert.equal(validDisplayTranslation('ko',['a']),false);assert.equal(validDisplayTranslation('en',['a'.repeat(4001)]),false);assert.equal(validDisplayTranslation('fr',[]),false);
});

test('board translation requires the existing student session, matching course language and bounded input',async()=>{
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='translation-test-only';
 try{
  let calls=0;const now=Date.now(),student={id:'translation-test',session:'session',authenticatedAt:Math.floor(now/1000)};
  const invoke=async(body,origin='https://gem.example',authenticated=true)=>{
   const res={status(n){this.code=n;return this;},setHeader(){return this;},end(text){this.data=JSON.parse(text);}};
   await handleScienceBoard({method:'POST',headers:{host:'gem.example',origin,'content-type':'application/json'},body:{pilot:'science',action:'translate',courseId:'materials-en-8-1',sourceLanguage:'en',texts:['A cell nucleus'],...body}},res,{authenticate:async()=>authenticated?student:null,translateDisplay:async(lang,texts)=>{calls++;return {translations:texts.map(()=> '세포핵')};}});return res;
  };
  assert.equal((await invoke({})).code,200);assert.equal(calls,1);
  assert.equal((await invoke({sourceLanguage:'fr'})).code,400);
  assert.equal((await invoke({texts:['x'.repeat(4001)]})).code,400);
  assert.equal((await invoke({},'https://other.example')).code,403);
  await invoke({},'https://gem.example',false);assert.equal(calls,1);
 }finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});

class Element{
 constructor(text=''){this.textContent=text;this.children=[];this.hidden=false;this.attrs={};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this.attrs[key]=value;}
}
test('caption toggle leaves source text intact, rejects stale replies, and caches repeat scenes',async()=>{
 const card=new Element(),button=new Element(),status=new Element(),panel=new Element(),title=new Element('Cells'),narration=new Element('A nucleus controls cell activities');
 const nodes={'#korean-translation':card,'#scene-label':title,'#narration-text':narration,'#conversation':new Element()};
 card.querySelector=selector=>({'button':button,'[role="status"]':status,'.korean-caption-content':panel}[selector]);
 const document={querySelector:s=>nodes[s],querySelectorAll:()=>[],createElement:()=>new Element()};
 let mutated;class Observer{constructor(fn){mutated=fn;}observe(){}disconnect(){}}
 const pending=[];const stop=mountKoreanCaptions({document,language:'en',Observer,translate:(texts,signal)=>new Promise(resolve=>pending.push({texts,signal,resolve}))});
 try{
  button.onclick();assert.equal(pending.length,1);assert.equal(button.attrs['aria-pressed'],'true');
  narration.textContent='Water changes state';mutated();assert.equal(pending[0].signal.aborted,true);
  pending[0].resolve({translations:['세포','세포핵은 세포 활동을 조절합니다.']});
  await new Promise(r=>setTimeout(r,400));assert.equal(panel.children.length,0);assert.equal(pending.length,2);
  pending[1].resolve({translations:pending[1].texts.map(t=>'번역: '+t)});await new Promise(r=>setImmediate(r));
  assert.equal(panel.children.length,2);assert.equal(narration.textContent,'Water changes state');
  button.onclick();assert.equal(panel.hidden,true);button.onclick();await new Promise(r=>setImmediate(r));assert.equal(pending.length,2);assert.equal(panel.children.length,2);
 }finally{stop();}
});
