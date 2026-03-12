window.Views = window.Views || {};
Views.Templates = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  let _data = [];
  let _q = "";

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
          return `<a class="btn" href="${href}" ${target}><span class="dot"></span>${label}</a>`;
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

  function renderViewerShell(template, options){
    const o = options || {};
    const metaHtml = renderMetaRow(template);
    const resourcesHtml = renderResourcesBlock(o.resources || []);
    const sub = o.sub ? `<p class="article-sub">${esc(o.sub)}</p>` : "";

    return `
      <div class="item" data-tpl-section="header" style="cursor:default; margin-bottom:12px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <h1 class="article-title">${esc(template.title || "Шаблон")}</h1>
            ${sub}
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-sm" id="tplBackBtn" type="button">${getTemplateCloseLabel()}</button>
          </div>
        </div>
      </div>

      <div class="item" data-tpl-section="meta" style="cursor:default; margin-bottom:12px; ${metaHtml ? "" : "display:none;"}">
        <div class="item-meta">${metaHtml}</div>
      </div>

      <div class="item" data-tpl-section="body" style="cursor:default; margin-bottom:12px;">
        ${o.body || ""}
      </div>

      <div class="item" data-tpl-section="resources" style="cursor:default;">
        <div class="item-title">Ресурсы</div>
        <div class="item-meta" style="margin-top:10px;">${resourcesHtml}</div>
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

  function renderList(){
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

    filtered.forEach((t) => {
      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/${encodeURIComponent("templates")}/${encodeURIComponent(t.id)}`;
      const metaParts = [];
      if(t.format) metaParts.push(`<span class="tag">${esc(t.format)}</span>`);
      if(Array.isArray(t.tags) && t.tags.length){
        t.tags.forEach(tag => {
          metaParts.push(`<span class="tag" data-tag-filter="${esc(String(tag))}">${esc(String(tag))}</span>`);
        });
      }

      a.innerHTML = `
        <div class="item-title">${esc(t.title || "Шаблон")}</div>
        ${metaParts.length ? `<div class="item-meta">${metaParts.join("")}</div>` : ""}
      `;
      list.appendChild(a);
    });
  }

  async function show(){
    setPanelTitle("Шаблоны");
    const viewer = $("#viewer");
    viewer.innerHTML = `<div class="empty">Выберите шаблон слева.</div>`;

    _data = await loadTemplatesFromSupabase();
    renderList();
  }

  async function open(templateId){
    const viewer = $("#viewer");
    const data = Array.isArray(_data) && _data.length ? _data : await loadTemplatesFromSupabase();
    const t = data.find(x => x.id === templateId);

    if(!t){
      viewer.innerHTML = `<div class="empty">Шаблон не найден.</div>`;
      return;
    }

    if(templateId === "project_links_excel"){
      const key = "tpl:project_links_excel:v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}");

      const body = `
        <div class="markdown">
          <div class="zr-form-grid">

            <div class="zr-field" style="grid-column:1 / -1;">
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

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">План мебели</span>
              <div class="zr-row-2">
                <input id="f_furn_dwg" class="zr-input" placeholder="DWG" />
                <input id="f_furn_pdf" class="zr-input" placeholder="PDF" />
              </div>
            </div>

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">Концепт + ТЗ визуализатору</span>
              <div class="zr-row-2">
                <input id="f_concept" class="zr-input" placeholder="Концепт" />
                <input id="f_tz" class="zr-input" placeholder="ТЗ" />
              </div>
            </div>

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">Ссылка на ведомость материалов</span>
              <input id="f_materials" class="zr-input" />
            </div>

          </div>

          <div class="zr-actions-right">
            <button class="btn" id="btn_save"><span class="dot"></span>Сохранить</button>
            <button class="btn" id="btn_xlsx"><span class="dot"></span>Скачать Excel</button>
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
        <div class="markdown">
          <p class="article-sub" style="margin:0;">Пока без формы. Можно открыть файл по ссылке.</p>
        </div>
      `;

      const resources = getTemplateResources(t);

      viewer.innerHTML = renderViewerShell(t, {
        body,
        resources
      });

      const backBtn = document.getElementById("tplBackBtn");
      if(backBtn) backBtn.onclick = () => goTemplateClose();
      return;
    }

    {
      const key = "tpl:brief_visualizer:v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}");

      const body = `
        <div class="markdown">
          <div class="zr-form-grid">
            <div class="zr-field" style="grid-column:1 / -1;">
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

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">Стиль/настроение</span>
              <input id="f_style" class="zr-input" />
            </div>

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">Палитра</span>
              <input id="f_palette" class="zr-input" />
            </div>

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">Камеры</span>
              <textarea id="f_cameras" rows="4" class="zr-input"></textarea>
            </div>

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">Обязательные позиции</span>
              <textarea id="f_must" rows="4" class="zr-input"></textarea>
            </div>

            <div class="zr-field" style="grid-column:1 / -1;">
              <span class="zr-label">Материалы/примечания</span>
              <textarea id="f_notes" rows="5" class="zr-input"></textarea>
            </div>
          </div>

          <div class="zr-actions-right">
            <button class="btn" id="btn_save"><span class="dot"></span>Сохранить</button>
            <button class="btn" id="btn_copy"><span class="dot"></span>Скопировать</button>
            <button class="btn" id="btn_download"><span class="dot"></span>Скачать .txt</button>
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

  function setFilter(q){
    _q = (q ?? "").toString();
    renderList();
  }

  return { show, open, setFilter };
})();
