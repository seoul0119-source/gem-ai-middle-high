// Preview-only static lesson cache. No login, API, audio recordings or student data.
const CACHE='gem-g2-shell-v1',FILES=['./','./index.html','./style.css','./app.mjs','./lesson.mjs','./avatar.bundle.js','./teacher-preview.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(FILES);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin)return;const path=url.pathname;if(!FILES.some(f=>new URL(f,location.href).pathname===path))return;event.respondWith((async()=>{const c=await caches.open(CACHE),saved=await c.match(event.request,{ignoreSearch:true});if(saved)return saved;return fetch(event.request);})());});
