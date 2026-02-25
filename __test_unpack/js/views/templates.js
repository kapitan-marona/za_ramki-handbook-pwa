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
      return title.includes(q) || id.includes(q) || fmt.includes(q);
    });

    setStatus(`${filtered.length}`);

    filtered.forEach((t) => {
      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/${encodeURIComponent("templates")}/${encodeURIComponent(t.id)}`;
      a.innerHTML = `
        <div class="item-title">${esc(t.title || "Шаблон")}</div>
        <div class="item-meta">
          ${t.format ? `<span class="tag">${esc(t.format)}</span>` : ""}
          ${t.link ? `<span class="tag">link</span>` : ""}
          <span class="tag accent">заполнить</span>
        </div>`;
      list.appendChild(a);
    });
  }

  async function show(){
    setPanelTitle("Шаблоны");
    const viewer = $("#viewer");
    viewer.innerHTML = `<div class="empty">Выберите шаблон слева.</div>`;

    _data = await API.json("./content/data/templates.json");
    renderList();
  }

  async function open(templateId){
    const viewer = $("#viewer");
    const data = Array.isArray(_data) && _data.length ? _data : await API.json("./content/data/templates.json");
    const t = data.find(x => x.id === templateId);

    if(!t){
      viewer.innerHTML = `<div class="empty">Шаблон не найден.</div>`;
      return;
    }

    // ===== Template: Project links + Excel =====
    if(templateId === "project_links_excel"){
      const key = "tpl:project_links_excel:v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}");

      viewer.innerHTML = `
        <h1 class="article-title">${esc(t.title)}</h1>
        <p class="article-sub">Вставь ссылки → скачай Excel.</p>
        <div class="hr"></div>

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

      Object.entries(fields).forEach(([k, el]) => el.value = saved[k] || "");

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

    // ===== Default "link-only" templates =====
    if(templateId !== "brief_visualizer"){
      viewer.innerHTML = `
        <h1 class="article-title">${esc(t.title)}</h1>
        <p class="article-sub">Пока без формы. Можно открыть файл по ссылке.</p>
        <div class="actions">
          ${t.link ? `<a class="btn" href="${esc(t.link)}" target="_blank" rel="noopener"><span class="dot"></span>Открыть</a>` : ""}
        </div>`;
      return;
    }

    // ===== Template: Visualizer brief (text) =====
    {
      const key = "tpl:brief_visualizer:v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}");

      viewer.innerHTML = `
        <h1 class="article-title">${esc(t.title)}</h1>
        <p class="article-sub">Заполни быстро → скачай .txt или скопируй.</p>
        <div class="hr"></div>

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

      Object.entries(fields).forEach(([k, el]) => el.value = saved[k] || "");

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
