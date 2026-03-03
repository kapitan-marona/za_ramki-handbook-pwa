/*
ZA RAMKI — PLANNER (future proto)
This file contains the early draft of Planner UI based on tabs:
- mine / all / new / updates / comments
It was removed from active planner.js to avoid "two planners in one file".
Bring it back only intentionally.

Source extracted on: 20260303_104505
*/

  function esc(s){
    return (s==null?"":String(s))
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function todayISO(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function urgencyWeight(u){
    return (u === "high" ? 0 : u === "normal" ? 1 : u === "low" ? 2 : 9);
  }

  function getRole(){
    return window.App?.session?.role || null;
  }

  function getSelectedId(){
    try{
      const p = (window.Router && Router.parse) ? Router.parse() : null;
      return p && p.param ? String(p.param) : null;
    }catch(e){
      return null;
    }
  }

  function goTask(id){
    location.hash = id ? ("#/planner/" + encodeURIComponent(id)) : "#/planner";
  }

  // ---------- DATA (SELECT only) ----------
  async function fetchTasksForTab(tab, role){
    if(!window.SB) return [];

    const today = todayISO();

    let q = SB
      .from("tasks")
      .select("id,title,body,status,urgency,role,start_date,due_date,archived_at,created_at,updated_at")
      .is("archived_at", null);

    if(tab === "new"){
      q = q.eq("status","new");
    }else if(tab === "work"){
      q = q.in("status", ["taken","in_progress","problem"]);
    }else if(tab === "done"){
      q = q.eq("status","done");
    }else if(tab === "overdue"){
      q = q.not("due_date","is", null).lt("due_date", today).neq("status","done");
    }

    q = q.order("due_date", { ascending:true, nullsFirst:false })
         .order("updated_at", { ascending:false });

    const res = await q;
    if(res && res.error){
      console.warn("[Planner] fetch error", res.error);
      return [];
    }

    let tasks = (res && res.data) ? res.data : [];

    // UI-side publish rule for non-admin (для предсказуемости)
    if(role !== "admin"){
      tasks = tasks.filter(t => !t.start_date || String(t.start_date) <= today);
    }

    tasks.sort((a,b) => {
      const ua = urgencyWeight(a.urgency);
      const ub = urgencyWeight(b.urgency);
      if(ua !== ub) return ua - ub;

      const da = a.due_date || "9999-12-31";
      const db = b.due_date || "9999-12-31";
      if(da !== db) return da < db ? -1 : 1;

      const ta = a.updated_at || a.created_at || "";
      const tb = b.updated_at || b.created_at || "";
      return ta > tb ? -1 : ta < tb ? 1 : 0;
    });

    return tasks;
  }

  // ---------- UI ----------
  function renderViewerEmpty(viewerEl, role){
    if(role === "admin"){
      viewerEl.innerHTML = `
        <div class="empty">
          <h2>PLANNER пуст.</h2>
          <p>Создайте первую задачу.</p>
        </div>
      `;
      return;
    }
    if(role === "staff"){
      viewerEl.innerHTML = `
        <div class="empty" style="text-align:center;">
          <div style="font-size:72px;">😎</div>
          <div style="margin-top:12px;">Новых задач нет. Всё разобрали.</div>
        </div>
      `;
      return;
    }
    viewerEl.innerHTML = `<div class="empty">Войдите в систему, чтобы увидеть задачи.</div>`;
  }

  function renderHeader(listEl, role, tab, count){
    const tabs = [
      { key:"new",     label:"Новые" },
      { key:"work",    label:"В работе" },
      { key:"overdue", label:"Просрочено" },
      { key:"done",    label:"Завершено" },
    ];

    const tabsHtml = tabs.map(t => `
      <button class="btn btn-sm pl-tab ${t.key===tab ? "is-active" : ""}" data-tab="${t.key}" type="button">
        ${esc(t.label)}
      </button>
    `).join("");

    listEl.innerHTML = `
      <div class="item" style="cursor:default;">
        <div class="item-title">PLANNER</div>
        <div class="item-meta">
          вкладка: <b>${esc(tabs.find(x=>x.key===tab)?.label || tab)}</b>
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
  }

  function renderTasksList(tasks){
    const host = document.getElementById("plTasks");
    if(!host) return;

    const selected = getSelectedId();

    if(!tasks || tasks.length === 0){
      host.innerHTML = `
        <div class="item" style="cursor:default;">
          <div class="item-meta"><span class="muted">Задач в этой вкладке нет.</span></div>
        </div>
      `;
      return;
    }

    host.innerHTML = tasks.map(t => {
      const due = t.due_date ? `до ${esc(t.due_date)}` : "";
      const urg = t.urgency ? `· ${esc(t.urgency)}` : "";
      const st  = t.status ? `· ${esc(t.status)}` : "";
      const isSel = selected && String(t.id) === String(selected);
      return `
        <div class="item" data-id="${esc(t.id)}" style="${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
          <div class="item-title">${esc(t.title || "(без названия)")}</div>
          <div class="item-meta">${due} ${urg} ${st}</div>
        </div>
      `;
    }).join("");

    host.querySelectorAll(".item[data-id]").forEach(row => {
      row.onclick = () => goTask(row.dataset.id);
    });
  }

  function renderViewer(viewerEl, tasks){
    const selectedId = getSelectedId();

    if(!selectedId){
      if(!tasks || tasks.length === 0) renderViewerEmpty(viewerEl, getRole());
      else viewerEl.innerHTML = `<div class="empty"><span class="muted">Выберите задачу слева.</span></div>`;
      return;
    }

    const t = (tasks || []).find(x => String(x.id) === String(selectedId));
    if(!t){
      viewerEl.innerHTML = `<div class="empty"><span class="muted">Задача не найдена в этой вкладке.</span></div>`;
      return;
    }

    const due = t.due_date ? `<span class="pill">due: ${esc(t.due_date)}</span>` : "";
    const st  = t.status ? `<span class="pill">status: ${esc(t.status)}</span>` : "";
    const urg = t.urgency ? `<span class="pill">urgency: ${esc(t.urgency)}</span>` : "";

    viewerEl.innerHTML = `
      <div class="item" style="cursor:default;">
        <div class="item-title">${esc(t.title || "(без названия)")}</div>
        <div class="item-meta" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          ${due}${urg}${st}
        </div>
      </div>
      <div class="item" style="cursor:default;">
        <div class="item-meta">${t.body ? esc(t.body) : '<span class="muted">Описание пустое.</span>'}</div>
      </div>
    `;
  }


