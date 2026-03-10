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
      <div class="item" style="width:min(560px, 96vw); cursor:default; padding:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:700; letter-spacing:.06em;">${dialogTitle}</div>
          <button class="btn btn-sm" id="plCreateClose" type="button">Закрыть</button>
        </div>

        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Название *</div>
            <input class="pl-control" id="plCreateTitle" value="${titleValue}" placeholder="Например: согласовать макет кухни" />
          </div>

          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Описание</div>
            <textarea class="pl-control pl-textarea" id="plCreateBody" rows="3" placeholder="Коротко: что сделать, где смотреть, какие критерии…">${bodyValue}</textarea>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Старт</div>
              <input class="pl-control" id="plCreateStart" type="date" value="${startValue}" />
            </div>
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Дедлайн</div>
              <input class="pl-control" id="plCreateDue" type="date" value="${dueValue}" />
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
            <select class="pl-control" id="plCreateProject">
              <option value="">— Без проекта —</option>
            </select>
          </div>

          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Исполнитель</div>
            <select class="pl-control" id="plCreateAssignee">
              <option value="">— Не назначен —</option>
            </select>
          </div>

          <div style="display:flex; gap:10px; align-items:center; justify-content:flex-end; margin-top:4px;">
            <span class="muted" id="plCreateMsg" style="font-size:12px; flex:1;"></span>
            <button class="btn" id="plCreateDo" type="button">${submitLabel}</button>
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

    overlay.addEventListener("click", (e) => { if(e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);

    (async () => {
      const sel = document.getElementById("plCreateProject");
      const assigneeSel = document.getElementById("plCreateAssignee");

      const items = await loadProjects();
      const selectedProjectId = isEdit && task && task.project_id ? String(task.project_id) : "";

      if(sel){
        sel.innerHTML =
          `<option value="">— Без проекта —</option>` +
          items.map(p => {
            const pid = String(p.id);
            const isSel = selectedProjectId && selectedProjectId === pid ? " selected" : "";
            return `<option value="${esc(pid)}"${isSel}>${esc(p.title)}</option>`;
          }).join("");
      }

      if(assigneeSel){
        const people = await loadAssignablePeople();
        const currentAssigneeId = (isEdit && task && Array.isArray(task.assignees) && task.assignees.length)
          ? String(task.assignees[0])
          : "";

        assigneeSel.innerHTML =
          `<option value="">— Не назначен —</option>` +
          (people || []).map(p => {
            const pid = String(p.id);
            const isSel = currentAssigneeId && currentAssigneeId === pid ? " selected" : "";
            return `<option value="${esc(pid)}"${isSel}>${esc(personLabel(p))}</option>`;
          }).join("");
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
        const roleEl = document.getElementById("plCreateRole");
        const urgEl  = document.getElementById("plCreateUrgency");
        const projectEl = document.getElementById("plCreateProject");
        const assigneeEl = document.getElementById("plCreateAssignee");

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

          const result = await onSubmit(payload);

          const taskIdForAssignee = isEdit
            ? (task && task.id ? String(task.id) : "")
            : (result && result.id ? String(result.id) : "");

          if(taskIdForAssignee && window.PlannerAPI && typeof PlannerAPI.setTaskAssignees === "function"){
            await PlannerAPI.setTaskAssignees(taskIdForAssignee, nextAssignees);
          }

          if(typeof opts.onAfterSubmit === "function"){
            await opts.onAfterSubmit(taskIdForAssignee, result);
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
      <div class="item" style="width:min(620px, 96vw); cursor:default; padding:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:700; letter-spacing:.06em;">Добавить документ</div>
          <button class="btn btn-sm" id="plLinkClose" type="button">Закрыть</button>
        </div>

        <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
          <div>
            <div class="muted" style="font-size:12px; margin-bottom:8px;">Тип документа</div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="article" checked>
                <span>Инструкция</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="checklist">
                <span>Чек-лист</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="template">
                <span>Шаблон</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="plLinkType" value="external">
                <span>Внешняя ссылка</span>
              </label>
            </div>
          </div>

          <div id="plLinkInternalBlock">
            <div id="plLinkArticlePicker" style="display:flex; flex-direction:column; gap:10px;">
              <div>
                <div class="muted" style="font-size:12px; margin-bottom:6px;">Поиск инструкции</div>
                <input class="pl-control" id="plLinkArticleSearch" placeholder="Начните вводить название инструкции" />
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
                <input class="pl-control" id="plLinkRefId" placeholder="Например: a_mm6t8xb9" />
              </div>
              <div>
                <div class="muted" style="font-size:12px; margin-bottom:6px;">Название</div>
                <input class="pl-control" id="plLinkInternalLabel" placeholder="Например: Инструкция" />
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

          <div style="display:flex; gap:10px; align-items:center; justify-content:flex-end;">
            <span class="muted" id="plLinkMsg" style="font-size:12px; flex:1;"></span>
            <button class="btn btn-sm" id="plLinkCancel" type="button">Отмена</button>
            <button class="btn" id="plLinkSubmit" type="button">Добавить</button>
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

    async function runArticleSearch(){
      try{
        const checked = overlay.querySelector('input[name="plLinkType"]:checked');
        const type = checked ? String(checked.value) : "article";
        const resultsHost = document.getElementById("plLinkArticleResults");
        const searchEl = document.getElementById("plLinkArticleSearch");

        if(!resultsHost) return;

        if(type !== "article"){
          resultsHost.innerHTML = "";
          resultsHost.style.display = "none";
          return;
        }

        if(!window.PlannerAPI || typeof PlannerAPI.searchArticlesForLink !== "function"){
          resultsHost.innerHTML = `<div class="muted" style="font-size:12px;">Поиск инструкций недоступен.</div>`;
          return;
        }

        const q = searchEl && searchEl.value ? String(searchEl.value).trim() : "";
        resultsHost.style.display = "block";
        resultsHost.innerHTML = `<div class="muted" style="font-size:12px; padding:6px 8px;">Ищу…</div>`;

        const items = (await PlannerAPI.searchArticlesForLink(q)).slice(0, 5);

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
            if(labelEl){
              labelEl.value = btn.dataset.title || "";
            }
            if(searchEl){
              searchEl.value = btn.dataset.title || "";
            }
            resultsHost.innerHTML = "";
            resultsHost.style.display = "none";
          };
        });
      }catch(err){
        console.warn("[PlannerActions] article search error", err);
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
      const type = checked ? String(checked.value) : "article";

      const internalBlock = document.getElementById("plLinkInternalBlock");
      const externalBlock = document.getElementById("plLinkExternalBlock");
      const articlePicker = document.getElementById("plLinkArticlePicker");
      const searchEl = document.getElementById("plLinkArticleSearch");
      const resultsHost = document.getElementById("plLinkArticleResults");

      if(internalBlock) internalBlock.style.display = (type === "external") ? "none" : "";
      if(externalBlock) externalBlock.style.display = (type === "external") ? "" : "none";

      if(articlePicker){
        articlePicker.style.display = (type === "external") ? "none" : "";
      }

      if(searchEl){
        searchEl.disabled = (type !== "article");
        searchEl.placeholder = (type === "article")
          ? "Начните вводить название инструкции"
          : "Поиск пока доступен только для инструкций";
      }

      if(resultsHost){
        resultsHost.innerHTML = "";
        resultsHost.style.display = "none";
      }
    }

    overlay.addEventListener("click", (e) => { if(e.target === overlay) close(); });
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
        const type = checked ? String(checked.value) : "article";

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

          const isDuplicate = await checkDuplicateLink(payload);
          if(isDuplicate){
            const ok = confirm("Уже добавлено. Добавить ещё раз?");
            if(!ok){
              submitBtn.disabled = false;
              if(msg) msg.textContent = "Отменено.";
              return;
            }
          }

          if(msg) msg.textContent = "Сохраняю…";
          const saved = await PlannerAPI.addTaskLink(task.id, payload);

          if(typeof opts.onAdded === "function"){
            await opts.onAdded(saved, payload);
          }

          close();
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

































