const CACHE='tsums-youya-v0641-control-layer-hardening';
const SHELL=['./','./index.html','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
async function networkFirst(r){const c=await caches.open(CACHE);try{const x=await fetch(new Request(r,{cache:'reload'}));if(x&&x.ok)c.put(r,x.clone());return x}catch(e){return(await c.match(r))||(await c.match('./index.html'))}}
async function cacheFirst(r){const c=await caches.open(CACHE),h=await c.match(r);if(h)return h;try{const x=await fetch(r);if(x&&x.ok)c.put(r,x.clone());return x}catch(e){return Response.error()}}
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url),nav=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('/index.html');e.respondWith(nav?networkFirst(e.request):cacheFirst(e.request));});