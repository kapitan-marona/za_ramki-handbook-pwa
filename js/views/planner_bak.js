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
  
  const PP = window.PlannerPresenters || {};
  const PIC = window.PlannerInlineChecklists || {};
  const PC = window.PlannerComments || {};
  const PA = window.PlannerActivity || {};
  const PD = window.PlannerDocs || {};

  const fmtDMY = PP.fmtDMY;
  const dueLabel = PP.dueLabel;
  const startLabel = PP.startLabel;
  const urgencyLabel = PP.urgencyLabel;
  const statusLabel = PP.statusLabel;

  function shortId(value){
    const s = value == null ? "" : String(value).trim();
    if(!s) return "";
    return s.length > 8 ? s.slice(0,8) : s;
  }

  const prettifyPersonName = PP.prettifyPersonName;
  const resolvePersonLabel = PP.resolvePersonLabel;
  const plannerDocTypeLabel = PP.plannerDocTypeLabel;
  

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
    function getCurrentSelectedId(){
  try{
    return getSelectedTaskId();
  }catch(e){
    return null;
  }
}
const selectedId = getCurrentSelectedId();
const isOverdue = (t) => window.PlannerState ? PlannerState.isOverdue(t, today) : !!(t.due_date && String(t.due_date) < today && t.status !== "done");

    // ---------- DATA (SELECT-only) ----------
async function fetchAllActiveTasks(){
  if(!window.PlannerData) throw new Error("PlannerData missing");
  return await PlannerData.fetchAllActiveTasks({ role, today });
}

async function loadInlineChecklists(task, isReadOnly, taskItems, opts){
  return await PIC.loadInlineChecklists(task, isReadOnly, taskItems, opts, {
    esc,
    fetchTaskLinks,
    fetchTaskFiles,
    parseTaskLink,
    parseInternalDoc,
    fetchAllActiveTasks,
    renderLeft,
    getSelectedTaskId,
    renderDetails
  });
}

