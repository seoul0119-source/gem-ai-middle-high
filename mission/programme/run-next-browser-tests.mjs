// Focused QA of the exact shipped parser. Runtime and audio settings are not changed.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=new URL('./next-button-browser-tests.mjs',import.meta.url),output=new URL('./.next-button-browser.generated.mjs',import.meta.url);
let code=await fs.readFile(source,'utf8');
function once(a,b){assert.equal(code.split(a).length,2,'Test anchor: '+a);code=code.replace(a,b);}
once("localStorage.setItem(version+'-session',JSON.stringify(","if(!localStorage.getItem(version+'-session'))localStorage.setItem(version+'-session',JSON.stringify(");
once('args:chromium.args,headless:true','args:chromium.args.filter(arg=>arg!==\'--single-process\'),headless:true');
once('baselineMode=isBaseline;','baselineMode=isBaseline;console.log(\'NEXT CASE\',lang,isBaseline?\'baseline\':\'fixed\');');
once('const say=async text=>{',`const say=async text=>{
   if(['ne','ur','sw'].includes(lang)){
    // These languages use the existing opt-in cloud/reviewed-text path, not
    // the EN/FR browser recognizer. Submit the reviewed transcript as text.
    await page.fill('#answer',text);await page.click('#answer-form button.primary');
    await page.waitForFunction(()=>GEM_PROGRAMME.revealed&&!GEM_PROGRAMME.busy);return;
   }
`);
code=code.replace("spokenOption:'PASS'","submittedOption:'PASS',inputPath:['en','fr'].includes(lang)?'browser-recognition-final':'reviewed-text'");
code=code.replace('Five languages: correct speech and typed selections, wrong-answer explanation and manual Next, three question stages through the final recap.','Five languages: submitted option and typed selections, wrong-answer explanation and manual Next, three question stages through final recap. EN/FR use simulated browser recognition; NE/UR/SW use reviewed text.');
await fs.writeFile(output,code);try{await import(output.href);}finally{await fs.rm(output,{force:true});}
