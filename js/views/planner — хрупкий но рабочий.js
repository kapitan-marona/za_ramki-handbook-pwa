window.Views = window.Views || {};

Views.Planner = (() => {


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
    }
    state = window.__plannerState;
    state.ownerKey = ownerKey;
    // rebind after possible reset
    const today = todayISO();
    const selectedId = getSelectedTaskId();
const isOverdue = (t) => window.PlannerState ? PlannerState.isOverdue(t, today) : !!(t.due_date && String(t.due_date) < today && t.status !== "done");

    // ---------- DATA (SELECT-only) ----------
async function fetchAllActiveTasks(){
  if(!window.PlannerData) throw new Error("PlannerData missing");
  return await PlannerData.fetchAllActiveTasks({ role, today });
}


if(window.PlannerChecklistRuntime && typeof PlannerChecklistRuntime.init === "function"){
  PlannerChecklistRuntime.init({
    esc,
    getChecklistHost: () => document.getElementById("plChecklist"),
    fetchAllActiveTasks,
    renderLeft,
    getSelectedTaskId,
    renderDetails
  });
}

const detailSections = (window.PlannerDetailSections && typeof PlannerDetailSections.create === "function")
  ? PlannerDetailSections.create({
      esc,
      uid,
      getSelectedTaskId,
      resolvePersonLabel,
      getTaskAssigneeIds,
      plannerDocTypeLabel,
      statusLabel,
      isCurrentDetailTask
    })
  : null;

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
      ${(role === "admin" && done > 0) ? `<button class="btn btn-sm btn--ghost" id="plArchiveDone" type="button">В архив: завершённые</button>` : ``}
      ${role === "admin" ? `<button class="btn btn-sm btn--primary" id="plQuickCreate" type="button">+</button>` : ``}
      <button class="btn btn-sm btn--ghost ${state.refreshBusy ? "is-loading" : ""}" id="plRefresh" type="button" ${state.refreshBusy ? "disabled" : ""}>${state.refreshBusy ? "Обновляю…" : "Обновить"}</button>
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
      if(!detailSections || typeof detailSections.loadChecklist !== "function"){
        throw new Error("PlannerDetailSections.loadChecklist missing");
      }
      return await detailSections.loadChecklist(task, isReadOnly);
    }

    async function loadDocs(task){
      if(!detailSections || typeof detailSections.loadDocs !== "function"){
        throw new Error("PlannerDetailSections.loadDocs missing");
      }
      return await detailSections.loadDocs(task);
    }

    async function loadComments(task, isReadOnly){
      if(!detailSections || typeof detailSections.loadComments !== "function"){
        throw new Error("PlannerDetailSections.loadComments missing");
      }
      return await detailSections.loadComments(task, isReadOnly);
    }

    async function loadActivity(task){
      if(!detailSections || typeof detailSections.loadActivity !== "function"){
        throw new Error("PlannerDetailSections.loadActivity missing");
      }
      return await detailSections.loadActivity(task);
    }

    async function loadDetailSections(task, checklistReadOnly){
      if(!detailSections || typeof detailSections.loadDetailSections !== "function"){
        throw new Error("PlannerDetailSections.loadDetailSections missing");
      }
      return await detailSections.loadDetailSections(task, checklistReadOnly);
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

    function isCurrentDetailTask(taskId){
      return String(getRenderedTaskId() || "") === String(taskId || "");
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
    function runDetailLockFlow(isLocked, taskId, detailLoadPromise){
      if(!isLocked){
        return false;
      }

      const expectedTaskId = String(taskId || "");
      const reapplyLockedState = () => {
        if(expectedTaskId && !isCurrentDetailTask(expectedTaskId)) return;
        try{ applyLockedViewState(); }catch(e){}
      };

      reapplyLockedState();
      setTimeout(reapplyLockedState, 0);
      setTimeout(reapplyLockedState, 80);
      setTimeout(reapplyLockedState, 220);
      setTimeout(reapplyLockedState, 500);

      if(detailLoadPromise && typeof detailLoadPromise.then === "function"){
        detailLoadPromise.then(
          () => { reapplyLockedState(); },
          () => { reapplyLockedState(); }
        );
      }

      return true;
    }
    function renderDetails(task){

      const incomingId = String(task && task.id || "");

      // reset shell state before replacing detail DOM
      viewerEl.classList.remove("pl-archived");


      const detailState = buildDetailViewState(task);
      const isArchived = detailState.isArchived;
      const isLocked = detailState.isLocked;
      const checklistReadOnly = detailState.checklistReadOnly;
      
      const actionsHtml = PDH.buildActionsHtml
        ? PDH.buildActionsHtml(task, {
            esc,
            next: detailState.next,
            isAdmin: detailState.isAdmin,
            isArchived: detailState.isArchived
          })
        : "";

      if(!PDH.buildLayout){
        throw new Error("PlannerDetailHelpers.buildLayout missing");
      }
      
      const detailLayoutContext = {
        esc,
        isAdmin: detailState.isAdmin,
        isArchived: detailState.isArchived,
        start: detailState.start,
        due: detailState.due,
        overduePill: detailState.overduePill,
        archivedPill: detailState.archivedPill,
        urg: detailState.urg,
        st: detailState.st,
        actionsHtml,
        detailsProblemStyle: detailState.detailsProblemStyle
      };

      viewerEl.innerHTML = PDH.buildLayout(task, detailLayoutContext);
      markRenderedTaskId(task.id);

      const detailInteractionContext = {
        viewerEl,
        isArchived,
        loadDocs,
        loadChecklist,
        uid,
        getTaskAssigneeDetails,
        goTask,
        fetchAllActiveTasks,
        renderLeft,
        getSelectedTaskId,
        statusLabel,
        startLabel,
        dueLabel,
        urgencyLabel,
        isOverdue,
        role,
        today,
        renderDetails,
        fetchTaskById: (taskId, ctx) => PlannerData.fetchTaskById(taskId, ctx)
      };

      if(PDH.bindDetailInteractions){
        PDH.bindDetailInteractions(task, detailInteractionContext);
      }  

      const detailPostLoadContext = {
        loadDetailSections,
        checklistReadOnly,
        runDetailLockFlow,
        isCurrentDetailTask,
        isLocked
      };

      if(PDH.runDetailPostLoad && PDH.runDetailPostLoad(task, detailPostLoadContext)){
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
              <button class="btn btn--primary" id="plCreateTask" type="button">Создать задачу</button>
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
        }

        renderRightHeader(tasks);
        const board = document.getElementById("plBoard");
        if(board) board.innerHTML = `<div class="empty"><span class="muted">Задача не найдена или нет доступа.</span></div>`;
      }
    }else{
      renderRightHeader(tasks);
      renderBoard(tasks);
    }

  }

  return { show };
})();


















































