if(window.PlannerChecklistRuntime && typeof PlannerChecklistRuntime.init === "function"){
  PlannerChecklistRuntime.init({
    esc,
    getChecklistHost: () => document.getElementById("plChecklist"),
    fetchAllActiveTasks,
    renderLeft,
    getSelectedTaskId,
    renderDetails,
    loadInlineChecklists
  });
}
// ---------- LEFT ----------
    function renderLeft(tasks){
      const head = `
        <div style="padding:12px 10px 8px 10px;">
          <div class="zr-panel-topline">PLANNER</div>
          <div class="zr-panel-subline">Список задач и быстрый переход к деталям.</div>
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
    <div class="zr-empty-shell">${esc(emptyText)}</div>
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
        const assigneeLabel = (role === "admin") ? getTaskAssigneeLabel(t, uid) : "";
        const isSel = selectedId && String(selectedId) === String(t.id);
        const projectLine = t.project_title
          ? `<div class="item-meta" style="margin-top:6px;">${esc(t.project_title)}</div>`
          : "";

        return `
          <div class="item ${isSel ? 'zr-list-row--active' : ''}" data-id="${esc(t.id)}">
            <div class="zr-list-row-title">${esc(t.title || "(без названия)")}</div>
            ${projectLine}
            <div class="zr-list-row-meta">${[assigneeLabel, startLabel(t.start_date), due, urgencyLabel(t.urgency), (t.status ? statusLabel(t.status) : "")].filter(Boolean).join(" · ")}</div>
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

      viewerEl.classList.remove("pl-archived");
viewerEl.querySelectorAll("button, input, textarea, select").forEach(x => { try{ x.disabled = false; }catch(e){} });

viewerEl.innerHTML = `
  <div class="pl-head">
    <div class="pl-head-left">
      <div class="zr-panel-topline">PLANNER</div>
      <div class="zr-panel-subline">Обзор по статусам · клик по карточке открывает детали</div>
    </div>

    <div class="pl-head-actions">
      ${(role === "admin" && done > 0) ? `<button class="btn btn-sm pl-btn-ghost" id="plArchiveDone" type="button">В архив: завершённые</button>` : ``}
      ${role === "admin" ? `<button class="btn btn-sm pl-btn-primary" id="plQuickCreate" type="button">+</button>` : ``}
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
                  goTask(created.id);
                }else { goTask(null); }
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

          const btn = document.getElementById("plRefresh");
          if(btn){
            btn.classList.remove("is-loading");
            btn.disabled = false;
            btn.textContent = "Обновить";
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
                  <div class="item-meta">${[startLabel(t.start_date), dueLabel(t.due_date), urgencyLabel(t.urgency), statusLabel(t.status || "")].filter(Boolean).map(esc).join(" · ")}</div>
                </div>
              `;
            }).join("")
          : `<div class="zr-board-col-empty">Пусто</div>`;

        return `
          <div class="zr-board-col">
            <div class="zr-board-col-head">
              <div class="zr-board-col-title">${esc(c.label)}</div>
              <div class="zr-board-col-count">${items.length}</div>
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
        host.innerHTML = `<div class="zr-planner-muted">Пункты пока не добавлены.</div>`;
        return;
      }

      const doneCount = items.filter(x => !!x.done).length;
      const total = items.length;

      host.innerHTML = `
        <div class="zr-planner-checklist">
          <div class="zr-planner-checklist-summary">${doneCount}/${total} выполнено</div>
          <div class="zr-planner-checklist-list">
            ${items.map(it => `
              <label class="zr-card zr-card--row zr-planner-checklist-row" style="cursor:${isReadOnly ? "default" : "pointer"};">
                <input
                  type="checkbox"
                  class="pl-ci"
                  data-id="${esc(it.id)}"
                  ${it.done ? "checked" : ""}
                  ${isReadOnly ? "disabled" : ""}
                >
                <span class="zr-planner-checklist-text ${it.done ? "is-done" : ""}">${esc(it.text || "(пусто)")}</span>
              </label>
            `).join("")}
          </div>
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
              const items = await PlannerChecklistRuntime.fetchChecklistItems(task.id);
              PlannerChecklistRuntime.renderChecklist(items);
              PlannerChecklistRuntime.bindChecklist(task);
            }
          }catch(err){
            console.warn("[Planner] checklist toggle error", err);
            const items = await PlannerChecklistRuntime.fetchChecklistItems(task.id);
            PlannerChecklistRuntime.renderChecklist(items);
            PlannerChecklistRuntime.bindChecklist(task);
          }
        };
      });
    }

    async function loadChecklist(task, isReadOnly){
      const host = document.getElementById("plChecklist");

      try{
        const items = await PlannerChecklistRuntime.fetchChecklistItems(task.id);
        const safeItems = Array.isArray(items) ? items : [];

        if(safeItems.length > 0){
          PlannerChecklistRuntime.renderChecklist(safeItems, !!isReadOnly);
          await loadInlineChecklists(task, !!isReadOnly, safeItems, { soft:true });
        }else{
          if(host){
            host.innerHTML = "";
          }

          await loadInlineChecklists(task, !!isReadOnly, safeItems, { soft:true });

          const hasInlineRendered = !!(
            host &&
            host.querySelector &&
            host.querySelector(".zr-planner-inline-cl")
          );

          if(!hasInlineRendered){
            PlannerChecklistRuntime.renderChecklist([], !!isReadOnly);
          }
        }

        if(!isReadOnly){
          PlannerChecklistRuntime.bindChecklist(task);
        }
      }catch(err){
        console.warn("[Planner] checklist load error", err);
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
    if(sec === "checklists"){
      const taskId = getSelectedTaskId();
      if(taskId){
        try{
          sessionStorage.setItem("zr_checklists_open_context", JSON.stringify({
            source: "planner",
            taskId: String(taskId),
            checklistId: String(refId)
          }));
        }catch(e){}
      }
    }

    if(window.Router && typeof Router.go === "function"){
      Router.go(sec, refId);
      return;
    }
  }catch(e){
    console.warn("[Planner] openPlannerDoc Router.go error", e);
  }

  location.hash = "#/" + encodeURIComponent(sec) + "/" + encodeURIComponent(refId);
}

