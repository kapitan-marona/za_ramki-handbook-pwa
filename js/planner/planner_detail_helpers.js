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

            try{
              console.log("[PlannerEdit] fresh task after save", {
                id: fresh && fresh.id,
                assignees: fresh && fresh.assignees,
                assignee_id: fresh && fresh.assignee_id,
                role: fresh && fresh.role,
                status: fresh && fresh.status
              });
            }catch(e){}

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
    const role = o.role;

    const cur = String((task && task.status) || "new");
    const isAdmin = (role === "admin");
    const isArchived = !!(task && task.archived_at);

    const next = [];
    if(cur === "new") next.push(["taken","Взять в работу"]);
    if(cur === "taken") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
    if(cur === "in_progress") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
    if(cur === "problem") next.push(["in_progress","Проблема решена"], ["done","Успешно завершена"]);
    if(isAdmin && cur !== "canceled" && cur !== "done") next.push(["canceled","Отменить задачу"]);

    return {
      cur,
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

    const due = task && task.due_date
      ? `<span class="pill">${safeEsc(dueLabel(task.due_date))}</span>`
      : "";

    const st = task && task.status
      ? `<span class="pill">${safeEsc(statusLabel(task.status))}</span>`
      : "";

    const overduePill = (task && typeof isOverdue === "function" && isOverdue(task))
      ? `<span class="pill">Срок истёк</span>`
      : "";

    const isArchived = !!(task && task.archived_at);
    const archivedPill = isArchived
      ? `<span class="pill">В архиве</span>`
      : "";

    const urgText = task ? urgencyLabel(task.urgency) : "";
    const urg = urgText
      ? `<span class="pill">${safeEsc(urgText)}</span>`
      : "";

    const start = task && task.start_date
      ? `<span class="pill">${safeEsc(startLabel(task.start_date))}</span>`
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

        // soft refresh left list so status changes appear immediately there too
        try{
          if(typeof liveFetchAllActiveTasks === "function" && typeof liveRenderLeft === "function"){
            const tasks2 = await liveFetchAllActiveTasks();
            liveRenderLeft(tasks2);
          }
        }catch(e){
          console.warn("[PlannerDetailHelpers] left list refresh after status failed", e);
        }

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
            typeof window.sendPlannerPush === "function"
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
          if(typeof liveOpts.updateDetailHeaderOnly === "function"){
            liveOpts.updateDetailHeaderOnly(t2, {
              viewerEl,
              buildMeta: (task) => {
                const parts = [];

                if(task.start_date && typeof liveOpts.startLabel === "function"){
                  parts.push(`<span class="pill">${liveOpts.startLabel(task.start_date)}</span>`);
                }

                if(task.due_date && typeof liveOpts.dueLabel === "function"){
                  parts.push(`<span class="pill">${liveOpts.dueLabel(task.due_date)}</span>`);
                }

                if(typeof liveOpts.isOverdue === "function" && liveOpts.isOverdue(task)){
                  parts.push(`<span class="pill">Срок истёк</span>`);
                }

                if(task.archived_at){
                  parts.push(`<span class="pill">В архиве</span>`);
                }

                if(typeof liveOpts.urgencyLabel === "function"){
                  const urg = liveOpts.urgencyLabel(task.urgency);
                  if(urg) parts.push(`<span class="pill">${urg}</span>`);
                }

                if(task.status && typeof liveStatusLabel === "function"){
                  parts.push(`<span class="pill">${liveStatusLabel(task.status)}</span>`);
                }

                return parts.join("");
              },
              buildActions: (task) => {
                const cur = String((task && task.status) || "new");
                const isAdmin = (liveOpts.role === "admin");
                const isArchived = !!(task && task.archived_at);

                const next = [];
                if(cur === "new") next.push(["taken","Взять в работу"]);
                if(cur === "taken") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
                if(cur === "in_progress") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
                if(cur === "problem") next.push(["in_progress","Проблема решена"], ["done","Успешно завершена"]);
                if(isAdmin && cur !== "canceled" && cur !== "done") next.push(["canceled","Отменить задачу"]);

                return buildActionsHtml(task, {
                  esc: (v) => String(v == null ? "" : v),
                  next,
                  isAdmin,
                  isArchived
                });
              }
            });

            viewerEl.__zrStatusTask = t2;
          }else{
            console.warn("[P3.2 TRACE] status flow fallback renderDetails(t2) fired");
            liveRenderDetails(t2);
            viewerEl.__zrStatusTask = t2;
          }
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

    const editBtnHtml = (!isArchived && isAdmin)
      ? `<button class="btn btn-sm btn--ghost" id="plEditTask" type="button">Редактировать</button>`
      : ``;

    const archiveBtnHtml = (!isArchived && isAdmin)
      ? `<button class="btn btn-sm btn--danger" id="plArchiveTask" type="button">Перенести задачу в архив</button>`
      : ``;

    if(next.length === 0 && !archiveBtnHtml && !editBtnHtml){
      return "";
    }

    return `
      <div class="zr-planner-actions">
        <div class="zr-planner-actions-main">
          ${next.map(([s,label]) => {
            const cls = (s === "done")
              ? "btn btn-sm btn--primary pl-status"
              : (s === "problem" || s === "canceled")
                ? "btn btn-sm btn--danger pl-status"
                : "btn btn-sm btn--ghost pl-status";
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

    return `
      <div class="zr-planner-detail">
        <div class="zr-card zr-card--section zr-planner-hero" style="${detailsProblemStyle}">
          <div class="zr-planner-hero-top">
            <div class="zr-planner-hero-main">
              <div class="zr-planner-title">${safeEsc(task.title || "(без названия)")}</div>
              <div class="zr-planner-meta">
                ${start}${due}${overduePill}${archivedPill}${urg}${st}
              </div>
            </div>

            <div>
              <button class="btn btn-sm btn--ghost" id="plBack" type="button">Назад</button>
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
                  <div class="zr-planner-body-text">${safeEsc(task.project_title)}</div>
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
              <div class="zr-planner-body-text">${task.body ? safeEsc(task.body) : '<span class="zr-planner-muted">Описание пустое.</span>'}</div>
            </div>

            <div class="zr-card zr-card--section zr-planner-section">
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

          <div class="zr-planner-sidecol">
            <div class="zr-card zr-card--subtle zr-planner-section">
              <div class="zr-section-head">
                <div class="zr-section-title">Документы</div>

                ${(isAdmin && !isArchived) ? `
                  <button class="btn btn-sm btn--ghost" id="plAddDocBtn" type="button">+ Добавить</button>
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

      if(typeof opts.buildActions === "function"){
        const actionsHost = hero.querySelector(".zr-planner-actions");
        const noteHost = hero.querySelector(".pl-status-msg") || hero.querySelector(".zr-planner-status-note");

        const tmp = document.createElement("div");
        tmp.innerHTML = opts.buildActions(task);

        const newActions = tmp.querySelector(".zr-planner-actions");
        const newNote = tmp.querySelector(".pl-status-msg") || tmp.querySelector(".zr-planner-status-note");

        const currentMain = actionsHost ? actionsHost.querySelector(".zr-planner-actions-main") : null;
        const newMain = newActions ? newActions.querySelector(".zr-planner-actions-main") : null;

        if(currentMain && newMain){
          currentMain.innerHTML = newMain.innerHTML;
        }

        if(noteHost && newNote){
          noteHost.innerHTML = newNote.innerHTML;
        }
      }

    }catch(e){
      console.warn("[PlannerDetailHelpers] header update error", e);
    }
  }

  return {
    initAssigneeBlock,
    bindBackButton,
    bindAddDocButton,
    bindAddChecklistButton,
    bindEditButton,
    bindArchiveButton,
    buildActionState,
    buildMetaState,
    buildActionsHtml,
    bindStatusButtons,
    buildLayout,
    updateDetailHeaderOnly
  };
})();