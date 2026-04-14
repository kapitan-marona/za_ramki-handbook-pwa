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
      return (window.App && App.session && App.session.role)
        ? App.session.role
        : null;
    }catch(e){
      return null;
    }
  }

  function getLocalPushPrefKey(endpoint){
    try{
      var userId = String(getCurrentUserId() || "anon");
      var ep = String(endpoint || "no-endpoint");
      return "zr_push_pref::" + userId + "::" + ep;
    }catch(e){
      return "zr_push_pref::fallback";
    }
  }

  function readLocalPushPref(endpoint){
    try{
      var raw = localStorage.getItem(getLocalPushPrefKey(endpoint));
      if(raw === "on") return true;
      if(raw === "off") return false;
      return null;
    }catch(e){
      return null;
    }
  }

  function writeLocalPushPref(endpoint, isActive){
    try{
      localStorage.setItem(getLocalPushPrefKey(endpoint), isActive ? "on" : "off");
    }catch(e){}
  }

  function clearLocalPushPref(endpoint){
    try{
      localStorage.removeItem(getLocalPushPrefKey(endpoint));
    }catch(e){}
  }

  function serializeSubscription(sub, overrides){
    if(!sub) return null;

    const o = overrides || {};
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
      is_active: (typeof o.is_active === "boolean") ? o.is_active : true,
      updated_at: new Date().toISOString()
    };
  }

  async function getCurrentBrowserSubscription(){
    if(!isSupported()) return null;

    try{
      const reg = await ensureServiceWorker();
      if(!reg) return null;
      return await reg.pushManager.getSubscription();
    }catch(e){
      console.warn("[Push] get browser subscription failed", e);
      return null;
    }
  }

  async function fetchSubscriptionRowByEndpoint(endpoint){
    if(!window.SB || !endpoint) return null;

    try{
      const { data, error } = await SB
        .from("push_subscriptions")
        .select("endpoint,is_active,user_id,user_role,updated_at")
        .eq("endpoint", endpoint)
        .maybeSingle();

      if(error) throw error;
      return data || null;
    }catch(e){
      console.warn("[Push] backend state fetch failed", e);
      return null;
    }
  }

  async function registerSubscriptionWithBackend(sub, opts){
    if(!sub) return { ok:false, reason:"no-subscription" };
    if(!window.SB) return { ok:false, reason:"no-supabase" };

    try{
      const o = opts || {};
      const existingRow = Object.prototype.hasOwnProperty.call(o, "existingRow")
        ? o.existingRow
        : await fetchSubscriptionRowByEndpoint(sub.endpoint || "");

      const desiredActive = (typeof o.isActive === "boolean")
        ? o.isActive
        : (existingRow && typeof existingRow.is_active === "boolean")
          ? !!existingRow.is_active
          : true;

      const row = serializeSubscription(sub, { is_active: desiredActive });
      if(!row || !row.endpoint) return { ok:false, reason:"bad-subscription" };

      const { error } = await SB
        .from("push_subscriptions")
        .upsert([row], { onConflict: "endpoint" });

      if(error) throw error;

      return {
        ok:true,
        row: row
      };
    }catch(e){
      console.warn("[Push] backend registration failed", e);
      return { ok:false, reason:"backend-registration-failed", error:e };
    }
  }

  async function getCurrentSubscriptionState(){
    const supported = isSupported();
    const permission = getPermissionState();

    if(!supported){
      return {
        ok:true,
        supported:false,
        permission: permission,
        hasSubscription:false,
        backendKnown:false,
        isActive:false
      };
    }

    try{
      const sub = await getCurrentBrowserSubscription();
      const endpoint = sub && sub.endpoint ? String(sub.endpoint) : "";
      const backendRow = endpoint ? await fetchSubscriptionRowByEndpoint(endpoint) : null;
      const localPref = endpoint ? readLocalPushPref(endpoint) : null;

      const backendKnown = !!backendRow;
      const backendActive = !!(backendRow && backendRow.is_active === true);

      let effectiveActive = false;

      if(endpoint){
        if(backendKnown){
          effectiveActive = backendActive;
        }else if(localPref === true || localPref === false){
          effectiveActive = !!localPref;
        }
      }

      return {
        ok:true,
        supported:true,
        permission: permission,
        hasSubscription: !!endpoint,
        endpoint: endpoint || "",
        backendKnown: backendKnown,
        backendActive: backendActive,
        localPref: localPref,
        isActive: !!endpoint && effectiveActive
      };
    }catch(e){
      console.warn("[Push] current state read failed", e);
      return {
        ok:false,
        supported:true,
        permission: permission,
        hasSubscription:false,
        backendKnown:false,
        isActive:false,
        error:e
      };
    }
  }

  async function setCurrentSubscriptionActive(isActive){
    if(!window.SB) return { ok:false, reason:"no-supabase" };
    if(!isSupported()) return { ok:false, reason:"unsupported" };

    try{
      const sub = await getCurrentBrowserSubscription();
      if(!sub || !sub.endpoint){
        return { ok:false, reason:"no-subscription" };
      }

      const existingRow = await fetchSubscriptionRowByEndpoint(sub.endpoint || "");
      const backend = await registerSubscriptionWithBackend(sub, {
        existingRow: existingRow,
        isActive: !!isActive
      });

      if(!backend || !backend.ok){
        return backend || { ok:false, reason:"backend-registration-failed" };
      }

      writeLocalPushPref(sub.endpoint, !!isActive);

      return {
        ok:true,
        endpoint: sub.endpoint,
        is_active: !!isActive
      };
    }catch(e){
      console.warn("[Push] set active failed", e);
      return { ok:false, reason:"set-active-failed", error:e };
    }
  }

  async function deactivateCurrentSubscription(opts){
    if(!window.SB) return { ok:false, reason:"no-supabase" };
    if(!isSupported()) return { ok:false, reason:"unsupported" };

    const o = opts || {};
    const shouldUnsubscribe = !!o.unsubscribe;

    try{
      const sub = await getCurrentBrowserSubscription();
      if(!sub || !sub.endpoint) return { ok:true, skipped:true };

      const soft = await setCurrentSubscriptionActive(false);
      if(!soft || !soft.ok) return soft || { ok:false, reason:"deactivate-failed" };

      if(shouldUnsubscribe){
        try{
          clearLocalPushPref(sub.endpoint);
          await sub.unsubscribe();
        }catch(unsubErr){
          console.warn("[Push] unsubscribe failed", unsubErr);
        }
      }else{
        writeLocalPushPref(sub.endpoint, false);
      }

      return {
        ok:true,
        endpoint: sub.endpoint,
        unsubscribed: shouldUnsubscribe
      };
    }catch(e){
      console.warn("[Push] deactivate failed", e);
      return { ok:false, reason:"deactivate-failed", error:e };
    }
  }

  async function hasActiveCurrentSubscription(){
    try{
      const state = await getCurrentSubscriptionState();
      return !!(state && state.isActive);
    }catch(e){
      console.warn("[Push] active subscription check failed", e);
      return false;
    }
  }

  async function requestPermissionInteractive(){
    if(!isSupported()) return "unsupported";
    return await Notification.requestPermission();
  }

  async function subscribeCurrentUser(opts){
    if(!isSupported()) return { ok:false, reason:"unsupported" };
    if(!getCurrentUserId()) return { ok:false, reason:"no-user" };

    const o = opts || {};
    const activate = (typeof o.activate === "boolean") ? o.activate : true;

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

      const backend = await registerSubscriptionWithBackend(sub, {
        isActive: activate
      });

      if(backend && backend.ok){
        writeLocalPushPref(sub.endpoint, !!activate);
      }

      return {
        ok: !!(backend && backend.ok),
        subscription: serializeSubscription(sub, { is_active: activate }),
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
      const sub = await getCurrentBrowserSubscription();
      if(!sub) return { ok:true, skipped:true, reason:"no-existing-subscription" };

      const existingRow = await fetchSubscriptionRowByEndpoint(sub.endpoint || "");
      const localPref = readLocalPushPref(sub.endpoint || "");

      const preservedActive = (existingRow && typeof existingRow.is_active === "boolean")
        ? !!existingRow.is_active
        : (localPref === true || localPref === false)
          ? !!localPref
          : false;

      const backend = await registerSubscriptionWithBackend(sub, {
        existingRow: existingRow,
        isActive: preservedActive
      });

      if(backend && backend.ok){
        writeLocalPushPref(sub.endpoint, !!preservedActive);
      }

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
    deactivateCurrentSubscription: deactivateCurrentSubscription,
    hasActiveCurrentSubscription: hasActiveCurrentSubscription,
    getCurrentBrowserSubscription: getCurrentBrowserSubscription,
    getCurrentSubscriptionState: getCurrentSubscriptionState,
    setCurrentSubscriptionActive: setCurrentSubscriptionActive
  };
})();


