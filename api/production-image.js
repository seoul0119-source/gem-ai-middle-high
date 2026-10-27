import {verifyReviewRequest} from '../lib/review-tutor.js';
import {productionImage} from '../lib/production-image.js';
function send(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(data));}
export default async function handler(req,res){
 res.setHeader('X-GEM-Image-Service','gem-production-image-v1');
 if(req.method!=='POST')return send(res,405,{service:'gem-production-image-v1',code:'method_not_allowed'});
 const p=await verifyReviewRequest(typeof req.body==='object'?req.body:null);
 if(!p||p.purpose!=='gem-materials-v1'||p.mode!=='production-image'||p.classroom!=='en')return send(res,401,{code:'invalid_image_signature'});
 console.info('gem-production-image-request',{job:p.job,index:p.index});
 try{const image=await productionImage(p);res.status(200).setHeader('Content-Type','image/png');res.setHeader('Content-Length',String(image.bytes.byteLength));res.setHeader('Cache-Control','no-store');return res.end(image.bytes);}
 catch(error){const code=['invalid_production_image','image_model_access_denied','image_rate_limited','image_result_too_large'].includes(error.message)?error.message:'image_unavailable';return send(res,code==='invalid_production_image'?400:code==='image_model_access_denied'?403:503,{code,...(error.diagnostic?{diagnostic:error.diagnostic}:{})});}
}
