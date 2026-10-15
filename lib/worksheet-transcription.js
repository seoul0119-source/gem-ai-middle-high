import {AiServiceError,aiServiceUnavailable,providerAiServiceError} from './ai-service-error.js';

const MIME_EXTENSIONS={'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','video/mp4':'mp4','audio/wav':'wav','audio/mpeg':'mp3'};
const TRANSCRIPTION_DEADLINE_MS=48000;
const TRANSCRIPTION_PROMPT='한국어 수업에서 학생이 한국어나 영어로 답하거나 질문합니다. A(에이), B(비), C(씨), D(디), 1번, 2번, 3번, 4번을 들린 그대로 받아쓰세요. 영어 보기나 문장은 영어로 보존하고 번역하지 마세요. Transcribe only the spoken Korean or English words. Preserve questions, uncertainty and negation. Do not answer the question, choose an option, complete a blank, or invent speech during silence.';
const FRENCH_TRANSCRIPTION_PROMPT='Transcrivez uniquement les paroles prononcées en français par un élève pendant un cours. Conservez la langue française originale, les lettres des choix A (a), B (bé), C (cé), D (dé), les nombres, les fractions, les questions, les hésitations et les négations. Ne traduisez rien. Ne répondez pas à une question, ne résolvez aucun exercice, ne choisissez aucune réponse et ne complétez pas une phrase. N’inventez aucune parole pendant un silence.';

function frenchCompatibilityFailure(response,data){
 if(response.ok||![400,403,404].includes(response.status))return false;
 const code=data?.error?.code,param=data?.error?.param;
 return ['model_not_found','unsupported_model','model_not_supported','model_not_available'].includes(code)||
  (param==='model'&&code==='invalid_request_error')||
  (['unsupported_parameter','unknown_parameter'].includes(code)&&['model','languages','languages[]','keywords','keywords[]'].includes(param));
}

// This entry point is reachable only after the worksheet server's ECDSA
// signature has been verified. Vocabulary is public, equally weighted context;
// neither the answer key nor the question to solve is passed to transcription.
export async function worksheetTranscription(payload,fetcher=fetch){
 const mime=String(payload.mimeType||'').split(';')[0].trim().toLowerCase();
 if(payload.purpose!=='gem-materials-v1'||payload.mode!=='transcribe'||payload.classroom!=='en'||!['ko','fr'].includes(payload.language)||!MIME_EXTENSIONS[mime]||typeof payload.audio!=='string'||payload.audio.length>1_340_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.audio)||!Array.isArray(payload.vocabulary)||payload.vocabulary.length>32||payload.vocabulary.some(v=>typeof v!=='string'||!v.trim()||v.length>100))throw Error('invalid_transcription');
 const french=payload.language==='fr';
 const prompt=french?FRENCH_TRANSCRIPTION_PROMPT:TRANSCRIPTION_PROMPT;
 const bytes=Buffer.from(payload.audio,'base64');
 if(bytes.length<100||bytes.length>1_000_000)throw Error('invalid_transcription');
 if(!process.env.OPENAI_API_KEY)throw new AiServiceError(aiServiceUnavailable());
 // The API rejects an entire request for a keyword containing CR/LF or angle
 // brackets. Keep public terms on one line and omit comparisons rather than
 // silently changing their mathematical meaning.
 const vocabulary=[...new Set(payload.vocabulary.map(word=>word.replace(/[\r\n]+/g,' ').trim()).filter(word=>word&&!/[<>]/.test(word)))];
 // One deadline covers both models and reading their response bodies. A slow
 // primary must not leave another 45 seconds for the compatibility request.
 const signal=AbortSignal.timeout(TRANSCRIPTION_DEADLINE_MS);
 const request=async model=>{
  try{
  signal.throwIfAborted();
  const form=new FormData();
  form.append('file',new Blob([bytes],{type:mime}),'student.'+MIME_EXTENSIONS[mime]);
  form.append('model',model);form.append('response_format','json');form.append('prompt',prompt);
  // A fixed ko-KR browser recognizer loses English choices. The primary model
  // receives both languages; the compatibility model detects either itself.
  // French classroom speech stays French in both provider request formats.
  if(model==='gpt-transcribe'){
   for(const language of french?['fr']:['ko','en'])form.append('languages[]',language);
   for(const word of vocabulary)form.append('keywords[]',word);
  }else if(french)form.append('language','fr');
  const response=await fetcher('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal});
  const data=await response.json();
  signal.throwIfAborted();
  if(response.ok&&typeof data?.text!=='string')throw Error('invalid_provider_response');
  return {response,data};
  }catch{throw new AiServiceError(aiServiceUnavailable());}
 };
 let model='gpt-transcribe',result=await request(model);
 const known=!result.response.ok&&providerAiServiceError(result.response.status,result.data);
 if(known)throw new AiServiceError(known);
 // A French recording gets at most one compatibility request, only when the
 // provider explicitly rejects the model or its optional context fields.
 // Silence, invalid audio, permissions, billing, rate limits and outages must
 // not incur a second paid transcription attempt.
 const compatibility=french?frenchCompatibilityFailure(result.response,result.data):!result.response.ok&&[400,403,404].includes(result.response.status);
 if(compatibility||(!french&&result.response.ok&&!result.data?.text?.trim())){model='gpt-4o-transcribe';result=await request(model);}
 if(!result.response.ok)throw new AiServiceError(providerAiServiceError(result.response.status,result.data)||aiServiceUnavailable());
 const text=typeof result.data?.text==='string'?result.data.text.trim():'';
 if(!text||text.length>1800||/(.)\1{8,}/u.test(text)||/Transcribe only the spoken|Do not answer the question|들린 그대로 받아쓰세요|번역하지 마세요|Transcrivez uniquement les paroles|Ne traduisez rien|Ne répondez pas à une question|N’inventez aucune parole/.test(text))throw Error('speech_not_heard');
 return {text,provider:'openai',model};
}