const plannerDocsRuntime = PD.create ? PD.create({
  esc,
  plannerDocTypeLabel,
  fetchTaskLinks,
  fetchTaskFiles,
  parseTaskLink,
  parseInternalDoc,
  openPlannerDoc,
  removeInlineChecklistFromTaskView,
  removeDocRowFromTaskView,
  getPlannerChecklistApi
}) : null;


async function loadDocs(task){
  if(plannerDocsRuntime && typeof plannerDocsRuntime.loadDocs === "function"){
    return await plannerDocsRuntime.loadDocs(task);
  }
  throw new Error("plannerDocsRuntime.loadDocs missing");
}

    async function fetchComments(taskId){
    if(!window.PlannerData) throw new Error("PlannerData missing");
    return await PlannerData.fetchComments(taskId);
  }
  async function fetchActivity(taskId){
    if(!window.PlannerData) throw new Error("PlannerData missing");
    return await PlannerData.fetchActivity(taskId);
  }

function getPlannerChecklistApi(){
  return PIC.getPlannerChecklistApi();
}

function isPlannerInlineChecklistExpanded(taskId, checklistId){
  const map = getPlannerInlineChecklistUiState();
  const key = String(taskId || "") + "::" + String(checklistId || "");
  return map[key] !== false;
}

function removeDocRowFromTaskView(linkId){
  const safeId = String(linkId || "");
  if(!safeId) return;

  const host = document.getElementById("plDocs");
  if(!host) return;

  host.querySelectorAll('[data-link-id="' + safeId + '"]').forEach((btn) => {
    const card = btn.closest(".zr-planner-doc-card") || btn.closest(".zr-planner-doc-row");
    if(card){
      try{ card.remove(); }catch(e){}
    }
  });

  const list = host.querySelector(".zr-planner-docs-list");
  const hasCards = !!(list && (list.querySelector(".zr-planner-doc-card") || list.querySelector(".zr-planner-doc-row")));

  if(list && !hasCards){
    host.innerHTML = `<div class="muted" style="font-size:12px;">Связанных документов нет.</div>`;
  }
}

function removeInlineChecklistFromTaskView(checklistId){
  return PIC.removeInlineChecklistFromTaskView(checklistId);
}

function renderComments(task, items){
  if(!PC.renderComments) throw new Error("PlannerComments.renderComments missing");

  const host = document.getElementById("plComments");
  return PC.renderComments({
    host,
    task,
    items,
    uid,
    esc,
    resolvePersonLabel,
    getTaskAssigneeIds,
    loadComments
  });
}

