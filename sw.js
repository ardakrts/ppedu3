const VERSION='pedrapreta-v1.0.0-';
const CACHE=VERSION+self.registration.scope;
const BASE=new URL('./',self.location.href);
const FILES=['./','./index.html','./style.css','./app.js','./store.js','./seed.json','./manifest.webmanifest','./assets/cover.jpg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(p=>new URL(p,BASE).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pedrapreta-')&&k.endsWith(self.registration.scope)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{if(!response.ok)throw Error('Unavailable');const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(new URL('index.html',BASE),copy)));return response}).catch(()=>caches.match(new URL('index.html',BASE))));return;
 }
 event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
