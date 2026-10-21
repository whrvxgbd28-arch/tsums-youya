const CACHE='tsums-youya-v0631-cache-hardened';
const SHELL=['./','./index.html','./manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const fresh=await fetch(new Request(request,{cache:'reload'}));
    if(fresh && fresh.ok) cache.put(request,fresh.clone());
    return fresh;
  }catch(err){
    return (await cache.match(request)) || (await cache.match('./index.html'));
  }
}

async function cacheFirst(request){
  const cache=await caches.open(CACHE);
  const hit=await cache.match(request);
  if(hit) return hit;
  try{
    const fresh=await fetch(request);
    if(fresh && fresh.ok) cache.put(request,fresh.clone());
    return fresh;
  }catch(err){
    return Response.error();
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  const url=new URL(event.request.url);
  const isNavigation=event.request.mode==='navigate';
  const isIndex=url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if(isNavigation || isIndex){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