window.syncPushUI = async function(){
  try{
    var btn = document.querySelector("#pushBtn");
    if(!btn) return;

    function bellIcon(){
      var common = 'width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"';
      return '<svg ' + common + '><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6-1.38-2.32a4.2 4.2 0 0 1-.62-2.12V9a5 5 0 1 0-10 0v2.56c0 .75-.21 1.49-.62 2.12L5 16h14z"/></svg>';
    }

    function applyBell(state, pressed, disabled, label){
      btn.disabled = !!disabled;
      btn.innerHTML = bellIcon();
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
      btn.classList.add("push-icon-btn");
      btn.classList.add("is-ready");
      btn.classList.toggle("is-on", state === "on");
      btn.classList.toggle("is-off", state === "off");
      btn.classList.toggle("is-disabled", !!disabled);
    }

    if(!window.ZRPush || !ZRPush.isSupported()){
      applyBell("off", false, true, "Уведомления недоступны");
      return;
    }

    var state = null;

    try{
      state = await ZRPush.getCurrentSubscriptionState();
    }catch(e){
      console.warn("[Push] current state read failed", e);
    }

    if(!state || state.supported === false){
      applyBell("off", false, true, "Уведомления недоступны");
      return;
    }

    if(state.permission === "denied"){
      applyBell("off", false, true, "Уведомления заблокированы");
      return;
    }

    if(state.isActive){
      applyBell("on", true, false, "Уведомления включены");
      return;
    }

    applyBell("off", false, false, "Уведомления выключены");
  }catch(e){
    console.warn("[Push] sync UI failed", e);
  }
};


