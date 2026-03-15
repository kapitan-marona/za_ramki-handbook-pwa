window.Views = window.Views || {};
window.__adminSaveLock = false;
window.__adminClickGuard = function(key, delay){
  try{
    const now = Date.now();
    window.__adminClickGuardMap = window.__adminClickGuardMap || {};
    const last = window.__adminClickGuardMap[key] || 0;

    if(now - last < (delay || 350)) return false;

    window.__adminClickGuardMap[key] = now;
    return true;
  }catch(e){
    return true;
  }
};

Views.Admin = (() => {
  const $ = (s) => document.querySelector(s);

  const TYPE_LABELS = {
    standard:  "Текстовая инструкция",
    procedure: "Пошаговая инструкция",
    check:     "Проверка",
    reference: "Референс",
    policy:    "Документация"
  };

  const TAGS_PRESET = [
    "Документация","Дизайн","Визуализация","3D","Заказчик","Обмер","Замер",
    "Чертежи","Объект","Передача проекта","Правки","Этапы","Хранение","Правила"
  ];

  const inpStyle = [
    "width:100%",
    "padding:10px 12px",
    "border-radius:12px",
    "border:1px solid rgba(255,255,255,.12)",
    "background:rgba(0,0,0,.18)",
    "color:var(--text)",
    "outline:none"
  ].join(";");

  const taStyle = [inpStyle,"resize:vertical","line-height:1.35"].join(";");

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function norm(s){ return (s ?? "").toString().trim(); }
  function normLower(s){ return (s ?? "").toString().trim().toLowerCase(); }

  function setStatus(t){ const el = $("#status"); if(el) el.textContent = t; }
  function setPanelTitle(t){ const el = $("#panelTitle"); if(el) el.textContent = t; }

  function showViewer(html){
    const v = $("#viewer");
    if(!v) return;

    v.innerHTML = `
      <div class="adm-viewer-root">
        ${html || ""}
      </div>
    `;
  }

  function showLoading(msg="Загрузка…"){
    showViewer(`<div class="empty">${esc(msg)}</div>`);
  }

  // ---------- Busy overlay (spinner + block clicks)
  function ensureSpinnerStyle(){
    if(document.querySelector("#admSpinnerStyle")) return;
    const st = document.createElement("style");
    st.id = "admSpinnerStyle";
    st.textContent = `
      .adm-busy-wrap{ position:relative; }
      .adm-busy-mask{
        position:absolute; inset:0;
        background: rgba(0,0,0,.25);
        border-radius: 16px;
        display:flex; align-items:center; justify-content:center;
        backdrop-filter: blur(2px);
        z-index: 5;
      }
      .adm-spinner{
        width:22px; height:22px; border-radius:999px;
        border:2px solid rgba(255,255,255,.25);
        border-top-color: rgba(255,255,255,.85);
        animation: admspin .9s linear infinite;
        margin-right:10px;
      }
      @keyframes admspin{ to{ transform: rotate(360deg); } }
      .adm-busy-pill{
        display:flex; align-items:center;
        padding:10px 14px;
        border:1px solid rgba(255,255,255,.14);
        border-radius:999px;
        background: rgba(0,0,0,.35);
        color: var(--text);
        font-size: 14px;
      }
      .adm-disabled{ pointer-events:none; opacity:.6; }
    `;
    document.head.appendChild(st);
  }

  function setBusy(isBusy, label){
    const v = $("#viewer");
    if(!v) return;
    ensureSpinnerStyle();

    if(!v.classList.contains("adm-busy-wrap")) v.classList.add("adm-busy-wrap");

    v.querySelectorAll("button, input, select, textarea, a").forEach(el => {
      if(isBusy) el.classList.add("adm-disabled");
      else el.classList.remove("adm-disabled");
    });

    let mask = document.querySelector("#admBusyMask");
    if(isBusy){
      if(!mask){
        mask = document.createElement("div");
        mask.id = "admBusyMask";
        mask.className = "adm-busy-mask";
        v.appendChild(mask);
      }
      mask.innerHTML = `<div class="adm-busy-pill"><span class="adm-spinner"></span>${esc(label || "Загрузка…")}</div>`;
    }else{
      if(mask) mask.remove();
    }
  }

  // ---------- Promise timeout
  function withTimeout(promise, ms, label){
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`Timeout (${ms}ms): ${label || "request"}`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  // ---------- Auth guard for admin actions
  async function ensureSession(){
    // Prefer shared helper from app.js (refreshes if expiring soon)
    try{
      if(window.AppAuth && typeof window.AppAuth.ensureFreshSession === "function"){
        const s = await window.AppAuth.ensureFreshSession(120);
        if(s) return s;
      }
    }catch(e){}

    // Fallback (old logic)
    try{
      const sessRes = await withTimeout(SB.auth.getSession(), 8000, "auth getSession");
      const session = sessRes && sessRes.data ? sessRes.data.session : null;
      if(session) return session;
    }catch(e){}

    try{
      const refRes = await withTimeout(SB.auth.refreshSession(), 12000, "auth refreshSession");
      const session2 = refRes && refRes.data ? refRes.data.session : null;
      if(session2) return session2;
    }catch(e){}

    // kick to login
    if(window.Router && Router.go) Router.go("login");
    else location.hash = "#/login";
    throw new Error("Сессия истекла. Войди снова и повтори действие.");
  }

  // ===== PHASE 2 — SHARED HELPER SURFACE (bridge prep only)
    const AdminShared = {
    $,
    SB: window.SB,
    esc,
    norm,
    normLower,
    setBusy,
    setStatus,
    setPanelTitle,
    showViewer,
    showLoading,
    withTimeout,
    ensureSession,
    renderAdminTabs,
    renderContentSubTabs,
    goAdmin,
    renderTagsPalette,
    parseSelectedTags,
    bindTagsPalette,
    renderActionsBuilder,
    bindActionsUI,
    readActionsFromUI,
    inpStyle,
    taStyle,
    TYPE_LABELS,
    setMode: (nextMode) => { MODE = nextMode; }
  };

  // state
  let MODE = "employees";
  let CONTENT_MODE = "articles";
  let TAG_DICT = TAGS_PRESET.slice().sort((a,b)=>a.localeCompare(b));

  function parseParam(param){
    const p = (param || "").trim();
    if(!p) return { mode:"employees" };
    const parts = p.split(":");
    if(parts[0] === "employees") return { mode:"employees" };
    if(parts[0] === "tasks") return { mode:"tasks" };
    if(parts[0] === "projects") return { mode:"projects" };
    if(parts[0] === "content"){
      return { mode:"content", contentMode: parts[1] || "articles", id: parts[2] || "" };
    }
    return { mode:"employees" };
  }

  function goAdmin(param){
    if(window.Router && Router.go) Router.go("admin", param || "");
    else location.hash = "#/admin" + (param ? ("/" + encodeURIComponent(param)) : "");
  }

  function renderAdminTabs(){
    const list = $("#list");
    if(!list) return;

    const tabBtn = (id, label) =>
      `<button class="btn btn-sm ${MODE===id ? "is-active" : ""}" data-adm-tab="${esc(id)}"><span class="dot"></span>${esc(label)}</button>`;

    list.innerHTML =
      `<div class="actions" style="margin:0 0 10px 0; flex-wrap:wrap;">` +
        tabBtn("employees","Сотрудники") +
        tabBtn("projects","Проекты") +
        tabBtn("content","Контент") +
      `</div>`;

    list.querySelectorAll("[data-adm-tab]").forEach(b => {
      b.onclick = () => {
        MODE = b.getAttribute("data-adm-tab");
        if(MODE === "content") goAdmin("content:" + CONTENT_MODE);
        else goAdmin(MODE);
      };
    });
  }

  function renderContentSubTabs(){
    const list = $("#list");
    if(!list) return;

    list.insertAdjacentHTML("beforeend", `
      <div class="actions" style="margin:0 0 10px 0; flex-wrap:wrap;">
        <button class="btn btn-sm ${CONTENT_MODE==="articles"?"is-active":""}" data-cm="articles"><span class="dot"></span>Инструкции</button>
        <button class="btn btn-sm ${CONTENT_MODE==="templates"?"is-active":""}" data-cm="templates"><span class="dot"></span>Шаблоны</button>
        <button class="btn btn-sm ${CONTENT_MODE==="checklists"?"is-active":""}" data-cm="checklists"><span class="dot"></span>Чек-листы</button>
      </div>
    `);

    list.querySelectorAll("[data-cm]").forEach(b => {
      b.onclick = () => {
        CONTENT_MODE = b.getAttribute("data-cm");
        goAdmin("content:" + CONTENT_MODE);
      };
    });
  }

  // =============================
  // EMPLOYEES (allowlist)
  // =============================
    const Employees = (window.Views && typeof window.Views.AdminEmployeesFactory === "function")
      ? window.Views.AdminEmployeesFactory(AdminShared)
      : {
          load: async () => {
            throw new Error("Admin employees module not loaded.");
          }
        };

        const Projects = (window.Views && typeof window.Views.AdminProjectsFactory === "function")
          ? window.Views.AdminProjectsFactory(AdminShared)
          : {
              load: async () => {
                throw new Error("Admin projects module not loaded.");
              }
            };

        const Templates = (window.Views && typeof window.Views.AdminTemplatesFactory === "function")
          ? window.Views.AdminTemplatesFactory(AdminShared)
          : {
              load: async () => {
                throw new Error("Admin templates module not loaded.");
              }
            };

        const Checklists = (window.Views && typeof window.Views.AdminChecklistsFactory === "function")
          ? window.Views.AdminChecklistsFactory(AdminShared)
          : {
              load: async () => {
                throw new Error("Admin checklists module not loaded.");
              }
            };

        const Articles = (window.Views && typeof window.Views.AdminArticlesFactory === "function")
          ? window.Views.AdminArticlesFactory(AdminShared)
          : {
              load: async () => {
                throw new Error("Admin articles module not loaded.");
              }
            };

        // =============================
        // TASKS (placeholder)
        // =============================
  async function loadTasks(){
    setPanelTitle("Админка");
    setStatus("—");
    MODE = "tasks";
    renderAdminTabs();
    showViewer(`
      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <h1 class="article-title">Админка → Задачи</h1>
            <p class="article-sub">Скоро: шаблоны задач, статусы, назначение, комментарии.</p>
          </div>
        </div>
      </div>

      <div class="item" style="cursor:default;">
        <div class="item-title">Раздел в разработке</div>
        <div class="item-meta" style="margin-top:10px;">
          <span class="tag">tasks</span>
          <span class="tag">placeholder</span>
        </div>
        <div style="margin-top:12px;">
          <div class="empty">Пока раздел в разработке.</div>
        </div>
      </div>
    `);
  }

  function renderTagsPalette(selected){
    const sel = new Set(selected || []);
    return `
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${TAG_DICT.map(t => `
          <button type="button"
            class="btn btn-sm ${sel.has(t) ? "is-active" : ""}"
            data-tag="${esc(t)}"
            style="padding:6px 10px; border-radius:999px;">
            ${esc(t)}
          </button>
        `).join("")}
      </div>
      <div class="muted" style="margin-top:8px;">Теги выбираются из справочника.</div>
    `;
  }

  function parseSelectedTags(root){
    const out = [];
    root.querySelectorAll("[data-tag].is-active").forEach(b => out.push(b.getAttribute("data-tag")));
    return out;
  }

  function renderActionsBuilder(actions){
    const arr = Array.isArray(actions) ? actions : [];
    const rows = arr.map((a, i) => {
      const rawUrl = String(a.url || "").trim();
      const articleMatch = rawUrl.match(/^#\/articles\/(.+)$/);
      const checklistMatch = rawUrl.match(/^#\/checklists\/(.+)$/);
      const templateMatch = rawUrl.match(/^#\/templates\/(.+)$/);

      let linkMode = String(a.kind || "").trim().toLowerCase() || (a.external ? "external" : "article");
      let extValue = "";
      let idValue = String(a.value || "").trim();

      if(a.external){
        linkMode = "external";
        extValue = rawUrl || idValue;
        idValue = "";
      }else if(articleMatch){
        linkMode = "article";
        idValue = articleMatch[1] || "";
      }else if(checklistMatch){
        linkMode = "checklist";
        idValue = checklistMatch[1] || "";
      }else if(templateMatch){
        linkMode = "template";
        idValue = templateMatch[1] || "";
      }else if(rawUrl){
        if(String(rawUrl).startsWith("#/checklists/")){
          linkMode = "checklist";
          idValue = rawUrl.replace(/^#\/checklists\//, "");
        }else if(String(rawUrl).startsWith("#/templates/")){
          linkMode = "template";
          idValue = rawUrl.replace(/^#\/templates\//, "");
        }else if(String(rawUrl).startsWith("#/articles/")){
          linkMode = "article";
          idValue = rawUrl.replace(/^#\/articles\//, "");
        }else{
          linkMode = a.external ? "external" : (linkMode || "article");
          extValue = a.external ? rawUrl : "";
          if(!a.external) idValue = rawUrl;
        }
      }

      return `
        <div class="item" style="padding:10px; display:grid; grid-template-columns: 1fr 1.4fr 110px; gap:10px; align-items:end;">
          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Label</div>
            <input data-act-label="${i}" style="${inpStyle}" value="${esc(a.label || "")}" />
          </div>

          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Ссылка</div>
            <div style="display:grid; grid-template-columns: 170px 1fr; gap:8px; align-items:end;">
              <select data-act-kind="${i}" style="${inpStyle}">
                <option value="article" ${linkMode==="article" ? "selected" : ""}>инструкция</option>
                <option value="checklist" ${linkMode==="checklist" ? "selected" : ""}>чек-лист</option>
                <option value="template" ${linkMode==="template" ? "selected" : ""}>шаблон</option>
                <option value="external" ${linkMode==="external" ? "selected" : ""}>внешняя</option>
              </select>

              <input
                data-act-value="${i}"
                style="${inpStyle}"
                value="${esc(linkMode==="external" ? extValue : idValue)}"
                placeholder="${esc(linkMode==="external" ? "https://..." : "ID записи")}"
              />
            </div>

          </div>

          <div style="display:flex; justify-content:flex-end;">
            <button class="btn btn-sm" data-act-del="${i}"><span class="dot"></span>Удалить</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin:0 0 10px 0;">
        <div class="muted">Кнопки действий (Actions)</div>
        <button class="btn btn-sm" id="act_add"><span class="dot"></span>+ Добавить</button>
      </div>
      <div class="muted" style="margin:-6px 0 10px 2px;">Можно добавить внешнюю ссылку или внутреннюю ссылку по ID.</div>
      ${rows || `<div class="empty" style="padding:12px;color:var(--muted)">Нет кнопок.</div>`}
    `;
  }

  function readActionsFromUI(root){
    const labels = Array.from(root.querySelectorAll("[data-act-label]"));
    const out = [];
    labels.forEach(inp => {
      const i = inp.getAttribute("data-act-label");
      const label = norm(inp.value);
      const kindEl = root.querySelector(`[data-act-kind="${CSS.escape(i)}"]`);
      const valueEl = root.querySelector(`[data-act-value="${CSS.escape(i)}"]`);

      const kind = normLower(kindEl ? kindEl.value : "article");
      const rawValue = norm(valueEl ? valueEl.value : "");
      if(!label || !rawValue) return;

      let url = "";
      let external = false;

      if(kind === "external"){
        url = rawValue;
        external = true;
      }else if(kind === "checklist"){
        url = "#/checklists/" + rawValue;
        external = false;
      }else if(kind === "template"){
        url = "#/templates/" + rawValue;
        external = false;
      }else{
        url = "#/articles/" + rawValue;
        external = false;
      }

      out.push({ label, url, external, kind, value: rawValue });
    });
    return out;
  }

  function bindTagsPalette(){
    const root = $("#viewer");
    if(!root) return;
    root.querySelectorAll("[data-tag]").forEach(btn => {
      btn.onclick = () => {
        btn.classList.toggle("is-active");
        const tags = parseSelectedTags(root);
        const el = $("#tagsChosen");
        if(el) el.textContent = tags.join(", ");
      };
    });
  }

  function bindActionsUI(actionsArr, boxId){
    const root = $("#viewer");
    if(!root) return;

    const targetBoxId = boxId || "actionsBox";

    const snapshotActionsFromUi = () => {
      const rows = Array.from(root.querySelectorAll("[data-act-label]"));
      return rows.map(inp => {
        const i = inp.getAttribute("data-act-label");
        const label = root.querySelector(`[data-act-label="${CSS.escape(i)}"]`)?.value || "";
        const kind = root.querySelector(`[data-act-kind="${CSS.escape(i)}"]`)?.value || "article";
        const value = root.querySelector(`[data-act-value="${CSS.escape(i)}"]`)?.value || "";

        let url = "";
        let external = false;

        if(kind === "external"){
          url = value;
          external = true;
        }else if(kind === "checklist"){
          url = value ? ("#/checklists/" + value) : "";
          external = false;
        }else if(kind === "template"){
          url = value ? ("#/templates/" + value) : "";
          external = false;
        }else{
          url = value ? ("#/articles/" + value) : "";
          external = false;
        }

        return { label, url, external, kind, value };
      });
    };

    const rebuild = (arr) => {
      const box = document.getElementById(targetBoxId);
      if(box) box.innerHTML = renderActionsBuilder(arr);
      bindActionsUI(arr, targetBoxId);
    };

    const addBtn = $("#act_add");
    if(addBtn){
      addBtn.onclick = () => {
        const arr = snapshotActionsFromUi();
        arr.push({ label:"", url:"", external:false });
        rebuild(arr);
      };
    }

    root.querySelectorAll("[data-act-del]").forEach(b => {
      b.onclick = () => {
        const i = parseInt(b.getAttribute("data-act-del"), 10);
        const arr = snapshotActionsFromUi();
        if(!isNaN(i)) arr.splice(i, 1);
        rebuild(arr);
      };
    });

    root.querySelectorAll("[data-act-kind]").forEach(sel => {
      sel.addEventListener("change", () => {
        const i = sel.getAttribute("data-act-kind");
        const valueEl = root.querySelector(`[data-act-value="${CSS.escape(i)}"]`);
        if(!valueEl) return;
        valueEl.placeholder = sel.value === "external" ? "https://..." : "ID записи";
      });
    });
  }

  async function loadContent(mode, openId){
    MODE = "content";
    CONTENT_MODE = mode || "articles";
    setPanelTitle("Админка");
    renderAdminTabs();
    renderContentSubTabs();

    if(CONTENT_MODE === "articles"){
      await Articles.load(openId || "");
      return;
    }

    if(CONTENT_MODE === "templates"){
      await Templates.load(openId || "");
      return;
    }

    if(CONTENT_MODE === "checklists"){
      await Checklists.load(openId || "");
      return;
    }
  }

  return {
    async show(param){
      if(!window.SB){
        setPanelTitle("Админка");
        setStatus("—");
        renderAdminTabs();
        showViewer(`<div class="empty">Supabase не готов.</div>`);
        return;
      }

      // default: allow rerenders (editor will enable lock itself)
      try{ if(window.App) App._navLock = false; }catch(e){}

      try{
        const p = parseParam(param);
        if(p.mode === "employees"){ await Employees.load(); return; }
        if(p.mode === "tasks"){ await loadTasks(); return; }
        if(p.mode === "projects"){ await Projects.load(); return; }
        if(p.mode === "content"){ await loadContent(p.contentMode, p.id); return; }
        await Employees.load();
      }catch(e){
        console.error(e);
        setPanelTitle("Админка");
        renderAdminTabs();
        showViewer(`<div class="empty">Ошибка: ${esc(e.message || String(e))}</div>`);
        setStatus("ошибка");
      }
    }
  };
})();











