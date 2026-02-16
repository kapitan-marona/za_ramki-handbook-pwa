window.Views = window.Views || {};
Views.Templates = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  function setStatus(t){ $("#status").textContent = t; }
  function setPanelTitle(t){ $("#panelTitle").textContent = t; }

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

  async function show(){
    setPanelTitle("Шаблоны");
    const list = $("#list");
    const viewer = $("#viewer");
    list.innerHTML = "";
    viewer.innerHTML = `<div class="empty">Выберите шаблон слева.</div>`;

    const data = await API.json("./content/data/templates.json");
    setStatus(`${data.length}`);

    data.forEach((t) => {
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

    return data;
  }

  async function open(templateId){
    const viewer = $("#viewer");
    const data = await API.json("./content/data/templates.json");
    const t = data.find(x => x.id === templateId);

    if(!t){
      viewer.innerHTML = `<div class="empty">Шаблон не найден.</div>`;
      return;
    }
    
    // Custom interactive templates
    if(templateId === "brief_visualizer_pro"){
      if(!window.Views || !Views.BriefPro){
        viewer.innerHTML = `<div class="empty">BriefPro не подключён (js/views/brief_pro.js).</div>`;
        return;
      }
      await Views.BriefPro.open();
      return;
    }


    // For demo we implement one interactive template: brief_visualizer
    if(templateId !== "brief_visualizer"){
      viewer.innerHTML = `
        <h1 class="article-title">${esc(t.title)}</h1>
        <p class="article-sub">Пока без формы. Можно открыть файл по ссылке.</p>
        <div class="actions">
          ${t.link ? `<a class="btn" href="${esc(t.link)}" target="_blank" rel="noopener"><span class="dot"></span>Открыть</a>` : ""}
        </div>`;
      return;
    }


    const key = "tpl:brief_visualizer:v1";
    const saved = JSON.parse(localStorage.getItem(key) || "{}");

    viewer.innerHTML = `
      <h1 class="article-title">${esc(t.title)}</h1>
      <p class="article-sub">Заполни быстро → скачай .txt или скопируй и отправь визуализатору.</p>

      <div class="hr"></div>

      <div class="markdown">
        <p><b>Проект</b><br/><input id="f_project" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)" /></p>
        <p><b>Зона/помещение</b><br/><input id="f_zone" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)" /></p>
        <p><b>Стиль/настроение</b><br/><input id="f_style" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)" /></p>
        <p><b>Палитра</b><br/><input id="f_palette" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)" /></p>
        <p><b>Камеры</b><br/><textarea id="f_cameras" rows="4" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)"></textarea></p>
        <p><b>Обязательные позиции</b><br/><textarea id="f_must" rows="4" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)"></textarea></p>
        <p><b>Материалы/примечания</b><br/><textarea id="f_notes" rows="5" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)"></textarea></p>
        <p><b>Дедлайн</b><br/><input id="f_deadline" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:rgba(15,23,42,.6);color:var(--text)" /></p>

        <div class="actions">
          <button class="btn" id="btn_save"><span class="dot"></span>Сохранить локально</button>
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

    // load saved
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

  return { show, open };
})();
