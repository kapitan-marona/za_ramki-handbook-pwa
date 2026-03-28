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
    try{
      if(typeof Router !== "undefined" && typeof Router.go === "function"){
        if(id) Router.go("planner", String(id));
        else Router.go("planner");
        return;
      }
    }catch(e){}
    location.hash = id ? ("#/planner/" + encodeURIComponent(String(id))) : "#/planner";
  }

  const PP = window.PlannerPresenters;
  if(!PP){
    throw new Error("PlannerPresenters missing");
  }

  const PA = window.PlannerActivity || {};
  const PIC = window.PlannerInlineChecklists || {};
  const PPL = window.PlannerPeople || {};
  const PD = window.PlannerDocs || {};
  const PC = window.PlannerComments || {};
  const PL = window.PlannerLeft || {};
  const PB = window.PlannerBoard || {};
  const PDH = window.PlannerDetailHelpers || {};
  const dueLabel = PP.dueLabel;
  const startLabel = PP.startLabel;
  const urgencyLabel = PP.urgencyLabel;
  const statusLabel = PP.statusLabel;
  const resolvePersonLabel = PP.resolvePersonLabel;
  const plannerDocTypeLabel = PP.plannerDocTypeLabel;

  function getTaskAssigneeLabel(task, uid){
    return PPL.getTaskAssigneeLabel(task, uid, {
      resolvePersonLabel
    });
  }

  function getTaskAssigneeDetails(task, peopleMap, uid){
    return PPL.getTaskAssigneeDetails(task, peopleMap, uid, {
      esc,
      resolvePersonLabel
    });
  }

  function getTaskAssigneeIds(task){
    return PPL.getTaskAssigneeIds(task);
  }

  function shouldShowInLeft(task, role, uid, leftFilter){
    return PPL.shouldShowInLeft(task, role, uid, leftFilter);
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
    if(!PL.renderLeft) throw new Error("PlannerLeft.renderLeft missing");

    return PL.renderLeft({
      listEl,
      tasks,
      role,
      uid,
      state,
      esc,
      dueLabel,
      urgencyLabel,
      startLabel,
      statusLabel,
      isOverdue,
      shouldShowInLeft,
      getTaskAssigneeLabel,
      selectedId,
      goTask,
      sortMineFirst: window.PlannerUX && typeof window.PlannerUX.sortMineFirst === "function"
        ? window.PlannerUX.sortMineFirst
        : null
    });
  }

    // ---------- RIGHT ----------
    function renderRightHeader(tasks){
      const total = Array.isArray(tasks) ? tasks.length : 0;
      const done = total ? tasks.filter(t => t.status === "done").length : 0;

      viewerEl.classList.remove("pl-archived");

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

        try{
          rf.classList.add("is-loading");
          rf.disabled = true;
          rf.textContent = "Обновляю…";
        }catch(e){}

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
      if(!PB.renderBoard) throw new Error("PlannerBoard.renderBoard missing");

      const board = document.getElementById("plBoard");

      return PB.renderBoard({
        board,
        viewerEl,
        tasks,
        esc,
        dueLabel,
        startLabel,
        urgencyLabel,
        statusLabel,
        isOverdue,
        selectedId,
        goTask
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
}

function parseInternalDoc(f){
  if(!PD.parseInternalDoc) throw new Error("PlannerDocs.parseInternalDoc missing");
  return PD.parseInternalDoc(f);
}
function parseTaskLink(link){
  if(!PD.parseTaskLink) throw new Error("PlannerDocs.parseTaskLink missing");
  return PD.parseTaskLink(link);
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

    if(typeof Router !== "undefined" && typeof Router.go === "function"){
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

function removeDocRowFromTaskView(linkId){
  return PD.removeDocRowFromTaskView(linkId);
}

function removeInlineChecklistFromTaskView(checklistId){
  return PIC.removeInlineChecklistFromTaskView(checklistId);
}

function applyLockedViewState(){
  viewerEl.classList.add("pl-archived");

  viewerEl.querySelectorAll("input, textarea, select").forEach(x => {
    try{
      x.disabled = true;
      x.readOnly = true;
      x.classList.add("is-disabled");
      x.classList.add("pl-readonly-disabled");
      x.setAttribute("aria-disabled", "true");
    }catch(e){}
  });

  // allow only Back + Archive
  viewerEl.querySelectorAll("button").forEach(btn => {
    try{
      const id = String(btn.id || "");
      if(id === "plBack" || id === "plArchiveTask") return;

      btn.disabled = true;
      btn.classList.add("is-disabled");
      btn.classList.add("pl-readonly-disabled");
      btn.setAttribute("aria-disabled", "true");
      btn.style.pointerEvents = "none";
    }catch(e){}
  });

  // disable clickable docs / links / checklist labels
  viewerEl.querySelectorAll(
    '#plDocs .pl-doc, #plDocs .pl-doc-remove, #plDocs a, #plComments a, #plChecklist label, #plChecklist .zr-planner-inline-cl, #plChecklist .zr-cl-item'
  ).forEach(x => {
    try{
      x.classList.add("pl-readonly-disabled");
      x.setAttribute("aria-disabled", "true");
      x.style.pointerEvents = "none";
    }catch(e){}
  });

  // hard stop for comment submit if it appears later
  viewerEl.querySelectorAll('#plComments button, #plComments textarea, #plComments input').forEach(x => {
    try{
      x.disabled = true;
      x.readOnly = true;
      x.classList.add("is-disabled");
      x.classList.add("pl-readonly-disabled");
      x.setAttribute("aria-disabled", "true");
      x.style.pointerEvents = "none";
    }catch(e){}
  });

  // docs add/remove
  viewerEl.querySelectorAll('#plAddDocBtn, #plDocs button').forEach(x => {
    try{
      const id = String(x.id || "");
      if(id === "plArchiveTask" || id === "plBack") return;
      x.disabled = true;
      x.classList.add("is-disabled");
      x.classList.add("pl-readonly-disabled");
      x.setAttribute("aria-disabled", "true");
      x.style.pointerEvents = "none";
    }catch(e){}
  });
}

async function loadDetailSections(task, checklistReadOnly){
  await loadChecklist(task, checklistReadOnly);
  await loadDocs(task);
  await loadComments(task);
  await loadActivity(task);
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

    function buildDetailViewState(task){
      const metaState = PDH.buildMetaState
        ? PDH.buildMetaState(task, {
            esc,
            dueLabel,
            statusLabel,
            urgencyLabel,
            startLabel,
            isOverdue
          })
        : {
            due: task.due_date ? `<span class="pill">${esc(dueLabel(task.due_date))}</span>` : "",
            st: task.status ? `<span class="pill">${esc(statusLabel(task.status))}</span>` : "",
            overduePill: isOverdue(task) ? `<span class="pill">Срок истёк</span>` : "",
            archivedPill: !!task.archived_at ? `<span class="pill">В архиве</span>` : "",
            urg: urgencyLabel(task.urgency) ? `<span class="pill">${esc(urgencyLabel(task.urgency))}</span>` : "",
            start: task.start_date ? `<span class="pill">${esc(startLabel(task.start_date))}</span>` : "",
            detailsProblemStyle: (String(task.status || "new") === "problem")
              ? "outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 10px 26px rgba(0,0,0,.35);"
              : ""
          };

      const actionState = PDH.buildActionState
        ? PDH.buildActionState(task, { role })
        : {
            cur: String(task.status || "new"),
            isAdmin: (role === "admin"),
            isArchived: !!task.archived_at,
            next: (function(){
              const cur = String(task.status || "new");
              const arr = [];
              if(cur === "new") arr.push(["taken","Взять в работу"]);
              if(cur === "taken") arr.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
              if(cur === "in_progress") arr.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
              if(cur === "problem") arr.push(["in_progress","Проблема решена"], ["done","Успешно завершена"]);
              if(role === "admin" && cur !== "canceled" && cur !== "done") arr.push(["canceled","Отменить задачу"]);
              return arr;
            })()
          };

      const isArchived = !!actionState.isArchived;
      const isLocked = isArchived || task.status === "done" || task.status === "canceled";

      return {
        metaState,
        actionState,
        due: metaState.due,
        st: metaState.st,
        overduePill: metaState.overduePill,
        archivedPill: metaState.archivedPill,
        urg: metaState.urg,
        start: metaState.start,
        detailsProblemStyle: metaState.detailsProblemStyle,
        cur: actionState.cur,
        isAdmin: !!actionState.isAdmin,
        isArchived,
        next: Array.isArray(actionState.next) ? actionState.next : [],
        isLocked,
        checklistReadOnly: !!isLocked
      };
    }
    function runDetailLockFlow(isLocked){
      if(!isLocked){
        return false;
      }

      let __plLockedApplied = false;
      const reapplyLockedState = () => {
        if(__plLockedApplied) return;
        try{ applyLockedViewState(); }catch(e){}
        __plLockedApplied = true;
      };

      reapplyLockedState();
      setTimeout(reapplyLockedState, 0);
      setTimeout(reapplyLockedState, 80);
      setTimeout(reapplyLockedState, 220);
      setTimeout(reapplyLockedState, 500);

      return true;
    }
    function renderDetails(task){

      // reset shell state before replacing detail DOM
      viewerEl.classList.remove("pl-archived");


      const detailState = buildDetailViewState(task);
      const metaState = detailState.metaState;
      const actionState = detailState.actionState;
      const due = detailState.due;
      const st = detailState.st;
      const cur = detailState.cur;
      const overduePill = detailState.overduePill;
      const isAdmin = detailState.isAdmin;
      const isArchived = detailState.isArchived;
      const archivedPill = detailState.archivedPill;
      const next = detailState.next;
      const urg = detailState.urg;
      const start = detailState.start;
      const detailsProblemStyle = detailState.detailsProblemStyle;
      const isLocked = detailState.isLocked;
      const checklistReadOnly = detailState.checklistReadOnly;
      
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

      viewerEl.innerHTML = PDH.buildLayout
        ? PDH.buildLayout(task, {
            esc,
            isAdmin,
            isArchived,
            start,
            due,
            overduePill,
            archivedPill,
            urg,
            st,
            actionsHtml,
            detailsProblemStyle
          })
        : `
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
              <div class="zr-planner-row">
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

      if(!isArchived && task.status !== "done" && task.status !== "canceled"){
        viewerEl.querySelectorAll(".pl-readonly-disabled, .is-disabled").forEach(x => {
          try{ x.classList.remove("pl-readonly-disabled"); }catch(e){}
          try{ x.classList.remove("is-disabled"); }catch(e){}
          try{ x.removeAttribute("aria-disabled"); }catch(e){}
          try{ x.style.pointerEvents = ""; }catch(e){}
        });
        viewerEl.querySelectorAll("button, input, textarea, select").forEach(x => {
          try{ x.disabled = false; }catch(e){}
          try{ x.readOnly = false; }catch(e){}
        });
      }
      const _addDocBtn = document.getElementById("plAddDocBtn");
      if(PDH.bindAddDocButton){
        PDH.bindAddDocButton(task, {
          button: _addDocBtn,
          loadDocs,
          loadChecklist,
          loadInlineChecklists
        });
      }

      const _addChecklistBtn = document.getElementById("plAddChecklistBtn");
      if(PDH.bindAddChecklistButton){
        PDH.bindAddChecklistButton(task, {
          button: _addChecklistBtn,
          loadInlineChecklists
        });
      }

      const assigneeView = document.getElementById("plAssigneeView");
      if(PDH.initAssigneeBlock){
        PDH.initAssigneeBlock(task, {
          assigneeView,
          uid,
          getTaskAssigneeDetails,
          fetchAssignablePeople: () => {
            if(window.PlannerAPI && typeof PlannerAPI.fetchAssignablePeople === "function"){
              return PlannerAPI.fetchAssignablePeople();
            }
            return [];
          }
        });
      }

      const back = document.getElementById("plBack");
      if(PDH.bindBackButton){
        PDH.bindBackButton({
          back,
          goTask
        });
      }

      if(PDH.bindStatusButtons){
        PDH.bindStatusButtons(task, {
          viewerEl,
          fetchAllActiveTasks,
          renderLeft,
          renderDetails,
          getSelectedTaskId,
          statusLabel
        });
      }

      var _plEditBtn = document.getElementById("plEditTask");
      if(PDH.bindEditButton){
        PDH.bindEditButton(task, {
          button: _plEditBtn,
          role,
          today,
          fetchAllActiveTasks,
          renderLeft,
          renderDetails,
          goTask,
          fetchTaskById: (taskId, ctx) => PlannerData.fetchTaskById(taskId, ctx)
        });
      }      
      
      // archive button (admin)
      var _plArchiveBtn = document.getElementById("plArchiveTask");
      if(PDH.bindArchiveButton){
        PDH.bindArchiveButton(task, {
          button: _plArchiveBtn,
          goTask
        });
      }      
// archived/done/canceled task = read-only content, but keep shell actions available
            loadDetailSections(task, checklistReadOnly);
      if(runDetailLockFlow(isLocked)){
        return;
      }
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
          if(window.PlannerData && typeof PlannerData.fetchTaskById === "function"){
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






























































