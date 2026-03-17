self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
