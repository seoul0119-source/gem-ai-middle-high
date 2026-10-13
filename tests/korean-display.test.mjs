import test from 'node:test';
import assert from 'node:assert/strict';
import {translateDisplay,validDisplayTranslation} from '../lib/korean-display.js';
import {handleScienceBoard} from '../lib/science-board-handler.js';
import {mountKoreanCaptions,requestBoardTranslation,captionErrorMessage} from '../whiteboard/korean-captions.js';

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

test('real caption request reaches the board handler and reads Responses output for English and French',async t=>{
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic-translation-key';
 t.after(()=>{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;});
 for(const language of ['en','fr']){
  let calls=0;
  const course={id:`materials-${language}-6-2`,language},texts=['Build Evidence Chains','A cause explains why something happened; an effect is the result.'];
  const result=await requestBoardTranslation(course,texts,new AbortController().signal,async(url,options)=>{
   assert.equal(url,'/api/whiteboard');
   const res={status(n){this.code=n;return this;},setHeader(){return this;},end(text){this.data=text;}};
   await handleScienceBoard({method:'POST',headers:{host:'portal.test',origin:'https://portal.test',...Object.fromEntries(new Headers(options.headers))},body:JSON.parse(options.body)},res,{
    authenticate:async()=>({id:'synthetic-'+language,session:'session',authenticatedAt:Math.floor(Date.now()/1000)}),
    fetcher:async(_url,request)=>{calls++;assert.deepEqual(JSON.parse(JSON.parse(request.body).input),texts);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({translations:['근거 연결하기','원인은 어떤 일이 일어난 이유이고, 결과는 그 일로 생긴 것입니다.']})}]}]});}
   });return new Response(res.data,{status:res.code});
  });
  assert.equal(calls,1);assert.equal(result.translations[1],'원인은 어떤 일이 일어난 이유이고, 결과는 그 일로 생긴 것입니다.');
 }
});

test('translation errors preserve safe causes without retrying the provider or exposing private data',async()=>{
 const cases=[
  [async()=>Response.json({error:{code:'insufficient_quota',message:'private-provider-secret'}},{status:429}),'ai_credit_exhausted'],
  [async()=>Response.json({error:{code:'rate_limit_exceeded'}},{status:429}),'ai_rate_limited'],
  [async()=>Response.json({error:{code:'invalid_json_schema',message:'private-provider-secret'}},{status:400}),'translation_configuration'],
  [async()=>{throw new DOMException('private-provider-secret','TimeoutError');},'translation_timeout'],
  [async()=>Response.json({status:'incomplete'}),'translation_incomplete'],
  [async()=>Response.json({status:'completed',output_text:'not JSON'}),'translation_invalid_response']
 ];
 for(const [reply,code]of cases){
  let calls=0;await assert.rejects(translateDisplay('en',['A cause'],{fetcher:async()=>{calls++;return reply();}}),error=>error.payload?.code===code&&!JSON.stringify(error.payload).includes('private-provider-secret'));
  assert.equal(calls,1);
  await assert.rejects(requestBoardTranslation({id:'materials-en-6-2',language:'en'},['A cause'],new AbortController().signal,async()=>Response.json({code},{status:503})),error=>error.code===code&&captionErrorMessage(error)!==captionErrorMessage({}));
 }
 await assert.rejects(requestBoardTranslation({id:'materials-en-6-2',language:'en'},['A cause'],new AbortController().signal,async()=>Response.json({error:'회원 이용 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:503})),error=>error.code==='translation_membership');
});

test('a failed translation stops automatic requests across scene updates and the retry button recovers the current scene',async()=>{
 const card=new Element(),button=new Element(),retry=new Element(),status=new Element(),panel=new Element(),title=new Element('Cause and effect'),narration=new Element('A cause explains why.');
 retry.hidden=true;
 const nodes={'#korean-translation':card,'#scene-label':title,'#narration-text':narration,'#conversation':new Element()};
 card.querySelector=selector=>({'button':button,'[data-translation-retry]':retry,'[role="status"]':status,'.korean-caption-content':panel}[selector]);
 const document={querySelector:s=>nodes[s],querySelectorAll:()=>[],createElement:()=>new Element()};
 let mutated,calls=0;class Observer{constructor(fn){mutated=fn;}observe(){}disconnect(){}}
 const stop=mountKoreanCaptions({document,language:'en',Observer,translate:async texts=>{calls++;if(calls===1)throw Object.assign(Error('unavailable'),{code:'translation_timeout'});return {translations:texts.map(text=>'번역: '+text)};}});
 try{
  button.onclick();await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.match(status.textContent,/응답 시간이/);assert.equal(retry.hidden,false);assert.equal(panel.hidden,true);
  narration.textContent='An effect is the result.';mutated();mutated();await new Promise(r=>setTimeout(r,400));assert.equal(calls,1,'no silent retry after failure');
  retry.onclick();await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert.equal(panel.hidden,false);assert.equal(retry.hidden,true);assert.equal(panel.children[1].children[1].textContent,'번역: An effect is the result.');
  button.onclick();button.onclick();await new Promise(r=>setImmediate(r));assert.equal(calls,2,'successful translation is cached');
 }finally{stop();}
});
