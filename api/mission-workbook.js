// A fresh-generation adapter around the existing validated five-language lesson engine.
// The standard lesson/question endpoint, review, voice paths and content policy stay intact.
import {randomUUID} from 'node:crypto';
import {runProgramme} from './mission-programme.js';
import {getUnit,LANGS} from '../mission/programme/curriculum.mjs';
import {WORKBOOK_VERSION,WORKBOOK_RULES,safeRecentQuestions,freshWorkbook} from '../mission/programme/workbook-core.mjs';
export const config={maxDuration:180};
const limits=new Map();
export async function runWorkbook(body,{fetchImpl=fetch,key=process.env.OPENAI_API_KEY}={}){
 if(!getUnit(body?.unitId)||!LANGS.includes(body?.lang))return {status:400,code:'invalid_request'};
 const previousQuestions=safeRecentQuestions(body.recentQuestions);
 let generationCalls=0;
 // Apply additional constraints only to lesson generation, never the independent reviewer.
 const freshFetch=async(url,options)=>{
  if(url!=='https://api.openai.com/v1/responses')throw Error('Unexpected generator endpoint');
  const payload=JSON.parse(options.body);
  if(payload.text?.format?.schema?.properties?.steps){
   generationCalls++;
   payload.instructions+='\n'+WORKBOOK_RULES;
   payload.input=JSON.stringify({...JSON.parse(payload.input),workbook:WORKBOOK_VERSION,previousQuestions});
  }
  return fetchImpl(url,{...options,body:JSON.stringify(payload)});
 };
 const result=await runProgramme({action:'lesson',unitId:body.unitId,lang:body.lang,variant:randomUUID()},{fetchImpl:freshFetch,key});
 if(result.status!==200)return result;
 // Never call a cached/duplicate question set new. Keep the old lesson in the browser on failure.
 if(!generationCalls||!freshWorkbook(result.lesson,previousQuestions))return {status:502,code:'repeat_detected'};
 return {...result,workbook:WORKBOOK_VERSION,freshness:{checkedAgainst:previousQuestions.length,questions:3}};
}
export default async function handler(req,res){
 const send=(status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(data);};
 if(req.method==='GET')return send(200,{version:WORKBOOK_VERSION,configured:!!process.env.OPENAI_API_KEY,questions:3});
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{code:'method'});}
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return send(403,{code:'origin'});}catch{return send(403,{code:'origin'});}}
 if(!String(req.headers['content-type']||'').includes('application/json'))return send(415,{code:'content_type'});
 let body;try{const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(!raw||raw.length>120000)return send(413,{code:'size'});body=JSON.parse(raw);}catch{return send(400,{code:'json'});}
 const id=String(req.headers['x-forwarded-for']||'unknown').split(',')[0],now=Date.now();let bucket=limits.get(id);if(!bucket||now-bucket.at>60000)bucket={at:now,n:0};bucket.n++;limits.set(id,bucket);
 if(limits.size>1000)for(const[k,v]of limits)if(now-v.at>60000)limits.delete(k);
 if(bucket.n>3)return send(429,{code:'limit'});
 const {status,...data}=await runWorkbook(body);return send(status,data);
}
