import {verifySupportRequest,supportModelRequest,supportOutput} from '../lib/support-assistant.js';
function send(res,status,data){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));}
export default async function handler(req,res){
  if(req.method==='GET')return send(res,200,{service:'gem-support-v1',configured:!!process.env.OPENAI_API_KEY});
  if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
  const payload=await verifySupportRequest(req.body);
  if(!payload)return send(res,403,{error:'invalid_support_request'});
  if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'support_unavailable'});
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(supportModelRequest(payload)),signal:AbortSignal.timeout(40000)});
    const data=await response.json();
    if(!response.ok)return send(res,503,{error:'support_unavailable'});
    const answer=supportOutput(data);
    if(!answer||data.status==='incomplete')return send(res,503,{error:'support_unavailable'});
    return send(res,200,{answer});
  }catch{return send(res,503,{error:'support_unavailable'});}
}
