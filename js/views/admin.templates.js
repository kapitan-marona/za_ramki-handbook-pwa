window.Views = window.Views || {};

window.Views.AdminTemplatesFactory = function(deps){
  deps = deps || {};

  const $ = deps.$ || function(s){ return document.querySelector(s); };
  const SB = deps.SB;

  const esc = deps.esc;
  const norm = deps.norm;
  const normLower = deps.normLower;
  const setBusy = deps.setBusy;
  const setStatus = deps.setStatus;
  const setPanelTitle = deps.setPanelTitle;
  const showViewer = deps.showViewer;
  const showLoading = deps.showLoading;
  const withTimeout = deps.withTimeout;
  const ensureSession = deps.ensureSession;
  const renderAdminTabs = deps.renderAdminTabs;
  const renderContentSubTabs = deps.renderContentSubTabs;
  const inpStyle = deps.inpStyle;
  const setMode = deps.setMode;
  const goAdmin = deps.goAdmin;

  const renderTagsPalette = deps.renderTagsPalette;
  const parseSelectedTags = deps.parseSelectedTags;
  const bindTagsPalette = deps.bindTagsPalette;
  const renderActionsBuilder = deps.renderActionsBuilder;
  const bindActionsUI = deps.bindActionsUI;
  const readActionsFromUI = deps.readActionsFromUI;

  if(!SB) throw new Error("Admin templates module: SB missing.");
  if(!esc || !norm || !normLower) throw new Error("Admin templates module: shared text helpers missing.");
  if(!setBusy || !setStatus || !setPanelTitle || !showViewer || !showLoading) throw new Error("Admin templates module: shared UI helpers missing.");
  if(!withTimeout || !ensureSession || !renderAdminTabs || !renderContentSubTabs || !inpStyle || !setMode || !goAdmin) {
    throw new Error("Admin templates module: shared runtime helpers missing.");
  }
  if(!renderTagsPalette || !parseSelectedTags || !bindTagsPalette || !renderActionsBuilder || !bindActionsUI || !readActionsFromUI){
    throw new Error("Admin templates module: shared content helpers missing.");
  }

  async function sbTemplatesListAll(){
    const p = SB.from("kb_templates")
      .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
      .order("sort", { ascending:true })
      .order("title", { ascending:true });
    const { data, error } = await withTimeout(p, 12000, "kb_templates list");
    if(error) throw error;
    return data || [];
  }

  async function sbTemplatesGet(id){
    const p = SB.from("kb_templates")
      .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
      .eq("id", id).single();
    const { data, error } = await withTimeout(p, 12000, "kb_templates get");
    if(error) throw error;
    return data;
  }

  async function sbTemplatesUpsert(row){
    await ensureSession();

    try{
      const p = SB.from("kb_templates").upsert(row, { onConflict:"id" }).select("id");
      const { error } = await withTimeout(p, 45000, "kb_templates upsert");
      if(error) throw error;
      return;
    }catch(e){
      const msg = (e && e.message) ? String(e.message) : String(e);
      const status = (e && typeof e.status === "number") ? e.status : null;
      const transient =
        msg.includes("Timeout") ||
        msg.toLowerCase().includes("network") ||
        msg.toLowerCase().includes("fetch") ||
        status === 0 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

      if(!transient) throw e;

      console.warn("[Admin] kb_templates upsert transient, retrying once…", e);
      try{
        await new Promise(res => setTimeout(res, 600));
        await ensureSession();
      }catch(_e){}

      const p2 = SB.from("kb_templates").upsert(row, { onConflict:"id" }).select("id");
      const { error: error2 } = await withTimeout(p2, 45000, "kb_templates upsert retry");
      if(error2) throw error2;
    }
  }

  async function sbTemplatesDelete(id){
    await ensureSession();
    const p = SB.from("kb_templates").delete().eq("id", id);
    const { error } = await withTimeout(p, 20000, "kb_templates delete");
    if(error) throw error;
  }

  function genTemplateId(){ return "tpl_" + Date.now().toString(36); }

  function openTemplate(id, opts){
    try{
      window.__tplReopenSafe = true;
      goAdmin("content:templates:" + id);
    }finally{
      setTimeout(() => window.__tplReopenSafe = false, 50);
    }
  }

  function templateEditorHtml(row, isNew){
    const id = row.id || "";
    const title = row.title || "";
    const format = row.format || "";
    const actions = Array.isArray(row.actions) ? row.actions : [];
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const published = row.published !== false;
    const sort = row.sort != null ? String(row.sort) : "1000";

    return `
      <div class="zr-admin-editor zr-stack-lg">
        <div class="zr-card zr-card--section zr-admin-editor__hero">
          <div class="zr-admin-editor__hero-head">
            <div class="zr-admin-editor__hero-main zr-stack-sm">
              <div class="zr-viewer-title-row">
                <h1 class="article-title">Контент → Шаблоны</h1>
              </div>
              <p class="article-sub">${isNew ? "Создание нового шаблона" : ("Редактирование: " + esc(id))}</p>
              <div class="zr-admin-editor__hero-meta">
                <span class="tag">templates</span>
                <span class="tag">${isNew ? "new" : "edit"}</span>
                ${id ? `<span class="tag mono">${esc(id)}</span>` : ""}
              </div>
            </div>
          </div>
        </div>

        <div class="zr-card zr-card--subtle zr-admin-editor__section zr-stack-md">
          <div class="zr-section-head">
            <div class="zr-section-title">Основные поля</div>
          </div>

          <div class="zr-admin-editor__grid">
            <div class="zr-admin-editor__field zr-admin-editor__field--full">
              <label class="zr-admin-editor__field-label" for="t_id">ID (уникальный ключ, латиница, без пробелов)</label>
              <div class="zr-admin-editor__id-row">
                <input id="t_id" style="${inpStyle}" value="${esc(id)}" ${isNew ? "" : "disabled"} placeholder="tpl_..." />
                <button class="btn btn-sm" id="gen_tpl_id" ${isNew ? "" : "disabled"}>Сгенерировать ID</button>
              </div>
              <div class="muted zr-admin-editor__field-help">ID используется как ключ шаблона. Лучше не менять после сохранения.</div>
            </div>

            <div class="zr-admin-editor__field zr-admin-editor__field--full">
              <label class="zr-admin-editor__field-label" for="t_title">Заголовок</label>
              <input id="t_title" style="${inpStyle}" value="${esc(title)}" />
            </div>

            <div class="zr-admin-editor__field">
              <label class="zr-admin-editor__field-label" for="t_format">Формат</label>
              <input id="t_format" style="${inpStyle}" value="${esc(format)}" placeholder="например: brief / excel / text" />
            </div>

            <div class="zr-admin-editor__field">
              <label class="zr-admin-editor__field-label" for="t_published">Published</label>
              <select id="t_published" style="${inpStyle}">
                <option value="1" ${published ? "selected" : ""}>да</option>
                <option value="0" ${published ? "" : "selected"}>нет</option>
              </select>
            </div>

            <div class="zr-admin-editor__field">
              <label class="zr-admin-editor__field-label" for="t_sort">Sort</label>
              <input id="t_sort" type="number" style="${inpStyle}" value="${esc(sort)}" />
            </div>
          </div>
        </div>

        <div class="zr-card zr-card--subtle zr-admin-editor__section zr-stack-sm">
          <div class="zr-section-head">
            <div class="zr-section-title">Теги</div>
          </div>
          <div class="item-meta">
            <span class="tag">dictionary</span>
            <span class="tag">multi-select</span>
          </div>
          <div id="tplTagsPalette">${renderTagsPalette(tags)}</div>
          <div class="muted zr-admin-editor__tags-meta">Выбрано: <span id="tplTagsChosen" class="mono">${esc(tags.join(", "))}</span></div>
        </div>

        <div class="zr-card zr-card--subtle zr-admin-editor__section zr-stack-sm">
          <div class="zr-section-head">
            <div class="zr-section-title">Кнопки действий</div>
          </div>
          <div id="tplActionsBox">${renderActionsBuilder(actions)}</div>
        </div>

        <div class="zr-card zr-card--subtle zr-admin-editor__section">
          <div class="zr-admin-editor__actions">
            <button class="btn btn--primary" id="t_save">Сохранить</button>
            ${isNew ? "" : `<button class="btn btn--danger" id="t_del">Удалить</button>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderTemplatesList(items){
    const list = $("#list");
    renderAdminTabs();
    renderContentSubTabs();

    if(!items.length){
      list.insertAdjacentHTML("beforeend", `<div class="empty" style="padding:12px;color:var(--muted)">Пока нет записей в kb_templates.</div>`);
      return;
    }

    items.forEach(it => {
      const fm = it.format ? `<span class="tag">${esc(it.format)}</span>` : "";
      const tagHtml = Array.isArray(it.tags) && it.tags.length
        ? it.tags.map(tag => `<span class="tag" data-tag-filter="${esc(String(tag))}">${esc(String(tag))}</span>`).join("")
        : "";
      const meta = [fm, tagHtml].filter(Boolean).join("");

      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/admin/${encodeURIComponent("content:templates:" + it.id)}`;
      a.innerHTML = `
        <div class="item-title">${esc(it.title || it.id || "Шаблон")}</div>
        <div class="item-meta">${meta}</div>
      `;
      list.appendChild(a);
    });
  }

  function bindTemplateEditor(isNew, rowData){
    const root = $("#viewer");
    if(!root) return;

    bindTagsPalette();
    bindActionsUI(Array.isArray(rowData?.actions) ? rowData.actions : [], "tplActionsBox");

    const syncTplTags = () => {
      const el = $("#tplTagsChosen");
      if(el) el.textContent = parseSelectedTags(root).join(", ");
    };

    root.querySelectorAll("[data-tag]").forEach(btn => {
      btn.addEventListener("click", () => {
        setTimeout(syncTplTags, 0);
      });
    });

    syncTplTags();

    const genBtn = $("#gen_tpl_id");
    if(genBtn){
      genBtn.onclick = () => {
        const idEl = $("#t_id");
        if(idEl && !idEl.value.trim()) idEl.value = genTemplateId();
      };
    }

    const saveBtn = $("#t_save");
    if(saveBtn){
      saveBtn.onclick = async () => {
        if(window.__adminSaveLock) return;
        if(!window.__adminClickGuard("admin_save")) return;
        if(!window.__adminClickGuard("tpl_save")) return;
        window.__adminSaveLock = true;

        setBusy(true, "Сохраняю…");
        try{
          const id = normLower($("#t_id").value);
          if(!id){
            setBusy(false);
            window.__adminSaveLock = false;
            return alert("ID обязателен. Нажми 'Сгенерировать ID' или введи вручную.");
          }

          const currentId = id;
          const existing = await sbTemplatesGet(currentId);

          const sortRaw = norm($("#t_sort").value);
          const actionsVal = readActionsFromUI(root);

          const row = {
            id: currentId,
            title: norm($("#t_title").value),
            format: normLower($("#t_format").value),
            link: existing && Object.prototype.hasOwnProperty.call(existing, "link")
              ? (existing.link || null)
              : null,
            actions: actionsVal,
            tags: parseSelectedTags(root),
            published: ($("#t_published").value || "1") === "1",
            sort: sortRaw ? Number(sortRaw) : 1000
          };

          if(!row.title){
            setBusy(false);
            window.__adminSaveLock = false;
            return alert("Заголовок обязателен.");
          }

          await sbTemplatesUpsert(row);

          try{
            const targetHash = "#/admin/templates/" + encodeURIComponent(row.id);
            if(location.hash !== targetHash){
              setBusy(false);
              window.__adminSaveLock = false;
              location.hash = targetHash;
              return;
            }
          }catch(e){}

          setBusy(false);
          window.__adminSaveLock = false;

          try{
            openTemplate(id, { reopen:true });
          }catch(e){
            console.warn("[ADMIN_TEMPLATES_SAFE_REFRESH_FAIL]", e);
          }

          return;
        }catch(e){
          console.error(e);
          setBusy(false);
          window.__adminSaveLock = false;
          alert(e.message || String(e));
        }
      };
    }

    const delBtn = $("#t_del");
    if(delBtn){
      delBtn.onclick = async () => {
        const id = normLower($("#t_id").value);
        if(!id) return;
        if(!confirm("Удалить шаблон?")) return;

        setBusy(true, "Удаляю…");
        try{
          await sbTemplatesDelete(id);
          setBusy(false);
          window.__adminSaveLock = false;

          alert("Удалено ✅");
          goAdmin("content:templates");
          await loadTemplates("");
        }catch(e){
          console.error(e);
          setBusy(false);
          window.__adminSaveLock = false;
          alert(e.message || String(e));
        }
      };
    }
  }

  async function loadTemplates(openId){
    setPanelTitle("Админка");
    setStatus("…");
    setMode("content");

    try{ if(window.App) App._navLock = !!(openId && String(openId).length); }catch(e){}

    showLoading("Загрузка шаблонов…");

    try{
      const items = await sbTemplatesListAll();

      renderTemplatesList(items);
      setStatus(String(items.length));

      if(!openId){
        showViewer(`<div class="empty">Выбери существующий шаблон слева для редактирования.</div>`);
        return;
      }

      if(openId === "new"){
        showViewer(`
          <div class="item" style="cursor:default; margin-bottom:12px;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div style="flex:1; min-width:240px;">
                <h1 class="article-title" style="font-size:18px; line-height:1.15;">Контент → Шаблоны</h1>
                <p class="article-sub">Создание новых шаблонов через админку отключено.</p>
              </div>
            </div>
          </div>

          <div class="item" style="cursor:default;">
            <div class="item-title">Edit-only mode</div>
            <div class="item-meta" style="margin-top:10px;">
              <span class="tag">templates</span>
              <span class="tag">edit_only</span>
              <span class="tag">no_create_in_admin</span>
            </div>
            <div style="margin-top:12px;">
              <div class="empty">Новые шаблоны создаются вне админки. Здесь можно редактировать только существующие записи.</div>
            </div>
          </div>
        `);
        setStatus(String(items.length));
        return;
      }

      const row = await sbTemplatesGet(openId);
      showViewer(templateEditorHtml(row, false));
      bindTemplateEditor(false, row);

    }catch(e){
      console.error(e);
      showViewer(`<div class="empty">Ошибка загрузки шаблонов: ${esc(e.message || String(e))}</div>`);
      setStatus("ошибка");
    }
  }

  const api = {
    load: loadTemplates
  };

  return api;
};
