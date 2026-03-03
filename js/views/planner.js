// js/views/planner.js
window.Views = window.Views || {};

Views.Planner = (() => {

  async function show(){
    const role = window.App?.session?.role || null;

    const listEl = document.getElementById("list");
    const viewerEl = document.getElementById("viewer");
    const titleEl = document.getElementById("panelTitle");

    titleEl.textContent = "PLANNER";

    // --- state (persist across rerenders) ---
    window.__plannerState = window.__plannerState || { tab: "new" };
    const state = window.__plannerState;

    // --- helpers ---
    const esc = (s) => (s==null?"":String(s))
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

    const todayISO = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,"0");
      const day = String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${day}`;
    };

    const parseSelectedId = () => {
      try{
        const p = (window.Router && Router.parse) ? Router.parse() : null;
        return p && p.param ? String(p.param) : null;
      }catch(e){ return null; }
    };

    const goTask = (id) => {
      location.hash = id ? ("#/planner/" + encodeURIComponent(id)) : "#/planner";
    };

    const urgencyWeight = (u) => (u === "high" ? 0 : u === "normal" ? 1 : u === "low" ? 2 : 9);

    // --- UI shell ---
    const tabs = [
      { key:"new",     label:"Новые" },
      { key:"work",    label:"В работе" },
      { key:"overdue", label:"Просрочено" },
      { key:"done",    label:"Завершено" },
    ];

    const renderHeader = (count) => {
      const tabsHtml = tabs.map(t => `
        <button class="btn btn-sm pl-tab ${t.key===state.tab ? "is-active" : ""}" data-tab="${t.key}" type="button">
          ${esc(t.label)}
        </button>
      `).join("");

      listEl.innerHTML = `
        <div class="item" style="cursor:default;">
          <div class="item-title">PLANNER</div>
          <div class="item-meta">
            вкладка: <b>${esc(tabs.find(x=>x.key===state.tab)?.label || state.tab)}</b>
            · задач: <b>${count}</b>
            · today: <span class="muted">${esc(todayISO())}</span>
            ${role ? ` · роль: <b>${esc(role)}</b>` : ""}
          </div>
          <div class="actions" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            ${tabsHtml}
            <button class="btn btn-sm" id="plRefresh" type="button">Обновить</button>
          </div>
        </div>
        <div id="plTasks"></div>
      `;

      // bind
      listEl.querySelectorAll(".pl-tab").forEach(btn => {
        btn.onclick = () => { state.tab = btn.dataset.tab; show(); };
      });
      const rf = listEl.querySelector("#plRefresh");
      if(rf) rf.onclick = () => show();
    };

    const renderEmptyViewer = () => {
      if(role === "admin"){
        viewerEl.innerHTML = `
          <div class="empty">
            <h2>PLANNER пуст.</h2>
            <p>Создайте первую задачу.</p>
          </div>
        `;
        return;
      }
  return { show };
})();