async function loadComments(task){
  if(!PC.loadComments) throw new Error("PlannerComments.loadComments missing");

  const host = document.getElementById("plComments");
  return await PC.loadComments({
    host,
    task,
    uid,
    esc,
    resolvePersonLabel,
    getTaskAssigneeIds,
    fetchComments,
    loadComments
  });
}
    
    async function loadActivity(task){
      const host = document.getElementById("plActivity");
      return await PA.loadActivity(task, {
        host,
        fetchActivity,
        statusLabel,
        resolvePersonLabel,
        uid
      });
    }    

    function getRenderedTaskId(){
      try{
        const root = viewerEl && viewerEl.querySelector && viewerEl.querySelector(".zr-planner-detail");
        return root && root.getAttribute ? String(root.getAttribute("data-task-id") || "") : "";
      }catch(e){
        return "";
      }
    }

    function markRenderedTaskId(taskId){
      try{
        const root = viewerEl && viewerEl.querySelector && viewerEl.querySelector(".zr-planner-detail");
        if(root && root.setAttribute){
          root.setAttribute("data-task-id", String(taskId || ""));
        }
      }catch(e){}
    }

    async function refreshTaskBlocks(task, opts){
      const o = opts || {};
      if(!task || !task.id) return;

      const renderedTaskId = getRenderedTaskId();
      if(!renderedTaskId || String(renderedTaskId) !== String(task.id)) return;

      if(o.checklist){
        await loadChecklist(task, !!o.readOnly);
      }
      if(o.docs){
        await loadDocs(task);
      }
      if(o.comments){
        await loadComments(task);
      }
      if(o.activity){
        await loadActivity(task);
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
        ? `<button class="btn btn-sm pl-btn-ghost" id="plEditTask" type="button">Редактировать</button>`
        : ``;
      const archiveBtnHtml = (!isArchived && isAdmin)
        ? `<button class="btn btn-sm pl-btn-danger-soft" id="plArchiveTask" type="button">Перенести задачу в архив</button>`
        : ``;

      const actionsHtml = (next.length === 0 && !archiveBtnHtml && !editBtnHtml) ? "" : `
        <div class="zr-planner-actions">
          <div class="zr-planner-actions-main">
            ${next.map(([s,label]) => {
              const cls = (s === "done")
                ? "btn btn-sm pl-btn-primary pl-status"
                : (s === "problem" || s === "canceled")
                  ? "btn btn-sm pl-btn-danger-soft pl-status"
                  : "btn btn-sm pl-btn-ghost pl-status";
              return `<button class="${cls}" data-s="${esc(s)}" type="button">${esc(label)}</button>`;
            }).join("")}
          </div>
          <div class="zr-planner-actions-side">
            ${editBtnHtml}
            ${archiveBtnHtml}
          </div>
        </div>
        ${(next.length > 0 || editBtnHtml) ? `<div class="zr-planner-muted pl-status-msg zr-planner-status-note"></div>` : ``}
      `;
      const urg = urgencyLabel(task.urgency) ? `<span class="pill">${esc(urgencyLabel(task.urgency))}</span>` : "";
      const start = task.start_date ? `<span class="pill">${esc(startLabel(task.start_date))}</span>` : "";
      const detailsProblemStyle = (cur === "problem")
        ? "outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 10px 26px rgba(0,0,0,.35);"
        : "";

      viewerEl.innerHTML = `
        <div class="zr-planner-detail">
          <div class="zr-card zr-card--section zr-planner-hero" style="${detailsProblemStyle}">
            <div class="zr-planner-hero-top">
              <div class="zr-planner-hero-main">
                <div class="zr-planner-title">${esc(task.title || "(без названия)")}</div>
                <div class="zr-planner-meta">
                  ${start}${due}${overduePill}${archivedPill}${urg}${st}
                </div>
              </div>

              <div>
                <button class="btn btn-sm pl-btn-ghost" id="plBack" type="button">Назад</button>
              </div>
            </div>

            ${actionsHtml}
          </div>

          <div class="zr-planner-grid">
            <div class="zr-planner-maincol">
              ${task.project_title ? `
                <div class="zr-card zr-card--section zr-planner-section">
                  <div class="zr-section-head">
                    <div class="zr-section-title">Проект</div>
                  </div>
                  <div class="zr-planner-body-text">${esc(task.project_title)}</div>
                </div>
              ` : ""}

              <div class="zr-card zr-card--section zr-planner-section">
                <div class="zr-section-head">
                  <div class="zr-section-title">Исполнитель</div>
                </div>
                <div class="zr-planner-assignee" id="plAssigneeView"></div>
              </div>

              <div class="zr-card zr-card--section zr-planner-section">
                <div class="zr-section-head">
                  <div class="zr-section-title">Описание</div>
                </div>
                <div class="zr-planner-body-text">${task.body ? esc(task.body) : '<span class="zr-planner-muted">Описание пустое.</span>'}</div>
              </div>

              <div class="zr-card zr-card--section zr-planner-section">
                <div class="zr-section-head">
                  <div class="zr-section-title">Пункты задачи</div>
                </div>
                <div id="plChecklist"></div>
              </div>
            </div>

            <div class="zr-planner-sidecol">
              <div class="zr-card zr-card--subtle zr-planner-section">
                <div class="zr-section-head">
                  <div class="zr-section-title">Документы</div>

                  ${(isAdmin && !isArchived) ? `
                    <button class="btn btn-sm pl-btn-ghost" id="plAddDocBtn" type="button">+ Добавить</button>
                  ` : ``}
                </div>

                <div id="plDocs"></div>
              </div>
            </div>
          </div>

          <div class="zr-planner-logcol">
            <div class="zr-card zr-card--subtle zr-planner-section">
              <div class="zr-section-head">
                <div class="zr-section-title">Комментарии</div>
              </div>
              <div id="plComments"></div>
            </div>

            <div class="zr-card zr-card--subtle zr-planner-section">
              <div class="zr-section-head">
                <div class="zr-section-title">История</div>
              </div>
              <div id="plActivity"></div>
            </div>
          </div>
        </div>
      `;
      markRenderedTaskId(task.id);

      const _addDocBtn = document.getElementById("plAddDocBtn");
      if(_addDocBtn){
        _addDocBtn.onclick = () => {
          try{
            if(!window.PlannerActions || typeof PlannerActions.openLinkDialog !== "function"){
              throw new Error("openLinkDialog missing");
            }
            PlannerActions.openLinkDialog(task, {
              onAdded: async (saved, payload) => {
                try{
                  await loadDocs(task);

                  const addedType = payload && payload.link_type ? String(payload.link_type) : "";
                  if(addedType === "checklist"){
                    await loadInlineChecklists(task, false, [], { soft:true });
                  }else{
                    await loadChecklist(task, false);
                  }
                }catch(err){
                  console.warn("[Planner] soft refresh after add error", err);
                }
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
          goTask(null);
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
            const beforeStatus = String(task.status || "");

          await PlannerActions.setStatus(task.id, s);

          // push (after successful save)
          try{
            const tasks2 = await fetchAllActiveTasks();
            const updated = tasks2.find(x => String(x.id) === String(task.id));

            const assignees = updated && Array.isArray(updated.assignees) ? updated.assignees : [];
            const targetUserId = assignees.length ? String(assignees[0]) : "";
            const actorId = String(window.App?.session?.user?.id || "");

            if(
              updated &&
              beforeStatus !== String(updated.status || "") &&
              targetUserId &&
              targetUserId !== actorId &&
              typeof window.sendPlannerPush === "function"
            ){
              sendPlannerPush({
                userId: targetUserId,
                title: "ZA RAMKI",
                body: (updated && updated.title ? updated.title + " — статус: " + statusLabel(updated.status) : "Статус задачи изменён"),
                url: "./#/planner/" + task.id,
                tag: "planner-status_changed-" + task.id
              });
            }
          }catch(e){
            console.warn("[PlannerPush] status_changed error", e);
          }
            if(msg) msg.textContent = "Готово.";
            // local refresh (safe): update list + rebuild details so action buttons/status UI stay correct
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
                try{
                  console.log("[PlannerEdit] fresh task after save", {
                    id: fresh && fresh.id,
                    assignees: fresh && fresh.assignees,
                    assignee_id: fresh && fresh.assignee_id,
                    role: fresh && fresh.role,
                    status: fresh && fresh.status
                  });
                }catch(e){}

                renderLeft(tasks2);

                if(fresh){
                  renderDetails(fresh);
                }else { goTask(null); }
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
            <h2>Новых задач пока нет.</h2>
            <p>Чтобы добавить новую задачу, нажмите "+".</p>
            <p>Включи уведомления (колокольчик), чтобы быть в курсе изменений.</p>
            <div style="margin-top:16px;">
              <button class="btn" id="plCreateTask" type="button">Создать задачу</button>
            </div>
          </div>
        `;
      }else{
        board.innerHTML = `
          <div class="empty" style="text-align:center;">
            <h2>Новых задач пока нет.</h2>
            <p>Включи уведомления (колокольчик), чтобы быть в курсе изменений.</p>
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
                  goTask(created.id);
                }else { goTask(null); }
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


























