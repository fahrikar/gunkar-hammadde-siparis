/* Günkar Sipariş — service worker.

   Amaç: ana ekrana eklenen uygulama, silinip yeniden kurulmadan güncellensin.
   Strateji "ağ önce": her istek önce sunucudan denenir, başarılı olursa
   önbelleğe de yazılır. Ağ yoksa önbellekten sunulur — yani uygulama
   çevrimdışı da çalışmaya devam eder ama internet varken hep son sürümü alır.

   Sürüm değiştiğinde APP_VERSION (index.html) ile birlikte güncellenmeli;
   tarayıcı bu dosyadaki farkı görünce yeni sürümü indirir ve sayfa
   "Yeni sürüm hazır" çubuğunu gösterir. */
const VERSION="2026-08-07.1";
const CACHE="gunkar-"+VERSION;
const ASSETS=["./","./index.html","./jszip.min.js"];

self.addEventListener("install",e=>{
  /* Ön yükleme başarısız olursa kurulum yine de sürsün; eksikler ilk
     istekte ağdan gelip önbelleğe yazılır. */
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Sayfa "Yenile"ye basınca bekleyen sürüm hemen devreye girer.
   skipWaiting'i kurulumda değil burada çağırıyoruz: kullanıcı form
   doldururken sayfa kendiliğinden yenilenip veri kaybolmasın. */
self.addEventListener("message",e=>{
  if(e.data&&e.data.type==="skipWaiting")self.skipWaiting();
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  if(new URL(req.url).origin!==self.location.origin)return;
  e.respondWith((async()=>{
    try{
      /* Sayfanın kendisi tarayıcı önbelleğine takılmasın diye no-store;
         diğer dosyalar ETag ile doğrulanır (değişmediyse 304, bedava). */
      const fresh=req.mode==="navigate"?await fetch(req,{cache:"no-store"}):await fetch(req);
      if(fresh&&fresh.ok&&fresh.type==="basic"){
        const c=await caches.open(CACHE);
        c.put(req,fresh.clone());
      }
      return fresh;
    }catch(err){
      const hit=await caches.match(req);
      if(hit)return hit;
      if(req.mode==="navigate"){
        const idx=await caches.match("./index.html");
        if(idx)return idx;
      }
      throw err;
    }
  })());
});
