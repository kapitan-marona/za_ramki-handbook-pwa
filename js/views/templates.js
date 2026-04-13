window.Views = window.Views || {};
Views.Templates = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  let _data = [];
  let _q = "";
  let _activeTemplateId = "";

  function setStatus(t){ $("#status").textContent = t; }
  function setPanelTitle(t){ $("#panelTitle").textContent = t; }

  function norm(s){ return (s ?? "").toString().toLowerCase(); }

  const TPL_LAST_HASH_KEY = "zr_tpl_last_hash";
  const TPL_RETURN_HASH_KEY = "zr_tpl_return_hash";

  function getCurrentHash(){
    return String(location.hash || "");
  }

  function isTemplateHash(hash){
    return /^#\/templates(?:\/|$)/.test(String(hash || ""));
  }

  function isTemplateDetailHash(hash){
    return /^#\/templates\/[^\/]+/.test(String(hash || ""));
  }

  function isTemplateListHash(hash){
    return String(hash || "") === "#/templates";
  }

  function isPlannerTaskHash(hash){
    return /^#\/planner\/[^\/]+/.test(String(hash || ""));
  }

  function installTemplateContextTracker(){
    try{
      if(window.__zrTemplateContextTrackerInstalled) return;
      window.__zrTemplateContextTrackerInstalled = true;

      if(window.ViewerNav && typeof ViewerNav.installTracker === "function"){
        ViewerNav.installTracker({
          lastKey: TPL_LAST_HASH_KEY,
          returnKey: TPL_RETURN_HASH_KEY,
          isDetailHash: isTemplateDetailHash,
          isListHash: isTemplateListHash
        });
      }
    }catch(e){}
  }

  function getTemplateReturnHash(){
    try{
      if(window.ViewerNav && typeof ViewerNav.getReturnHash === "function"){
        return ViewerNav.getReturnHash(TPL_RETURN_HASH_KEY) || "#/templates";
      }
    }catch(e){}
    return "#/templates";
  }

  function getTemplateCloseLabel(){
    try{
      if(window.ViewerNav && typeof ViewerNav.getCloseLabel === "function"){
        return ViewerNav.getCloseLabel(getTemplateReturnHash());
      }
    }catch(e){}
    return isPlannerTaskHash(getTemplateReturnHash()) ? "К задаче" : "Закрыть";
  }

  function goTemplateClose(){
    const target = getTemplateReturnHash();

    try{
      if(window.ViewerNav && typeof ViewerNav.goClose === "function"){
        ViewerNav.goClose(target, "templates");
        return;
      }
    }catch(e){}

    location.hash = isPlannerTaskHash(target) ? target : "#/templates";
  }

  function getMainPanel(){
    return document.querySelector(".panel");
  }

  function getMainViewer(){
    return document.querySelector(".viewer");
  }

  function enableMobileReadingMode(){
    document.body.classList.add("zr-mobile-reading");
    if(window.innerWidth > 960) return;

    const panel = getMainPanel();
    const viewer = getMainViewer();

    if(panel) panel.style.display = "none";
    if(viewer){
      viewer.style.display = "";
      viewer.style.width = "100%";
      viewer.style.maxWidth = "100%";
    }
  }

  function disableMobileReadingMode(){
    document.body.classList.remove("zr-mobile-reading");

    const panel = getMainPanel();
    const viewer = getMainViewer();

    if(panel) panel.style.display = "";
    if(viewer){
      viewer.style.display = "";
      viewer.style.width = "";
      viewer.style.maxWidth = "";
    }
  }

  function bindMobileListToggle(btn){
    if(!btn) return;

    const sync = () => {
      if(window.innerWidth > 960){
        btn.style.display = "none";
        return;
      }

      btn.style.display = "inline-flex";

      const panel = getMainPanel();
      const reading = !!(panel && panel.style.display === "none");

      btn.textContent = reading ? "Показать список" : "Скрыть список";
      btn.setAttribute("aria-expanded", reading ? "false" : "true");
    };

    btn.onclick = () => {
      if(window.innerWidth > 960) return;

      const panel = getMainPanel();
      const hiddenNow = !!(panel && panel.style.display === "none");

      if(hiddenNow){
        disableMobileReadingMode();
      }else{
        enableMobileReadingMode();
      }

      sync();
    };

    sync();
  }

  function fmtDMY(value){
    try{
      if(window.ViewerNav && typeof ViewerNav.formatDMY === "function"){
        return ViewerNav.formatDMY(value);
      }
    }catch(e){}
    return String(value || "").trim();
  }

  function fmtMetaDate(value){
    return fmtDMY(value);
  }

  function renderMetaRow(meta){
    const author =
      meta?.author ||
      meta?.author_name ||
      meta?.created_by_name ||
      meta?.created_by ||
      "";

    const created =
      meta?.createdAt ||
      meta?.created_at ||
      "";

    const updated =
      meta?.updatedAt ||
      meta?.updated_at ||
      "";

    const linked =
      meta?.linkedFrom ||
      meta?.linked_from ||
      "";

    const parts = [];

    if(author)  parts.push(`<span class="tag">Автор: ${esc(String(author))}</span>`);
    if(created) parts.push(`<span class="tag">Создано: ${esc(fmtMetaDate(created))}</span>`);
    if(updated) parts.push(`<span class="tag">Обновлено: ${esc(fmtMetaDate(updated))}</span>`);
    if(linked)  parts.push(`<span class="tag">Связано с: ${esc(String(linked))}</span>`);

    return parts.join("");
  }

  function renderResourcesBlock(items){
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if(!list.length){
      return `<span class="muted">Связанные ресурсы пока не добавлены.</span>`;
    }

    return `
      <div class="actions">
        ${list.map((r) => {
          const label = esc(r.label || "Открыть");
          const href = esc(r.href || "#");
          const target = r.external ? `target="_blank" rel="noopener"` : "";
          return `<a class="btn" href="${href}" ${target}>${label}</a>`;
        }).join("")}
      </div>
    `;
  }

  async function loadTemplatesFromSupabase(){
    if(!window.SB) return [];

    const { data, error } = await SB
      .from("kb_templates")
      .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
      .eq("published", true)
      .order("sort", { ascending:true })
      .order("title", { ascending:true });

    if(error){
      console.error("[Templates] Supabase load error:", error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  function getTemplateResources(template){
    const actions = Array.isArray(template?.actions) ? template.actions.filter(Boolean) : [];
    if(actions.length){
      return actions.map((a) => ({
        label: a.label || "Открыть",
        href: a.url || "#",
        external: !!a.external
      }));
    }

    const link = String(template?.link || "").trim();
    if(link){
      return [{
        label: "Открыть",
        href: link,
        external: !link.startsWith("#/")
      }];
    }

    return [];
  }

  function getFavApi(){
    return window.ZRFavorites || null;
  }

  function isTemplateFavorite(id){
    try{
      const api = getFavApi();
      return !!(api && api.isFavorite("templates", id));
    }catch(e){}
    return false;
  }

  function renderTemplateFavoriteButton(id){
    const active = isTemplateFavorite(id);
    return `<button class="btn btn-sm zr-fav-btn ${active ? "is-active" : ""}" id="tplFavBtn" type="button" aria-pressed="${active ? "true" : "false"}" title="${active ? "Убрать из избранного" : "Добавить в избранное"}" aria-label="${active ? "Убрать из избранного" : "Добавить в избранное"}"><span class="zr-fav-btn__icon" aria-hidden="true">${active ? "★" : "☆"}</span><span class="zr-fav-btn__text">Избранное</span></button>`;
  }

  function bindTemplateFavoriteButton(id){
    const btn = document.getElementById("tplFavBtn");
    if(!btn) return;

    btn.onclick = () => {
      try{
        const api = getFavApi();
        if(!api) return;

        api.toggleFavorite("templates", id);
        const active = api.isFavorite("templates", id);

        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.setAttribute("title", active ? "Убрать из избранного" : "Добавить в избранное");
        btn.setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");

        const icon = btn.querySelector(".zr-fav-btn__icon");
        if(icon) icon.textContent = active ? "★" : "☆";
      }catch(e){
        console.error("[Favorites][Templates]", e);
      }
    };
  }

  function renderViewerShell(template, options){
    const o = options || {};
    const metaHtml = renderMetaRow(template);
    const resourcesHtml = renderResourcesBlock(o.resources || []);
    const sub = o.sub ? `<p class="article-sub">${esc(o.sub)}</p>` : "";

    return `
      <div class="zr-stack-lg zr-viewer-shell">
        <div class="zr-card zr-card--section zr-stack-md" data-tpl-section="header">
          <div class="zr-viewer-header-row">
            <div class="zr-viewer-header-main zr-stack-sm">
              <div class="zr-viewer-title-row">
                <h1 class="article-title">${esc(template.title || "Шаблон")}</h1>
                ${renderTemplateFavoriteButton(template.id)}
              </div>
              ${sub}
            </div>
            <div class="zr-viewer-header-actions">
              <button class="btn btn-sm zr-mobile-only" id="tplListBtn" type="button">Показать список</button>
              <button class="btn btn-sm" id="tplBackBtn" type="button">${getTemplateCloseLabel()}</button>
            </div>
          </div>
        </div>

        <div class="zr-card zr-card--subtle zr-stack-sm" data-tpl-section="meta" style="${metaHtml ? "" : "display:none;"}">
          <div class="zr-section-head">
            <div class="zr-section-title">Мета</div>
          </div>
          <div class="item-meta">${metaHtml}</div>
        </div>

        <div class="zr-card zr-card--section zr-stack-md" data-tpl-section="body">
          ${o.body || ""}
        </div>

        <div class="zr-card zr-card--subtle zr-stack-sm" data-tpl-section="resources">
          <div class="zr-section-head">
            <div class="zr-section-title">Ресурсы</div>
          </div>
          <div class="zr-resource-block">${resourcesHtml}</div>
        </div>
      </div>
    `;
  }

  installTemplateContextTracker();

  function bindAutosave(fields, key){
    if(!fields || !key) return;

    const saveDraft = () => {
      try{
        const v = {};
        Object.entries(fields).forEach(([k, el]) => {
          if(!el) return;
          v[k] = (el.value || "").trim();
        });
        localStorage.setItem(key, JSON.stringify(v));
      }catch(e){}
    };

    Object.values(fields).forEach((el) => {
      if(!el) return;
      el.addEventListener("input", saveDraft);
      el.addEventListener("change", saveDraft);
      el.addEventListener("blur", saveDraft);
    });
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function buildBriefText(v){
    return [
      "ТЗ для визуализатора",
      "=====================",
      `Проект: ${v.project || ""}`,
      `Помещение/зона: ${v.zone || ""}`,
      `Стиль/настроение: ${v.style || ""}`,
      `Палитра: ${v.palette || ""}`,
      `Камеры: ${v.cameras || ""}`,
      "",
      "Обязательные позиции:",
      v.mustHave || "",
      "",
      "Материалы/примечания:",
      v.notes || "",
      "",
      `Дедлайн: ${v.deadline || ""}`
    ].join("\n");
  }

  function renderList(activeId){
    const list = $("#list");
    list.innerHTML = "";

    const q = norm(_q).trim();
    const items = Array.isArray(_data) ? _data : [];
    const filtered = !q ? items : items.filter(t => {
      const title = norm(t.title);
      const id = norm(t.id);
      const fmt = norm(t.format);
      const tags = Array.isArray(t.tags) ? norm(t.tags.join(" ")) : "";
      return title.includes(q) || id.includes(q) || fmt.includes(q) || tags.includes(q);
    });

    setStatus(`${filtered.length}`);

    const selectedId = String(
      activeId != null && activeId !== ""
        ? activeId
        : _activeTemplateId || ""
    );

    filtered.forEach((t) => {
      const currentId = String(t.id || "");
      const a = document.createElement("a");
      a.className = `zr-list-row ${selectedId === currentId ? "zr-list-row--active" : ""}`;
      a.href = `#/${encodeURIComponent("templates")}/${encodeURIComponent(t.id)}`;
      const metaParts = [];
      if(t.format) metaParts.push(`<span class="tag">${esc(t.format)}</span>`);
      if(Array.isArray(t.tags) && t.tags.length){
        t.tags.forEach(tag => {
          metaParts.push(`<span class="tag" data-tag-filter="${esc(String(tag))}">${esc(String(tag))}</span>`);
        });
      }

      a.innerHTML = `
        <div class="zr-list-row-title">${esc(t.title || "Шаблон")}</div>
        ${metaParts.length ? `<div class="zr-list-row-tags">${metaParts.join("")}</div>` : ""}
      `;
      list.appendChild(a);
    });
  }

  async function show(param){
    setPanelTitle("Шаблоны");
    const viewer = $("#viewer"); if(viewer) viewer.scrollTop = 0;

    _data = await loadTemplatesFromSupabase();
    _activeTemplateId = String(param || "");

    if(param){
      renderList();
      await open(param);
      return;
    }

    renderList();
    disableMobileReadingMode();
    viewer.innerHTML = renderFavoriteTemplatesStart();
  }

  async function open(templateId){
    _activeTemplateId = String(templateId || "");

    const viewer = $("#viewer"); if(viewer) viewer.scrollTop = 0;
    renderList();
    const data = Array.isArray(_data) && _data.length ? _data : await loadTemplatesFromSupabase();
    const t = data.find(x => x.id === templateId);

    if(!t){
      disableMobileReadingMode();
      viewer.innerHTML = `<div class="empty">Шаблон не найден.</div>`;
      return;
    }

    if(templateId === "project_links_excel"){
      const key = "tpl:project_links_excel:v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}");

      const body = `
        <div class="markdown zr-stack-lg">
          <div class="zr-form-grid">
            <div class="zr-field zr-span-full">
              <span class="zr-label">Адрес объекта</span>
              <input id="f_address" class="zr-input" placeholder="Например: Oulu, Isokatu 10" />
            </div>

            <div class="zr-field">
              <span class="zr-label">Ссылка на свет (PDF)</span>
              <input id="f_light_pdf" class="zr-input" />
            </div>

            <div class="zr-field">
              <span class="zr-label">Ссылка на обмерный план (PDF)</span>
              <input id="f_meas_pdf" class="zr-input" />
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">План мебели</span>
              <div class="zr-row-2">
                <input id="f_furn_dwg" class="zr-input" placeholder="DWG" />
                <input id="f_furn_pdf" class="zr-input" placeholder="PDF" />
              </div>
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">Концепт + ТЗ визуализатору</span>
              <div class="zr-row-2">
                <input id="f_concept" class="zr-input" placeholder="Концепт" />
                <input id="f_tz" class="zr-input" placeholder="ТЗ" />
              </div>
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">Ссылка на ведомость материалов</span>
              <input id="f_materials" class="zr-input" />
            </div>
          </div>

          <div class="zr-actions-right">
            <button class="btn" id="btn_save">Сохранить</button>
            <button class="btn" id="btn_clear">Очистить</button>
            <button class="btn" id="btn_xlsx">Скачать Excel</button>
          </div>
        </div>
      `;

      const resources = getTemplateResources(t);

      viewer.innerHTML = renderViewerShell(t, {
        sub: "Вставь ссылки → скачай Excel.",
        body,
        resources
      });

      const backBtn = document.getElementById("tplBackBtn");
      if(backBtn) backBtn.onclick = () => goTemplateClose();

      bindTemplateFavoriteButton(t.id);

      const listBtn = document.getElementById("tplListBtn");
      bindMobileListToggle(listBtn);

      setupTemplateBodyCollapse(viewer);
      enableMobileReadingMode();

      const fields = {
        address: $("#f_address"),
        lightPdf: $("#f_light_pdf"),
        furnitureDwg: $("#f_furn_dwg"),
        furniturePdf: $("#f_furn_pdf"),
        measPdf: $("#f_meas_pdf"),
        concept: $("#f_concept"),
        tz: $("#f_tz"),
        materials: $("#f_materials"),
      };

      Object.entries(fields).forEach(([k, el]) => {
        if(el) el.value = saved[k] || "";
      });
      bindAutosave(fields, key);

      function readValues(){
        const v = {};
        Object.entries(fields).forEach(([k, el]) => v[k] = (el.value || "").trim());
        return v;
      }

      $("#btn_save").onclick = () => {
        localStorage.setItem(key, JSON.stringify(readValues()));
        alert("Сохранено ✅");
      };

      $("#btn_clear").onclick = () => {
        const hasValues = Object.values(fields).some((el) => {
          return !!(el && String(el.value || "").trim());
        });

        if(!hasValues) return;
        if(!confirm("Очистить все поля?")) return;

        Object.values(fields).forEach((el) => {
          if(el) el.value = "";
        });

        try{ localStorage.removeItem(key); }catch(e){}

        try{
          const viewerEl = $("#viewer");
          if(viewerEl) viewerEl.scrollTop = 0;
        }catch(e){}

        try{
          const firstField = $("#f_address");
          if(firstField) firstField.focus();
        }catch(e){}
      };

      $("#btn_xlsx").onclick = async () => {
        const v = readValues();
        if(!window.Utils || !Utils.LinksXLSX){
          alert("XLSX-экспорт не подключён (js/utils/links_xlsx.js).");
          return;
        }

        const rows = [
          { label: "Адрес объекта", value: v.address },
          { label: "Ссылка на свет (PDF)", value: v.lightPdf },
          { label: "Ссылка на план мебели (DWG)", value: v.furnitureDwg },
          { label: "Ссылка на план мебели (PDF)", value: v.furniturePdf },
          { label: "Ссылка на обмерный план (PDF)", value: v.measPdf },
          { label: "Ссылка на концепт", value: v.concept },
          { label: "Ссылка на ТЗ визуализатору", value: v.tz },
          { label: "Ссылка на ведомость материалов", value: v.materials }
        ];

        const rawAddr = (v.address || "").trim();
        const safeAddr = rawAddr
          .replace(/[^a-zA-Z0-9А-Яа-яЁё]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 60);

        const fileBase = safeAddr ? `${safeAddr}_Project_Links` : "Project_Links";
        await Utils.LinksXLSX.downloadLinksXLSX(rows, fileBase, rawAddr);
      };

      return;
    }

    if(templateId !== "brief_visualizer"){
      const body = `
        <div class="markdown zr-stack-sm">
          <p class="article-sub zr-note-reset">Пока без формы. Можно открыть файл по ссылке.</p>
        </div>
      `;

      const resources = getTemplateResources(t);

      viewer.innerHTML = renderViewerShell(t, {
        body,
        resources
      });

      const backBtn = document.getElementById("tplBackBtn");
      if(backBtn) backBtn.onclick = () => goTemplateClose();

      bindTemplateFavoriteButton(t.id);

      const listBtn = document.getElementById("tplListBtn");
      bindMobileListToggle(listBtn);

      setupTemplateBodyCollapse(viewer);
      enableMobileReadingMode();
      return;
    }

    {
      const key = "tpl:brief_visualizer:v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}");

      const body = `
        <div class="markdown zr-stack-lg">
          <div class="zr-form-grid">
            <div class="zr-field zr-span-full">
              <span class="zr-label">Проект</span>
              <input id="f_project" class="zr-input" />
            </div>

            <div class="zr-field">
              <span class="zr-label">Зона/помещение</span>
              <input id="f_zone" class="zr-input" />
            </div>

            <div class="zr-field">
              <span class="zr-label">Дедлайн</span>
              <input id="f_deadline" class="zr-input" />
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">Стиль/настроение</span>
              <input id="f_style" class="zr-input" />
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">Палитра</span>
              <input id="f_palette" class="zr-input" />
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">Камеры</span>
              <textarea id="f_cameras" rows="4" class="zr-input zr-textarea"></textarea>
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">Обязательные позиции</span>
              <textarea id="f_must" rows="4" class="zr-input zr-textarea"></textarea>
            </div>

            <div class="zr-field zr-span-full">
              <span class="zr-label">Материалы/примечания</span>
              <textarea id="f_notes" rows="5" class="zr-input zr-textarea"></textarea>
            </div>
          </div>

          <div class="zr-actions-right">
            <button class="btn" id="btn_save">Сохранить</button>
            <button class="btn" id="btn_clear">Очистить</button>
            <button class="btn" id="btn_copy">Скопировать</button>
            <button class="btn" id="btn_download">Скачать .txt</button>
          </div>
        </div>
      `;

      const resources = getTemplateResources(t);

      viewer.innerHTML = renderViewerShell(t, {
        sub: "Заполни быстро → скачай .txt или скопируй.",
        body,
        resources
      });

      const backBtn = document.getElementById("tplBackBtn");
      if(backBtn) backBtn.onclick = () => goTemplateClose();

      bindTemplateFavoriteButton(t.id);

      const listBtn = document.getElementById("tplListBtn");
      bindMobileListToggle(listBtn);

      setupTemplateBodyCollapse(viewer);
      enableMobileReadingMode();

      const fields = {
        project: $("#f_project"),
        zone: $("#f_zone"),
        style: $("#f_style"),
        palette: $("#f_palette"),
        cameras: $("#f_cameras"),
        mustHave: $("#f_must"),
        notes: $("#f_notes"),
        deadline: $("#f_deadline"),
      };

      Object.entries(fields).forEach(([k, el]) => {
        if(el) el.value = saved[k] || "";
      });
      bindAutosave(fields, key);

      function readValues(){
        const v = {};
        Object.entries(fields).forEach(([k, el]) => v[k] = (el.value || "").trim());
        return v;
      }

      $("#btn_save").onclick = () => {
        localStorage.setItem(key, JSON.stringify(readValues()));
        alert("Сохранено ✅");
      };

      $("#btn_clear").onclick = () => {
        const hasValues = Object.values(fields).some((el) => {
          return !!(el && String(el.value || "").trim());
        });

        if(!hasValues) return;
        if(!confirm("Очистить все поля?")) return;

        Object.values(fields).forEach((el) => {
          if(el) el.value = "";
        });

        try{ localStorage.removeItem(key); }catch(e){}

        try{
          const viewerEl = $("#viewer");
          if(viewerEl) viewerEl.scrollTop = 0;
        }catch(e){}

        try{
          const firstField = $("#f_address");
          if(firstField) firstField.focus();
        }catch(e){}
      };

      $("#btn_copy").onclick = async () => {
        const text = buildBriefText(readValues());
        await navigator.clipboard.writeText(text);
        alert("Скопировано ✅");
      };

      $("#btn_download").onclick = () => {
        const text = buildBriefText(readValues());
        downloadText("TZ_dlya_vizualizatora.txt", text);
      };
    }
  }

  function getFavoriteTemplateItems(){
    try{
      const api = getFavApi();
      if(!api || typeof api.getFavorites !== "function") return [];
      const store = api.getFavorites() || {};
      const ids = Array.isArray(store.templates) ? store.templates : [];
      if(!ids.length) return [];
      const map = new Map((_data || []).map(it => [String(it.id), it]));
      return ids.map(id => map.get(String(id))).filter(Boolean);
    }catch(e){}
    return [];
  }

  function renderFavoriteTemplatesStart(){
    const items = getFavoriteTemplateItems();

    if(!items.length){
      return `<div class="zr-empty-shell">Выберите шаблон слева.</div>`;
    }

    return `
      <div class="zr-stack-md">
        <div class="zr-list-intro zr-stack-sm">
          <div class="zr-section-head">
            <div class="zr-section-title">Избранное</div>
          </div>
          <div class="item-meta">Быстрый доступ к сохранённым шаблонам.</div>
        </div>

        <div class="zr-stack-sm">
          ${items.map((t) => {
            const metaParts = [];
            if(t.format) metaParts.push(`<span class="tag">${esc(t.format)}</span>`);
            if(t.updated_at || t.updatedAt) metaParts.push(`<span class="tag">Обновлено: ${esc(fmtMetaDate(t.updated_at || t.updatedAt))}</span>`);
            if(Array.isArray(t.tags) && t.tags.length){
              t.tags.forEach(tag => metaParts.push(`<span class="tag">${esc(String(tag))}</span>`));
            }

            return `
              <a class="zr-list-row" href="#/${encodeURIComponent("templates")}/${encodeURIComponent(t.id)}">
                <div class="zr-list-row-title">${esc(t.title || "Шаблон")}</div>
                ${metaParts.length ? `<div class="zr-list-row-tags">${metaParts.join("")}</div>` : ""}
              </a>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function setFilter(q){
    _q = (q ?? "").toString();
    renderList();
  }

  return { show, open, setFilter };
})();

function setupTemplateBodyCollapse(viewer){
  if(!viewer) return;

  const section = viewer.querySelector('[data-tpl-section="body"]');
  if(!section) return;

  const body = section.querySelector(".markdown");
  if(!body) return;

  const oldControls = section.querySelector('[data-tpl-collapse="controls"]');
  if(oldControls) oldControls.remove();

  body.style.maxHeight = "";
  body.style.overflow = "";
  body.style.position = "";

  const limit = 520;
  const fullHeight = body.scrollHeight || 0;
  if(fullHeight <= limit) return;

  let expanded = false;

  body.style.maxHeight = limit + "px";
  body.style.overflow = "hidden";
  body.style.position = "relative";

  const controls = document.createElement("div");
  controls.setAttribute("data-tpl-collapse","controls");
  controls.style.marginTop = "12px";

  const btn = document.createElement("button");
  btn.className = "btn btn-sm";
  btn.textContent = "Показать полностью";

  btn.onclick = () => {
    expanded = !expanded;

    if(expanded){
      body.style.maxHeight = "";
      body.style.overflow = "";
      btn.textContent = "Свернуть";
    }else{
      body.style.maxHeight = limit + "px";
      body.style.overflow = "hidden";
      btn.textContent = "Показать полностью";
      section.scrollIntoView({ block:"start", behavior:"smooth" });
    }
  };

  controls.appendChild(btn);
  section.appendChild(controls);
}














