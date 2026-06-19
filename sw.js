const ZR_CACHE_VERSION = "2026-06-19-11";
const ZR_STATIC_CACHE = "zr-static-" + ZR_CACHE_VERSION;

const ZR_STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles.rebuild.css",
  "./styles.editorial.css",
  "./colors.css",
  "./theme.css",
  "./assets/img/logo.png",
  "./assets/favicon/favicon-96x96.png",
  "./assets/favicon/favicon.svg",
  "./assets/favicon/apple-touch-icon.png",
  "./assets/icons/icon-push.png",
  "./assets/fonts/Manasco.woff2",
  "./js/config.js",
  "./js/vendor/supabase-js-2.js",
  "./js/utils/supabase_client.js",
  "./js/services/zr_backend_provider.js",
  "./js/services/zr_backend_core.js",
  "./js/services/zr_backend_projects.js",
  "./js/services/zr_backend_people.js",
  "./js/services/zr_backend_kb.js",
  "./js/services/zr_backend_push.js",
  "./js/services/zr_backend_task_meta.js",
  "./js/services/zr_backend_task_checklists.js",
  "./js/services/zr_backend_task_content.js",
  "./js/services/zr_backend_tasks.js",
  "./js/services/zr_backend.js",
  "./js/api.js",
  "./js/router.js",
  "./js/utils/viewer_nav.js",
  "./js/utils/favorites.js",
  "./js/utils/push.js",
  "./js/utils/planner_push_sender.js",
  "./js/utils/update_checker.js",
  "./js/app.js"
];

function isSameOrigin(request){
  try{
    return new URL(request.url).origin === self.location.origin;
  }catch(e){
    return false;
  }
}

function isStaticRequest(request){
  if(request.method !== "GET") return false;
  if(!isSameOrigin(request)) return false;

  const url = new URL(request.url);
  const path = url.pathname;

  if(path.endsWith("/version.json")) return false;
  if(path.includes("/rest/v1/")) return false;
  if(path.includes("/auth/v1/")) return false;
  if(path.includes("/storage/v1/")) return false;
  if(path.includes("/functions/v1/")) return false;

  return (
    path === "/" ||
    path.endsWith("/index.html") ||
    path.endsWith("/manifest.json") ||
    path.endsWith(".css") ||
    path.endsWith(".js") ||
    path.endsWith(".png") ||
    path.endsWith(".webp") ||
    path.endsWith(".svg") ||
    path.endsWith(".ico") ||
    path.endsWith(".webmanifest") ||
    path.endsWith(".ttf") ||
    path.endsWith(".otf") ||
    path.endsWith(".woff2")
  );
}

async function cacheStaticAssets(){
  const cache = await caches.open(ZR_STATIC_CACHE);
  await cache.addAll(ZR_STATIC_ASSETS);
}

function isShellRequest(request){
  if(request.method !== "GET") return false;
  if(!isSameOrigin(request)) return false;

  const url = new URL(request.url);
  return request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheStaticAssets().catch((err) => {
      console.warn("[SW] static cache install skipped", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.indexOf("zr-static-") === 0 && key !== ZR_STATIC_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if(!isStaticRequest(request)) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if(response && response.ok){
            const copy = response.clone();
            caches.open(ZR_STATIC_CACHE).then((cache) => {
              cache.put(request, copy).catch(() => {});
            });
          }

          return response;
        })
        .catch(() => cached);

      if(isShellRequest(request)){
        return network || cached;
      }

      return cached || network;
    })
  );
});

function parsePushPayload(event){
  try{
    if(!event || !event.data) return {};
    const text = event.data.text();
    if(!text) return {};
    return JSON.parse(text);
  }catch(e){
    try{
      return { body: event.data.text() };
    }catch(err){
      return {};
    }
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);

  const title = payload.title || "ZA RAMKI";
  const body = payload.body || "Новое уведомление";
  const url = payload.url || "./#/planner";

    const options = {
      body: body,
      icon: "/assets/icons/icon-push.png",
      badge: "/assets/icons/icon-push.png",
      tag: payload.tag || "zr-push",
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: {
        url: url
      }
    };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const relUrl = (event.notification && event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : "./#/planner";

  const absUrl = new URL(relUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for(const client of clientsArr){
        try{
          if("focus" in client){
            if(client.url === absUrl){
              return client.focus();
            }
            if(client.url.indexOf(self.location.origin) === 0 && "navigate" in client){
              return client.navigate(absUrl).then(() => client.focus());
            }
          }
        }catch(e){}
      }

      if(self.clients.openWindow){
        return self.clients.openWindow(absUrl);
      }
    })
  );
});
