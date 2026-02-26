window.App = window.App || { session: { user: null, role: null, ready: false }, _authSub: null, _render: null, _navLock: false };

/* =========================================================
   Shared helpers
   ========================================================= */

window.clearMainArea = function(){
  var v = document.querySelector("#viewer");
  var l = document.querySelector("#list");
  if(v) v.innerHTML = "";
  if(l) l.innerHTML = "";
};

window.withTimeout = function(promise, ms, label){
  var t;
  var timeout = new Promise(function(_, rej){
    t = setTimeout(function(){
      rej(new Error("Timeout (" + ms + "ms): " + (label || "request")));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(function(){ clearTimeout(t); });
};

// Auth helpers (single place so views can reuse)
window.AppAuth = window.AppAuth || {};

window.AppAuth.getSessionSafe = async function(){
  if(!window.SB || !SB.auth) return null;
  try{
    var sres = await window.withTimeout(SB.auth.getSession(), 8000, "auth getSession");
    return (sres && sres.data) ? (sres.data.session || null) : null;
  }catch(e){
    return null;
  }
};

// Refresh session if missing OR expiring soon.
// Returns session (or null).
window.AppAuth.ensureFreshSession = async function(minTtlSeconds){
  if(!window.SB || !SB.auth) return null;
  var minTtl = (typeof minTtlSeconds === "number") ? minTtlSeconds : 120;

  // 1) try current session
  var s1 = await window.AppAuth.getSessionSafe();
  if(s1){
    try{
      var exp = (typeof s1.expires_at === "number") ? s1.expires_at : 0; // seconds (unix)
      var now = Math.floor(Date.now() / 1000);
      var ttl = exp ? (exp - now) : 999999;
      if(ttl > minTtl) return s1;
    }catch(e){
      return s1; // be conservative
    }
  }

  // 2) refresh
  try{
    var rres = await window.withTimeout(SB.auth.refreshSession(), 12000, "auth refreshSession");
    var s2 = (rres && rres.data) ? (rres.data.session || null) : null;
    return s2;
  }catch(e){
    // still may have a session (race); re-check once
    return await window.AppAuth.getSessionSafe();
  }
};

window.fetchRole = async function(){
  if(!window.SB) return { role: null, denied: false, transient: true };

  for(var attempt=1; attempt<=2; attempt++){
    try{
      var r = await window.withTimeout(SB.rpc("get_role"), 8000, "get_role");
      if(r && !r.error){
        if(r.data === "admin" || r.data === "staff"){
          return { role: r.data, denied: false, transient: false };
        }
        // null/other => реально нет доступа
        return { role: null, denied: true, transient: false };
      }
      console.warn("[Auth] get_role error", r && r.error ? r.error : r);
      if(attempt === 1) { await new Promise(function(res){ setTimeout(res, 400); }); continue; }
      return { role: null, denied: false, transient: true };
    }catch(e){
      console.warn("[Auth] get_role failed", e);
      if(attempt === 1) { await new Promise(function(res){ setTimeout(res, 400); }); continue; }
      return { role: null, denied: false, transient: true };
    }
  }
  return { role: null, denied: false, transient: true };
};

window.syncRoleUI = function(){
  try{
    var adminTab = document.querySelector('.tab.zr-admin-tab[data-tab="admin"]');
    if(!adminTab) return;
    var isAdmin = !!(window.App && App.session && App.session.role === "admin");
    adminTab.style.display = isAdmin ? "" : "none";
  }catch(e){}
};

window.renderAuthArea = function(){
  var el = document.querySelector("#authArea");
  if(!el) return;

  // --- NOT logged in
  if(!window.App || !App.session || !App.session.user){
    el.innerHTML = '<button type="button" class="btn btn-sm" id="loginGo">Войти</button>';
    var b = document.querySelector("#loginGo");
    if(b){
      b.onclick = function(){
        // всегда триггерим навигацию (даже если уже на login)
        if(window.Router) Router.go("login", String(Date.now()));
        else location.hash = "#/login/" + Date.now();
      };
    }
    return;
  }

  // --- logged in
  var roleLabel = App.session.role || "…";
  el.innerHTML =
    '<span class="pill">' + roleLabel + '</span>' +
    '<button type="button" class="btn btn-sm" id="logoutBtn">Выйти</button>';

  var btn = document.querySelector("#logoutBtn");
  if(btn){
    btn.onclick = function(){
      // UI-first logout: мгновенно чистим локально и уходим на login
      try{
        App.session.user = null;
        App.session.role = null;
        App.session.ready = true;
        window.renderAuthArea();
        window.syncRoleUI();
        window.clearMainArea();
        if(window.Router) Router.go("login", String(Date.now()));
        else location.hash = "#/login/" + Date.now();
      }catch(e){}

      // затем пытаемся реально выйти из Supabase (не блокируя UI)
      try{
        if(window.SB && SB.auth){
          window.withTimeout(SB.auth.signOut(), 8000, "auth signOut").catch(function(e){
            console.warn("[Auth] signOut failed", e);
          });
        }
      }catch(e){}
    };
  }
};

window.applySession = async function(user){
  App.session.user = user || null;
  App.session.role = null;

  if(App.session.user){
    var rr = await window.fetchRole();
    App.session.role = rr.role;

    // ✅ SignOut только если мы точно уверены, что deny (не в allowlist)
    if(rr.denied){
      try{ if(window.SB && SB.auth) await window.withTimeout(SB.auth.signOut(), 8000, "auth signOut"); }catch(e){}
      App.session.user = null;
      App.session.role = null;
      window.renderAuthArea();
      window.syncRoleUI();
      window.clearMainArea();
      if(window.Router) Router.go("login", String(Date.now()));
      else location.hash = "#/login/" + Date.now();
      return;
    }
    // transient => остаёмся залогиненными, но роль "…"
  }

  window.renderAuthArea();
  window.syncRoleUI();
};

window.initAuth = async function(){
  App.session.ready = false;

  if(!window.SB || !SB.auth){
    App.session.user = null;
    App.session.role = null;
    App.session.ready = true;
    window.renderAuthArea();
    window.syncRoleUI();
    return;
  }

  try{
    // Ensure token is not near expiry at boot.
    var session = await window.AppAuth.ensureFreshSession(120);
    var user = (session && session.user) ? session.user : null;

    await window.applySession(user);
    App.session.ready = true;

    if(!App._authSub){
      App._authSub = SB.auth.onAuthStateChange(async function(evt, session2){
        // не дергаем UI во время редактирования (иначе "вылеты")
        if(App._navLock) return;

        // We only need to fully re-apply on meaningful changes.
        // TOKEN_REFRESHED can be frequent; still keep it light but consistent.
        App.session.ready = false;
        var u = (session2 && session2.user) ? session2.user : null;
        await window.applySession(u);
        App.session.ready = true;

        if(typeof App._render === "function") App._render();
      });
    }
  }catch(e){
    console.warn("[Auth] init failed", e);
    // не зависаем: просто возвращаемся на login
    App.session.user = null;
    App.session.role = null;
    App.session.ready = true;
    window.renderAuthArea();
    window.syncRoleUI();
    window.clearMainArea();
    if(window.Router) Router.go("login", String(Date.now()));
    else location.hash = "#/login/" + Date.now();
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
    try{
      if(p.section === "articles" && Views.Articles && Views.Articles.setFilter) Views.Articles.setFilter(q);
      if(p.section === "templates" && Views.Templates && Views.Templates.setFilter) Views.Templates.setFilter(q);
      if(p.section === "checklists" && Views.Checklists && Views.Checklists.setFilter) Views.Checklists.setFilter(q);
    }catch(e){
      console.warn("[UI] applySearch failed", e);
    }
  }

  function showLoading(){
    var v = $("#viewer");
    var l = $("#list");
    if(l) l.innerHTML = "";
    if(v) v.innerHTML = '<div class="empty">Загрузка…</div>';
  }

  async function render(){
    var p = Router.parse();
    var section = p.section;
    var param = p.param;
    var q = $("#q");

    // if user is on login but already has session — go to articles
    if(section === "login" && App.session && App.session.user && App.session.ready === true){
      Router.go("articles");
      return;
    }

    // если не залогинен — всегда на login
    if(section !== "login" && (!App.session || !App.session.user)){
      window.clearMainArea();
      Router.go("login");
      return;
    }

    // пока auth не ready — показываем загрузку, но НЕ прыгаем по роутам
    if(section !== "login" && App.session && App.session.ready !== true){
      setActiveTab(section);
      if(q) q.disabled = true;
      showLoading();
      return;
    }

    // админка только для admin (если роль не успела — не выкидываем, просто не пускаем)
    if(section === "admin" && (!App.session || App.session.role !== "admin")){
      Router.go("articles");
      return;
    }

    try{
      setActiveTab(section);
      if(q) q.disabled = false;

      if(section === "login"){ await Views.Login.show(param); return; }
      if(section === "articles"){ await Views.Articles.show(param); applySearch(q ? (q.value||"") : ""); return; }
      if(section === "templates"){ await Views.Templates.show(); await Views.Templates.open(param); applySearch(q ? (q.value||"") : ""); return; }
      if(section === "checklists"){ await Views.Checklists.show(); await Views.Checklists.open(param); applySearch(q ? (q.value||"") : ""); return; }

      if(section === "admin" && Views.Admin && Views.Admin.show){
        await Views.Admin.show(param);
        return;
      }

      Router.go("articles");
    }catch(e){
      console.error("[UI] render failed", e);
      var v = $("#viewer");
      if(v) v.innerHTML = '<div class="empty">Ошибка UI. Смотри консоль.</div>';
    }
  }

  async function boot(){
    $("#tabs").addEventListener("click", function(e){
      var btn = e.target.closest(".tab");
      if(!btn) return;
      Router.go(btn.dataset.tab);
    });

    $("#q").addEventListener("input", function(e){ applySearch(e.target.value || ""); });

    window.addEventListener("hashchange", render);

    App._render = render;

    await window.initAuth();

    if(!location.hash) Router.go(App.session && App.session.user ? "articles" : "login");
    render();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();