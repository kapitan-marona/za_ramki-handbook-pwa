window.App = window.App || {
  session: { user: null, role: null, ready: false }
};

// Safe UI renderer (no template literals, no backticks)
window.renderAuthArea = function(){
  var el = document.querySelector("#authArea");
  if(!el) return;

  if(!window.App || !App.session || !App.session.user){
    el.innerHTML = '<a href="#/login" class="btn btn-sm">Войти</a>';
    return;
  }

  el.innerHTML = '<span class="pill">' + (App.session.role || 'staff') + '</span>' +
                 '<button type="button" class="btn btn-sm" id="logoutBtn">Выйти</button>';

  var btn = document.querySelector("#logoutBtn");
  if(btn){
    btn.onclick = async function(){
      if(window.SB && SB.auth) await SB.auth.signOut();
      location.hash = "#/articles";
      location.reload();
    };
  }
};
(() => {
  const $ = (s) => document.querySelector(s);

  function setActiveTab(tab){
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tab));
  }

  function applySearch(q){
    const { section } = Router.parse();
    if(section === "articles" && Views.Articles?.setFilter) Views.Articles.setFilter(q);
    if(section === "templates" && Views.Templates?.setFilter) Views.Templates.setFilter(q);
    if(section === "checklists" && Views.Checklists?.setFilter) Views.Checklists.setFilter(q);
  }

  async function render(){
    const { section, param } = Router.parse();
    const q = $("#q");

    setActiveTab(section);

    // Search is enabled for all remaining sections
    q.disabled = false;

    
    if(section === "login"){
      await Views.Login.show();
      return;
    }
if(section === "articles"){
      await Views.Articles.show(param);
      applySearch(q.value || "");
      return;
    }

    if(section === "templates"){
      await Views.Templates.show();
      await Views.Templates.open(param);
      applySearch(q.value || "");
      return;
    }

    if(section === "checklists"){
      await Views.Checklists.show();
      await Views.Checklists.open(param);
      applySearch(q.value || "");
      return;
    }

    Router.go("articles");
  }

  function boot(){
    $("#tabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if(!btn) return;
      Router.go(btn.dataset.tab);
    });

    $("#q").addEventListener("input", (e) => applySearch(e.target.value || ""));

    window.addEventListener("hashchange", render);

    
    window.renderAuthArea();
if(!location.hash) Router.go("articles");
    render();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();



