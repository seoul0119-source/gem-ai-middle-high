// Test-only harness corrections. No classroom/runtime code is transformed here.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=new URL('./next-button-browser-tests.mjs',import.meta.url);
const output=new URL('./.next-button-browser.generated.mjs',import.meta.url);
let code=await fs.readFile(source,'utf8');
function once(a,b){assert.equal(code.split(a).length,2,'Test anchor: '+a);code=code.replace(a,b);}
once("localStorage.setItem(version+'-session',JSON.stringify(","if(!localStorage.getItem(version+'-session'))localStorage.setItem(version+'-session',JSON.stringify(");
// Multiple sequential browser contexts must not share a single process lifetime.
once('args:chromium.args,headless:true','args:chromium.args.filter(arg=>arg!==\'--single-process\'),headless:true');
once('baselineMode=isBaseline;','baselineMode=isBaseline;console.log(\'NEXT CASE\',lang,isBaseline?\'baseline\':\'fixed\');');
once("await page.goto(base+'/programme.html');","await page.goto(base+'/programme.html');console.log('NEXT PAGE LOADED',lang);");
await fs.writeFile(output,code);
try{await import(output.href);}finally{await fs.rm(output,{force:true});}
