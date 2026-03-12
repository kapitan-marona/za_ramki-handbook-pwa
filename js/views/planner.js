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
  function getSelectedTaskId(){
    try{
      const p = (window.Router && typeof Router.parse === "function") ? Router.parse() : null;
      return p && p.param ? String(p.param) : null;
    }catch(e){
      return null;
    }
  }

  function goTask(id){
    // Single source of truth: Router.go()
    try{
      if(window.Router && typeof Router.go === "function"){
        if(id) Router.go("planner", String(id));
        else Router.go("planner");
        return;
      }
    }catch(e){}
    // Fallback
    location.hash = id ? ("#/planner/" + encodeURIComponent(String(id))) : "#/planner";
  }
function fmtDMY(iso){
    if(!iso) return "";
    const s = String(iso);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
  }

  function dueLabel(iso){
    return iso ? `до ${fmtDMY(iso)}` : "";
  }

  function startLabel(iso){
    return iso ? `с ${fmtDMY(iso)}` : "";
  }

  function urgencyLabel(u){
    if(u == null) return "";
    const s = String(u).trim().toLowerCase();
    if(!s) return "";
    if(s === "normal" || s === "low") return "";
    // show as "Срочно" for high/urgent/anything non-normal
    if(s === "high" || s === "urgent") return "Срочно";
    return "Срочно";
  }


function statusLabel(code){
  if(code === "new") return "Новая задача";
  if(code === "taken") return "Принята в работу";
  if(code === "in_progress") return "В работе";
  if(code === "problem") return "Есть проблема";
  if(code === "done") return "Завершена";
  if(code === "canceled") return "Отменена";
  return code;
}
function shortId(value){
  const s = value == null ? "" : String(value).trim();
  if(!s) return "";
  return s.length > 8 ? s.slice(0,8) : s;
}

function prettifyPersonName(value){
  const s = value == null ? "" : String(value).trim();
  if(!s) return "";

  if(s.includes("@")){
    return s.split("@")[0].replace(/[._-]+/g, " ").trim();
  }

  if(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s)) return "";
  if(/^[0-9a-f]{32}$/i.test(s)) return "";

  return s;
}

function resolvePersonLabel(input, opts){
  const o = opts || {};
  const uid = o.uid ? String(o.uid) : "";
  const fallback = o.fallback || "Сотрудник";
  if(input == null || input === "") return fallback;

  if(typeof input === "object"){
    const id = input.id != null ? String(input.id) : "";
    if(uid && id && id === uid) return "Вы";

    const direct = [
      input.display_name,
      input.full_name,
      input.name,
      input.email,
      input.label,
      input.title,
      input.username
    ];

    for(const candidate of direct){
      const pretty = prettifyPersonName(candidate);
      if(pretty) return pretty;
    }

    if(id) return `${fallback} ${shortId(id)}`;
    return fallback;
  }

  const raw = String(input).trim();
  if(!raw) return fallback;
  if(uid && raw === uid) return "Вы";

  const pretty = prettifyPersonName(raw);
  if(pretty) return pretty;

  return `${fallback} ${shortId(raw)}`;
}

function getTaskAssigneeLabel(task, uid){
  const assignees = Array.isArray(task && task.assignees) ? task.assignees : [];
  if(assignees.length === 0) return "";
  if(assignees.length === 1) return resolvePersonLabel(assignees[0], { uid, fallback: "Сотрудник" });
  return `${assignees.length} исполнителя`;
}

function getTaskAssigneeDetails(task, peopleMap, uid){
  const ids = Array.isArray(task && task.assignees) ? task.assignees.map(x => String(x)).filter(Boolean) : [];
  if(ids.length === 0){
    return {
      ids: [],
      text: '<span class="muted">Не назначен</span>'
    };
  }

  const labels = ids.map(id => {
    const person = peopleMap && peopleMap[id] ? peopleMap[id] : { id };
    return esc(resolvePersonLabel(person, { uid, fallback: "Сотрудник" }));
  });

  return {
    ids,
    text: labels.join(", ")
  };
}

function getTaskAssigneeIds(task){
  return Array.isArray(task && task.assignees)
    ? task.assignees.map(x => String(x)).filter(Boolean)
    : [];
}

function getTaskRoleScope(task){
  const s = String((task && task.role) || "all").trim().toLowerCase();
  return s || "all";
}

function canRoleSeeTask(task, role){
  const scope = getTaskRoleScope(task);
  if(role === "admin") return true;
  return scope === "all" || scope === "staff";
}

function isTaskMine(task, uid){
  if(!uid) return false;
  const assignees = getTaskAssigneeIds(task);
  return assignees.includes(String(uid));
}

