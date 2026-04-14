window.App = window.App || { session: { user: null, role: null, ready: false } };

window.clearMainArea = function(){
  var v = document.querySelector("#viewer");
  var l = document.querySelector("#list");
  if(v) v.innerHTML = "";
  if(l) l.innerHTML = "";
};

window.fetchRole = async function(){
  if(!window.SB) return null;
  try{
    var r = await SB.rpc("get_role");
    if(r && !r.error && (r.data === "admin" || r.data === "staff")) return r.data;
  }catch(e){
    console.warn("[Auth] get_role failed", e);
  }
  return null;
};

window.syncRoleUI = function(){
  try{
    var isAdmin = !!(window.App && App.session && App.session.role === "admin");

    var adminTab = document.querySelector('.tab.zr-admin-tab[data-tab="admin"]');
    if(adminTab){
      adminTab.style.display = isAdmin ? "" : "none";
    }

    var checklistsTab = document.querySelector('.tab[data-tab="checklists"]');
    if(checklistsTab){
      checklistsTab.style.display = isAdmin ? "" : "none";
    }
  }catch(e){ console.warn("[app.js] silent catch", e); }
};


window.handlePushToggleClick = async function(){
  var pushBtn = null;

  try{
    if(window.__pushToggleBusy) return;
    window.__pushToggleBusy = true;

    pushBtn = document.querySelector("#pushBtn");
    if(pushBtn){
      pushBtn.classList.add("is-pending");
      pushBtn.disabled = true;
    }

    if(!window.ZRPush || !ZRPush.isSupported()){
      alert("Push не поддерживается в этом браузере.");
      return;
    }

    var state = null;

    try{
      if(typeof ZRPush.getCurrentSubscriptionState !== "function"){
        throw new Error("getCurrentSubscriptionState missing");
      }
      state = await ZRPush.getCurrentSubscriptionState();
    }catch(e){
      console.warn("[Push] state read failed", e);
      alert("Не удалось прочитать текущее состояние push.");
      return;
    }

    if(!state || state.supported === false){
      alert("Push не поддерживается в этом браузере.");
      return;
    }

    if(state.permission === "denied"){
      alert("Уведомления заблокированы в браузере.");
      return;
    }

    if(state.hasSubscription){
      var targetActive = !state.isActive;
      var toggleRes = await ZRPush.setCurrentSubscriptionActive(targetActive);

      if(!toggleRes || !toggleRes.ok){
        alert("Не удалось переключить уведомления. Проверь консоль.");
        return;
      }

      return;
    }

    var perm = state.permission;

    if(perm === "default"){
      perm = await ZRPush.requestPermissionInteractive();
    }

    if(perm !== "granted"){
      if(perm === "denied"){
        alert("Уведомления заблокированы в браузере.");
      }
      return;
    }

    var res = await ZRPush.subscribeCurrentUser({ activate: true });

    if(!res || !res.ok){
      if(res && res.reason === "missing-vapid-key"){
        alert("Foundation готов. Дальше нужен реальный PUSH_VAPID_PUBLIC_KEY.");
        return;
      }

      alert("Не удалось включить уведомления. Проверь консоль.");
      return;
    }
  }catch(e){
    console.warn("[Push] toggle flow failed", e);
    alert("Ошибка переключения push. Смотри консоль.");
  }finally{
    window.__pushToggleBusy = false;

    if(pushBtn){
      pushBtn.classList.remove("is-pending");
      pushBtn.disabled = false;
    }

    try{
      await window.syncPushUI();
    }catch(syncErr){
      console.warn("[Push] final UI sync failed", syncErr);
    }
  }
};

