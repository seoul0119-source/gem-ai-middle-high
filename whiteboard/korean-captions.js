import {getBoardCourse} from './board-courses.js';

export function captionErrorMessage(error){
 const messages={
  ai_credit_exhausted:'번역 서비스 이용 한도에 도달했습니다. 선생님께 이용 한도 확인을 요청해 주세요.',
  ai_rate_limited:'번역 요청이 잠시 몰렸습니다. 잠시 후 ‘번역 다시 시도’를 눌러 주세요.',
  translation_configuration:'번역 서비스 설정을 확인해야 합니다. 이 화면을 선생님께 알려 주세요.',
  translation_membership:'회원 이용 상태를 확인하지 못했습니다. 잠시 후 ‘번역 다시 시도’를 눌러 주세요.',
  translation_timeout:'번역 응답 시간이 길어져 멈췄습니다. ‘번역 다시 시도’를 눌러 주세요.',
  translation_incomplete:'번역이 끝까지 도착하지 않았습니다. ‘번역 다시 시도’를 눌러 주세요.',
  translation_invalid_response:'번역 결과를 읽지 못했습니다. ‘번역 다시 시도’를 눌러 주세요.',
  invalid_translation:'번역할 설명을 확인하지 못했습니다. 이 화면을 선생님께 알려 주세요.'
 };
 if(error?.status===401)return '학생 ID로 다시 입장한 뒤 번역을 켜 주세요.';
 if(error?.status===403)return '회원 이용 권한을 확인하지 못했습니다. 학생 ID로 다시 입장해 주세요.';
 return messages[error?.code]||'번역 연결이 잠시 원활하지 않습니다. ‘번역 다시 시도’를 눌러 주세요.';
}

export async function requestBoardTranslation(course,texts,signal,fetcher=fetch){
 try{
  const response=await fetcher('/api/whiteboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pilot:'science',action:'translate',courseId:course.id,sourceLanguage:course.language,texts}),signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   const code=data.code||(/회원 이용 상태를 확인하지 못했습니다/.test(data.error||'')?'translation_membership':data.error);
   throw Object.assign(Error('translation_unavailable'),{status:response.status,code});
  }
  return data;
 }catch(error){
  if(error?.name==='TimeoutError')throw Object.assign(Error('translation_timeout'),{code:'translation_timeout'});
  throw error;
 }
}

// Translate a display copy only. The lesson, voice, answers and saved progress
// continue to use their original content and language.
export function mountKoreanCaptions({document,language,translate,storage,Observer=MutationObserver}){
 const card=document.querySelector('#korean-translation');
 if(!card||!['en','fr'].includes(language))return ()=>{};
 card.hidden=false;
 const button=card.querySelector('button'),retry=card.querySelector('[data-translation-retry]'),status=card.querySelector('[role="status"]'),panel=card.querySelector('.korean-caption-content');
 const cache=new Map();let enabled=false,disposed=false,failed=false,timer,abort,version=0,last='';
 try{enabled=storage?.getItem('gem-board-korean-v1')==='on';}catch{}
 const snapshot=()=>[
  ['현재 설명',document.querySelector('#scene-label')?.textContent?.trim()||''],
  ['선생님 설명',document.querySelector('#narration-text')?.textContent?.trim()||''],
  ['최근 질문',Array.from(document.querySelectorAll('#conversation .message.user span')).at(-1)?.textContent?.trim()||''],
  ['선생님 답변',Array.from(document.querySelectorAll('#conversation .message.assistant span')).at(-1)?.textContent?.trim()||'']
 ].filter(([,text])=>text);
 function controls(){button.textContent=enabled?'한국어 번역 끄기':'한국어 번역 켜기';button.setAttribute('aria-pressed',String(enabled));panel.hidden=!enabled||!panel.children.length;}
 async function update(){
  if(!enabled||disposed||failed)return;
  const parts=snapshot(),key=JSON.stringify(parts);if(key===last)return;last=key;
  if(!parts.length){status.textContent='설명이 준비되면 한국어로 번역합니다.';return;}
  const current=++version;abort?.abort();abort=new AbortController();
  panel.replaceChildren();status.textContent='한국어로 번역 중…';
  try{
   const texts=[...new Set(parts.map(([,text])=>text).filter(text=>!cache.has(text)))];
   if(texts.length){
    const data=await translate(texts,abort.signal);
    if(!Array.isArray(data.translations)||data.translations.length!==texts.length||data.translations.some(t=>typeof t!=='string'||!t.trim()))throw Object.assign(Error('invalid_translation'),{code:'translation_invalid_response'});
    if(disposed||!enabled||current!==version)return;
    if(cache.size>200)cache.clear();texts.forEach((text,i)=>cache.set(text,data.translations[i]));
   }
   if(disposed||!enabled||current!==version)return;
   // Never label an earlier response as the currently visible scene.
   if(JSON.stringify(snapshot())!==key){last='';schedule();return;}
   for(const [label,text] of parts){const section=document.createElement('section'),title=document.createElement('strong'),p=document.createElement('p');title.textContent=label;p.textContent=cache.get(text)||text;section.append(title,p);panel.append(section);}
   panel.hidden=false;
   status.textContent='설명·답변이 바뀌면 자동으로 번역됩니다. 음성은 원래 언어로 재생됩니다.';
  }catch(error){if(!disposed&&enabled&&current===version){failed=true;panel.hidden=true;status.textContent=captionErrorMessage(error);if(retry)retry.hidden=[401,403].includes(error?.status)||['ai_credit_exhausted','translation_configuration','invalid_translation'].includes(error?.code);}}
 }
 function schedule(){if(!enabled||disposed||failed)return;const key=JSON.stringify(snapshot());if(key===last)return;version++;abort?.abort();panel.replaceChildren();panel.hidden=true;status.textContent='한국어로 번역 중…';clearTimeout(timer);timer=setTimeout(update,350);}
 if(retry)retry.onclick=()=>{failed=false;last='';retry.hidden=true;void update();};
 button.onclick=()=>{enabled=!enabled;failed=false;if(retry)retry.hidden=true;version++;abort?.abort();clearTimeout(timer);last='';panel.replaceChildren();controls();try{storage?.setItem('gem-board-korean-v1',enabled?'on':'off');}catch{}status.textContent=enabled?'한국어로 번역 중…':'설명과 질문·답변을 한국어로 볼 수 있습니다.';if(enabled)void update();};
 const observer=new Observer(schedule);
 for(const selector of ['#scene-label','#narration-text','#conversation']){const node=document.querySelector(selector);if(node)observer.observe(node,{childList:true,characterData:true,subtree:true});}
 controls();if(enabled)void update();
 return ()=>{disposed=true;version++;clearTimeout(timer);abort?.abort();observer.disconnect();};
}

if(typeof window!=='undefined'){
 const course=getBoardCourse(new URL(location.href).searchParams.get('course')||'h3-science');
 let storage;try{storage=window.localStorage;}catch{}
 const stop=mountKoreanCaptions({document,language:course?.language,storage,translate:(texts,signal)=>requestBoardTranslation(course,texts,signal)});
 window.addEventListener('pagehide',stop,{once:true});
}