function shouldShowInLeft(task, role, uid, leftFilter){
  if(!task) return false;
  if(!canRoleSeeTask(task, role)) return false;

  if(role === "admin" && leftFilter === "all") return true;

  const assignees = getTaskAssigneeIds(task);
  const mine = isTaskMine(task, uid);
  const unassigned = assignees.length === 0;

  if(role === "admin"){
    if(mine) return true;
    if(unassigned) return true;
    return false;
  }

  return mine || unassigned;
}


  async function show(){
    const listEl = document.getElementById("list");
    const viewerEl = document.getElementById("viewer");
    const titleEl = document.getElementById("panelTitle");
    if(!listEl || !viewerEl) return;
    if(titleEl) titleEl.textContent = "PLANNER";

    const role = window.App?.session?.role || null;
    const uid  = window.App?.session?.user?.id || null;

    window.__plannerState = window.__plannerState || { leftFilter: "mine", refreshBusy: false, ownerKey: null }; // mine | all
    let state = window.__plannerState;
    // Reset planner UI state when user/role changes (prevents state leaking between accounts)
    const ownerKey = ((window.App && App.session && App.session.user) ? App.session.user.id : "anon") + "|" + ((window.App && App.session) ? (App.session.role || "none") : "none");
    if(state.ownerKey !== ownerKey){
      window.__plannerState = { leftFilter: "mine", refreshBusy: false, ownerKey };
    }else{
      state.ownerKey = ownerKey;
    }
    // rebind after possible reset
    const today = todayISO();
    const selectedId = getSelectedTaskId();
const isOverdue = (t) => window.PlannerState ? PlannerState.isOverdue(t, today) : !!(t.due_date && String(t.due_date) < today && t.status !== "done");

    // ---------- DATA (SELECT-only) ----------
    async function fetchAllActiveTasks(){
      if(!window.PlannerData) throw new Error("PlannerData missing");
      return await PlannerData.fetchAllActiveTasks({ role, today });
    }
    // ---------- LEFT ----------
    function renderLeft(tasks){
      const head = `
        <div style="padding:10px 10px 6px 10px;">
          <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
          
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
        b.onclick = () => { state.leftFilter = b.dataset.f; renderLeft(tasks); };
      });

      const host = document.getElementById("plLeftList");
      if(!host) return;

      let leftTasks = tasks.filter(t => shouldShowInLeft(t, role, uid, state.leftFilter));

      if(leftTasks.length === 0){
  const emptyText = (role === "admin" && state.leftFilter === "mine")
    ? "Для фильтра «Мои» задач пока нет."
    : "В списке слева пока пусто.";

  host.innerHTML = `
    <div class="item" style="cursor:default;">
      <div class="item-meta"><span class="muted">${esc(emptyText)}</span></div>
    </div>
  `;
  return;
}

      // [PlannerUX] sortMineFirst: my tasks first in left list
        try{
        if(window.PlannerUX && typeof PlannerUX.sortMineFirst === "function"){
          leftTasks = PlannerUX.sortMineFirst(leftTasks, uid);
        }
      }catch(e){ console.warn("[Planner] left sortMineFirst error", e); }
      host.innerHTML = leftTasks.map(t => {
        const due = t.due_date ? `<span class="pl-due ${isOverdue(t) ? "is-overdue" : ""}">${esc(dueLabel(t.due_date))}</span>` : "";
        const st  = t.status ? `· ${esc(statusLabel(t.status))}` : "";
        const badge = isOverdue(t) ? `<span class="tag warn">Срок истёк</span>` : ``;

        const assigneeLabel = getTaskAssigneeLabel(t, uid);
const isSel = selectedId && String(selectedId) === String(t.id);
        return `
          <div class="item" data-id="${esc(t.id)}" style="${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
            <div class="item-title">${esc(t.title || "(без названия)")}${badge}</div>
            <div class="item-meta">${[assigneeLabel, startLabel(t.start_date), due, urgencyLabel(t.urgency), (t.status ? statusLabel(t.status) : "")].filter(Boolean).join(" · ")}</div>
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

      viewerEl.classList.remove("pl-archived");
viewerEl.querySelectorAll("button, input, textarea, select").forEach(x => { try{ x.disabled = false; }catch(e){} });

viewerEl.innerHTML = `
  <div class="pl-head">
    <div class="pl-head-left">
      <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
      <div class="muted" style="margin-top:6px; font-size:12px;">Обзор по статусам · клик по карточке открывает детали</div>

      <div class="pl-progress-row">
        <span class="pl-bracket">[</span>
        <div class="pl-progress">
          <div class="pl-progress-bar" style="--pl-progress:${pct}%;"></div>
        </div>
        <span class="pl-bracket">]</span>
</div>
    </div>

    <div class="pl-head-actions">
      ${(role === "admin" && done > 0) ? `<button class="btn btn-sm pl-btn-ghost" id="plArchiveDone" type="button">В архив: завершённые</button>` : ``}
      ${role === "admin" ? `<button class="btn btn-sm pl-btn-primary" id="plQuickCreate" type="button">+ Задача</button>` : ``}
      <button class="btn btn-sm pl-btn-ghost ${state.refreshBusy ? "is-loading" : ""}" id="plRefresh" type="button" ${state.refreshBusy ? "disabled" : ""}>${state.refreshBusy ? "Обновляю…" : "Обновить"}</button>
    </div>
  </div>

  <div id="plBoard"></div>
`;

      const rf = document.getElementById("plRefresh");
      const qc = document.getElementById("plQuickCreate");
      if(qc) qc.onclick = () => {
        try{
          if(!window.PlannerActions || typeof PlannerActions.openCreateDialog !== "function"){
            alert("Create UI missing");
            return;
          }
          PlannerActions.openCreateDialog({
            onCreate: async (payload) => {
              qc.disabled = true;
              try{
                const created = await PlannerAPI.createTask(payload);
                if(created && created.id){
                  location.hash = "#/planner/" + encodeURIComponent(String(created.id));
                }else{
                  show();
                }
                return created;
              }finally{
                qc.disabled = false;
              }
            }
          });
        }catch(err){
          console.warn("[Planner] openCreateDialog error", err);
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          alert("Ошибка: " + t);
        }
      };

      var ad = document.getElementById("plArchiveDone");
      if(ad) ad.onclick = async () => {
        if(!confirm("Перенести все завершённые задачи в архив?")) return;

        ad.disabled = true;
        try{
          if(!window.PlannerAPI || typeof PlannerAPI.archiveDoneTasks !== "function"){
            throw new Error("archiveDoneTasks RPC not wired");
          }
          const n = await PlannerAPI.archiveDoneTasks();
          alert("Готово. В архив перенесено: " + String(n || 0));
          show();
        }catch(err){
          console.warn("[Planner] archive done error", err);
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          alert("Ошибка: " + t);
          ad.disabled = false;
        }
      };
      if(rf) rf.onclick = async () => {
        if(state.refreshBusy) return;

        state.refreshBusy = true;
        renderRightHeader(tasks);

        try{
          const freshTasks = await fetchAllActiveTasks();
          renderLeft(freshTasks);
          renderRightHeader(freshTasks);
          renderBoard(freshTasks);
        }catch(err){
          console.warn("[Planner] refresh error", err);
        }finally{
          state.refreshBusy = false;
          try{
            const freshTasks = await fetchAllActiveTasks();
            renderLeft(freshTasks);
            renderRightHeader(freshTasks);
            renderBoard(freshTasks);
          }catch(err){
            console.warn("[Planner] refresh finalize error", err);
          }
        }
      };

}

    function renderBoard(tasks){
      const board = document.getElementById("plBoard");
      if(!board) return;      const grouped = window.PlannerState
        ? PlannerState.groupBoardTasks(tasks)
        : {
            new: tasks.filter(t => t.status === "new"),
            work: tasks.filter(t => ["taken","in_progress","problem"].includes(t.status)),
            done: tasks.filter(t => t.status === "done")
          };

      const cols = [
        { key:"new", label:"Новые задачи" },
        { key:"work", label:"В работе" },
        { key:"done", label:"Завершено" },
      ];

      const colHtml = cols.map(c => {
        let items = grouped[c.key] || [];

        items = window.PlannerState
          ? PlannerState.sortBoardItems(items)
          : [...items].sort((a,b) => {
              const da = a && a.due_date ? String(a.due_date) : "9999-99-99";
              const db = b && b.due_date ? String(b.due_date) : "9999-99-99";
              if(da !== db) return da < db ? -1 : 1;

              const ua = a && a.updated_at ? String(a.updated_at) : "";
              const ub = b && b.updated_at ? String(b.updated_at) : "";
              if(ua !== ub) return ua > ub ? -1 : 1;

              return 0;
            });
        const cards = items.length
          ? items.map(t => {
              const due = t.due_date ? `<span class="pl-due ${isOverdue(t) ? "is-overdue" : ""}">${esc(dueLabel(t.due_date))}</span>` : "";
              const isProblem = (String(t.status || "") === "problem");
              const isSel = selectedId && String(selectedId) === String(t.id);
              const projectLine = t.project_title
                ? `<div class="item-meta" style="margin-top:6px;">${esc(t.project_title)}</div>`
                : "";
              return `
                <div class="item" data-id="${esc(t.id)}" style="margin-top:10px; ${isProblem ? 'outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 12px 30px rgba(0,0,0,.35);' : ''} ${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
                  <div class="item-title">${esc(t.title || "(без названия)")}</div>
                  ${projectLine}
                  <div class="item-meta">${[startLabel(t.start_date), dueLabel(t.due_date), (isOverdue(t) ? "Срок истёк" : ""), urgencyLabel(t.urgency), statusLabel(t.status || "")].filter(Boolean).map(esc).join(" · ")}</div>
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
    async function fetchChecklistItems(taskId){
    if(!window.PlannerData) throw new Error("PlannerData missing");
    return await PlannerData.fetchChecklistItems(taskId);
  }function renderChecklist(items, isReadOnly){
      const host = document.getElementById("plChecklist");
      if(!host) return;

      if(!items || items.length === 0){
        host.innerHTML = `<div class="muted" style="font-size:12px;">Пункты пока не добавлены.</div>`;
        return;
      }

      const doneCount = items.filter(x => !!x.done).length;
      const total = items.length;

      host.innerHTML = `
        <div class="muted" style="font-size:12px; margin-bottom:8px;">${doneCount}/${total} выполнено</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${items.map(it => `
            <label style="display:flex; gap:10px; align-items:flex-start; cursor:${isReadOnly ? "default" : "pointer"};">
              <input
                type="checkbox"
                class="pl-ci"
                data-id="${esc(it.id)}"
                ${it.done ? "checked" : ""}
                ${isReadOnly ? "disabled" : ""}
                style="margin-top:3px;"
              >
              <span style="${it.done ? "opacity:.75; text-decoration:line-through;" : ""}">${esc(it.text || "(пусто)")}</span>
            </label>
          `).join("")}
        </div>
      `;
    }

    function bindChecklist(task){
      const host = document.getElementById("plChecklist");
      if(!host) return;

      host.querySelectorAll(".pl-ci").forEach(cb => {
        cb.onchange = async () => {
          const id = cb.dataset.id;
          const newDone = !!cb.checked;

          // optimistic disable
          host.querySelectorAll(".pl-ci").forEach(x => x.disabled = true);

          try{
            // auto-progress: taken -> in_progress on first action
            try{
              if(task && String(task.status || "") === "taken"){
                await PlannerActions.setStatus(task.id, "in_progress");
              }
            }catch(e){
              console.warn("[Planner] auto-progress error", e);
            }
            const rpc = await (PlannerAPI.setChecklistDone(id, newDone).then(() => ({ error: null })).catch(error => ({ error })));
            if(rpc && rpc.error) throw rpc.error;

            // If this was the first action, RPC may have bumped task taken -> in_progress.
            // To avoid blinking: reload checklist only, then do a full refresh only if status likely changed.
            const needFull = (String(task.status || "") === "taken");

            if(needFull){
              // local refresh (anti-jitter): status may have changed taken -> in_progress
              const tasks2 = await fetchAllActiveTasks();
              renderLeft(tasks2);

              const sel2 = getSelectedTaskId();
              if(sel2){
                const t2 = tasks2.find(x => String(x.id) === String(sel2));
                if(t2) renderDetails(t2);
              }
            }else{
              const items = await fetchChecklistItems(task.id);
              renderChecklist(items);
              bindChecklist(task);
            }
          }catch(err){
            console.warn("[Planner] checklist toggle error", err);
            const items = await fetchChecklistItems(task.id);
            renderChecklist(items);
            bindChecklist(task);
          }
        };
      });
    }

    async function loadChecklist(task, isReadOnly){
      try{
        const items = await fetchChecklistItems(task.id);
        renderChecklist(items, !!isReadOnly);

        if(!isReadOnly){
          bindChecklist(task);
        }
      }catch(err){
        console.warn("[Planner] checklist load error", err);
        const host = document.getElementById("plChecklist");
        if(host){
          const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки чекбоксов: ${esc(text)}</div>`;
        }
      }
    }
    async function fetchTaskFiles(taskId){
  if(!window.PlannerData) throw new Error("PlannerData missing");
  return await PlannerData.fetchTaskFiles(taskId);
}
async function fetchTaskLinks(taskId){
  if(!window.PlannerData) throw new Error("PlannerData missing");
  return await PlannerData.fetchTaskLinks(taskId);
}function parseInternalDoc(f){
  if(!f) return null;
      if(String(f.bucket_id || "") !== "internal") return null;

      const p = String(f.object_path || "").trim();
      const label = (f.file_name || p);

      // preferred format (same as admin internal links): "#/section/id"
      let m = p.match(/^#\/([^\/]+)\/(.+)$/);
      if(m){
        const section = m[1];
        const id = m[2];
        if(!["articles","checklists","templates"].includes(section)) return null;
        return { section, id, label, removable: false, source: "file" };
      }

      // fallback: "section/id"
      m = p.match(/^([^\/]+)\/(.+)$/);
      if(m){
        const section = m[1];
        const id = m[2];
        if(!["articles","checklists","templates"].includes(section)) return null;
        return { section, id, label, removable: false, source: "file" };
      }

      return null;
    }

    function parseTaskLink(link){
  if(!link) return null;

  const type = String(link.link_type || "").trim().toLowerCase();
  const refId = String(link.ref_id || "").trim();
  const url = String(link.url || "").trim();
  const label = String(link.label || "").trim() || "Открыть";
  const linkId = link.id ? String(link.id) : null;

  if(type === "article" && refId){
    return { section: "articles", id: refId, label, link_id: linkId, removable: true, source: "link" };
  }
  if(type === "checklist" && refId){
    return { section: "checklists", id: refId, label, link_id: linkId, removable: true, source: "link" };
  }
  if(type === "template" && refId){
    return { section: "templates", id: refId, label, link_id: linkId, removable: true, source: "link" };
  }
  if(type === "external" && url){
    return { section: "external", url, label, link_id: linkId, removable: true, source: "link" };
  }

  return null;
}

function openPlannerDoc(section, id){
  const sec = String(section || "").trim();
  const refId = String(id || "").trim();
  if(!sec || !refId) return;

  if(!["articles","checklists","templates"].includes(sec)) return;

  try{
    if(window.Router && typeof Router.go === "function"){
      Router.go(sec, refId);
      return;
    }
  }catch(e){
    console.warn("[Planner] openPlannerDoc Router.go error", e);
  }

  location.hash = "#/" + encodeURIComponent(sec) + "/" + encodeURIComponent(refId);
}

async function loadDocs(task){

  const role = (window.App && App.session) ? String(App.session.role || "") : "";
  const isAdmin = role === "admin";
  const isArchived = !!(task && task.archived_at);
  const host = document.getElementById("plDocs");
  if(!host) return;
  host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;

  try{
    const [links, files] = await Promise.all([
      fetchTaskLinks(task.id).catch(() => []),
      fetchTaskFiles(task.id).catch(() => [])
    ]);

    const docsFromLinks = (links || []).map(parseTaskLink).filter(Boolean);
    const docsFromFiles = (files || []).map(parseInternalDoc).filter(Boolean);

    const docs = [...docsFromLinks, ...docsFromFiles];

    if(docs.length === 0){
      host.innerHTML = `<div class="muted" style="font-size:12px;">Связанных документов нет.</div>`;
      return;
    }

    host.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${docs.map((d) => {
          const canRemove = !!(isAdmin && !isArchived && d.removable && d.link_id);
          const removeBtn = canRemove
            ? `<button class="pl-doc-remove" data-link-id="${esc(d.link_id)}" type="button" title="Убрать" style="
                flex:0 0 auto;
                width:26px;
                height:26px;
                border:1px solid rgba(255,255,255,.10);
                border-radius:999px;
                background:transparent;
                color:inherit;
                opacity:.55;
                cursor:pointer;
                line-height:1;
                padding:0;
              ">×</button>`
            : ``;

          const commonStyle = `
            display:block;
            width:100%;
            min-width:0;
            box-sizing:border-box;
            padding:6px 12px;
            border:1px solid rgba(255,255,255,.10);
            border-radius:999px;
            background:transparent;
            color:inherit;
            text-decoration:none;
            text-align:center;
            cursor:pointer;
            overflow:hidden;
          `;

          const labelHtml = `
            <span style="
              display:block;
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
              font-size:12px;
              line-height:1.2;
            ">${esc(d.label)}</span>
          `;

          const main = (d.section === "external")
            ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" style="${commonStyle}">
                ${labelHtml}
              </a>`
            : `<button class="pl-doc" data-sec="${esc(d.section)}" data-id="${esc(d.id)}" type="button" style="${commonStyle}">
                ${labelHtml}
              </button>`;

          return `
            <div style="display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; width:100%; min-width:0;">
              <div style="min-width:0; overflow:hidden;">
                ${main}
              </div>
              <div style="width:26px; display:flex; align-items:center; justify-content:center;">
                ${removeBtn}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    host.querySelectorAll(".pl-doc").forEach(b => {
      b.onclick = () => openPlannerDoc(b.dataset.sec, b.dataset.id);
    });

    host.querySelectorAll(".pl-doc-remove").forEach(b => {
      b.onclick = async () => {
        const linkId = b.dataset.linkId;
        if(!linkId) return;
        if(!confirm("Убрать этот документ из задачи?")) return;

        b.disabled = true;
        try{
          if(!window.PlannerAPI || typeof PlannerAPI.removeTaskLink !== "function"){
            throw new Error("removeTaskLink missing");
          }
          await PlannerAPI.removeTaskLink(linkId);
          await loadDocs(task);
        }catch(err){
          console.warn("[Planner] remove doc link error", err);
          const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          alert("Ошибка: " + text);
          b.disabled = false;
        }
      };
    });
  }catch(err){
    console.warn("[Planner] docs load error", err);
    const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
    host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки документов: ${esc(text)}</div>`;
  }
}
    async function fetchComments(taskId){
    if(!window.PlannerData) throw new Error("PlannerData missing");
    return await PlannerData.fetchComments(taskId);
  }
  async function fetchActivity(taskId){
    if(!window.PlannerData) throw new Error("PlannerData missing");
    return await PlannerData.fetchActivity(taskId);
  }function renderComments(task, items){
  const host = document.getElementById("plComments");
  if(!host) return;

  function fmtCommentTs(ts){
    if(!ts) return "";
    try{
      const d = new Date(ts);
      const dd = String(d.getDate()).padStart(2,"0");
      const mm = String(d.getMonth() + 1).padStart(2,"0");
      const hh = String(d.getHours()).padStart(2,"0");
      const mi = String(d.getMinutes()).padStart(2,"0");
      return `${dd}.${mm}, ${hh}:${mi}`;
    }catch(_){
      return String(ts);
    }
  }

  const list = (!items || items.length === 0)
    ? `<div class="muted" style="font-size:12px;">Комментариев пока нет.</div>`
    : `<div style="display:flex; flex-direction:column; gap:0;">
        ${items.map((c, idx) => {
          const author = resolvePersonLabel({
            id: c.author_id,
            display_name: c.author_display_name,
            full_name: c.author_name,
            name: c.author_label,
            email: c.author_email
          }, { uid, fallback: "Автор" });
          const ts = fmtCommentTs(c.created_at);
          const isLast = idx === items.length - 1;

          return `
            <div style="padding:6px 0; ${isLast ? "" : "border-bottom:1px solid rgba(255,255,255,.08);"}">
              <div style="display:flex; align-items:baseline; gap:6px; min-width:0; flex-wrap:wrap;">
                <span style="font-size:12px; line-height:1.35; min-width:0;">
                  <span class="muted">${esc(author)}:</span>
                  <span>${esc(c.body || "")}</span>
                </span>
                <span class="muted" style="font-size:10px; line-height:1.2; opacity:.72; white-space:nowrap;">
                  ${esc(ts)}
                </span>
              </div>
            </div>
          `;
        }).join("")}
      </div>`;

  host.innerHTML = `
    ${list}
    <div style="margin-top:12px;">
      <textarea id="plCommentInput" rows="3" class="pl-control pl-textarea" placeholder="Напишите комментарий…"></textarea>
      <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
        <button class="btn btn-sm" id="plCommentSend" type="button">Отправить</button>
        <span class="muted" id="plCommentMsg" style="font-size:12px;"></span>
      </div>
    </div>
  `;

  const send = document.getElementById("plCommentSend");
  const inp = document.getElementById("plCommentInput");
  const msg = document.getElementById("plCommentMsg");

  if(send){
    send.onclick = async () => {
      const text = (inp && inp.value) ? inp.value.trim() : "";
      if(!text){ if(msg) msg.textContent = "Пустой комментарий."; return; }

      send.disabled = true;
      if(msg) msg.textContent = "Сохраняю…";

      try{
        try{
          if(task && String(task.status || "") === "taken"){
            await PlannerActions.setStatus(task.id, "in_progress");
          }
        }catch(e){
          console.warn("[Planner] auto-progress error", e);
        }

        const r = await (PlannerAPI.addTaskComment(task.id, text).then(() => ({ error: null })).catch(error => ({ error })));
        if(r && r.error) throw r.error;

        if(inp) inp.value = "";
        if(msg) msg.textContent = "Готово.";
        await loadComments(task);
      }catch(err){
        console.warn("[Planner] add comment error", err);
        const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
        if(msg) msg.textContent = "Ошибка: " + t;
        send.disabled = false;
      }
    };
  }
}
    async function loadComments(task){
      const host = document.getElementById("plComments");
      if(host) host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;
      try{
        const items = await fetchComments(task.id);
        renderComments(task, items);
      }catch(err){
        console.warn("[Planner] comments load error", err);
        const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
        if(host) host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки комментариев: ${esc(text)}</div>`;
      }
    }
    function formatDateTimeShort(ts){
      if(!ts) return "";
      try{
        const d = new Date(ts);
        return d.toLocaleString("ru-RU", {
          day:"2-digit",
          month:"2-digit",
          hour:"2-digit",
          minute:"2-digit"
        });
      }catch(_){
        return String(ts);
      }
    }

    function formatActivityText(a){
      const type = String((a && a.type) || "");
      const p = (a && a.payload && typeof a.payload === "object") ? a.payload : {};

      if(type === "status_change"){
        const from = p.from ? statusLabel(p.from) : "—";
        const to = p.to ? statusLabel(p.to) : "—";
        return `Статус: ${from} → ${to}`;
      }

      if(type === "assignment_change"){
        const hasFrom = !!(p.from_assignee_id || p.from_assignee_name || p.from_assignee_display_name);
        const hasTo = !!(p.to_assignee_id || p.to_assignee_name || p.to_assignee_display_name);

        const fromLabel = resolvePersonLabel({
          id: p.from_assignee_id,
          display_name: p.from_assignee_display_name,
          full_name: p.from_assignee_name,
          name: p.from_assignee_label,
          email: p.from_assignee_email
        }, { uid, fallback: "Сотрудник" });

        const toLabel = resolvePersonLabel({
          id: p.to_assignee_id,
          display_name: p.to_assignee_display_name,
          full_name: p.to_assignee_name,
          name: p.to_assignee_label,
          email: p.to_assignee_email
        }, { uid, fallback: "Сотрудник" });

        if(!hasFrom && hasTo) return `Назначен сотрудник: ${toLabel}`;
        if(hasFrom && !hasTo) return `Исполнитель снят: ${fromLabel}`;
        if(hasFrom && hasTo) return `Исполнитель изменён: ${fromLabel} → ${toLabel}`;
        return "Исполнитель изменён";
      }

      if(type === "comment"){
        return "Добавлен комментарий";
      }

      if(type === "system"){
        const body = a && a.body ? String(a.body).trim() : "";
        return body || "Системное событие";
      }

      return "Событие";
    }
    function activityText(a){
      const type = String((a && a.type) || "");
      const p = (a && a.payload && typeof a.payload === "object") ? a.payload : {};

      if(type === "status_change"){
        const from = p.from ? String(p.from) : "—";
        const to = p.to ? String(p.to) : "—";
        return `Статус: ${statusLabel(from)} → ${statusLabel(to)}`;
      }

      if(type === "assignment_change"){
        const hasFrom = !!(p.from_assignee_id);
        const hasTo = !!(p.to_assignee_id);
        if(!hasFrom && hasTo) return "Задача назначена";
        if(hasFrom && !hasTo) return "Назначение снято";
        return "Назначение изменено";
      }

      if(type === "comment"){
        return "Добавлен комментарий";
      }

      if(type === "system"){
        return "Системное событие";
      }

      return type || "Событие";
    }

    function renderActivity(items){
  const host = document.getElementById("plActivity");
  if(!host) return;

  if(!items || items.length === 0){
    host.innerHTML = `<div class="muted" style="font-size:12px;">История пока пуста.</div>`;
    return;
  }

  host.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:6px;">
      ${items.map(a => `
        <div style="font-size:12px; line-height:1.35; display:flex; gap:8px;">
          <span class="muted" style="white-space:nowrap;">
            ${esc(formatDateTimeShort(a.created_at))}
          </span>
          <span style="opacity:.9;">
            ${esc(formatActivityText(a))}
          </span>
        </div>
      `).join("")}
    </div>
  `;
  }
    async function loadActivity(task){
      const host = document.getElementById("plActivity");
      if(host) host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;
      try{
        const items = await fetchActivity(task.id);
        renderActivity(items);
      }catch(err){
        console.warn("[Planner] activity load error", err);
        const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
        if(host) host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки истории: ${esc(text)}</div>`;
      }
    }

    function renderDetails(task){

      // STEP FIX — reset archived/read-only state
      viewerEl.classList.remove("pl-archived");
      viewerEl.querySelectorAll("button, input, textarea, select").forEach(x => { try{ x.disabled = false; }catch(e){} });
      const due = task.due_date ? `<span class="pill">${esc(dueLabel(task.due_date))}</span>` : "";
      const st  = task.status ? `<span class="pill">${esc(statusLabel(task.status))}</span>` : "";

      const cur = String(task.status || "new");
      const overduePill = isOverdue(task) ? `<span class="pill">Срок истёк</span>` : "";
      const isAdmin = (role === "admin");
      const isArchived = !!task.archived_at;
      const archivedPill = isArchived ? `<span class="pill">В архиве</span>` : "";

      const next = [];
      if(cur === "new") next.push(["taken","Взять в работу"]);
      if(cur === "taken") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
      if(cur === "in_progress") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
      if(cur === "problem") next.push(["in_progress","Проблема решена"], ["done","Успешно завершена"]);
      if(isAdmin && cur !== "canceled" && cur !== "done") next.push(["canceled","Отменить задачу"]);

      const editBtnHtml = (!isArchived && isAdmin)
        ? `<button class="btn btn-sm" id="plEditTask" type="button">Редактировать</button>`
        : ``;
      const archiveBtnHtml = (!isArchived && isAdmin)
        ? `<button class="btn btn-sm" id="plArchiveTask" type="button">Перенести задачу в архив</button>`
        : ``;

      const actionsHtml = (next.length === 0 && !archiveBtnHtml && !editBtnHtml) ? "" : `
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          ${next.map(([s,label]) => `<button class="btn btn-sm pl-status" data-s="${esc(s)}" type="button">${esc(label)}</button>`).join("")}
          ${editBtnHtml}
          ${archiveBtnHtml}
        </div>
        ${(next.length > 0 || editBtnHtml) ? `<div class="muted pl-status-msg" style="margin-top:8px; font-size:12px;"></div>` : ``}
      `;
      const urg = urgencyLabel(task.urgency) ? `<span class="pill">${esc(urgencyLabel(task.urgency))}</span>` : "";
      const start = task.start_date ? `<span class="pill">${esc(startLabel(task.start_date))}</span>` : "";
      const detailsProblemStyle = (cur === "problem")
        ? "outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 10px 26px rgba(0,0,0,.35);"
        : "";

      viewerEl.innerHTML = `
        <div class="item" style="cursor:default; margin:10px 12px 12px 12px;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:260px;">
              <div class="item-title">${esc(task.title || "(без названия)")}</div>
              <div class="item-meta" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                ${start}${due}${overduePill}${archivedPill}${urg}${st}
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
              <button class="btn btn-sm" id="plBack" type="button">Назад</button>
            </div>
          </div>

          ${actionsHtml}
        </div>
        <!-- Row 1: core + docs -->
        <div style="display:flex; gap:12px; padding:0 12px; align-items:flex-start; flex-wrap:wrap;">
          <!-- Left: core -->
          <div style="flex:2; min-width:320px;">

            ${task.project_title ? `
              <div class="item" style="cursor:default;">
                <div class="item-title">Проект</div>
                <div class="item-meta" style="margin-top:8px;">${esc(task.project_title)}</div>
              </div>
            ` : ""}

            <div class="item" style="cursor:default;">
  <div class="item-title">Исполнитель</div>
  <div class="item-meta" id="plAssigneeView" style="margin-top:8px;"></div>
</div>

<div class="item" style="cursor:default;">
              <div class="item-title">Описание</div>
              <div class="item-meta" style="margin-top:8px;">${task.body ? esc(task.body) : '<span class="muted">Описание пустое.</span>'}</div>
            </div>

            <div class="item" style="cursor:default;">
              <div class="item-title">Пункты задачи</div>
              <div class="item-meta" id="plChecklist" style="margin-top:10px;"></div>
            </div>
          </div>

                    <!-- Right: linked docs -->
          <div style="flex:1; min-width:240px;">
            <div class="item" style="cursor:default;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div class="item-title">Документы</div>

                ${(isAdmin && !isArchived) ? `
                  <button class="btn btn-sm pl-btn-ghost" id="plAddDocBtn" type="button">
                    + Добавить
                  </button>
                ` : ``}
              </div>

              <div class="item-meta" id="plDocs" style="margin-top:10px;"></div>
            </div>
          </div>
        </div>
        </div>

        <!-- Row 2: comments -->
        <div style="padding:0 12px 12px 12px;">
          <div class="item" style="cursor:default;">
            <div class="item-title">Комментарии</div>
            <div class="item-meta" id="plComments" style="margin-top:10px;"></div>
          </div>
        </div>

        <!-- Row 3: activity -->
        <div style="padding:0 12px 12px 12px;">
          <div class="item" style="cursor:default;">
            <div class="item-title">История</div>
            <div class="item-meta" id="plActivity" style="margin-top:10px; max-height:220px; overflow:auto; padding-right:4px;"></div>
          </div>
        </div>
      `;

      const _addDocBtn = document.getElementById("plAddDocBtn");
      if(_addDocBtn){
        _addDocBtn.onclick = () => {
          try{
            if(!window.PlannerActions || typeof PlannerActions.openLinkDialog !== "function"){
              throw new Error("openLinkDialog missing");
            }
            PlannerActions.openLinkDialog(task, {
              onAdded: async () => {
                const fresh = await PlannerData.fetchTaskById(task.id, { role, today });
                if(fresh) renderDetails(fresh);
              }
            });
          }catch(err){
            console.warn("[Planner] openLinkDialog error", err);
            alert("Ошибка открытия окна");
          }
        };
      }

      const assigneeView = document.getElementById("plAssigneeView");

      (async () => {
        try{
          let people = [];
          try{
            if(window.PlannerAPI && typeof PlannerAPI.fetchAssignablePeople === "function"){
              people = await PlannerAPI.fetchAssignablePeople();
            }
          }catch(e){
            console.warn("[Planner] fetchAssignablePeople error", e);
          }

          const peopleMap = {};
          (people || []).forEach(p => {
            if(!p || !p.id) return;
            peopleMap[String(p.id)] = {
              id: p.id,
              name: p.name,
              email: p.email,
              role: p.role
            };
          });

          if(assigneeView){
            const details = getTaskAssigneeDetails(task, peopleMap, uid);
            assigneeView.innerHTML = details.text;
          }
        }catch(err){
          console.warn("[Planner] assignment block init error", err);
        }
      })();

      const back = document.getElementById("plBack");
      if(back) back.onclick = (e) => {
        try{ if(e) e.preventDefault(); }catch(_){}
        if(window.Router && Router.go){
          Router.go("planner");
        }else{
          location.hash = "#/planner";
        }
      };
// bind status buttons (RPC)
      viewerEl.querySelectorAll(".pl-status").forEach(btn => {
        btn.onclick = async () => {
          const s = btn.dataset.s;
          const msg = viewerEl.querySelector(".pl-status-msg");

          viewerEl.querySelectorAll(".pl-status").forEach(x => x.disabled = true);
          if(msg) msg.textContent = "Сохраняю…";

          try{
            await PlannerActions.setStatus(task.id, s);
            if(msg) msg.textContent = "Готово.";
            // local refresh (anti-jitter): update list + details without re-mounting full planner
            const tasks2 = await fetchAllActiveTasks();
            renderLeft(tasks2);

            const sel2 = getSelectedTaskId();
            if(sel2){
              const t2 = tasks2.find(x => String(x.id) === String(sel2));
              if(t2) renderDetails(t2);
            }
          }catch(err){
            console.warn("[Planner] set status error", err);
            const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
            if(msg) msg.textContent = "Ошибка: " + text;
            viewerEl.querySelectorAll(".pl-status").forEach(x => x.disabled = false);
          }
        };
      });

      var _plEditBtn = document.getElementById("plEditTask");
      if(_plEditBtn){
        _plEditBtn.onclick = async () => {
          try{
            if(!window.PlannerActions || typeof PlannerActions.openEditDialog !== "function"){
              throw new Error("openEditDialog missing");
            }
            PlannerActions.openEditDialog(task, {
              onSave: async (payload) => {
                if(!window.PlannerAPI || typeof PlannerAPI.updateTask !== "function"){
                  throw new Error("updateTask missing");
                }
                return await PlannerAPI.updateTask(task.id, payload);
              },
              onAfterSubmit: async (taskIdAfterSave) => {
                const targetId = taskIdAfterSave || task.id;
                const tasks2 = await fetchAllActiveTasks();
                const fresh = await PlannerData.fetchTaskById(targetId, { role, today });

                renderLeft(tasks2);

                if(fresh){
                  renderDetails(fresh);
                }else{
                  show();
                }
              }
            });
          }catch(err){
            console.warn("[Planner] openEditDialog error", err);
            const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
            alert("Ошибка: " + t);
          }
        };
      }
      // archive button (admin)
      var _plArchiveBtn = document.getElementById("plArchiveTask");
      if(_plArchiveBtn){
        _plArchiveBtn.onclick = async () => {
          if(!confirm("Перенести задачу в архив?")) return;
          _plArchiveBtn.disabled = true;
          try{
            if(!window.PlannerAPI || typeof PlannerAPI.archiveTask !== "function"){
              throw new Error("archiveTask RPC not wired");
            }
            await PlannerAPI.archiveTask(task.id);
            goTask(null);
          }catch(err){
            console.warn("[Planner] archive task error", err);
            const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
            alert("Ошибка: " + t);
            _plArchiveBtn.disabled = false;
          }
        };
      }

      // archived task = read-only
      if(isArchived){
        if(window.PlannerRO && typeof PlannerRO.applyReadOnly === "function"){
          PlannerRO.applyReadOnly(viewerEl);
        }else{
          viewerEl.classList.add("pl-archived");
          viewerEl.querySelectorAll("button, input, textarea, select").forEach(x => { try{ x.disabled = true; }catch(e){} });
        }

        // still render blocks (but no interactions)
        loadChecklist(task, true);
        // STEP 8 — add doc button hook (clean)


loadDocs(task);
        loadComments(task);
        loadActivity(task);
        return;
      }
      

loadChecklist(task, false);
      // STEP 8 — add doc button hook (clean)


loadDocs(task);
      loadComments(task);
      loadActivity(task);
    }

    function renderEmpty(){
      renderRightHeader(tasks);
      const board = document.getElementById("plBoard");
      if(!board) return;

      if(role === "admin"){
        board.innerHTML = `
          <div class="empty" style="text-align:center;">
            <h2>PLANNER пуст.</h2>
            <p>Создайте первую задачу.</p>
            <div style="margin-top:16px;">
              <button class="btn" id="plCreateTask" type="button">Создать задачу</button>
            </div>
          </div>
        `;
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
      // [PlannerActions] wireCreateButton: minimal create flow (admin only)
      try{
        if(role === "admin" && window.PlannerActions && typeof PlannerActions.wireCreateButton === "function"){
          PlannerActions.wireCreateButton(() => {
            if(!window.PlannerActions || typeof PlannerActions.openCreateDialog !== "function"){
              alert("Create UI missing");
              return;
            }
            PlannerActions.openCreateDialog({
              onCreate: async (payload) => {
                const created = await PlannerAPI.createTask(payload);
                if(created && created.id){
                  location.hash = "#/planner/" + encodeURIComponent(String(created.id));
                }else{
                  show();
                }
                return created;
              }
            });
          });
        }
      }catch(e){
        console.warn("[Planner] wireCreateButton error", e);
      }

      return;
    }

    if(selectedId){
      const t = tasks.find(x => String(x.id) === String(selectedId));
      if(t) renderDetails(t);
      else {
        // fetchTaskById fallback (archived by direct link, read-only)
        try{
          if(window.PlannerAPI && typeof PlannerAPI.fetchTaskById === "function"){
            const one = await PlannerData.fetchTaskById(selectedId, { role, today });
            if(one && one.archived_at){
              renderDetails(one);
              return;
            }
          }
        }catch(err){
          console.warn("[Planner] fetchTaskById fallback error", err);
        }

        renderRightHeader(tasks);
        const board = document.getElementById("plBoard");
        if(board) board.innerHTML = `<div class="empty"><span class="muted">Задача не найдена или нет доступа.</span></div>`;
      }
    }else{
      renderRightHeader(tasks);
      renderBoard(tasks);
    }

    try{ console.log("[Planner] tasks", tasks.length, "leftFilter", state.leftFilter); }catch(e){}
  }

  return { show };
})();







































































































































































