window.renderAuthArea = function(){
  var el = document.querySelector("#authArea");
  if(!el) return;

  if(!window.App || !App.session || !App.session.user){
    el.innerHTML = '<a href="#/login" class="btn btn-sm">Войти</a>';
    window.syncRoleUI();
    return;
  }

  el.innerHTML =
    '<div class="auth-group">' +
      '<span class="pill auth-role">' + (App.session.role || '—') + '</span>' +
      '<button type="button" class="btn btn-sm auth-push push-icon-btn is-off" id="pushBtn" aria-pressed="false"></button>' +
    '</div>' +
    '<button type="button" class="btn btn-sm auth-logout" id="logoutBtn">Выйти</button>';

  var pushBtn = document.querySelector("#pushBtn");
  if(pushBtn){
    pushBtn.onclick = async function(){
      await window.handlePushToggleClick();
    };
  }

  var btn = document.querySelector("#logoutBtn");
  if(btn){
    btn.onclick = async function(){
      try{
        if(window.ZRPush && ZRPush.deactivateCurrentSubscription){
          await ZRPush.deactivateCurrentSubscription({ unsubscribe: true });
        }
      }catch(e){ console.warn("[app.js] silent catch", e); }

      try{ if(window.SB && SB.auth) await SB.auth.signOut(); }catch(e){ console.warn("[app.js] silent catch", e); }
      try{ delete window.__plannerState; }catch(e){ console.warn("[app.js] silent catch", e); }
      App.session.user = null;
      App.session.role = null;
      App.session.ready = true;
      window.renderAuthArea();
      window.clearMainArea();
      window.syncRoleUI();
      if(window.Router) Router.go("login");
    };
  }

  window.syncRoleUI();
};

window.applySession = async function(user){
  App.session.user = user || null;
  App.session.role = null;

  if(App.session.user){
    var role = await window.fetchRole();
    App.session.role = role;

    // нет роли -> нет доступа
    if(!role){
      try{ await SB.auth.signOut(); }catch(e){ console.warn("[app.js] silent catch", e); }
      try{ delete window.__plannerState; }catch(e){ console.warn("[app.js] silent catch", e); }
      App.session.user = null;
      App.session.role = null;
      window.renderAuthArea();
      window.clearMainArea();
      window.syncRoleUI();
      if(window.Router) Router.go("login");

      try{
        var err = document.querySelector("#loginError");
        if(err) err.textContent = "Нет доступа: ваш email не добавлен в allowlist.";
      }catch(e){ console.warn("[app.js] silent catch", e); }

      try{
        await window.syncPushUI();
      }catch(e){
        console.warn("[Push] sync UI after no-role branch failed", e);
      }

      return;
    }
  }

  window.renderAuthArea();
  window.syncRoleUI();

  if(App.session.user && window.ZRPush && ZRPush.syncExistingSubscription){
    try{
      await ZRPush.syncExistingSubscription();
    }catch(e){
      console.warn("[Push] sync existing subscription skipped", e);
    }
  }

  try{
    await window.syncPushUI();
  }catch(e){
    console.warn("[Push] sync UI after session apply failed", e);
  }
};

// ===== AUTH INIT =====
// ===== AUTH RECOVERY DETECTION =====
window.syncAuthRecoveryMode = function(){
  try{
    window.__authRecoveryMode = false;
    try{ sessionStorage.removeItem("zr_auth_recovery"); }catch(e){}
  }catch(e){
    window.__authRecoveryMode = false;
    console.warn("[Auth] recovery mode disable failed", e);
  }
};

window.initAuth = async function(){
  try{
    App.session.ready = false;

    if(!window.SB || !SB.auth){
      try{ delete window.__plannerState; }catch(e){ console.warn("[app.js] silent catch", e); }
      App.session.user = null;
      App.session.role = null;
      App.session.ready = true;
      window.renderAuthArea();
      window.syncRoleUI();
      return;
    }

    // initial
    var sres = await SB.auth.getSession();
    var user = (sres && sres.data && sres.data.session) ? sres.data.session.user : null;
    await window.applySession(user);

    App.session.ready = true;

    // subscribe once
    if(!App._authSub){
      App._authSub = SB.auth.onAuthStateChange(function(evt, session){
        var u = (session && session.user) ? session.user : null;
        var prevUserId = (window.App && App.session && App.session.user && App.session.user.id) ? String(App.session.user.id) : "";
        var nextUserId = (u && u.id) ? String(u.id) : "";
        var shouldHardRerender = (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "USER_UPDATED" || prevUserId !== nextUserId);

        // IMPORTANT: do not call async Supabase APIs inside onAuthStateChange callback.
        // Defer applySession to the next tick to avoid auth deadlocks (Navigator Lock).
        window._applySessionSeq = (window._applySessionSeq || 0) + 1;
        var seq = window._applySessionSeq;
        if(window._applySessionTimer) clearTimeout(window._applySessionTimer);
        window._applySessionTimer = setTimeout(function(){
          (async function(){
            if(seq !== window._applySessionSeq) return;
            try{
              await window.applySession(u);
            }catch(e){
              console.warn("[Auth] applySession failed", e);
            }
            App.session.ready = true;
            if(shouldHardRerender && !App._navLock && typeof App._render === "function") App._render();
          })();
        }, 0);
      });
    }
  }catch(e){
    console.warn("[Auth] init failed", e);
    try{ delete window.__plannerState; }catch(e){ console.warn("[app.js] silent catch", e); }
      App.session.user = null;
    App.session.role = null;
    App.session.ready = true;
    window.renderAuthArea();
    window.clearMainArea();
    window.syncRoleUI();
    if(window.Router) Router.go("login");
  }
};

