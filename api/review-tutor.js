import {handleMaterials} from '../lib/materials-ai.js';
import {verifyReviewRequest,reviewModelRequest,reviewOutput} from '../lib/review-tutor.js';
import {providerAiServiceError,AiServiceError} from '../lib/ai-service-error.js';
function send(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{code:'method_not_allowed'});
 const body=typeof req.body==='object'?req.body:null;
 const payload=await verifyReviewRequest(body);
 if(!payload)return send(res,401,{code:'invalid_review_signature'});
 if(payload.purpose==='gem-materials-v1'){
  if(payload.classroom!=='en')return send(res,403,{code:'invalid_material_classroom'});
  try{return send(res,200,await handleMaterials(payload));}catch(error){if(error instanceof AiServiceError)return send(res,error.status,error.payload);return send(res,503,{code:'materials_unavailable',error:error.message});}
 }
 if(!payload.message?.trim()||!payload.question?.prompt)return send(res,400,{code:'invalid_review_message'});
 if(!process.env.OPENAI_API_KEY)return send(res,503,{code:'ai_service_unavailable'});
 try{
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(reviewModelRequest(payload)),signal:AbortSignal.timeout(45000)});
 const data=await response.json();
 if(!response.ok){const known=providerAiServiceError(response.status,data);return send(res,known?.status||503,{code:known?.payload.code||'ai_service_unavailable'});}
 const text=reviewOutput(data);
 if(!text||data.status==='incomplete')return send(res,503,{code:'ai_service_unavailable'});
 return send(res,200,{text});
 }catch{return send(res,503,{code:'ai_service_unavailable'});}
}
