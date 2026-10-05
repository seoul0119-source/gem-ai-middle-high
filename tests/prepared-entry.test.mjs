import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
test('selected Korean course enters its saved worksheet classroom; conversation and resume stay available',()=>{
 let click,selected,destination;const element=tag=>({style:{},setAttribute(){},append(){},prepend(){},value:tag==='select'?'worksheet':'',...(tag==='select'?{capture:true}:{})});
 const document={createElement(tag){const e=element(tag);if(tag==='select')selected=e;return e},querySelector:()=>element('main'),addEventListener:(type,fn)=>click=fn};
 const location={href:'https://gem-ai-middle-high.vercel.app/class.html',origin:'https://gem-ai-middle-high.vercel.app',assign:value=>destination=value};
 vm.runInNewContext(readFileSync('prepared-entry.js','utf8'),{document,location,URL,Set,window:{}});
 function enter(href){destination=null;let stopped=false;click({target:{closest:()=>({dataset:{href}})},preventDefault(){stopped=true},stopImmediatePropagation(){stopped=true}});return{destination,stopped};}
 for(const course of ['toefl','toeic','m1-science','ged-high-korean','suneung-2028-english'])assert.equal(enter('/learn.html?course='+course).destination,'/materials.html?classroom=1&course='+course);
 assert.equal(enter('/learn.html?course=toefl&resume=saved').destination,null);assert.equal(enter('https://other.test/learn.html?course=toefl').destination,null);
 selected.value='conversation';assert.equal(enter('/learn.html?course=toefl').stopped,false);
});
