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

window.renderAuthArea = function(){
  var el = document.querySelector("#authArea");
  if(!el) return;

  if(!window.App || !App.session || !App.session.user){
    el.innerHTML = '<a href="#/login" class="btn btn-sm">Войти</a>';
    return;
  }

  el.innerHTML =
    '<span class="pill">' + (App.session.role || '—') + '</span>' +
    '<button type="button" class="btn btn-sm" id="logoutBtn">Выйти</button>';

  var btn = document.querySelector("#logoutBtn");
  if(btn){
    btn.onclick = async function(){
      try{ if(window.SB && SB.auth) await SB.auth.signOut(); }catch(e){}
      App.session.user = null;
      App.session.role = null;
      App.session.ready = true;
      window.renderAuthArea();
      window.syncRoleUI();
      window.clearMainArea();
      if(window.Router) Router.go("login");
    };
  }
};

window.syncRoleUI = function(){
  // ADMIN_TAB_MARKER_001
  try{
    var adminTab = document.querySelector('.tab.zr-admin-tab[data-tab="admin"]');
    if(!adminTab) return;

    var isAdmin = !!(window.App && App.session && App.session.role === "admin");
    adminTab.style.display = isAdmin ? "" : "none";
  }catch(e){}
};

window.applySession = async function(user){
  App.session.user = user || null;
  App.session.role = null;

  if(App.session.user){
    var role = await window.fetchRole();
    App.session.role = role;

    // нет роли -> нет доступа
    if(!role){
      try{ await SB.auth.signOut(); }catch(e){}
      App.session.user = null;
      App.session.role = null;
      window.renderAuthArea();
      window.syncRoleUI();
      window.clearMainArea();
      if(window.Router) Router.go("login");

      // покажем причину на экране логина (если он есть)
      try{
        var err = document.querySelector("#loginError");
        if(err) err.textContent = "Нет доступа: ваш email не добавлен в allowlist.";
      }catch(e){}
      return;
    }
  }

  window.renderAuthArea();
  window.syncRoleUI();
};

window.initAuth = async function(){
  try{
    App.session.ready = false;

    if(!window.SB || !SB.auth){
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
      App._authSub = SB.auth.onAuthStateChange(async function(evt, session){
        var u = (session && session.user) ? session.user : null;
        await window.applySession(u);
        App.session.ready = true;
        if(typeof App._render === "function") App._render();
      });
    }
  }catch(e){
    console.warn("[Auth] init failed", e);
    App.session.user = null;
    App.session.role = null;
    App.session.ready = true;
    window.renderAuthArea();
    window.syncRoleUI();
    window.clearMainArea();
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

  function showLoading(){
    // ZAGRUZKA_MARKER_001
    var viewer = $("#viewer");
    var list = $("#list");
    if(list) list.innerHTML = "";
    if(viewer){
      viewer.innerHTML =
        '<div class="empty" style="margin-top:10px;">' +
          'Загрузка…' +
        '</div>';
    }
  }

  async function render(){
    var p = Router.parse();
    var section = p.section;
    var param = p.param;
    var q = $("#q");

    // gate 0: ждём, пока auth определится
    if(!App.session || App.session.ready !== true){
      if(q) q.disabled = true;
      if(section !== "login") showLoading();
      return;
    }

    // gate 1: все кроме login требует user
    if(section !== "login" && (!App.session || !App.session.user)){
      window.clearMainArea();
      Router.go("login");
      return;
    }

    // gate 2: admin-only route
    if(section === "admin" && (!App.session || App.session.role !== "admin")){
      Router.go("articles");
      return;
    }

    setActiveTab(section);
    if(q) q.disabled = false;

    if(section === "login"){ await Views.Login.show(); return; }
    if(section === "articles"){ await Views.Articles.show(param); applySearch(q ? (q.value||"") : ""); return; }
    if(section === "templates"){ await Views.Templates.show(); await Views.Templates.open(param); applySearch(q ? (q.value||"") : ""); return; }
    if(section === "checklists"){ await Views.Checklists.show(); await Views.Checklists.open(param); applySearch(q ? (q.value||"") : ""); return; }
    if(section === "admin"){ await Views.Admin.show(); return; }

    Router.go("articles");
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
