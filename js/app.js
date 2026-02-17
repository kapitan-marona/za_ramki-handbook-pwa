(() => {
  const $ = (s) => document.querySelector(s);

  function setActiveTab(tab){
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tab));
  }

  async function render(){
    const { section, param } = Router.parse();
    const q = $("#q");

    // Tabs -> routes
    setActiveTab(section === "articles" ? "articles" : section);

    if(section === "articles"){
      q.disabled = false;
      await Views.Articles.show(param);
      Views.Articles.setFilter(q.value || "");
      return;
    }

    // Other sections do not use search (for now)
    q.value = "";
    q.disabled = true;

    if(section === "contacts"){
      await Views.Contacts.show();
      await Views.Contacts.open(param);
      return;
    }

    if(section === "templates"){
      await Views.Templates.show();
      await Views.Templates.open(param);
      return;
    }
    if(section === "updates"){
      if(!window.Views || !Views.Updates){
        $("#viewer").innerHTML = `<div class="empty">Updates не подключён (js/views/updates.js).</div>`;
        return;
      }
      await Views.Updates.show();
      await Views.Updates.open(param);
      return;
    }
}

  function boot(){
    // tab click
    $("#tabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if(!btn) return;
      Router.go(btn.dataset.tab === "articles" ? "articles" : btn.dataset.tab);
    });

    // search only for articles
    $("#q").addEventListener("input", (e) => {
      const { section } = Router.parse();
      if(section !== "articles") return;
      Views.Articles.setFilter(e.target.value || "");
    });

    window.addEventListener("hashchange", render);

    // default route
    if(!location.hash)
    if(section === "updates"){
      if(!window.Views || !Views.Updates){
        $("#viewer").innerHTML = `<div class="empty">Updates не подключён (js/views/updates.js).</div>`;
        return;
      }
      await Views.Updates.show();
      await Views.Updates.open(param);
      return;
    }
render();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();

