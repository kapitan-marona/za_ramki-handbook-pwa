window.Views = window.Views || {};

Views.Planner = (() => {
  console.log("[PLANNER_BUILD] 2026-03-03");

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
        <div class="item" data-id="${esc(t.id)}" style="${isSel ? 'outline:1px solid rgba(255,255,255,.18);' : ''}">
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

  async function show(){
    const listEl = document.getElementById("list");
    const viewerEl = document.getElementById("viewer");
    const titleEl = document.getElementById("panelTitle");
    if(!listEl || !viewerEl) return;
    if(titleEl) titleEl.textContent = "PLANNER";

    const role = window.App?.session?.role || null;
    const uid  = window.App?.session?.user?.id || null;

    window.__plannerState = window.__plannerState || { leftFilter: "mine" }; // mine | all
    const state = window.__plannerState;

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
    const today = todayISO();

    const selectedId = (() => {
      try{
        const p = (window.Router && Router.parse) ? Router.parse() : null;
        return p && p.param ? String(p.param) : null;
      }catch(e){ return null; }
    })();

    const goTask = (id) => {
      location.hash = id ? ("#/planner/" + encodeURIComponent(id)) : "#/planner";
    };

    const isOverdue = (t) => !!(t.due_date && String(t.due_date) < today && t.status !== "done");

    // ---------- DATA (SELECT-only) ----------
    async function fetchAllActiveTasks(){
      if(!window.SB) return [];
      const res = await SB
        .from("tasks")
        .select("id,title,body,status,urgency,role,assignee_id,start_date,due_date,archived_at,created_at,updated_at")
        .is("archived_at", null)
        .order("due_date", { ascending:true, nullsFirst:false })
        .order("updated_at", { ascending:false });

      if(res.error){
        console.warn("[Planner] fetch tasks error", res.error);
        return [];
      }

      let tasks = res.data || [];

      // publish rule on UI for non-admin (предсказуемость)
      if(role !== "admin"){
        tasks = tasks.filter(t => !t.start_date || String(t.start_date) <= today);
      }

      return tasks;
    }

    // ---------- LEFT ----------
    function renderLeft(tasks){
      const head = `
        <div style="padding:10px 10px 6px 10px;">
          <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
          <div class="muted" style="margin-top:6px; font-size:12px;">
            today: ${esc(today)}${role ? ` · роль: ${esc(role)}` : ""}${uid ? ` · user: ${esc(uid.slice(0,8))}…` : ""}
          </div>
        </div>
      `;

      const pills = (role === "admin")
        ? `
          <div style="padding:0 10px 10px 10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm pl-left ${state.leftFilter==="mine" ? "is-active" : ""}" data-f="mine" type="button">Мои</button>
            <button class="btn btn-sm pl-left ${state.leftFilter==="all" ? "is-active" : ""}" data-f="all" type="button">Все</button>
          </div>
        `
        : `
          <div style="padding:0 10px 10px 10px;">
            <span class="muted" style="font-size:12px;">Мои + общие</span>
          </div>
        `;

      listEl.innerHTML = head + pills + `<div id="plLeftList"></div>`;

      // bind pills
      listEl.querySelectorAll(".pl-left").forEach(b => {
        b.onclick = () => { state.leftFilter = b.dataset.f; show(); };
      });

      const host = document.getElementById("plLeftList");
      if(!host) return;

      const leftTasks = tasks.filter(t => {
        const isMine = uid && t.assignee_id && String(t.assignee_id) === String(uid);
        const isCommon = !t.assignee_id;
        if(state.leftFilter === "all" && role === "admin") return true;
        return isMine || isCommon;
      });

      if(leftTasks.length === 0){
        host.innerHTML = `
          <div class="item" style="cursor:default;">
            <div class="item-meta"><span class="muted">В списке слева пока пусто.</span></div>
          </div>
        `;
        return;
      }

      host.innerHTML = leftTasks.map(t => {
        const due = t.due_date ? `до ${esc(t.due_date)}` : "";
        const st  = t.status ? `· ${esc(t.status)}` : "";
        const badge = isOverdue(t) ? `<span class="tag" style="margin-left:6px;">overdue</span>` : ``;
        const isSel = selectedId && String(selectedId) === String(t.id);
        return `
          <div class="item" data-id="${esc(t.id)}" style="${isSel ? 'outline:1px solid rgba(255,255,255,.18);' : ''}">
            <div class="item-title">${esc(t.title || "(без названия)")}${badge}</div>
            <div class="item-meta">${due} ${st}</div>
          </div>
        `;
      }).join("");

      host.querySelectorAll(".item[data-id]").forEach(row => {
        row.onclick = () => goTask(row.dataset.id);
      });
    }

    // ---------- RIGHT ----------
    function renderRightHeader(){
      viewerEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px;">
          <div>
            <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
            <div class="muted" style="margin-top:6px; font-size:12px;">Обзор по статусам · клик по карточке открывает детали</div>
          </div>
          <button class="btn btn-sm" id="plRefresh" type="button">Обновить</button>
        </div>
        <div id="plBoard"></div>
      `;

      const rf = document.getElementById("plRefresh");
      if(rf) rf.onclick = () => show();
    }

    function renderBoard(tasks){
      const board = document.getElementById("plBoard");
      if(!board) return;

      const cols = [
        { key:"new", label:"Новые", match: (t) => t.status === "new" },
        { key:"work", label:"В работе", match: (t) => ["taken","in_progress","problem"].includes(t.status) },
        { key:"overdue", label:"Просрочено", match: (t) => isOverdue(t) },
        { key:"done", label:"Завершено", match: (t) => t.status === "done" },
      ];

      const colHtml = cols.map(c => {
        const items = tasks.filter(c.match);
        const cards = items.length
          ? items.map(t => {
              const due = t.due_date ? `до ${esc(t.due_date)}` : "без дедлайна";
              const isSel = selectedId && String(selectedId) === String(t.id);
              return `
                <div class="item" data-id="${esc(t.id)}" style="margin-top:10px; ${isSel ? 'outline:1px solid rgba(255,255,255,.18);' : ''}">
                  <div class="item-title">${esc(t.title || "(без названия)")}</div>
                  <div class="item-meta">${esc(due)} · ${esc(t.status || "")}</div>
                </div>
              `;
            }).join("")
          : `<div class="muted" style="padding:10px 2px; font-size:12px;">Пусто</div>`;

        return `
          <div style="flex:1; min-width:260px; padding:10px 12px; border:1px solid rgba(255,255,255,.10); border-radius:16px;">
            <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px;">
              <div style="font-weight:650;">${esc(c.label)}</div>
              <div class="muted" style="font-size:12px;">${items.length}</div>
            </div>
            ${cards}
          </div>
        `;
      }).join("");

      board.innerHTML = `
        <div style="display:flex; gap:12px; overflow:auto; padding:0 12px 12px 12px;">
          ${colHtml}
        </div>
      `;

      viewerEl.querySelectorAll(".item[data-id]").forEach(card => {
        card.style.cursor = "pointer";
        card.onclick = () => goTask(card.dataset.id);
      });
    }

    function renderDetails(task){
      const due = task.due_date ? `<span class="pill">due: ${esc(task.due_date)}</span>` : "";
      const st  = task.status ? `<span class="pill">status: ${esc(task.status)}</span>` : "";
      const urg = task.urgency ? `<span class="pill">urgency: ${esc(task.urgency)}</span>` : "";
      const start = task.start_date ? `<span class="pill">start: ${esc(task.start_date)}</span>` : "";

      viewerEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px;">
          <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
          <button class="btn btn-sm" id="plBack" type="button">Назад</button>
        </div>

        <div class="item" style="cursor:default;">
          <div class="item-title">${esc(task.title || "(без названия)")}</div>
          <div class="item-meta" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            ${start}${due}${urg}${st}
          </div>
        </div>

        <div class="item" style="cursor:default;">
          <div class="item-meta">${task.body ? esc(task.body) : '<span class="muted">Описание пустое.</span>'}</div>
        </div>
      `;

      const back = document.getElementById("plBack");
      if(back) back.onclick = () => goTask(null);
    }

    function renderEmpty(){
      renderRightHeader();
      const board = document.getElementById("plBoard");
      if(!board) return;

      if(role === "admin"){
        board.innerHTML = `<div class="empty"><h2>PLANNER пуст.</h2><p>Создайте первую задачу.</p></div>`;
      }else{
        board.innerHTML = `
          <div class="empty" style="text-align:center;">
            <div style="font-size:72px;">😎</div>
            <div style="margin-top:12px;">Новых задач нет. Всё разобрали.</div>
          </div>
        `;
      }
    }

    // ---------- FLOW ----------
    const tasks = await fetchAllActiveTasks();

    renderLeft(tasks);

    if(!tasks || tasks.length === 0){
      renderEmpty();
      return;
    }

    if(selectedId){
      const t = tasks.find(x => String(x.id) === String(selectedId));
      if(t) renderDetails(t);
      else {
        renderRightHeader();
        const board = document.getElementById("plBoard");
        if(board) board.innerHTML = `<div class="empty"><span class="muted">Задача не найдена.</span></div>`;
      }
    }else{
      renderRightHeader();
      renderBoard(tasks);
    }

    try{ console.log("[Planner] tasks", tasks.length, "leftFilter", state.leftFilter); }catch(e){}
  }

  return { show };
})();


