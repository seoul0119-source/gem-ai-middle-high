import {getBoardCourse} from './board-courses.js';

// Translate a display copy only. The lesson, voice, answers and saved progress
// continue to use their original content and language.
export function mountKoreanCaptions({document,language,translate,storage,Observer=MutationObserver}){
 const card=document.querySelector('#korean-translation');
 if(!card||!['en','fr'].includes(language))return ()=>{};
 card.hidden=false;
 const button=card.querySelector('button'),status=card.querySelector('[role="status"]'),panel=card.querySelector('.korean-caption-content');
 const cache=new Map();let enabled=false,disposed=false,timer,abort,version=0,last='';
 try{enabled=storage?.getItem('gem-board-korean-v1')==='on';}catch{}
 const snapshot=()=>[
  ['현재 설명',document.querySelector('#scene-label')?.textContent?.trim()||''],
  ['선생님 설명',document.querySelector('#narration-text')?.textContent?.trim()||''],
  ['최근 질문',Array.from(document.querySelectorAll('#conversation .message.user span')).at(-1)?.textContent?.trim()||''],
  ['선생님 답변',Array.from(document.querySelectorAll('#conversation .message.assistant span')).at(-1)?.textContent?.trim()||'']
 ].filter(([,text])=>text);
 function controls(){button.textContent=enabled?'한국어 번역 끄기':'한국어 번역 켜기';button.setAttribute('aria-pressed',String(enabled));panel.hidden=!enabled;}
 async function update(){
  if(!enabled||disposed)return;
  const parts=snapshot(),key=JSON.stringify(parts);if(key===last)return;last=key;
  const current=++version;abort?.abort();abort=new AbortController();
  panel.replaceChildren();status.textContent='한국어로 번역 중…';
  try{
   const texts=[...new Set(parts.map(([,text])=>text).filter(text=>!cache.has(text)))];
   if(texts.length){
    const data=await translate(texts,abort.signal);
    if(!Array.isArray(data.translations)||data.translations.length!==texts.length||data.translations.some(t=>typeof t!=='string'||!t.trim()))throw Error('invalid_translation');
    if(disposed||!enabled||current!==version)return;
    if(cache.size>200)cache.clear();texts.forEach((text,i)=>cache.set(text,data.translations[i]));
   }
   if(disposed||!enabled||current!==version)return;
   // Never label an earlier response as the currently visible scene.
   if(JSON.stringify(snapshot())!==key){last='';schedule();return;}
   for(const [label,text] of parts){const section=document.createElement('section'),title=document.createElement('strong'),p=document.createElement('p');title.textContent=label;p.textContent=cache.get(text)||text;section.append(title,p);panel.append(section);}
   status.textContent='설명·답변이 바뀌면 자동으로 번역됩니다. 음성은 원래 언어로 재생됩니다.';
  }catch(error){if(!disposed&&enabled&&current===version){last='';status.textContent=error?.status===401?'학생 ID로 다시 입장한 뒤 번역을 켜 주세요.':'번역을 불러오지 못했어요. 번역을 껐다가 다시 켜 주세요.';}}
 }
 function schedule(){if(!enabled||disposed)return;const key=JSON.stringify(snapshot());if(key===last)return;version++;abort?.abort();panel.replaceChildren();status.textContent='한국어로 번역 중…';clearTimeout(timer);timer=setTimeout(update,350);}
 button.onclick=()=>{enabled=!enabled;version++;abort?.abort();clearTimeout(timer);last='';panel.replaceChildren();controls();try{storage?.setItem('gem-board-korean-v1',enabled?'on':'off');}catch{}status.textContent=enabled?'한국어로 번역 중…':'설명과 질문·답변을 한국어로 볼 수 있습니다.';if(enabled)void update();};
 const observer=new Observer(schedule);
 for(const selector of ['#scene-label','#narration-text','#conversation']){const node=document.querySelector(selector);if(node)observer.observe(node,{childList:true,characterData:true,subtree:true});}
 controls();if(enabled)void update();
 return ()=>{disposed=true;version++;clearTimeout(timer);abort?.abort();observer.disconnect();};
}

if(typeof window!=='undefined'){
 const course=getBoardCourse(new URL(location.href).searchParams.get('course')||'h3-science');
 let storage;try{storage=window.localStorage;}catch{}
 const stop=mountKoreanCaptions({document,language:course?.language,storage,translate:async(texts,signal)=>{
  const response=await fetch('/api/whiteboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pilot:'science',action:'translate',courseId:course.id,sourceLanguage:course.language,texts}),signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'translation_unavailable'),{status:response.status});return data;
 }});
 window.addEventListener('pagehide',stop,{once:true});
}
