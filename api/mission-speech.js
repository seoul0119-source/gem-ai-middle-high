// Programme-only, opt-in speech. No API key or recordings are stored in the client.
export const config={maxDuration:60};
const languages={en:'English',fr:'French',ne:'Nepali',ur:'Urdu',sw:'Swahili'};
const types={'audio/webm':'webm','audio/mp4':'mp4','audio/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav'};
const buckets=new Map();
export async function runSpeech(body,{fetchImpl=fetch,key=process.env.OPENAI_API_KEY}={}){
 if(!body||!Object.hasOwn(languages,body.lang)||!['speak','transcribe'].includes(body.action)||body.consent!==true)return {status:400,code:'invalid_request'};
 let payload,endpoint,headers={Authorization:`Bearer ${key}`};
 if(body.action==='speak'){
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>3000)return {status:400,code:'invalid_text'};
  endpoint='speech';headers['Content-Type']='application/json';
  payload=JSON.stringify({model:'gpt-4o-mini-tts',voice:'coral',input:body.text,response_format:'mp3',instructions:`Read only the supplied text in ${languages[body.lang]}. Speak clearly and slowly for school learners. Do not translate or add words.`});
 }else{
  const mime=String(body.mime||'').split(';')[0];
  if(!types[mime]||typeof body.audio!=='string'||body.audio.length>2800000||!body.audio.length||body.audio.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.audio))return {status:400,code:'invalid_audio'};
  const bytes=Buffer.from(body.audio,'base64');if(bytes.length<100||bytes.length>2000000)return {status:400,code:'invalid_audio'};
  payload=new FormData();payload.append('file',new Blob([bytes],{type:mime}),'recording.'+types[mime]);payload.append('model','whisper-1');payload.append('language',body.lang);payload.append('response_format','verbose_json');payload.append('temperature','0');endpoint='transcriptions';
 }
 if(!key)return {status:503,code:'not_configured'};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
 try{
  const response=await fetchImpl('https://api.openai.com/v1/audio/'+endpoint,{method:'POST',headers,body:payload,signal:controller.signal});
  if(!response.ok){console.warn('GEM speech provider status',body.action,response.status);return {status:response.status===429?429:502,code:'provider_error'};}
  if(body.action==='speak'){
   const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>3000000)return {status:502,code:'invalid_audio'};
   return {status:200,audio:bytes.toString('base64'),mime:'audio/mpeg'};
  }
  const value=await response.json();
  if(Number(value.duration)>35)return {status:400,code:'too_long'};
  const silent=Array.isArray(value.segments)&&value.segments.length>0&&value.segments.every(s=>Number(s.no_speech_prob)>.7);
  const text=typeof value.text==='string'?value.text.trim():'';
  if(silent||!text)return {status:422,code:'no_speech'};
  if(text.length>450)return {status:422,code:'too_long'};
  return {status:200,text};
 }catch(error){return {status:503,code:error.name==='AbortError'?'timeout':'network'};}finally{clearTimeout(timer);}
}
export default async function handler(req,res){
 const send=(status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(data);};
 if(req.method==='GET')return send(200,{version:'programme-speech-v1',configured:!!process.env.OPENAI_API_KEY,languages:Object.keys(languages)});
 if(req.method!=='POST')return send(405,{code:'method'});
 // Browser-only endpoint: require a matching origin, plus explicit client consent.
 try{if(new URL(req.headers.origin).host!==req.headers.host)return send(403,{code:'origin'});}catch{return send(403,{code:'origin'});}
 if(!String(req.headers['content-type']||'').includes('application/json'))return send(415,{code:'content_type'});
 let body;try{const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(!raw||raw.length>2850000)return send(413,{code:'size'});body=JSON.parse(raw);}catch{return send(400,{code:'json'});}
 const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0],now=Date.now(),b=buckets.get(ip)||{at:now,n:0};if(now-b.at>60000){b.at=now;b.n=0;}if(++b.n>24)return send(429,{code:'limit'});buckets.set(ip,b);if(buckets.size>2000)for(const[k,v]of buckets)if(now-v.at>60000)buckets.delete(k);
 const {status,...data}=await runSpeech(body);return send(status,data);
}
