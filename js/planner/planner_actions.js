/* ZA RAMKI — Planner actions wiring (buttons) */
(function(){
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function openTaskDialog(mode, task, opts){
    opts = opts || {};

    const isEdit = String(mode || "") === "edit";
    const onSubmit = isEdit ? opts.onSave : opts.onCreate;
    const dialogTitle = isEdit ? "Редактировать задачу" : "Новая задача";
    const submitLabel = isEdit ? "Сохранить" : "Создать";

    task = task || {};
    

    const existing = document.getElementById("plCreateOverlay");
    if(existing){ try{ existing.remove(); }catch(e){} }

    const nowIso = new Date().toISOString().slice(0,10);
    const tomorrowIso = new Date(Date.now()+86400000).toISOString().slice(0,10);

    async function loadProjects(){
      try{
        if(!window.SB) return [];
        const r = await SB.from("projects")
          .select("id,title")
          .order("created_at",{ ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      }catch(e){
        console.warn("[Planner] loadProjects error", e);
        return [];
      }
    }

    async function loadAssignablePeople(){
      try{
        if(!window.PlannerAPI || typeof PlannerAPI.fetchAssignablePeople !== "function") return [];
        return await PlannerAPI.fetchAssignablePeople();
      }catch(e){
        console.warn("[Planner] loadAssignablePeople error", e);
        return [];
      }
    }

    function personLabel(p){
      if(!p) return "Сотрудник";
      const name = p.name ? String(p.name).trim() : "";
      if(name) return name;
      const email = p.email ? String(p.email).trim() : "";
      if(email){
        return email.split("@")[0].replace(/[._-]+/g, " ").trim();
      }
      return "Сотрудник";
    }

    function isoToRuDate(iso){
      const s = String(iso || "").trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(!m) return "";
      return `${m[3]}.${m[2]}.${m[1]}`;
    }

    function ruDateToIso(value){
      const s = String(value || "").trim();
      const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if(!m) return "";
      return `${m[3]}-${m[2]}-${m[1]}`;
    }

    function wireDateField(nativeId, textId, buttonId){
      const nativeEl = document.getElementById(nativeId);
      const textEl = document.getElementById(textId);
      const buttonEl = document.getElementById(buttonId);

      if(!nativeEl || !textEl) return;

      function syncTextFromNative(){
        textEl.value = isoToRuDate(nativeEl.value || "");
      }

      function syncNativeFromText(){
        const iso = ruDateToIso(textEl.value || "");
        if(iso) nativeEl.value = iso;
      }

      syncTextFromNative();

      nativeEl.addEventListener("change", () => {
        syncTextFromNative();
      });

      textEl.addEventListener("blur", () => {
        syncNativeFromText();
        syncTextFromNative();
      });

      textEl.addEventListener("keydown", (e) => {
        if(e && e.key === "Enter"){
          syncNativeFromText();
          syncTextFromNative();
        }
      });

      if(buttonEl){
        buttonEl.addEventListener("click", () => {
          try{
            if(typeof nativeEl.showPicker === "function"){
              nativeEl.showPicker();
              return;
            }
          }catch(e){}

          try{
            nativeEl.focus();
            nativeEl.click();
          }catch(e){}
        });
      }
    }

    const titleValue = isEdit ? esc(task.title || "") : "";
    const bodyValue = isEdit ? esc(task.body || "") : "";
    const startValue = isEdit ? esc(task.start_date || "") : esc(nowIso);
    const dueValue = isEdit ? esc(task.due_date || "") : esc(tomorrowIso);

    const roleValue = String(isEdit ? (task.role || "all") : "all");
    const urgencyValue = String(isEdit ? (task.urgency || "normal") : "normal");

    const overlay = document.createElement("div");
    overlay.id = "plCreateOverlay";
    overlay.style.cssText = [
      "position:fixed; inset:0; z-index:9999;",
      "background:rgba(0,0,0,.55);",
      "display:flex; align-items:center; justify-content:center;",
      "padding:16px;"
    ].join("");

    overlay.innerHTML = `
      <div class="item zr-planner-dialog" style="width:min(560px, 96vw); cursor:default; padding:14px;">
        <div class="zr-planner-dialog-head">
          <div style="font-weight:700; letter-spacing:.06em;">${dialogTitle}</div>
          <button class="btn btn-sm btn--ghost" id="plCreateClose" type="button">Закрыть</button>
        </div>

        <div class="zr-planner-dialog-body">
          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Название *</div>
            <input class="pl-control" id="plCreateTitle" value="${titleValue}" placeholder="Например: согласовать макет кухни" />
          </div>

          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Описание</div>
            <textarea class="pl-control pl-textarea" id="plCreateBody" rows="3" placeholder="Коротко: что сделать, где смотреть, какие критерии…">${bodyValue}</textarea>
          </div>

          <div class="zr-planner-dialog-grid">
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Старт</div>
              <div class="zr-date-field">
                <input class="pl-control zr-date-field__text" id="plCreateStartText" type="text" inputmode="numeric" placeholder="ДД.ММ.ГГГГ" />
                <button class="zr-date-field__button" id="plCreateStartBtn" type="button" aria-label="Выбрать дату">
                  📅
                </button>
                <input class="zr-date-field__native" id="plCreateStart" type="date" value="${startValue}" tabindex="-1" />
              </div>
            </div>
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Дедлайн</div>
              <div class="zr-date-field">
                <input class="pl-control zr-date-field__text" id="plCreateDueText" type="text" inputmode="numeric" placeholder="ДД.ММ.ГГГГ" />
                <button class="zr-date-field__button" id="plCreateDueBtn" type="button" aria-label="Выбрать дату">
                  📅
                </button>
                <input class="zr-date-field__native" id="plCreateDue" type="date" value="${dueValue}" tabindex="-1" />
              </div>
            </div>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Видимость</div>
              <select class="pl-control" id="plCreateRole">
                <option value="all" ${roleValue==="all" ? "selected" : ""}>all</option>
                <option value="staff" ${roleValue==="staff" ? "selected" : ""}>staff</option>
                <option value="admin" ${roleValue==="admin" ? "selected" : ""}>admin</option>
              </select>
            </div>
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Срочность</div>
              <select class="pl-control" id="plCreateUrgency">
                <option value="normal" ${urgencyValue==="normal" ? "selected" : ""}>normal</option>
                <option value="urgent" ${urgencyValue==="urgent" ? "selected" : ""}>urgent</option>
                <option value="high" ${urgencyValue==="high" ? "selected" : ""}>high</option>
                <option value="low" ${urgencyValue==="low" ? "selected" : ""}>low</option>
              </select>
            </div>
          </div>

          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Проект</div>
            <input type="hidden" id="plCreateProject" value="">
            <div style="position:relative;">
              <input
                class="pl-control"
                id="plCreateProjectSearch"
                placeholder="Начните вводить название проекта"
                autocomplete="off"
              />
              <div id="plCreateProjectResults" style="
                display:none;
                position:absolute;
                top:calc(100% + 6px);
                left:0;
                right:0;
                z-index:20;
                max-height:220px;
                overflow:auto;
                padding:6px;
                border:1px solid rgba(255,255,255,.10);
                border-radius:12px;
                background:rgba(20,16,14,.98);
                box-shadow:0 14px 30px rgba(0,0,0,.35);
              "></div>
            </div>
          </div>

          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Исполнитель</div>
            <input type="hidden" id="plCreateAssignee" value="">
            <div style="position:relative;">
              <input
                class="pl-control"
                id="plCreateAssigneeSearch"
                placeholder="Начните вводить имя сотрудника"
                autocomplete="off"
              />
              <div id="plCreateAssigneeResults" style="
                display:none;
                position:absolute;
                top:calc(100% + 6px);
                left:0;
                right:0;
                z-index:20;
                max-height:220px;
                overflow:auto;
                padding:6px;
                border:1px solid rgba(255,255,255,.10);
                border-radius:12px;
                background:rgba(20,16,14,.98);
                box-shadow:0 14px 30px rgba(0,0,0,.35);
              "></div>
            </div>
          </div>

          <div class="zr-planner-dialog-actions">
            <span class="muted" id="plCreateMsg" style="font-size:12px; flex:1;"></span>
            <button class="btn btn--primary" id="plCreateDo" type="button">${submitLabel}</button>
          </div>
        </div>
      </div>
    `;

    function close(){
      try{ overlay.remove(); }catch(e){}
      try{ document.removeEventListener("keydown", onKey); }catch(e){}
    }
    function onKey(e){
      if(e && e.key === "Escape") close();
    }

    const dialogEl = overlay.querySelector(".item");


    let pointerStartedInsideDialog = false;


    


    overlay.addEventListener("mousedown", (e) => {


      pointerStartedInsideDialog = !!(dialogEl && dialogEl.contains(e.target));


    });


    


    overlay.addEventListener("click", (e) => {


      const clickedOverlay = e.target === overlay;


      if(clickedOverlay && !pointerStartedInsideDialog) close();


      pointerStartedInsideDialog = false;


    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);

    wireDateField("plCreateStart", "plCreateStartText", "plCreateStartBtn");
    wireDateField("plCreateDue", "plCreateDueText", "plCreateDueBtn");

    let projectItems = [];

    function renderProjectResults(items){
      const resultsEl = document.getElementById("plCreateProjectResults");
      const projectValueEl = document.getElementById("plCreateProject");
      const projectSearchEl = document.getElementById("plCreateProjectSearch");
      if(!resultsEl) return;

      if(!Array.isArray(items) || items.length === 0){
        resultsEl.innerHTML = `<div class="muted" style="font-size:12px; padding:6px 8px;">Ничего не найдено.</div>`;
        resultsEl.style.display = "block";
        return;
      }

      resultsEl.innerHTML = items.map(p => `
        <button
          type="button"
          class="pl-link-pick"
          data-id="${esc(p.id)}"
          data-title="${esc(p.title || "")}"
          style="
            display:block;
            width:100%;
            text-align:left;
            padding:8px 10px;
            border:none;
            border-radius:8px;
            background:transparent;
            color:inherit;
            cursor:pointer;
          "
        >
          ${esc(p.title || "(без названия)")}
        </button>
      `).join("");

      resultsEl.style.display = "block";

      resultsEl.querySelectorAll(".pl-link-pick").forEach(btn => {
        btn.onclick = () => {
          if(projectValueEl) projectValueEl.value = btn.dataset.id || "";
          if(projectSearchEl) projectSearchEl.value = btn.dataset.title || "";
          resultsEl.innerHTML = "";
          resultsEl.style.display = "none";
        };
      });
    }

    (async () => {
      const projectValueEl = document.getElementById("plCreateProject");
      const projectSearchEl = document.getElementById("plCreateProjectSearch");
      const projectResultsEl = document.getElementById("plCreateProjectResults");
      const assigneeSel = document.getElementById("plCreateAssignee");

      projectItems = await loadProjects();
      const selectedProjectId = isEdit && task && task.project_id ? String(task.project_id) : "";
      const selectedProject = selectedProjectId
        ? (projectItems || []).find(p => String(p.id) === selectedProjectId)
        : null;

      if(projectValueEl){
        projectValueEl.value = selectedProjectId || "";
      }

      if(projectSearchEl){
        projectSearchEl.value = selectedProject && selectedProject.title
          ? String(selectedProject.title)
          : "";

        projectSearchEl.addEventListener("input", () => {
          const q = String(projectSearchEl.value || "").trim().toLowerCase();

          if(!q){
            if(projectValueEl) projectValueEl.value = "";
            if(projectResultsEl){
              projectResultsEl.innerHTML = "";
              projectResultsEl.style.display = "none";
            }
            return;
          }

          const filtered = (projectItems || []).filter(p =>
            String(p && p.title || "").toLowerCase().includes(q)
          );

          renderProjectResults(filtered);
        });

        projectSearchEl.addEventListener("focus", () => {
          const q = String(projectSearchEl.value || "").trim().toLowerCase();
          if(!q) return;

          const filtered = (projectItems || []).filter(p =>
            String(p && p.title || "").toLowerCase().includes(q)
          );

          renderProjectResults(filtered);
        });
      }

      if(projectResultsEl && projectSearchEl){
        document.addEventListener("click", (e) => {
          if(!projectResultsEl.contains(e.target) && e.target !== projectSearchEl){
            projectResultsEl.innerHTML = "";
            projectResultsEl.style.display = "none";
          }
        });
      }

      const assigneeValueEl = document.getElementById("plCreateAssignee");
      const assigneeSearchEl = document.getElementById("plCreateAssigneeSearch");
      const assigneeResultsEl = document.getElementById("plCreateAssigneeResults");

      const people = await loadAssignablePeople();
      const currentAssigneeId = (isEdit && task && Array.isArray(task.assignees) && task.assignees.length)
        ? String(task.assignees[0])
        : "";

      const currentAssignee = currentAssigneeId
        ? (people || []).find(p => String(p.id) === currentAssigneeId)
        : null;

      if(assigneeValueEl){
        assigneeValueEl.value = currentAssigneeId || "";
      }

      function renderAssigneeResults(items){
        if(!assigneeResultsEl) return;

        if(!Array.isArray(items) || items.length === 0){
          assigneeResultsEl.innerHTML = `<div class="muted" style="font-size:12px; padding:6px 8px;">Ничего не найдено.</div>`;
          assigneeResultsEl.style.display = "block";
          return;
        }

        assigneeResultsEl.innerHTML = items.map(p => `
          <button
            type="button"
            class="pl-link-pick"
            data-id="${esc(p.id)}"
            data-title="${esc(personLabel(p))}"
            style="
              display:block;
              width:100%;
              text-align:left;
              padding:8px 10px;
              border:none;
              border-radius:8px;
              background:transparent;
              color:inherit;
              cursor:pointer;
            "
          >
            ${esc(personLabel(p))}
          </button>
        `).join("");

        assigneeResultsEl.style.display = "block";

        assigneeResultsEl.querySelectorAll(".pl-link-pick").forEach(btn => {
          btn.onclick = () => {
            if(assigneeValueEl) assigneeValueEl.value = btn.dataset.id || "";
            if(assigneeSearchEl) assigneeSearchEl.value = btn.dataset.title || "";
            assigneeResultsEl.innerHTML = "";
            assigneeResultsEl.style.display = "none";
          };
        });
      }

      if(assigneeSearchEl){
        assigneeSearchEl.value = currentAssignee ? personLabel(currentAssignee) : "";

        assigneeSearchEl.addEventListener("input", () => {
          const q = String(assigneeSearchEl.value || "").trim().toLowerCase();

          if(!q){
            if(assigneeValueEl) assigneeValueEl.value = "";
            if(assigneeResultsEl){
              assigneeResultsEl.innerHTML = "";
              assigneeResultsEl.style.display = "none";
            }
            return;
          }

          const filtered = (people || []).filter(p =>
            String(personLabel(p) || "").toLowerCase().includes(q)
          );

          renderAssigneeResults(filtered);
        });

        assigneeSearchEl.addEventListener("focus", () => {
          const q = String(assigneeSearchEl.value || "").trim().toLowerCase();
          if(!q) return;

          const filtered = (people || []).filter(p =>
            String(personLabel(p) || "").toLowerCase().includes(q)
          );

          renderAssigneeResults(filtered);
        });
      }

      if(assigneeResultsEl && assigneeSearchEl){
        document.addEventListener("click", (e) => {
          if(!assigneeResultsEl.contains(e.target) && e.target !== assigneeSearchEl){
            assigneeResultsEl.innerHTML = "";
            assigneeResultsEl.style.display = "none";
          }
        });
      }
    })();

    const closeBtn = document.getElementById("plCreateClose");
    if(closeBtn) closeBtn.onclick = close;

    const doBtn = document.getElementById("plCreateDo");
    const msg = document.getElementById("plCreateMsg");

    if(doBtn){
      doBtn.onclick = async () => {
        const titleEl = document.getElementById("plCreateTitle");
        const bodyEl = document.getElementById("plCreateBody");
        const startEl = document.getElementById("plCreateStart");
        const dueEl = document.getElementById("plCreateDue");
        const startTextEl = document.getElementById("plCreateStartText");
        const dueTextEl = document.getElementById("plCreateDueText");
        const roleEl = document.getElementById("plCreateRole");
        const urgEl  = document.getElementById("plCreateUrgency");
        const projectEl = document.getElementById("plCreateProject");
        const assigneeEl = document.getElementById("plCreateAssignee");

        if(startEl && startTextEl){
          const startIso = ruDateToIso(startTextEl.value || "");
          if(startIso) startEl.value = startIso;
        }

        if(dueEl && dueTextEl){
          const dueIso = ruDateToIso(dueTextEl.value || "");
          if(dueIso) dueEl.value = dueIso;
        }

        const title = titleEl && titleEl.value ? titleEl.value.trim() : "";
        if(!title){ if(msg) msg.textContent = "Название обязательно."; return; }

        doBtn.disabled = true;
        if(msg) msg.textContent = isEdit ? "Сохраняю…" : "Создаю…";

        try{
          const payload = {
            title,
            body: bodyEl && bodyEl.value != null ? String(bodyEl.value) : "",
            start_date: startEl && startEl.value ? String(startEl.value) : (isEdit ? null : nowIso),
            due_date: dueEl && dueEl.value ? String(dueEl.value) : (isEdit ? null : tomorrowIso),
            role: roleEl && roleEl.value ? String(roleEl.value) : "all",
            urgency: urgEl && urgEl.value ? String(urgEl.value) : "normal",
            project_id: (projectEl && projectEl.value) ? projectEl.value : null
          };

          const selectedAssigneeId = (assigneeEl && assigneeEl.value) ? String(assigneeEl.value) : "";
          const nextAssignees = selectedAssigneeId ? [selectedAssigneeId] : [];

          if(typeof onSubmit !== "function"){
            throw new Error(isEdit ? "onSave handler missing" : "onCreate handler missing");
          }

          let result = null;

          try{
            result = await onSubmit(payload);
          }catch(err){
            console.warn("[PlannerActions] submit core error", err);
            throw err;
          }

          const taskIdForAssignee = isEdit
            ? (task && task.id ? String(task.id) : "")
            : (result && result.id ? String(result.id) : "");

          if(taskIdForAssignee && window.PlannerAPI && typeof PlannerAPI.setTaskAssignees === "function"){
            try{
              if(msg) msg.textContent = "Сохраняю исполнителя…";
              const before = Array.isArray(task && task.assignees) ? task.assignees : [];

              await PlannerAPI.setTaskAssignees(taskIdForAssignee, nextAssignees);

              // push (after assignment)
              try{
                const actorId = String(window.App?.session?.user?.id || "");
                const after = nextAssignees || [];

                const beforeOne = before.length ? String(before[0]) : null;
                const afterOne = after.length ? String(after[0]) : null;

                if(afterOne && afterOne !== actorId){
                  const eventType = beforeOne ? "reassigned" : "assigned";

                  if(typeof window.sendPlannerPush === "function"){
                    await sendPlannerPush({
                      userId: afterOne,
                      title: "ZA RAMKI",
                      body: eventType === "assigned"
                        ? (payload.title ? payload.title + " — назначена вам" : "Вам назначена задача")
                        : (payload.title ? payload.title + " — переназначена вам" : "Задача переназначена"),
                      url: "./#/planner/" + taskIdForAssignee,
                      tag: "planner-" + eventType + "-" + taskIdForAssignee
                    });
                  }
                }
              }catch(e){
                console.warn("[PlannerPush] assignment error", e);
              }
            }catch(err){
              console.warn("[PlannerActions] assignees sync error", err);
              throw err;
            }
          }

          if(typeof opts.onAfterSubmit === "function"){
            try{
              if(msg) msg.textContent = "Обновляю интерфейс…";
              await opts.onAfterSubmit(taskIdForAssignee, result);
            }catch(err){
              console.warn("[PlannerActions] after submit error", err);
              throw err;
            }
          }

          close();
          return result;
        }catch(err){
          console.warn("[PlannerActions] dialog submit error", err);
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          if(msg) msg.textContent = "Ошибка: " + t;
          doBtn.disabled = false;
        }
      };
    }

    try{
      const t = document.getElementById("plCreateTitle");
      if(t) t.focus();
    }catch(e){}
  }

  function openCreateDialog(opts){
    return openTaskDialog("create", null, opts || {});
  }

  function openEditDialog(task, opts){
    if(!task) throw new Error("task required");
    return openTaskDialog("edit", task, opts || {});
  }

  function wireCreateButton(onClick){
    const b = document.getElementById("plCreateTask");
    if(b) b.onclick = onClick;
  }

  function wireQuickCreate(onClick){
    const b = document.getElementById("plQuickCreate");
    if(b) b.onclick = onClick;
  }

  async function setStatus(taskId, newStatus){
    if(!window.PlannerAPI) throw new Error("PlannerAPI missing");
    return await PlannerAPI.setTaskStatus(taskId, newStatus);
  }

  async function ensureInProgress(task){
    if(!task) return false;
    const cur = String(task.status || "");
    if(cur === "taken"){
      await setStatus(task.id, "in_progress");
      return true;
    }
    return false;
  }

    function openLinkDialog(task, opts){
    opts = opts || {};
    task = task || {};

    const allowedTypes = Array.isArray(opts.allowedTypes) && opts.allowedTypes.length
      ? opts.allowedTypes.map(x => String(x || "").trim().toLowerCase()).filter(Boolean)
      : ["article","checklist","template","external"];

    const defaultType = allowedTypes.includes(String(opts.defaultType || "").trim().toLowerCase())
      ? String(opts.defaultType || "").trim().toLowerCase()
      : (allowedTypes[0] || "article");


    const forcedType = allowedTypes.length === 1 ? allowedTypes[0] : "";
    const dialogTitle = defaultType === "checklist" && allowedTypes.length === 1
      ? "Добавить чек-лист"
      : "Добавить документ";

    const existing = document.getElementById("plLinkOverlay");
    if(existing){ try{ existing.remove(); }catch(e){} }

    const overlay = document.createElement("div");
    overlay.id = "plLinkOverlay";
    overlay.style.cssText = [
      "position:fixed; inset:0; z-index:9999;",
      "background:rgba(0,0,0,.55);",
      "display:flex; align-items:center; justify-content:center;",
      "padding:16px;"
    ].join("");

    overlay.innerHTML = `
      <div class="item zr-planner-dialog" style="width:min(620px, 96vw); cursor:default; padding:14px;">
        <div class="zr-planner-dialog-head">
          <div style="font-weight:700; letter-spacing:.06em;">${dialogTitle}</div>
          <button class="btn btn-sm btn--ghost" id="plLinkClose" type="button">Закрыть</button>
        </div>

        <div class="zr-planner-dialog-body">
          <div>
            <div class="muted" style="font-size:12px; margin-bottom:8px;">Тип документа</div>
            <div class="zr-planner-dialog-choice-row">
              ${allowedTypes.includes("article") ? `
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="article" ${defaultType==="article" ? "checked" : ""}>
                <span>Инструкция</span>
              </label>
              ` : ``}
              ${allowedTypes.includes("checklist") ? `
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="checklist" ${defaultType==="checklist" ? "checked" : ""}>
                <span>Чек-лист</span>
              </label>
              ` : ``}
              ${allowedTypes.includes("template") ? `
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="template" ${defaultType==="template" ? "checked" : ""}>
                <span>Шаблон</span>
              </label>
              ` : ``}
              ${allowedTypes.includes("external") ? `
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="external" ${defaultType==="external" ? "checked" : ""}>
                <span>Внешняя ссылка</span>
              </label>
              ` : ``}
            </div>
          </div>

          <div id="plLinkInternalBlock">
            <div id="plLinkArticlePicker" style="display:flex; flex-direction:column; gap:10px;">
              <div>
                <div class="muted" id="plLinkSearchLabel" style="font-size:12px; margin-bottom:6px;">Поиск инструкции</div>
                <input class="pl-control" id="plLinkArticleSearch" placeholder="Начните вводить название документа" />
              </div>
              <div style="position:relative;">
                <div id="plLinkArticleResults" style="
                  display:none;
                  position:absolute;
                  top:0;
                  left:0;
                  right:0;
                  z-index:20;
                  max-height:220px;
                  overflow:auto;
                  padding:6px;
                  border:1px solid rgba(255,255,255,.10);
                  border-radius:12px;
                  background:rgba(20,16,14,.98);
                  box-shadow:0 14px 30px rgba(0,0,0,.35);
                "></div>
              </div>
              <div>
                <div class="muted" style="font-size:12px; margin-bottom:6px;">Выбранный ID</div>
                <input class="pl-control" id="plLinkRefId" placeholder="Например: ID записи" />
              </div>
              <div>
                <div class="muted" style="font-size:12px; margin-bottom:6px;">Название</div>
                <input class="pl-control" id="plLinkInternalLabel" placeholder="Например: Название документа" />
              </div>
            </div>
          </div>

          <div id="plLinkExternalBlock" style="display:none;">
            <div style="display:flex; flex-direction:column; gap:10px;">
              <div>
                <div class="muted" style="font-size:12px; margin-bottom:6px;">URL</div>
                <input class="pl-control" id="plLinkUrl" placeholder="https://example.com" />
              </div>
              <div>
                <div class="muted" style="font-size:12px; margin-bottom:6px;">Название</div>
                <input class="pl-control" id="plLinkLabel" placeholder="Например: Техническое задание" />
              </div>
            </div>
          </div>

          <div class="zr-planner-dialog-actions">
            <span class="muted" id="plLinkMsg" style="font-size:12px; flex:1;"></span>
            <button class="btn btn-sm btn--ghost" id="plLinkCancel" type="button">Отмена</button>
            <button class="btn btn--primary" id="plLinkSubmit" type="button">Добавить</button>
          </div>
        </div>
      </div>
    `;

    function close(){
      try{ overlay.remove(); }catch(e){}
      try{ document.removeEventListener("keydown", onKey); }catch(e){}

      if(typeof opts.onClose === "function"){
        try{ opts.onClose(); }catch(e){}
      }
    }

    function onKey(e){
      if(e && e.key === "Escape") close();
    }

    async function runArticleSearch(){
      try{
        const checked = overlay.querySelector('input[name="plLinkType"]:checked');
        const forcedType =
          Array.isArray(opts.allowedTypes) && opts.allowedTypes.length === 1
            ? String(opts.allowedTypes[0] || "").trim().toLowerCase()
            : "";
        const type = forcedType || (checked ? String(checked.value) : "article");
        const resultsHost = document.getElementById("plLinkArticleResults");
        const searchEl = document.getElementById("plLinkArticleSearch");

        if(!resultsHost) return;

        if(type === "external"){
          resultsHost.innerHTML = "";
          resultsHost.style.display = "none";
          return;
        }

        const q = searchEl && searchEl.value ? String(searchEl.value).trim() : "";
        resultsHost.style.display = "block";
        resultsHost.innerHTML = `<div class="muted" style="font-size:12px; padding:6px 8px;">Ищу…</div>`;

        let items = [];
        if(type === "article"){
          if(!window.PlannerAPI || typeof PlannerAPI.searchArticlesForLink !== "function"){
            resultsHost.innerHTML = `<div class="muted" style="font-size:12px;">Поиск инструкций недоступен.</div>`;
            return;
          }
          items = await PlannerAPI.searchArticlesForLink(q);
        }else if(type === "template"){
          if(!window.PlannerAPI || typeof PlannerAPI.searchTemplatesForLink !== "function"){
            resultsHost.innerHTML = `<div class="muted" style="font-size:12px;">Поиск шаблонов недоступен.</div>`;
            return;
          }
          items = await PlannerAPI.searchTemplatesForLink(q);
        }else if(type === "checklist"){
          if(!window.PlannerAPI || typeof PlannerAPI.searchChecklistsForLink !== "function"){
            resultsHost.innerHTML = `<div class="muted" style="font-size:12px;">Поиск чек-листов недоступен.</div>`;
            return;
          }
          items = await PlannerAPI.searchChecklistsForLink(q);
        }

        items = (items || []).slice(0, 5);

        if(!items || items.length === 0){
          resultsHost.style.display = q ? "block" : "none";
          resultsHost.innerHTML = q ? `<div class="muted" style="font-size:12px; padding:6px 8px;">Ничего не найдено.</div>` : "";
          return;
        }

        resultsHost.innerHTML = items.map(it => `
          <button
            type="button"
            class="pl-link-pick"
            data-id="${esc(it.id)}"
            data-title="${esc(it.title || "")}"
            style="
              display:block;
              width:100%;
              text-align:left;
              padding:8px 10px;
              border:none;
              border-radius:8px;
              background:transparent;
              color:inherit;
              cursor:pointer;
            "
          >
            ${esc(it.title || "(без названия)")}
          </button>
        `).join("");

        resultsHost.querySelectorAll(".pl-link-pick").forEach(btn => {
          btn.onclick = () => {
            const refEl = document.getElementById("plLinkRefId");
            const labelEl = document.getElementById("plLinkInternalLabel");

            if(refEl) refEl.value = btn.dataset.id || "";
            if(labelEl) labelEl.value = btn.dataset.title || "";
            if(searchEl) searchEl.value = btn.dataset.title || "";

            resultsHost.innerHTML = "";
            resultsHost.style.display = "none";
          };
        });
      }catch(err){
        console.warn("[PlannerActions] internal search error", err);
        const resultsHost = document.getElementById("plLinkArticleResults");
        if(resultsHost){
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          resultsHost.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка поиска: ${esc(t)}</div>`;
        }
      }
    }
    async function checkDuplicateLink(payload){
      try{
        if(!task || !task.id) return false;
        if(!window.PlannerAPI || typeof PlannerAPI.fetchTaskLinks !== "function") return false;

        const items = await PlannerAPI.fetchTaskLinks(task.id);
        if(!Array.isArray(items) || items.length === 0) return false;

        const linkType = payload && payload.link_type ? String(payload.link_type).trim().toLowerCase() : "";
        const refId = payload && payload.ref_id ? String(payload.ref_id).trim() : "";
        const url = payload && payload.url ? String(payload.url).trim() : "";

        return items.some(it => {
          const t = it && it.link_type ? String(it.link_type).trim().toLowerCase() : "";
          const r = it && it.ref_id ? String(it.ref_id).trim() : "";
          const u = it && it.url ? String(it.url).trim() : "";

          if(t !== linkType) return false;

          if(linkType === "external"){
            return !!url && u === url;
          }

          return !!refId && r === refId;
        });
      }catch(err){
        console.warn("[PlannerActions] duplicate check error", err);
        return false;
      }
    }
    function syncType(){
      const checked = overlay.querySelector('input[name="plLinkType"]:checked');
      const type = forcedType || (checked ? String(checked.value) : "article");

      const internalBlock = document.getElementById("plLinkInternalBlock");
      const externalBlock = document.getElementById("plLinkExternalBlock");
      const articlePicker = document.getElementById("plLinkArticlePicker");
      const searchEl = document.getElementById("plLinkArticleSearch");
      const searchLabel = document.getElementById("plLinkSearchLabel");
      const resultsHost = document.getElementById("plLinkArticleResults");
      const refEl = document.getElementById("plLinkRefId");
      const labelEl = document.getElementById("plLinkInternalLabel");

      if(internalBlock) internalBlock.style.display = (type === "external") ? "none" : "";
      if(externalBlock) externalBlock.style.display = (type === "external") ? "" : "none";

      if(articlePicker){
        articlePicker.style.display = (type === "external") ? "none" : "";
      }

      if(searchLabel){
        searchLabel.textContent = (type === "checklist")
          ? "Поиск чек-листа"
          : (type === "template")
            ? "Поиск шаблона"
            : (type === "article")
              ? "Поиск инструкции"
              : "Поиск документа";
      }

      if(searchEl){
        searchEl.disabled = (type === "external");
        searchEl.placeholder = (type === "article")
          ? "Начните вводить название инструкции"
          : (type === "template")
            ? "Начните вводить название шаблона"
            : (type === "checklist")
              ? "Начните вводить название чек-листа"
              : "Начните вводить название документа";
      }

      if(refEl) refEl.placeholder = "Например: ID записи";

      if(labelEl){
        labelEl.placeholder = (type === "article")
          ? "Например: Инструкция"
          : (type === "template")
            ? "Например: Шаблон"
            : (type === "checklist")
              ? "Например: Чек-лист"
              : "Например: Название документа";
      }

      if(resultsHost){
        resultsHost.innerHTML = "";
        resultsHost.style.display = "none";
      }
    }

    const dialogEl = overlay.querySelector(".item");


    let pointerStartedInsideDialog = false;


    


    overlay.addEventListener("mousedown", (e) => {


      pointerStartedInsideDialog = !!(dialogEl && dialogEl.contains(e.target));


    });


    


    overlay.addEventListener("click", (e) => {


      const clickedOverlay = e.target === overlay;


      if(clickedOverlay && !pointerStartedInsideDialog) close();


      pointerStartedInsideDialog = false;


    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById("plLinkClose");
    const cancelBtn = document.getElementById("plLinkCancel");
    const submitBtn = document.getElementById("plLinkSubmit");

    if(closeBtn) closeBtn.onclick = close;
    if(cancelBtn) cancelBtn.onclick = close;

    overlay.querySelectorAll('input[name="plLinkType"]').forEach(el => {
      el.addEventListener("change", async () => {
        syncType();
        await runArticleSearch();
      });
    });

    const articleSearchEl = document.getElementById("plLinkArticleSearch");
    if(articleSearchEl){
      let timer = null;

      articleSearchEl.addEventListener("input", () => {
        try{ clearTimeout(timer); }catch(e){}
        const val = String(articleSearchEl.value || "").trim();

        timer = setTimeout(() => {
          if(val){
            runArticleSearch();
          }else{
            const resultsHost = document.getElementById("plLinkArticleResults");
            if(resultsHost){
              resultsHost.innerHTML = "";
              resultsHost.style.display = "none";
            }
          }
        }, 220);
      });

      articleSearchEl.addEventListener("focus", () => {
        const val = String(articleSearchEl.value || "").trim();
        if(val){
          runArticleSearch();
        }
      });
    }

    syncType();

    if(submitBtn){
      submitBtn.onclick = async () => {
        const msg = document.getElementById("plLinkMsg");
        const checked = overlay.querySelector('input[name="plLinkType"]:checked');
        const type = forcedType || (checked ? String(checked.value) : "article");

        submitBtn.disabled = true;
        if(msg) msg.textContent = "Проверяю…";

        try{
          if(!window.PlannerAPI || typeof PlannerAPI.addTaskLink !== "function"){
            throw new Error("addTaskLink missing");
          }

          let payload = null;

          if(type === "external"){
            const urlEl = document.getElementById("plLinkUrl");
            const labelEl = document.getElementById("plLinkLabel");

            payload = {
              link_type: "external",
              url: urlEl && urlEl.value ? String(urlEl.value).trim() : "",
              label: labelEl && labelEl.value ? String(labelEl.value).trim() : ""
            };
          }else{
            const refEl = document.getElementById("plLinkRefId");
            const labelEl = document.getElementById("plLinkInternalLabel");

            payload = {
              link_type: type,
              ref_id: refEl && refEl.value ? String(refEl.value).trim() : "",
              label: labelEl && labelEl.value ? String(labelEl.value).trim() : ""
            };
          }

          const isChecklistType = (type === "checklist");

          if(!isChecklistType){
            const isDuplicate = await checkDuplicateLink(payload);
            if(isDuplicate){
              const ok = confirm("Уже добавлено. Добавить ещё раз?");
              if(!ok){
                submitBtn.disabled = false;
                if(msg) msg.textContent = "Отменено.";
                return;
              }
            }
          }

          let checklistRows = null;

          if(type === "checklist"){
            if(msg) msg.textContent = "Проверяю чек-лист…";

            let checklistTemplateRes = null;
            try{
              checklistTemplateRes = await SB
                .from("kb_checklists")
                .select("items")
                .eq("id", payload.ref_id)
                .maybeSingle();
            }catch(err){
              console.warn("[PlannerActions] checklist preflight fetch error", err);
              checklistTemplateRes = { error: err };
            }

            if(checklistTemplateRes && checklistTemplateRes.error){
              console.warn("[PlannerActions] checklist preflight failed", checklistTemplateRes.error);
              submitBtn.disabled = false;
              if(msg) msg.textContent = "Не удалось прочитать структуру чек-листа.";
              return;
            }

            const rawItems = checklistTemplateRes && checklistTemplateRes.data
              ? checklistTemplateRes.data.items
              : null;

            if(Array.isArray(rawItems) && rawItems.length > 0){
              checklistRows = rawItems
                .map((item, index) => {
                  const text = (
                    typeof item === "string"
                      ? item
                      : (item && typeof item.text === "string")
                        ? item.text
                        : (item && item.text != null)
                          ? String(item.text)
                          : (item != null)
                            ? String(item)
                            : ""
                  ).trim();

                  if(!text || text === "[object Object]") return null;

                  return {
                    task_id: task.id,
                    text,
                    pos: index,
                    done: false,
                    done_at: null
                  };
                })
                .filter(Boolean);

              if(checklistRows.length === 0){
                console.warn("[PlannerActions] checklist preflight malformed items", {
                  taskId: task.id,
                  checklistId: payload.ref_id,
                  items: rawItems
                });
                checklistRows = [];
              }
            }else if(rawItems != null){
              console.warn("[PlannerActions] checklist preflight malformed items", {
                taskId: task.id,
                checklistId: payload.ref_id,
                items: rawItems
              });
              checklistRows = [];
            }else{
              checklistRows = [];
            }

            // --- SINGLE CHECKLIST GUARD ---
            try{
              const existingChecklistRows = await SB
                .from("task_checklist_items")
                .select("id")
                .eq("task_id", task.id)
                .limit(1);

              if(existingChecklistRows && existingChecklistRows.error){
                throw existingChecklistRows.error;
              }

              const hasTaskChecklistItems =
                Array.isArray(existingChecklistRows.data) &&
                existingChecklistRows.data.length > 0;

              if(hasTaskChecklistItems){
                submitBtn.disabled = false;
                if(msg) msg.textContent = "У задачи уже есть чек-лист. Сначала удалите текущий.";
                return;
              }
            }catch(err){
              console.warn("[PlannerActions] checklist runtime guard error", err);
              submitBtn.disabled = false;
              if(msg) msg.textContent = "Не удалось проверить существующий чек-лист задачи.";
              return;
            }

            // --- CLEANUP OLD CHECKLIST LINKS (FIX) ---
            try{
              const existingLinks = await PlannerAPI.fetchTaskLinks(task.id);

              const checklistLinks = (existingLinks || []).filter(l =>
                String(l.link_type || "") === "checklist"
              );

              for(const l of checklistLinks){
                if(l && l.id){
                  await PlannerAPI.removeTaskLink(l.id);
                }
              }

            }catch(err){
              console.warn("[PlannerActions] checklist link cleanup warning", err);
            }
          }

          if(msg) msg.textContent = "Сохраняю…";
          const saved = await PlannerAPI.addTaskLink(task.id, payload);

          if(type === "checklist" && Array.isArray(checklistRows) && checklistRows.length > 0){
            try{
              const insertRes = await SB
                .from("task_checklist_items")
                .insert(checklistRows);

              if(insertRes && insertRes.error){
                throw insertRes.error;
              }
            }catch(snapshotErr){
              console.warn("[PlannerActions] checklist snapshot insert failed", snapshotErr);

              try{
                if(saved && saved.id && window.PlannerAPI && typeof PlannerAPI.removeTaskLink === "function"){
                  await PlannerAPI.removeTaskLink(saved.id);
                }
              }catch(rollbackErr){
                console.warn("[PlannerActions] checklist snapshot rollback failed", rollbackErr);
              }

              submitBtn.disabled = false;
              if(msg) msg.textContent = "Не удалось прикрепить чек-лист.";
              return;
            }
          }

          close();

          if(typeof opts.onAdded === "function"){
            try{
              await opts.onAdded(saved, payload);
            }catch(afterErr){
              console.warn("[PlannerActions] onAdded callback error", afterErr);
            }
          }
        }catch(err){
          console.warn("[PlannerActions] openLinkDialog submit error", err);
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          if(msg) msg.textContent = "Ошибка: " + t;
          submitBtn.disabled = false;
        }
      };
    }
  }
window.PlannerActions = {
    wireCreateButton,
    wireQuickCreate,
    openCreateDialog,
    openEditDialog,
    openLinkDialog,
    setStatus,
    ensureInProgress
  };
})();




















































