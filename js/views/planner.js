window.Views = window.Views || {};

Views.Planner = (() => {
  console.log("[PLANNER_BUILD] 2026-03-03");

  async function show(){
    const listEl = document.getElementById("list");
    const viewerEl = document.getElementById("viewer");
    const titleEl = document.getElementById("panelTitle");
    if(!listEl || !viewerEl) return;
    if(titleEl) titleEl.textContent = "PLANNER";

    const role = window.App?.session?.role || null;
    const uid  = window.App?.session?.user?.id || null;

    window.__plannerState = window.__plannerState || { leftFilter: "mine", ownerKey: null }; // mine | all
    const state = window.__plannerState;
    // Reset planner UI state when user/role changes (prevents state leaking between accounts)
    const ownerKey = ((window.App && App.session && App.session.user) ? App.session.user.id : "anon") + "|" + ((window.App && App.session) ? (App.session.role || "none") : "none");
    if(state.ownerKey !== ownerKey){
      window.__plannerState = { leftFilter: "mine", ownerKey };
    }else{
      state.ownerKey = ownerKey;
    }
    // rebind after possible reset
    const state2 = window.__plannerState;const esc = (s) => (s==null?"":String(s))
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

        const r = (t.role ? String(t.role) : "all");
        const rLabel = (r === "staff") ? "S" : (r === "admin") ? "A" : "ALL";
        const roleBadge = `<span class="tag" style="margin-left:6px; font-size:10px; padding:2px 6px;">${rLabel}</span>`;
        const isSel = selectedId && String(selectedId) === String(t.id);
        return `
          <div class="item" data-id="${esc(t.id)}" style="${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
            <div class="item-title">${esc(t.title || "(без названия)")}${roleBadge}${badge}</div>
            <div class="item-meta">${due} ${st}</div>
          </div>
        `;
      }).join("");

      host.querySelectorAll(".item[data-id]").forEach(row => {
        row.onclick = () => goTask(row.dataset.id);
      });
    }

    // ---------- RIGHT ----------
    function renderRightHeader(tasks){
      const total = Array.isArray(tasks) ? tasks.length : 0;
      const done = total ? tasks.filter(t => t.status === "done").length : 0;
      const pct = total ? Math.round((done / total) * 100) : 0;

      viewerEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px;">
          <div>
            <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
            <div class="muted" style="margin-top:6px; font-size:12px;">Обзор по статусам · клик по карточке открывает детали</div>

            <div style="margin-top:10px; height:6px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:var(--brand-accent, #c45a2a);"></div>
            </div>
            <div class="muted" style="margin-top:6px; font-size:12px;">Прогресс дня: ${done}/${total} (${pct}%)</div>
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
                <div class="item" data-id="${esc(t.id)}" style="margin-top:10px; ${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
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
      renderRightHeader(tasks);
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
        renderRightHeader(tasks);
        const board = document.getElementById("plBoard");
        if(board) board.innerHTML = `<div class="empty"><span class="muted">Задача не найдена.</span></div>`;
      }
    }else{
      renderRightHeader(tasks);
      renderBoard(tasks);
    }

    try{ console.log("[Planner] tasks", tasks.length, "leftFilter", state.leftFilter); }catch(e){}
  }

  return { show };
})();









