export const PRODUCTION_IMAGE_MODEL='gpt-image-2';
export function validateProductionImage(p){
 return p?.purpose==='gem-materials-v1'&&p.mode==='production-image'&&p.classroom==='en'&&['ko','en','fr'].includes(p.language)&&/^[a-zA-Z0-9_-]{1,101}$/.test(p.job)&&Number.isInteger(p.index)&&p.index>=0&&p.index<5&&/^[a-f0-9]{64}$/.test(p.sourceHash)&&typeof p.prompt==='string'&&p.prompt.length>=100&&p.prompt.length<=12000&&Object.keys(p).every(k=>['purpose','mode','classroom','timestamp','language','job','index','sourceHash','prompt'].includes(k));
}
export async function productionImage(p,{fetcher=fetch,key=process.env.OPENAI_API_KEY}={}){
 if(!validateProductionImage(p))throw Error('invalid_production_image');if(!key)throw Error('image_unavailable');
 const r=await fetcher('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:PRODUCTION_IMAGE_MODEL,prompt:p.prompt,n:1,size:'1536x864',quality:'medium',output_format:'png'}),signal:AbortSignal.timeout(150000)});
 if(!r.ok){await r.body?.cancel();throw Error(r.status===403||r.status===404?'image_model_access_denied':r.status===429?'image_rate_limited':'image_unavailable');}
 const reader=r.body?.getReader();if(!reader)throw Error('image_unavailable');let text='',size=0;const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6000000){await reader.cancel();throw Error('image_result_too_large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
 const d=JSON.parse(text),encoded=d?.data?.[0]?.b64_json;if(typeof encoded!=='string'||!/^[A-Za-z0-9+/=]+$/.test(encoded))throw Error('image_unavailable');
 const bytes=Buffer.from(encoded,'base64');if(bytes.length<32||bytes.length>4*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==1536||bytes.readUInt32BE(20)!==864)throw Error('image_unavailable');
 return {bytes,model:PRODUCTION_IMAGE_MODEL};
}
