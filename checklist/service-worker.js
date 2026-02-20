const CACHE = "za-ramki-checklist-v1";
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./service-worker.js",
  "../assets/img/logo.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => (k === CACHE) ? null : caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if(req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if(cached) return cached;
      return fetch(req).then((res) => {
        // Cache same-origin resources only
        try{
          const url = new URL(req.url);
          if(url.origin === location.origin){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
        }catch(_){}
        return res;
      }).catch(() => cached);
    })
  );
});
