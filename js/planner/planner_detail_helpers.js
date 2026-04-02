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
    const loadInlineChecklists = o.loadInlineChecklists;

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

              const addedType = payload && payload.link_type ? String(payload.link_type) : "";
              if(addedType === "checklist"){
                if(typeof loadInlineChecklists === "function"){
                  await loadInlineChecklists(task, false, [], { soft:true });
                }
              }else{
                if(typeof loadChecklist === "function"){
                  await loadChecklist(task, false);
                }
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
    const loadInlineChecklists = o.loadInlineChecklists;

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
              if(typeof loadInlineChecklists === "function"){
                await loadInlineChecklists(task, false, [], { soft:true });
              }
            }catch(err){
              console.warn("[PlannerDetailHelpers] soft refresh after checklist add error", err);
            }
          }
        });
      }catch(err){
        console.warn("[PlannerDetailHelpers] open checklist dialog error", err);
        alert("Ошибка открытия окна");
      }
    };
  }

  function bindAddChecklistButton(task, opts){
    const o = opts || {};
    const button = o.button;
    const loadInlineChecklists = o.loadInlineChecklists;

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
              if(typeof loadInlineChecklists === "function"){
                await loadInlineChecklists(task, false, [], { soft:true });
              }
            }catch(err){
              console.warn("[PlannerDetailHelpers] soft refresh after checklist add error", err);
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
            const tasks2 = (typeof fetchAllActiveTasks === "function")
              ? await fetchAllActiveTasks()
              : [];

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

            if(typeof renderLeft === "function"){
              renderLeft(tasks2);
            }

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

    viewerEl.querySelectorAll(".pl-status").forEach(btn => {
      btn.onclick = async () => {
        const s = btn.dataset.s;
        const msg = viewerEl.querySelector(".pl-status-msg");

        if(String(s || "") === "canceled"){
          const ok = confirm("Отменить задачу?");
          if(!ok) return;
        }

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

          const tasks2 = await fetchAllActiveTasks();
          renderLeft(tasks2);

          const sel2 = getSelectedTaskId();
          if(sel2){
            const t2 = tasks2.find(x => String(x.id) === String(sel2));
            if(t2) renderDetails(t2);
          }
        }catch(err){
          console.warn("[PlannerDetailHelpers] set status error", err);
          const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          if(msg) msg.textContent = "Ошибка: " + text;
          viewerEl.querySelectorAll(".pl-status").forEach(x => x.disabled = false);
        }
      };
    });
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
                  <button class="btn btn-sm btn--ghost" id="plAddChecklistBtn" type="button">+ Добавить чек-лист</button>
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
  
  return {
    initAssigneeBlock,
    bindBackButton,
    bindAddDocButton,
    bindAddChecklistButton,
    bindEditButton,
    bindArchiveButton,
    buildActionState,
    buildMetaState,
    bindStatusButtons,
    buildLayout
  };
})();




