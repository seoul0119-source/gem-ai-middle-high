// One-time, private PREVIEW validation. Never part of the production build.
import {mkdir,writeFile} from 'node:fs/promises';
import {inspectBook} from '../lib/library-core.js';
import {makeNarration} from '../api/library-job.js';
if(process.env.VERCEL_ENV!=='preview')throw Error('Pilot preparation is preview-only');
if(!process.env.OPENAI_API_KEY)throw Error('AI service not configured');
await mkdir('library-pilot',{recursive:true});
const results=[];
for(const slug of ['baby-talk','hello','sleepy-mr-sloth','grandpa-farouks-garden','a-tiny-seed']){
 try{
  const b=await inspectBook('https://bookdash.org/books/'+slug+'/',process.env.OPENAI_API_KEY);
  const audio=await makeNarration(b,process.env.OPENAI_API_KEY);
  if(audio){await writeFile('library-pilot/'+slug+'.mp3',Buffer.from(audio,'base64'));b.pilotAudio=slug+'.mp3';}
  results.push(b);console.log('Pilot review:',slug,b.status,'level',b.level,'audio',!!audio);
 }catch(e){results.push({id:slug,error:e.message});console.log('Pilot needs review:',slug,e.message);}
}
await writeFile('library-pilot/seed.json',JSON.stringify(results,null,2));
