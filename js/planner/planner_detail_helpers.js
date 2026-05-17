window.PlannerDetailHelpers = (() => {
  function initAssigneeBlock(task, opts){
    const o = opts || {};
    const assigneeView = o.assigneeView;
    const getTaskAssigneeDetails = o.getTaskAssigneeDetails;
    const uid = o.uid;
    const fetchAssignablePeople = o.fetchAssignablePeople;

    (async () => {
      try{
        let people = [];
        try{
          if(typeof fetchAssignablePeople === "function"){
            people = await fetchAssignablePeople();
          }
        }catch(e){
          console.warn("[PlannerDetailHelpers] fetchAssignablePeople error", e);
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

        if(assigneeView && typeof getTaskAssigneeDetails === "function"){
          const details = getTaskAssigneeDetails(task, peopleMap, uid);
          assigneeView.innerHTML = details && details.text ? details.text : "";
        }
      }catch(err){
        console.warn("[PlannerDetailHelpers] assignment block init error", err);
      }
    })();
  }

  function bindBackButton(opts){
    const o = opts || {};
    const back = o.back;
    const goTask = o.goTask;

    if(!back) return;

    back.onclick = (e) => {
      try{
        if(e) e.preventDefault();
      }catch(_){}

      try{
        if(window.Router && typeof Router.go === "function"){
          Router.go("planner");
          return;
        }
      }catch(err){
        console.warn("[PlannerDetailHelpers] back Router.go error", err);
      }

      if(typeof goTask === "function"){
        goTask(null);
      }
    };
  }

  function bindAddDocButton(task, opts){
    const o = opts || {};
    const button = o.button;
    const loadDocs = o.loadDocs;
    const loadChecklist = o.loadChecklist;

    if(!button) return;

    button.onclick = () => {
      try{
        if(!window.PlannerActions || typeof PlannerActions.openLinkDialog !== "function"){
          throw new Error("openLinkDialog missing");
        }

        PlannerActions.openLinkDialog(task, {
          allowedTypes: ["article","template","external"],
          defaultType: "article",
          onAdded: async (saved, payload) => {
            try{
              if(typeof loadDocs === "function"){
                await loadDocs(task);
              }

              if(typeof loadChecklist === "function"){
                await loadChecklist(task, false);
              }
            }catch(err){
              console.warn("[PlannerDetailHelpers] soft refresh after add error", err);
            }
          }
        });
      }catch(err){
        console.warn("[PlannerDetailHelpers] openLinkDialog error", err);
        alert("Ошибка открытия окна");
      }
    };
  }
  
  function bindDocsToggle(opts){
    const o = opts || {};
    const viewerEl = o.viewerEl;
    const taskId = o.taskId;

    if(!viewerEl) return;

    const section = viewerEl.querySelector("#plDocsSection");
    const toggle = viewerEl.querySelector("#plDocsToggle");
    const docsRoot = viewerEl.querySelector("#plDocs");

    if(!section || !toggle || !docsRoot) return;

    const saved = readDetailUiState(taskId);
    const countEl = toggle.querySelector(".zr-section-title-toggle__count");

    const applyCollapsedState = (collapsed) => {
      section.classList.toggle("is-collapsed", !!collapsed);
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      syncDetailGridLayout(viewerEl);
    };

    applyCollapsedState(!!saved.docsCollapsed);

    if(countEl){
      if(typeof saved.docsCount === "number"){
        countEl.textContent = `(${saved.docsCount})`;
      }else{
        countEl.textContent = "(…)";
      }
    }

    const updateCount = () => {
      let count = 0;

      try{
        count = docsRoot.querySelectorAll(".zr-planner-doc-card, .zr-planner-doc-row").length;
      }catch(e){
        count = 0;
      }

      const currentSaved = readDetailUiState(taskId);
      const prevCount = (typeof currentSaved.docsCount === "number") ? currentSaved.docsCount : null;

      if(count <= 0){
        const text = String((docsRoot.textContent || "").trim()).toLowerCase();
        const looksExplicitlyEmpty =
          text.includes("нет") ||
          text.includes("пуст") ||
          text.includes("не добав");

        if(!looksExplicitlyEmpty && prevCount != null){
          if(countEl){
            countEl.textContent = `(${prevCount})`;
          }
          return;
        }
      }

      if(countEl){
        countEl.textContent = `(${count})`;
      }

      writeDetailUiState(taskId, { docsCount: count });
    };

    updateCount();

    if(section.__zrDocsObserver){
      try{ section.__zrDocsObserver.disconnect(); }catch(e){}
      section.__zrDocsObserver = null;
    }

    if(toggle.__zrDocsToggleHandler){
      toggle.removeEventListener("click", toggle.__zrDocsToggleHandler);
    }

    const onClick = (e) => {
      try{
        if(e) e.preventDefault();
      }catch(_){}

      const collapsed = !section.classList.contains("is-collapsed");
      applyCollapsedState(collapsed);

      writeDetailUiState(taskId, {
        docsCollapsed: collapsed
      });
    };

    toggle.__zrDocsToggleHandler = onClick;
    toggle.addEventListener("click", onClick);

    const obs = new MutationObserver(() => {
      updateCount();
    });

    try{
      obs.observe(docsRoot, { childList:true, subtree:true });
    }catch(e){}

    section.__zrDocsObserver = obs;
  }
  
  function bindDetailsToggle(opts){
    const o = opts || {};
    const viewerEl = o.viewerEl;
    const taskId = o.taskId;

    if(!viewerEl) return;

    const section = viewerEl.querySelector("#plDetailsSection");
    const toggle = viewerEl.querySelector("#plDetailsToggle");
    const body = viewerEl.querySelector("#plDetailsBody");

    if(!section || !toggle || !body) return;

    const saved = readDetailUiState(taskId);

    const applyState = (collapsed) => {
      section.classList.toggle("is-collapsed", !!collapsed);
      body.style.display = collapsed ? "none" : "";

      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");

      const labelEl = toggle.querySelector(".zr-section-title-toggle__label");
      if(labelEl){
        labelEl.textContent = collapsed ? "Показать детали" : "Скрыть детали";
      }

      syncDetailGridLayout(viewerEl);
    };

    applyState(!!saved.detailsCollapsed);

    if(toggle.__zrDetailsToggleHandler){
      toggle.removeEventListener("click", toggle.__zrDetailsToggleHandler);
    }

    const onClick = (e) => {
      try{
        if(e) e.preventDefault();
      }catch(_){}

      const collapsed = !section.classList.contains("is-collapsed");
      applyState(collapsed);

      writeDetailUiState(taskId, {
        detailsCollapsed: collapsed
      });
    };

    toggle.__zrDetailsToggleHandler = onClick;
    toggle.addEventListener("click", onClick);
  }

  function bindAddChecklistButton(task, opts){
    const o = opts || {};
    const button = o.button;

    if(!button) return;

    button.onclick = () => {
      try{
        if(!window.PlannerActions || typeof PlannerActions.openLinkDialog !== "function"){
          throw new Error("openLinkDialog missing");
        }

        PlannerActions.openLinkDialog(task, {
          allowedTypes: ["checklist"],
          defaultType: "checklist",
          onAdded: async () => {
            try{
              if(!window.PlannerChecklistRuntime){
                throw new Error("PlannerChecklistRuntime missing");
              }

              const links = await PlannerAPI.fetchTaskLinks(task.id);
              console.log("[DEBUG links after add]", links);

              const items = await PlannerChecklistRuntime.fetchChecklistItems(task.id);
              const safeItems = Array.isArray(items) ? items : [];

              PlannerChecklistRuntime.renderChecklist(safeItems, false);
              PlannerChecklistRuntime.bindChecklist(task);
            }catch(err){
              console.warn("[PlannerDetailHelpers] runtime refresh after checklist add error", err);
            }
          }
        });
      }catch(err){
        console.warn("[PlannerDetailHelpers] open checklist dialog error", err);
        alert("Ошибка открытия окна");
      }
    };
  }
  
    function getDetailUiStorageKey(taskId){
    return `zr_planner_detail_ui_${String(taskId || "")}`;
  }

  function readDetailUiState(taskId){
    try{
      if(!taskId || !window.localStorage) return {};
      const raw = localStorage.getItem(getDetailUiStorageKey(taskId));
      if(!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object") ? parsed : {};
    }catch(e){
      return {};
    }
  }

  function writeDetailUiState(taskId, patch){
    try{
      if(!taskId || !window.localStorage) return;
      const prev = readDetailUiState(taskId);
      const next = Object.assign({}, prev, patch || {});
      localStorage.setItem(getDetailUiStorageKey(taskId), JSON.stringify(next));
    }catch(e){}
  }
  
    function syncDetailGridLayout(viewerEl){
    try{
      if(!viewerEl) return;

      const grid = viewerEl.querySelector(".zr-planner-grid");
      const detailsSection = viewerEl.querySelector("#plDetailsSection");
      const docsSection = viewerEl.querySelector("#plDocsSection");
      const checklistSection = viewerEl.querySelector("#plChecklist") && viewerEl.querySelector("#plChecklist").closest(".zr-planner-section");

      if(!grid || !detailsSection || !docsSection || !checklistSection) return;

      const detailsCollapsed = detailsSection.classList.contains("is-collapsed");
      const docsCollapsed = docsSection.classList.contains("is-collapsed");
      const bothCollapsed = detailsCollapsed && docsCollapsed;

      grid.classList.toggle("zr-planner-grid--compact-top", bothCollapsed);
      checklistSection.classList.toggle("zr-planner-section--fullwidth", bothCollapsed);
    }catch(e){
      console.warn("[PlannerDetailHelpers] syncDetailGridLayout error", e);
    }
  }

  function bindEditButton(task, opts){
    const o = opts || {};
    const button = o.button;
    const role = o.role;
    const today = o.today;
    const fetchAllActiveTasks = o.fetchAllActiveTasks;
    const renderLeft = o.renderLeft;
    const renderDetails = o.renderDetails;
    const goTask = o.goTask;
    const fetchTaskById = o.fetchTaskById;

    if(!button) return;

    button.onclick = async () => {
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
            const fresh = (typeof fetchTaskById === "function")
              ? await fetchTaskById(targetId, { role, today })
              : null;

            // debug log removed: keep edit save path lightweight
            // Skip full left-list refresh after edit.
            // Detail will re-render from fresh task below.
            // Full task list refresh is intentionally avoided here to keep edit save path responsive.

            if(fresh){
              if(typeof renderDetails === "function"){
                renderDetails(fresh);
              }
            }else{
              if(typeof goTask === "function"){
                goTask(null);
              }
            }
          }
        });
      }catch(err){
        console.warn("[PlannerDetailHelpers] openEditDialog error", err);
        const t = (err && (err.message || err.details || err.hint))
          ? (err.message || err.details || err.hint)
          : String(err);
        alert("Ошибка: " + t);
      }
    };
  }

  function bindArchiveButton(task, opts){
    const o = opts || {};
    const button = o.button;
    const goTask = o.goTask;

    if(!button) return;

    button.onclick = async () => {
      if(!confirm("Перенести задачу в архив?")) return;

      button.disabled = true;
      try{
        if(!window.PlannerAPI || typeof PlannerAPI.archiveTask !== "function"){
          throw new Error("archiveTask RPC not wired");
        }

        await PlannerAPI.archiveTask(task.id);

        if(typeof goTask === "function"){
          goTask(null);
        }
      }catch(err){
        console.warn("[PlannerDetailHelpers] archive task error", err);
        const t = (err && (err.message || err.details || err.hint))
          ? (err.message || err.details || err.hint)
          : String(err);
        alert("Ошибка: " + t);
        button.disabled = false;
      }
    };
  }

  function buildActionState(task, opts){
    const o = opts || {};
    const role = String(o.role || "");

    const cur = String((task && task.status) || "new");
    const canEdit = canUserEditTask(task, role, opts.uid);
    const isAdmin = (role === "admin");
    const isArchived = !!(task && task.archived_at);
    const next = [];

    const canCancel = isAdmin && cur !== "canceled" && cur !== "done";

    if(cur === "new"){
      next.push(["taken","Взять в работу"]);
    }

    if(cur === "taken" || cur === "in_progress"){
      next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
    }

    if(cur === "problem"){
      next.push(["in_progress","Проблема решена"], ["done","Успешно завершена"]);
    }

    if(canCancel){
      next.push(["canceled","Отменить задачу"]);
    }

    return {
      cur,
      canEdit,
      isAdmin,
      isArchived,
      next
    };
  }

  function buildMetaState(task, opts){
    const o = opts || {};
    const esc = o.esc;
    const dueLabel = o.dueLabel;
    const statusLabel = o.statusLabel;
    const urgencyLabel = o.urgencyLabel;
    const startLabel = o.startLabel;
    const isOverdue = o.isOverdue;

    const safeEsc = (typeof esc === "function")
      ? esc
      : (v => String(v == null ? "" : v));

    const safeDueLabel = (typeof dueLabel === "function")
      ? dueLabel
      : (v => String(v == null ? "" : v));

    const safeStatusLabel = (typeof statusLabel === "function")
      ? statusLabel
      : (v => String(v == null ? "" : v));

    const safeUrgencyLabel = (typeof urgencyLabel === "function")
      ? urgencyLabel
      : (v => String(v == null ? "" : v));

    const safeStartLabel = (typeof startLabel === "function")
      ? startLabel
      : (v => String(v == null ? "" : v));

    const due = task && task.due_date
      ? `<span class="pill">${safeEsc(safeDueLabel(task.due_date))}</span>`
      : "";

    const st = task && task.status
      ? `<span class="pill">${safeEsc(safeStatusLabel(task.status))}</span>`
      : "";

    const overduePill = (task && typeof isOverdue === "function" && isOverdue(task))
      ? `<span class="pill">Срок истёк</span>`
      : "";

    const isArchived = !!(task && task.archived_at);
    const archivedPill = isArchived
      ? `<span class="pill">В архиве</span>`
      : "";

    const urgText = task ? safeUrgencyLabel(task.urgency) : "";
    const urg = urgText
      ? `<span class="pill">${safeEsc(urgText)}</span>`
      : "";

    const start = task && task.start_date
      ? `<span class="pill">${safeEsc(safeStartLabel(task.start_date))}</span>`
      : "";

    const cur = String((task && task.status) || "new");
    const detailsProblemStyle = (cur === "problem")
      ? "outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 10px 26px rgba(0,0,0,.35);"
      : "";

    return {
      due,
      st,
      overduePill,
      archivedPill,
      urg,
      start,
      detailsProblemStyle
    };
  }

  function bindStatusButtons(task, opts){
    const o = opts || {};
    const viewerEl = o.viewerEl;
    const fetchAllActiveTasks = o.fetchAllActiveTasks;
    const renderLeft = o.renderLeft;
    const renderDetails = o.renderDetails;
    const getSelectedTaskId = o.getSelectedTaskId;
    const statusLabel = o.statusLabel;

    if(!viewerEl) return;

    viewerEl.__zrStatusTask = task;
    viewerEl.__zrStatusOpts = o;

    if(viewerEl.__zrStatusDelegatedBound) return;
    viewerEl.__zrStatusDelegatedBound = true;

    viewerEl.addEventListener("click", async (e) => {
      const archiveBtn = e.target && e.target.closest ? e.target.closest("#plArchiveTask") : null;
      if(archiveBtn && viewerEl.contains(archiveBtn)){
        const liveTask = viewerEl.__zrStatusTask;
        const liveOpts = viewerEl.__zrStatusOpts || {};

        if(!liveTask) return;

        if(!confirm("Перенести задачу в архив?")) return;

        archiveBtn.disabled = true;
        try{
          if(!window.PlannerAPI || typeof PlannerAPI.archiveTask !== "function"){
            throw new Error("archiveTask RPC not wired");
          }

          await PlannerAPI.archiveTask(liveTask.id);

          if(typeof liveOpts.goTask === "function"){
            liveOpts.goTask(null);
          }
        }catch(err){
          console.warn("[PlannerDetailHelpers] archive task error", err);
          const t = (err && (err.message || err.details || err.hint))
            ? (err.message || err.details || err.hint)
            : String(err);
          alert("Ошибка: " + t);
          archiveBtn.disabled = false;
        }
        return;
      }

      const btn = e.target && e.target.closest ? e.target.closest(".pl-status") : null;
      if(!btn || !viewerEl.contains(btn)) return;

      const liveTask = viewerEl.__zrStatusTask;
      const liveOpts = viewerEl.__zrStatusOpts || {};
      const liveFetchAllActiveTasks = liveOpts.fetchAllActiveTasks;
      const liveRenderLeft = liveOpts.renderLeft;
      const liveRenderDetails = liveOpts.renderDetails;
      const liveGetSelectedTaskId = liveOpts.getSelectedTaskId;
      const liveStatusLabel = liveOpts.statusLabel;

      if(!liveTask) return;

      const s = btn.dataset.s;
      const msg = viewerEl.querySelector(".pl-status-msg");

      if(String(s || "") === "canceled"){
        const ok = confirm("Отменить задачу?");
        if(!ok) return;
      }

      viewerEl.querySelectorAll(".pl-status").forEach(x => x.disabled = true);
      if(msg) msg.textContent = "Сохраняю…";

      try{
        const beforeStatus = String(liveTask.status || "");

        await PlannerActions.setStatus(liveTask.id, s);
        const t2 = Object.assign({}, liveTask, { status: s });

        // Skip full left-list refresh after status change.
        // Detail/header update below keeps the current task responsive.
        // Full task list refresh is intentionally avoided here to reduce save latency.

        try{
          const updated = t2;

          const assignees = updated && Array.isArray(updated.assignees) ? updated.assignees : [];
          const targetUserId = assignees.length ? String(assignees[0]) : "";
          const actorId = String(window.App?.session?.user?.id || "");

          if(
            updated &&
            beforeStatus !== String(updated.status || "") &&
            targetUserId &&
            targetUserId !== actorId &&
            false && typeof window.sendPlannerPush === "function"
          ){
            sendPlannerPush({
              userId: targetUserId,
              title: "ZA RAMKI",
              body: (updated && updated.title
                ? updated.title + " — статус: " + liveStatusLabel(updated.status)
                : "Статус задачи изменён"),
              url: "./#/planner/" + liveTask.id,
              tag: "planner-status_changed-" + liveTask.id
            });
          }
        }catch(e){
          console.warn("[PlannerPush] status_changed error", e);
        }

        if(msg) msg.textContent = "Готово.";

        const sel2 = liveGetSelectedTaskId();
        if(sel2 && String(sel2) === String(liveTask.id)){
          liveRenderDetails(t2);
          viewerEl.__zrStatusTask = t2;
        }
      }catch(err){
        console.warn("[PlannerDetailHelpers] set status error", err);
        const text = (err && (err.message || err.details || err.hint))
          ? (err.message || err.details || err.hint)
          : String(err);

        if(msg) msg.textContent = "Ошибка: " + text;
        viewerEl.querySelectorAll(".pl-status").forEach(x => x.disabled = false);
      }
    });
  }

  function buildActionsHtml(task, opts){
    const o = opts || {};
    const esc = o.esc || (v => String(v == null ? "" : v));
    const next = Array.isArray(o.next) ? o.next : [];
    const isAdmin = !!o.isAdmin;
    const isArchived = !!o.isArchived;
    const canEdit = !!o.canEdit;

    const cur = String((task && task.status) || "");

    let statusBtns = "";
    let adminBtns = "";

    // --- STATUS BUTTONS (assignee/admin with edit rights) ---
    if(cur === "new" && canEdit && !isArchived){
      statusBtns = `
        <button class="btn btn-sm btn--ghost pl-status" data-s="taken">Взять в работу</button>
      `;
    }

    if((cur === "taken" || cur === "in_progress") && canEdit && !isArchived){
      statusBtns = `
        <button class="btn btn-sm btn--danger pl-status" data-s="problem">⚠ Возникла проблема</button>
        <button class="btn btn-sm btn--primary pl-status" data-s="done">Успешно завершена</button>
      `;
    }

    if(cur === "problem" && canEdit && !isArchived){
      statusBtns = `
        <button class="btn btn-sm btn--primary pl-status" data-s="in_progress">✓ Проблема решена</button>
        <button class="btn btn-sm btn--primary pl-status" data-s="done">Успешно завершена</button>
      `;
    }

    // --- ADMIN BUTTONS ONLY ---
    if(isAdmin && !isArchived){
      const adminOnlyNext = next.filter(([s]) => {
        return (
          s !== "taken" &&
          s !== "problem" &&
          s !== "done" &&
          s !== "in_progress"
        );
      });

      adminBtns = `
        ${adminOnlyNext.map(([s,label]) => {
          const cls = (s === "canceled")
            ? "btn btn-sm btn--danger pl-status"
            : "btn btn-sm btn--ghost pl-status";

          return `<button class="${cls}" data-s="${esc(s)}">${esc(label)}</button>`;
        }).join("")}

        <button class="btn btn-sm btn--danger" id="plArchiveTask">
          Перенести в архив
        </button>
      `;
    }

    return `
      <div class="zr-planner-actions">
        ${adminBtns ? `
          <div class="zr-planner-actions-admin">
            ${adminBtns}
          </div>
        ` : ``}

        ${statusBtns ? `
          <div class="zr-planner-actions-status">
            ${statusBtns}
          </div>
        ` : ``}

        <div class="zr-planner-muted pl-status-msg zr-planner-status-note"></div>
      </div>
    `;
  }
  
  function buildHeroTopActionsHtml(task, opts){
    const o = opts || {};
    const isAdmin = !!o.isAdmin;
    const isArchived = !!o.isArchived;

    const editBtnHtml = (isAdmin && !isArchived)
      ? `<button class="btn btn-sm btn--ghost" id="plEditTask" type="button">Редактировать</button>`
      : "";

    return `
      <div class="zr-planner-hero-top-actions">
        <div class="zr-planner-hero-top-nav">
          <button class="btn btn-sm btn--ghost" id="plBack" type="button">Назад</button>
        </div>

        ${editBtnHtml ? `
          <div class="zr-planner-hero-top-admin">
            ${editBtnHtml}
          </div>
        ` : ``}
      </div>
    `;
  }
  
  function buildLayout(task, opts){
    const o = opts || {};
    const esc = o.esc;
    const isAdmin = !!o.isAdmin;
    const isArchived = !!o.isArchived;
    const start = o.start || "";
    const due = o.due || "";
    const overduePill = o.overduePill || "";
    const archivedPill = o.archivedPill || "";
    const urg = o.urg || "";
    const st = o.st || "";
    const actionsHtml = o.actionsHtml || "";
    const detailsProblemStyle = o.detailsProblemStyle || "";

    const safeEsc = (typeof esc === "function")
      ? esc
      : (v => String(v == null ? "" : v));

    const hasDetails = !!(
      task.project_title ||
      (Array.isArray(task.assignees) && task.assignees.length) ||
      (task.body && String(task.body).trim())
    );

    const hasChecklistContent = !!(
      Array.isArray(task.checklist_items) && task.checklist_items.length
    );

    const hasDocsContent = !!(
      Array.isArray(task.links) && task.links.length
    );

    const hideChecklistInitially = (!isAdmin && !hasChecklistContent);
    const hideDocsInitially = (!isAdmin && !hasDocsContent);

    return `
      <div class="zr-planner-detail">
        <div class="zr-card zr-card--section zr-planner-hero" style="${detailsProblemStyle}">
          <div class="zr-planner-hero-top">
            <div class="zr-planner-hero-main">
              <div class="zr-planner-title">${safeEsc(task.title || "(без названия)")}</div>
              <div class="zr-planner-meta" style="display:flex; flex-wrap:wrap; gap:6px;">
                ${overduePill}${archivedPill}${st}
                ${start}${due}${urg}
              </div>
            </div>

            ${buildHeroTopActionsHtml(task, { isAdmin, isArchived })}
          </div>

          ${actionsHtml}
        </div>

        <div class="zr-planner-grid${!hasDetails ? ` zr-planner-grid--no-details` : ``}${hideDocsInitially ? ` zr-planner-grid--no-sidecol` : ``}">
          <div class="zr-planner-maincol">
            ${hasDetails ? `
              <div class="zr-card zr-card--section zr-planner-section zr-planner-details-section" id="plDetailsSection">
                <div class="zr-section-head zr-section-head--details">
                  <button
                    class="zr-section-title zr-section-title--toggle"
                    id="plDetailsToggle"
                    type="button"
                    aria-expanded="true"
                  >
                    <span class="zr-section-title-toggle__label">Скрыть детали</span>
                  </button>
                </div>

                <div class="zr-planner-details-body" id="plDetailsBody">
                  <div class="zr-planner-row">
                    ${task.project_title ? `
                      <div class="zr-card zr-card--section zr-planner-section">
                        <div class="zr-section-head">
                          <div class="zr-section-title">Проект</div>
                        </div>
                        <div class="zr-planner-body-text">${safeEsc(task.project_title)}</div>
                      </div>
                    ` : ""}

                    ${Array.isArray(task.assignees) && task.assignees.length ? `
                      <div class="zr-card zr-card--section zr-planner-section">
                        <div class="zr-section-head">
                          <div class="zr-section-title">Исполнитель</div>
                        </div>
                        <div class="zr-planner-assignee" id="plAssigneeView"></div>
                      </div>
                    ` : ""}
                  </div>

                  ${task.body ? `
                    <div class="zr-card zr-card--section zr-planner-section">
                      <div class="zr-section-head">
                        <div class="zr-section-title">Описание</div>
                      </div>
                      <div class="zr-planner-body-text">${safeEsc(task.body)}</div>
                    </div>
                  ` : ""}
                </div>
              </div>
            ` : ""}

            <div
              class="zr-card zr-card--section zr-planner-section"
              id="plChecklistSection"
              data-initial-has-content="${hasChecklistContent ? "1" : "0"}"
              ${hideChecklistInitially ? `style="display:none;"` : ``}
            >
              <div class="zr-section-head" style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                <div class="zr-section-title">Пункты задачи</div>
                ${(isAdmin && !isArchived) ? `
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-sm btn--ghost" id="plAddChecklistBtn" type="button">+ Добавить чек-лист</button>
                    <button class="btn btn-sm btn--ghost" id="plRemoveChecklistBtn" type="button" style="display:none;">Удалить</button>
                  </div>
                ` : ``}
              </div>
              <div id="plChecklist"></div>
            </div>
          </div>

          <div class="zr-planner-sidecol"${hideDocsInitially ? ` style="display:none;"` : ``}>
            <div
              class="zr-card zr-card--subtle zr-planner-section zr-planner-docs-section${hasDocsContent ? ` is-collapsed` : ``}"
              id="plDocsSection"
              data-initial-has-content="${hasDocsContent ? "1" : "0"}"
            >
              <div class="zr-section-head zr-section-head--docs">
                ${hasDocsContent ? `
                  <button
                    class="zr-section-title zr-section-title--toggle"
                    id="plDocsToggle"
                    type="button"
                    aria-expanded="false"
                  >
                    <span class="zr-section-title-toggle__label">Документы</span>
                    <span class="zr-section-title-toggle__count">(…)</span>
                  </button>
                ` : `
                  <div class="zr-section-title" id="plDocsStaticTitle">Документы</div>
                `}

                <div class="zr-planner-docs-head-actions">
                  ${(isAdmin && !isArchived) ? `
                    <button class="btn btn-sm btn--ghost" id="plAddDocBtn" type="button">+ Добавить</button>
                  ` : ``}
                </div>
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
            <div id="plComments" class="zr-comments-surface"></div>
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
  }
  
  function canUserEditTask(task, role, uid){
    if(role === "admin") return true;

    const assignees = Array.isArray(task.assignees) ? task.assignees : [];
    const isAssignee = assignees.includes(String(uid));
    const scope = String(task.role || "all");

    if(scope === "admin") return false;

    if(scope === "all"){
      if(assignees.length === 0) return true; // свободная задача
      return isAssignee;
    }

    if(scope === "staff"){ // ← позже переименуем в assignee-only
      return isAssignee;
    }

    return false;
  }

  function updateDetailHeaderOnly(task, opts){
    try{
      const viewerEl = opts.viewerEl;
      if(!viewerEl) return;

      const root = viewerEl.querySelector(".zr-planner-detail");
      if(!root) return;

      const hero = root.querySelector(".zr-planner-hero");
      if(!hero) return;

      const titleEl = hero.querySelector(".zr-planner-title");
      if(titleEl){
        titleEl.textContent = task.title || "(без названия)";
      }

      const metaEl = hero.querySelector(".zr-planner-meta");
      if(metaEl && typeof opts.buildMeta === "function"){
        metaEl.innerHTML = opts.buildMeta(task);
      }

      const isProblem = String(task && task.status || "") === "problem";
      hero.style.outline = isProblem ? "1px solid rgba(255,80,80,.45)" : "";
      hero.style.boxShadow = isProblem
        ? "0 0 0 1px rgba(255,80,80,.18), 0 10px 26px rgba(0,0,0,.35)"
        : "";

      const heroTopActionsHost = hero.querySelector(".zr-planner-hero-top-actions");
      if(heroTopActionsHost){
        heroTopActionsHost.outerHTML = buildHeroTopActionsHtml(task, {
          isAdmin: !!(opts && opts.role === "admin"),
          isArchived: !!(task && task.archived_at)
        });
      }

      if(typeof opts.buildActions === "function"){
        const actionsHost = hero.querySelector(".zr-planner-actions");
        const noteHost = hero.querySelector(".pl-status-msg") || hero.querySelector(".zr-planner-status-note");

        const tmp = document.createElement("div");
        tmp.innerHTML = opts.buildActions(task);

        const newActions = tmp.querySelector(".zr-planner-actions");
        const newNote = tmp.querySelector(".pl-status-msg") || tmp.querySelector(".zr-planner-status-note");

        if(actionsHost && newActions){
          actionsHost.innerHTML = newActions.innerHTML;
        }

        if(noteHost && newNote){
          noteHost.innerHTML = newNote.innerHTML;
        }
      }

      if(typeof bindBackButton === "function"){
        const back = hero.querySelector("#plBack");
        bindBackButton({
          back,
          goTask: opts.goTask
        });
      }

      if(typeof bindEditButton === "function"){
        const editBtn = hero.querySelector("#plEditTask");
        bindEditButton(task, {
          button: editBtn,
          role: opts.role,
          today: opts.today,
          fetchAllActiveTasks: opts.fetchAllActiveTasks,
          renderLeft: opts.renderLeft,
          renderDetails: opts.renderDetails,
          goTask: opts.goTask,
          fetchTaskById: opts.fetchTaskById
        });
      }

      // archive button is handled by delegated click inside bindStatusButtons

    }catch(e){
      console.warn("[PlannerDetailHelpers] header update error", e);
    }
  }

  function bindDetailInteractions(task, opts){
    const o = opts || {};
    const viewerEl = o.viewerEl;
    const loadDocs = o.loadDocs;
    const loadChecklist = o.loadChecklist;
    const uid = o.uid;
    const getTaskAssigneeDetails = o.getTaskAssigneeDetails;
    const goTask = o.goTask;
    const fetchAllActiveTasks = o.fetchAllActiveTasks;
    const renderLeft = o.renderLeft;
    const getSelectedTaskId = o.getSelectedTaskId;
    const statusLabel = o.statusLabel;
    const startLabel = o.startLabel;
    const dueLabel = o.dueLabel;
    const urgencyLabel = o.urgencyLabel;
    const isOverdue = o.isOverdue;
    const role = o.role;
    const today = o.today;
    const renderDetails = o.renderDetails;
    const fetchTaskById = o.fetchTaskById;

    if(!viewerEl) return;
    
    // detail DOM may be re-rendered for the same task after status/edit updates,
    // so per-task early return is unsafe here
    viewerEl.__zrBoundTaskId = task.id;

    const byId = (id) => {
      try{
        return viewerEl.querySelector(`#${id}`);
      }catch(e){
        return null;
      }
    };

    if(!o.isArchived && task.status !== "done" && task.status !== "canceled"){
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

    const _addDocBtn = byId("plAddDocBtn");
    if(bindAddDocButton){
      bindAddDocButton(task, {
        button: _addDocBtn,
        loadDocs,
        loadChecklist
      });
    }

    if(typeof bindDocsToggle === "function"){
      bindDocsToggle({
        viewerEl,
        taskId: task && task.id
      });
    }

    if(typeof bindDetailsToggle === "function"){
      bindDetailsToggle({
        viewerEl,
        taskId: task && task.id
      });
    }

    const _addChecklistBtn = byId("plAddChecklistBtn");
    if(bindAddChecklistButton){
      bindAddChecklistButton(task, {
        button: _addChecklistBtn
      });
    }

    const assigneeView = byId("plAssigneeView");
    if(initAssigneeBlock){
      initAssigneeBlock(task, {
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

    const back = byId("plBack");
    if(bindBackButton){
      bindBackButton({
        back,
        goTask
      });
    }

    if(bindStatusButtons){
      bindStatusButtons(task, {
        viewerEl,
        fetchAllActiveTasks,
        renderLeft,
        renderDetails,
        updateDetailHeaderOnly,
        getSelectedTaskId,
        statusLabel,
        startLabel,
        dueLabel,
        urgencyLabel,
        isOverdue,
        role,
        today,
        goTask,
        fetchTaskById
      });
    }

    const _plEditBtn = byId("plEditTask");
    if(bindEditButton){
      bindEditButton(task, {
        button: _plEditBtn,
        role,
        today,
        fetchAllActiveTasks,
        renderLeft,
        renderDetails,
        goTask,
        fetchTaskById
      });
    }

    // archive button is handled by delegated click inside bindStatusButtons
  }

  function runDetailPostLoad(task, opts){
    const o = opts || {};
    const loadDetailSections = o.loadDetailSections;
    const checklistReadOnly = !!o.checklistReadOnly;
    const runDetailLockFlow = o.runDetailLockFlow;
    const isCurrentDetailTask = o.isCurrentDetailTask;
    const viewerEl = o.viewerEl;

    const byId = (id) => {
      if(viewerEl && typeof viewerEl.querySelector === "function"){
        return viewerEl.querySelector(`#${id}`);
      }
      return document.getElementById(id);
    };

    const clearDetailMinHeights = () => {
      if(typeof isCurrentDetailTask === "function" && !isCurrentDetailTask(task.id)) return;

      ["plChecklist", "plDocs", "plComments", "plActivity"].forEach(id => {
        const el = byId(id);
        if(el){
          el.style.minHeight = "";
        }
      });
    };

    const detailLoadPromise = (typeof loadDetailSections === "function")
      ? loadDetailSections(task, checklistReadOnly).finally(() => {
          clearDetailMinHeights();
        })
      : Promise.resolve(false).finally(() => {
          clearDetailMinHeights();
        });

    if(typeof runDetailLockFlow === "function"){
      return runDetailLockFlow(!!o.isLocked, task.id, detailLoadPromise);
    }

    return false;
  }

  return {
    initAssigneeBlock,
    bindBackButton,
    bindAddDocButton,
    bindDocsToggle,
    bindDetailsToggle,    
    bindAddChecklistButton,
    bindEditButton,
    bindArchiveButton,
    buildActionState,
    buildMetaState,
    buildActionsHtml,
    bindStatusButtons,
    buildLayout,
    updateDetailHeaderOnly,
    bindDetailInteractions,
    runDetailPostLoad
  };
})();



