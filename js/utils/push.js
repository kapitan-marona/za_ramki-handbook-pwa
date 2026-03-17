window.ZRPush = (function(){
  const SW_URL = "./sw.js";

  function isSupported(){
    return !!(
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function getPermissionState(){
    if(!("Notification" in window)) return "unsupported";
    return Notification.permission || "default";
  }

  function getPublicVapidKey(){
    return String(window.PUSH_VAPID_PUBLIC_KEY || "").trim();
  }

  function urlBase64ToUint8Array(base64String){
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for(let i = 0; i < rawData.length; ++i){
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  async function ensureServiceWorker(){
    if(!isSupported()) return null;

    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "./" });
    await navigator.serviceWorker.ready;
    return reg;
  }

  function getCurrentUserId(){
    try{
      const u = window.App && App.session ? App.session.user : null;
      if(!u) return null;
      return u.id || null;
    }catch(e){
      return null;
    }
  }

  function getCurrentRole(){
    try{
      return (window.App && App.session && App.session.role) ? App.session.role : null;
    }catch(e){
      return null;
    }
  }

  function serializeSubscription(sub){
    if(!sub) return null;

    const json = sub.toJSON ? sub.toJSON() : {};
    const keys = json.keys || {};

    return {
      user_id: getCurrentUserId(),
      user_role: getCurrentRole(),
      endpoint: sub.endpoint || "",
      p256dh: keys.p256dh || "",
      auth: keys.auth || "",
      expiration_time: sub.expirationTime || null,
      ua: navigator.userAgent || "",
      language: navigator.language || "",
      is_active: true,
      updated_at: new Date().toISOString()
    };
  }

  async function registerSubscriptionWithBackend(sub){
    if(!sub) return { ok:false, reason:"no-subscription" };
    if(!window.SB) return { ok:false, reason:"no-supabase" };

    try{
      const row = serializeSubscription(sub);
      if(!row || !row.endpoint) return { ok:false, reason:"bad-subscription" };

      const { error } = await SB
        .from("push_subscriptions")
        .upsert([row], { onConflict: "endpoint" });

      if(error) throw error;

      return { ok:true };
    }catch(e){
      console.warn("[Push] backend registration failed", e);
      return { ok:false, reason:"backend-registration-failed", error:e };
    }
  }

  async function deactivateCurrentSubscription(){
    if(!window.SB) return { ok:false, reason:"no-supabase" };
    if(!isSupported()) return { ok:false, reason:"unsupported" };

    try{
      const reg = await ensureServiceWorker();
      if(!reg) return { ok:false, reason:"no-registration" };

      const sub = await reg.pushManager.getSubscription();
      if(!sub || !sub.endpoint) return { ok:true, skipped:true };

      const userId = getCurrentUserId();

      const q = SB
        .from("push_subscriptions")
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq("endpoint", sub.endpoint);

      const { error } = userId ? await q.eq("user_id", userId) : await q;

      if(error) throw error;
      return { ok:true };
    }catch(e){
      console.warn("[Push] deactivate failed", e);
      return { ok:false, reason:"deactivate-failed", error:e };
    }
  }

  async function requestPermissionInteractive(){
    if(!isSupported()) return "unsupported";
    return await Notification.requestPermission();
  }

  async function subscribeCurrentUser(){
    if(!isSupported()) return { ok:false, reason:"unsupported" };
    if(!getCurrentUserId()) return { ok:false, reason:"no-user" };

    const perm = getPermissionState();
    if(perm !== "granted") return { ok:false, reason:"permission-not-granted", permission:perm };

    const publicKey = getPublicVapidKey();
    if(!publicKey) return { ok:false, reason:"missing-vapid-key" };

    try{
      const reg = await ensureServiceWorker();
      if(!reg) return { ok:false, reason:"no-registration" };

      let sub = await reg.pushManager.getSubscription();

      if(!sub){
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      const backend = await registerSubscriptionWithBackend(sub);

      return {
        ok: true,
        subscription: serializeSubscription(sub),
        backend: backend
      };
    }catch(e){
      console.warn("[Push] subscribe failed", e);
      return { ok:false, reason:"subscribe-failed", error:e };
    }
  }

  async function syncExistingSubscription(){
    if(!isSupported()) return { ok:false, reason:"unsupported" };

    try{
      const reg = await ensureServiceWorker();
      if(!reg) return { ok:false, reason:"no-registration" };

      const sub = await reg.pushManager.getSubscription();
      if(!sub) return { ok:true, skipped:true, reason:"no-existing-subscription" };

      const backend = await registerSubscriptionWithBackend(sub);
      return { ok:true, backend:backend };
    }catch(e){
      console.warn("[Push] sync existing subscription failed", e);
      return { ok:false, reason:"sync-failed", error:e };
    }
  }

  return {
    isSupported: isSupported,
    getPermissionState: getPermissionState,
    getPublicVapidKey: getPublicVapidKey,
    ensureServiceWorker: ensureServiceWorker,
    requestPermissionInteractive: requestPermissionInteractive,
    subscribeCurrentUser: subscribeCurrentUser,
    syncExistingSubscription: syncExistingSubscription,
    deactivateCurrentSubscription: deactivateCurrentSubscription
  };
})();
