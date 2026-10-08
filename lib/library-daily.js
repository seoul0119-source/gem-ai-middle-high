import crypto from 'node:crypto';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const expected=process.env.CRON_SECRET,received=String(req.headers.authorization||'');
 if(req.method!=='GET'||!expected||received.length!==('Bearer '+expected).length||!crypto.timingSafeEqual(Buffer.from(received),Buffer.from('Bearer '+expected))){res.status(401).end('Unauthorized');return;}
 if(!process.env.GEM_LIBRARY_REFRESH_SECRET){res.status(503).end('Library refresh is not configured');return;}
 try{const r=await fetch('https://gem-ai-library.seoul0119.chatgpt.site/api/library/refresh',{method:'POST',headers:{Authorization:'Bearer '+process.env.GEM_LIBRARY_REFRESH_SECRET},signal:AbortSignal.timeout(280000)});const body=await r.json();res.status(body.status==='failed'?503:r.status).setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}catch{res.status(503).end('Refresh unavailable; last verified selection retained');}
}
