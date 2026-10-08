import crypto from 'node:crypto';
import {SUPPORT_PUBLIC_KEY} from '../lib/support-public-key.js';
import {discover,inspectBook,allowedUrl,acceptReview} from '../lib/library-core.js';
const send=(res,status,data)=>{res.status(status);res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
export async function verifyLibraryRequest(body) {
 try {if(typeof body?.payload!=='string'||body.payload.length>15000||typeof body.signature!=='string')return null;
 const key=crypto.createPublicKey({key:SUPPORT_PUBLIC_KEY,format:'jwk'});
 if(!crypto.verify('sha256',Buffer.from(body.payload),{key,dsaEncoding:'ieee-p1363'},Buffer.from(body.signature,'base64url')))return null;
 const p=JSON.parse(body.payload);if(p.purpose!=='gem-library-v1'||!Number.isSafeInteger(p.timestamp)||Math.abs(Date.now()-p.timestamp)>120000)return null;
 if(!['discover','inspect'].includes(p.action))return null;
 if(p.action==='inspect'&&!allowedUrl(p.url))return null;
 if(p.action==='discover'&&(!Array.isArray(p.excluded)||p.excluded.length>5000||p.excluded.some(x=>typeof x!=='string'||x.length>250)))return null;
 return p;}catch{return null;}
}
export async function makeNarration(book,key,fetcher=fetch) {
 if(!acceptReview(book,book.review))return null;
 const text=book.review.pageTexts.filter(Boolean).join('\n\n');
 if(text.length>12000)return null;
 const r=await fetcher('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'marin',input:text,instructions:'Read this English children’s book in clear, warm natural English. Read only the supplied story. Do not translate or add words.',response_format:'mp3'}),signal:AbortSignal.timeout(60000)});
 if(!r.ok)return null;const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>2500000)return null;return bytes.toString('base64');
}
export default async function handler(req,res) {
 if(req.method==='GET')return send(res,200,{service:'gem-library-v1',configured:!!process.env.OPENAI_API_KEY});
 if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
 const p=await verifyLibraryRequest(req.body);if(!p)return send(res,403,{error:'invalid_library_request'});
 try {
  if(p.action==='discover')return send(res,200,{urls:await discover(p.excluded)});
  if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'ai_unavailable'});
  const book=await inspectBook(p.url,process.env.OPENAI_API_KEY);
  let audio=null;try{audio=await makeNarration(book,process.env.OPENAI_API_KEY);}catch{}
  return send(res,200,{book,audio});
 }catch(e){console.error('library-job',e.message);return send(res,503,{error:'book_review_failed'});}
}
