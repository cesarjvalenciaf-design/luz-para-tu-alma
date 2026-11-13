const CACHE='luz-alma-v4';
const ASSETS=['./','./index.html','./app.js','./config.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.allSettled(ASSETS.map(url=>cache.add(new Request(url,{cache:'reload'}))));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith('luz-alma-v')&&key!==CACHE).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(req);
      if(response.ok)cache.put(req,response.clone()).catch(()=>{});
      return response;
    } catch(error) {
      const saved=await caches.match(req,{ignoreSearch:true});
      if(saved)return saved;
      if(req.mode==='navigate'){
        const page=await cache.match('./index.html');
        if(page)return page;
      }
      throw error;
    }
  })());
});