(() => {
  var $ = function(s){ return document.querySelector(s); };

  function setActiveTab(tab){
    document.querySelectorAll(".tab").forEach(function(b){
      b.classList.toggle("is-active", b.dataset.tab === tab);
    });
  }

  function applySearch(q){
    var p = Router.parse();
    if(p.section === "articles" && Views.Articles && Views.Articles.setFilter) Views.Articles.setFilter(q);
    if(p.section === "templates" && Views.Templates && Views.Templates.setFilter) Views.Templates.setFilter(q);
    if(p.section === "checklists" && Views.Checklists && Views.Checklists.setFilter) Views.Checklists.setFilter(q);
  }

  function syncTopSearchUI(section){
    var q = $("#q");
    var status = $("#status");
    if(!q) return;

    var searchable = section === "articles" || section === "templates" || section === "checklists";
    var pill = status ? status.closest(".pill") : null;

    q.disabled = !searchable;

    if(searchable){
      q.placeholder = "Поиск по базе…";
      if(pill) pill.style.display = "";
      if(status && !String(status.textContent || "").trim()) status.textContent = "0";
      return;
    }

    q.value = "";
    q.placeholder = (section === "planner")
      ? "Поиск в Planner пока недоступен"
      : "Поиск недоступен в этом разделе";

    if(status) status.textContent = "";
    if(pill) pill.style.display = "none";
  }

  // ===== RENDER ROUTER =====
async function render(){
  // ENTRY: render flow (do not duplicate guards here)

    var p = Router.parse();
    var section = p.section;
    var param = p.param;
    var q = $("#q");
    var searchValue = q ? (q.value || "") : "";

    async function showSearchView(view, param, searchValue){
      await view.show(param);
      applySearch(searchValue);
    }

    if(window.syncAuthRecoveryMode) window.syncAuthRecoveryMode();
    if(window.__authRecoveryMode){
      section = "login";
      param = "";
    }

    var hasUser = !!(App.session && App.session.user);
    var isLogin = (section === "login");
    var isRecovery = !!window.__authRecoveryMode;

    if(isLogin && hasUser && !isRecovery){
      Router.go("planner");
      return;
    }

    // gate: все кроме login требует user
    if(!isLogin && !hasUser){
      window.clearMainArea();
      Router.go("login");
      return;
    }

    setActiveTab(section);
    syncTopSearchUI(section);

    var simpleViewMap = {
      login: async function(){ await Views.Login.show(); },
      planner: async function(){ await Views.Planner.show(); },
      articles: async function(){ await showSearchView(Views.Articles, param, searchValue); },
      templates: async function(){ await showSearchView(Views.Templates, param, searchValue); },
      checklists: async function(){ await showSearchView(Views.Checklists, param, searchValue); }
    };

    async function showAdminView(param){
      var isAdmin = !!(App.session && App.session.role === "admin");
      var adminView = Views.Admin && Views.Admin.show;
      var v;

      if(!isAdmin){
        Router.go("planner");
        return;
      }

      if(adminView){
        await adminView(param);
        return;
      }

      v = $("#viewer");
      if(v) v.innerHTML = '<div class="empty">Админка не загружена (Views.Admin отсутствует).</div>';
    }

    var routeHandler = simpleViewMap[section];

    if(section === "admin"){
      routeHandler = function(){
        return showAdminView(param);
      };
    }

    function handleUnknownRoute(){
      Router.go("planner");
    }

    if(routeHandler){
      await routeHandler();
      return;
    }

    handleUnknownRoute();
  }

  // ===== APP BOOT =====
  async function boot(){
    $("#tabs").addEventListener("click", function(e){
      var btn = e.target.closest(".tab");
      if(!btn) return;
      Router.go(btn.dataset.tab);
    });

    $("#q").addEventListener("input", function(e){ applySearch(e.target.value || ""); });

    window.addEventListener("hashchange", render);

    App._render = render;

    window.syncAuthRecoveryMode();

    await window.initAuth();

    if(!location.hash) Router.go(App.session && App.session.user ? "planner" : "login");
    render();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();

















