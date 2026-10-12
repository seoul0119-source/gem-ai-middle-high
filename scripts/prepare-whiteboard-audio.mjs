// Build once, serve the same prepared explanation to every admitted learner.
// Credentials remain in the existing Vercel build/runtime environment.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {LESSON,LANGUAGES} from '../whiteboard/lesson.js';
import {speechRequest,sceneAudioFilename,whiteboardPrompt} from '../lib/whiteboard-handler.js';
const output=new URL('../generated-whiteboard/',import.meta.url);
const cache=new URL('../.vercel/cache/whiteboard-audio/',import.meta.url);
await mkdir(output,{recursive:true});await mkdir(cache,{recursive:true});
const key=process.env.OPENAI_API_KEY;
if(!key)throw Error('Existing classroom OpenAI configuration is required to prepare pilot narration.');
const jobs=LANGUAGES.flatMap(language=>LESSON[language].scenes.map((_,scene)=>({language,scene})));
let prepared=0,cached=0;
async function worker(){while(jobs.length){const {language,scene}=jobs.shift(),filename=sceneAudioFilename(language,scene);let bytes;try{bytes=await readFile(new URL(filename,cache));if(bytes.length<1000)bytes=null;}catch{}
 if(bytes)cached++;
 else{const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(speechRequest(LESSON[language].scenes[scene][1],language)),signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error(`Narration preparation failed (${language}, scene ${scene+1}, HTTP ${response.status}).`);bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<1000||bytes.length>4000000)throw Error('Invalid narration output.');await writeFile(new URL(filename,cache),bytes);}
 await writeFile(new URL(filename,output),bytes);prepared++;console.log(`Prepared ${language} scene ${scene+1} (${bytes.length} audio bytes).`);
}}
await Promise.all([worker(),worker(),worker()]);
// Three short real-provider checks use only fictional arithmetic, no student data.
for(const language of LANGUAGES){const body={language,scene:3},question={ko:'왜 5를 3과 2로 나누나요?',en:'Why do we split five into three and two?',fr:'Pourquoi décomposer cinq en trois et deux ?'}[language];
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_WHITEBOARD_MODEL||'gpt-4.1-mini-2025-04-14',store:false,max_output_tokens:700,instructions:whiteboardPrompt(body),input:[{role:'user',content:question}]}),signal:AbortSignal.timeout(40000)});
 if(!response.ok)throw Error(`Pilot teacher check failed (${language}, HTTP ${response.status}).`);const data=await response.json();const answer=String(data.output_text||data.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||'').trim();if(!answer||data.status==='incomplete')throw Error(`Incomplete pilot teacher reply (${language}).`);console.log(`Pilot teacher ${language}: ${answer}`);
}
console.log(`Whiteboard narration ready: ${prepared} clips (${cached} reused). Three teacher checks completed.`);
