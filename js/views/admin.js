window.Views = window.Views || {};
Views.Admin = (() => {
  const $ = (s) => document.querySelector(s);

  const TYPE_LABELS = {
    standard:  "Текстовая инструкция",
    procedure: "Пошаговая инструкция",
    check:     "Проверка",
    reference: "Референс",
    policy:    "Документация"
  };
  const TYPE_IDS = ["standard","procedure","check","reference","policy"];
  const ROLE_IDS = ["admin","staff"];

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
    if(v) v.innerHTML = html || "";
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

  // state
  let MODE = "employees";
  let CONTENT_MODE = "articles";
  let TAG_DICT = TAGS_PRESET.slice().sort((a,b)=>a.localeCompare(b));
  let CAT_DICT = [];

  function parseParam(param){
    const p = (param || "").trim();
    if(!p) return { mode:"employees" };
    const parts = p.split(":");
    if(parts[0] === "employees") return { mode:"employees" };
    if(parts[0] === "tasks") return { mode:"tasks" };
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
        tabBtn("tasks","Задачи") +
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
  async function sbAllowlistList(){
    const p = SB.from("allowlist").select("email,role,enabled").order("email", { ascending:true });
    const { data, error } = await withTimeout(p, 12000, "allowlist select");
    if(error) throw error;
    return data || [];
  }
  async function sbAllowlistUpsert(row){
    await ensureSession();
    const p = SB.from("allowlist").upsert(row, { onConflict:"email" });
    const { error } = await withTimeout(p, 20000, "allowlist upsert");
    if(error) throw error;
  }
  async function sbAllowlistDelete(email){
    await ensureSession();
    const p = SB.from("allowlist").delete().eq("email", email);
    const { error } = await withTimeout(p, 20000, "allowlist delete");
    if(error) throw error;
  }

  function employeesHtml(items){
    const rows = (items || []).map(it => `
      <div class="item" style="display:grid; grid-template-columns: 1fr 120px 90px 170px; gap:10px; align-items:center;">
        <div class="mono" style="overflow:hidden; text-overflow:ellipsis;">${esc(it.email)}</div>

        <select data-al-role="${esc(it.email)}" style="${inpStyle}">
          <option value="staff" ${it.role==="staff"?"selected":""}>staff</option>
          <option value="admin" ${it.role==="admin"?"selected":""}>admin</option>
        </select>

        <label style="display:flex; gap:8px; align-items:center; user-select:none;">
          <input type="checkbox" data-al-enabled="${esc(it.email)}" ${it.enabled ? "checked" : ""} />
          <span>enabled</span>
        </label>

        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-sm" data-al-save="${esc(it.email)}"><span class="dot"></span>Сохранить</button>
          <button class="btn btn-sm" data-al-del="${esc(it.email)}"><span class="dot"></span>Удалить</button>
        </div>
      </div>
    `).join("");

    return `
      <h1 class="article-title">Админка → Сотрудники</h1>
      <p class="article-sub">Управление доступами (allowlist). Только admin.</p>
      <div class="hr"></div>

      <div class="markdown" style="padding:0; margin:0;">
        <div style="display:grid; grid-template-columns: 1fr 140px; gap:10px; align-items:end;">
          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Email</div>
            <input id="al_email" style="${inpStyle}" placeholder="email@example.com" />
          </div>
          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Роль</div>
            <select id="al_role" style="${inpStyle}">
              <option value="staff">staff</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>

        <div style="display:flex; gap:12px; align-items:center; margin-top:10px;">
          <label style="display:flex; gap:8px; align-items:center; user-select:none;">
            <input id="al_enabled" type="checkbox" checked />
            <span>enabled</span>
          </label>
          <button class="btn btn-sm" id="al_add"><span class="dot"></span>Добавить / обновить</button>
          <button class="btn btn-sm" id="al_reload"><span class="dot"></span>Обновить список</button>
        </div>

        <div class="hr"></div>
        <div class="muted" style="margin:0 0 8px 0;">Сотрудников: ${(items||[]).length}</div>

        ${rows || `<div class="empty" style="padding:12px;color:var(--muted)">Список пуст.</div>`}
      </div>
    `;
  }

  function bindEmployees(){
    const root = $("#viewer");
    if(!root) return;

    $("#al_add").onclick = async () => {
      setBusy(true, "Сохраняю…");
      try{
        const email = normLower($("#al_email").value);
        if(!email || !email.includes("@")) { setBusy(false); return alert("Введи корректный email."); }
        const role = normLower($("#al_role").value) || "staff";
        const enabled = !!$("#al_enabled").checked;
        await sbAllowlistUpsert({ email, role, enabled });
        $("#al_email").value = "";
        setBusy(false);
        await loadEmployees();
      }catch(e){
        console.error(e);
        setBusy(false);
        alert(e.message || String(e));
      }
    };

    $("#al_reload").onclick = () => loadEmployees();

    root.querySelectorAll("[data-al-save]").forEach(btn => {
      btn.onclick = async () => {
        const email = btn.getAttribute("data-al-save");
        setBusy(true, "Сохраняю…");
        try{
          const role = root.querySelector(`[data-al-role="${CSS.escape(email)}"]`).value;
          const enabled = !!root.querySelector(`[data-al-enabled="${CSS.escape(email)}"]`).checked;
          await sbAllowlistUpsert({ email, role, enabled });
          setBusy(false);
          await loadEmployees();
        }catch(e){
          console.error(e);
          setBusy(false);
          alert(e.message || String(e));
        }
      };
    });

    root.querySelectorAll("[data-al-del]").forEach(btn => {
      btn.onclick = async () => {
        const email = btn.getAttribute("data-al-del");
        if(!confirm("Удалить из allowlist?")) return;
        setBusy(true, "Удаляю…");
        try{
          await sbAllowlistDelete(email);
          setBusy(false);
          await loadEmployees();
        }catch(e){
          console.error(e);
          setBusy(false);
          alert(e.message || String(e));
        }
      };
    });
  }

  async function loadEmployees(){
    setPanelTitle("Админка");
    setStatus("…");
    MODE = "employees";
    renderAdminTabs();
    showLoading("Загрузка allowlist…");

    try{
      const items = await sbAllowlistList();
      showViewer(employeesHtml(items));
      bindEmployees();
      setStatus(String(items.length));
    }catch(e){
      console.error(e);
      showViewer(`<div class="empty">Ошибка allowlist: ${esc(e.message || String(e))}</div>`);
      setStatus("ошибка");
    }
  }

  // =============================
  // TASKS (placeholder)
  // =============================
  async function loadTasks(){
    setPanelTitle("Админка");
    setStatus("—");
    MODE = "tasks";
    renderAdminTabs();
    showViewer(`
      <h1 class="article-title">Админка → Задачи</h1>
      <p class="article-sub">Скоро: шаблоны задач, статусы, назначение, комментарии.</p>
      <div class="hr"></div>
      <div class="hr"></div>
      <div class="empty">Пока раздел в разработке.</div>
    `);
  }

  // =============================
  // CONTENT → ARTICLES (kb_articles)
  // =============================
  async function sbArticlesListAll(){
    const p = SB.from("kb_articles")
      .select("id,title,category,type,tags,roles,status,updated_at,excerpt,has_inline_new")
      .order("updated_at", { ascending:false });
    const { data, error } = await withTimeout(p, 12000, "kb_articles list");
    if(error) throw error;
    return data || [];
  }

  async function sbArticlesGet(id){
    const p = SB.from("kb_articles")
      .select("id,title,category,type,tags,roles,status,updated_at,excerpt,content_md,actions,has_inline_new")
      .eq("id", id).single();
    const { data, error } = await withTimeout(p, 12000, "kb_articles get");
    if(error) throw error;
    return data;
  }

  async function sbArticlesUpsert(row){
    // Ensure token is present and not near expiry before write
    await ensureSession();

    // First try
    try{
      const p = SB.from("kb_articles").upsert(row, { onConflict:"id" }).select("id");
      const { error } = await withTimeout(p, 45000, "kb_articles upsert");
      if(error) throw error;
      return;
    }catch(e){
      // Retry once on transient/timeout-like failures (do NOT log out)
      const msg = (e && e.message) ? String(e.message) : String(e);
      const status = (e && typeof e.status === "number") ? e.status : null;
      const transient =
        msg.includes("Timeout") ||
        msg.toLowerCase().includes("network") ||
        msg.toLowerCase().includes("fetch") ||
        status === 0 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

      if(!transient) throw e;

      console.warn("[Admin] kb_articles upsert transient, retrying once…", e);
      try{
        await new Promise(res => setTimeout(res, 600));
        await ensureSession(); // refresh again
      }catch(_e){}

      const p2 = SB.from("kb_articles").upsert(row, { onConflict:"id" }).select("id");
      const { error: error2 } = await withTimeout(p2, 45000, "kb_articles upsert retry");
      if(error2) throw error2;
    }
  }

  async function sbArticlesDelete(id){
    await ensureSession();
    const p = SB.from("kb_articles").delete().eq("id", id);
    const { error } = await withTimeout(p, 20000, "kb_articles delete");
    if(error) throw error;
  }

  function buildCatDict(items){
    const set = new Set();
    (items || []).forEach(it => { if(it.category) set.add(String(it.category)); });
    return Array.from(set.values()).sort((a,b) => a.localeCompare(b));
  }

  function typeOptions(selected){
    return TYPE_IDS.map(id => {
      const t = TYPE_LABELS[id] || id;
      return `<option value="${esc(id)}" ${id===selected ? "selected" : ""}>${esc(t)}</option>`;
    }).join("");
  }

  function renderRolesPicker(selected){
    const sel = new Set(selected || []);
    return ROLE_IDS.map(r => `
      <label style="display:flex; gap:8px; align-items:center; user-select:none;">
        <input type="checkbox" data-role="${esc(r)}" ${sel.has(r) ? "checked" : ""} />
        <span>${esc(r)}</span>
      </label>
    `).join("");
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

  function renderCategoryDatalist(){
    if(!CAT_DICT.length) return "";
    return `
      <datalist id="cat_list">
        ${CAT_DICT.map(c => `<option value="${esc(c)}"></option>`).join("")}
      </datalist>
      <div class="muted" style="margin-top:6px;">Начни вводить — появятся подсказки.</div>
    `;
  }

  function parseSelectedRoles(root){
    const out = [];
    root.querySelectorAll("[data-role]").forEach(ch => { if(ch.checked) out.push(ch.getAttribute("data-role")); });
    return out;
  }

  function parseSelectedTags(root){
    const out = [];
    root.querySelectorAll("[data-tag].is-active").forEach(b => out.push(b.getAttribute("data-tag")));
    return out;
  }

  function renderActionsBuilder(actions){
    const arr = Array.isArray(actions) ? actions : [];
    const rows = arr.map((a, i) => `
      <div class="item" style="padding:10px; display:grid; grid-template-columns: 1fr 1.2fr 160px 110px; gap:10px; align-items:end;">
        <div>
          <div class="muted" style="margin:0 0 6px 2px;">Label</div>
          <input data-act-label="${i}" style="${inpStyle}" value="${esc(a.label || "")}" />
        </div>
        <div>
          <div class="muted" style="margin:0 0 6px 2px;">URL</div>
          <input data-act-url="${i}" style="${inpStyle}" value="${esc(a.url || "")}" />
        </div>
        <div>
          <div class="muted" style="margin:0 0 6px 2px;">Ссылка</div>
          <select data-act-external="${i}" style="${inpStyle}">
            <option value="0" ${a.external ? "" : "selected"}>внутренняя</option>
            <option value="1" ${a.external ? "selected" : ""}>внешняя</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn btn-sm" data-act-del="${i}"><span class="dot"></span>Удалить</button>
        </div>
      </div>
    `).join("");

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin:0 0 10px 0;">
        <div class="muted">Кнопки действий (Actions)</div>
        <button class="btn btn-sm" id="act_add"><span class="dot"></span>+ Добавить</button>
      </div>
      <div class="muted" style="margin:-6px 0 10px 2px;">Внутренняя = #/… (внутри PWA). Внешняя = откроется в новой вкладке.</div>
      ${rows || `<div class="empty" style="padding:12px;color:var(--muted)">Нет кнопок.</div>`}
    `;
  }

  function readActionsFromUI(root){
    const labels = Array.from(root.querySelectorAll("[data-act-label]"));
    const out = [];
    labels.forEach(inp => {
      const i = inp.getAttribute("data-act-label");
      const label = norm(inp.value);
      const urlEl = root.querySelector(`[data-act-url="${CSS.escape(i)}"]`);
      const extEl = root.querySelector(`[data-act-external="${CSS.escape(i)}"]`);
      const url = norm(urlEl ? urlEl.value : "");
      const external = (extEl ? extEl.value : "0") === "1";
      if(label && url) out.push({ label, url, external });
    });
    return out;
  }

  function genId(){ return "a_" + Date.now().toString(36); }

  function editorHtml(row, isNew){
    const id = row.id || "";
    const title = row.title || "";
    const category = row.category || "";
    const type = row.type || "standard";
    const status = row.status || "draft";
    const excerpt = row.excerpt || "";
    const md = row.content_md || "";
    const actions = Array.isArray(row.actions) ? row.actions : [];
    const roles = Array.isArray(row.roles) ? row.roles : [];
    const tags = Array.isArray(row.tags) ? row.tags : [];

    return `
      <h1 class="article-title">Контент → Инструкции</h1>
      <p class="article-sub">${isNew ? "Создание новой инструкции" : ("Редактирование: " + esc(id))}</p>
      <div class="hr"></div>

      <div class="markdown" style="padding:0; margin:0;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:end;">

          <div style="grid-column:1 / -1;">
            <div class="muted" style="margin:0 0 6px 2px;">ID (уникальный ключ, латиница, без пробелов)</div>
            <div style="display:grid; grid-template-columns: 1fr 190px; gap:10px; align-items:end;">
              <input id="a_id" style="${inpStyle}" value="${esc(id)}" ${isNew ? "" : "disabled"} placeholder="a_..." />
              <button class="btn btn-sm" id="gen_id" ${isNew ? "" : "disabled"}><span class="dot"></span>Сгенерировать ID</button>
            </div>
            <div class="muted" style="margin-top:6px;">ID используется в URL и в базе как ключ. Лучше не менять после публикации.</div>
          </div>

          <div style="grid-column:1 / -1;">
            <div class="muted" style="margin:0 0 6px 2px;">Заголовок</div>
            <input id="a_title" style="${inpStyle}" value="${esc(title)}" />
          </div>

          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Раздел (category)</div>
            <input id="a_category" list="cat_list" style="${inpStyle}" value="${esc(category)}" placeholder="например: process" />
            ${renderCategoryDatalist()}
          </div>

          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Тип (только для админа)</div>
            <select id="a_type" style="${inpStyle}">${typeOptions(type)}</select>
          </div>

          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Статус</div>
            <select id="a_status" style="${inpStyle}">
              ${["draft","published","archived"].map(s => `<option value="${s}" ${s===status?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>

          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Для кого (roles)</div>
            <div style="display:flex; gap:12px; flex-wrap:wrap; padding:10px 0 0 2px;">
              ${renderRolesPicker(roles)}
            </div>
          </div>

          <div style="grid-column:1 / -1;">
            <div class="muted" style="margin:0 0 6px 2px;">Краткое описание</div>
            <textarea id="a_excerpt" style="${taStyle}; min-height:70px;" rows="3">${esc(excerpt)}</textarea>
          </div>

          <div style="grid-column:1 / -1;">
            <div class="muted" style="margin:0 0 8px 2px;">Теги</div>
            <div id="tagsPalette">${renderTagsPalette(tags)}</div>
            <div class="muted" style="margin-top:8px;">Выбрано: <span id="tagsChosen" class="mono">${esc(tags.join(", "))}</span></div>
          </div>

          <div style="grid-column:1 / -1;">
            <div class="hr"></div>
            <div id="actionsBox">${renderActionsBuilder(actions)}</div>
          </div>

          <div style="grid-column:1 / -1;">
            <div class="hr"></div>
            <div class="muted" style="margin:0 0 6px 2px;">Контент (Markdown)</div>
            <textarea id="a_md" style="${taStyle}; min-height:220px;" rows="14">${esc(md)}</textarea>
          </div>

        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
          <button class="btn" id="a_save"><span class="dot"></span>Сохранить</button>
          ${isNew ? "" : `<button class="btn" id="a_del"><span class="dot"></span>Удалить</button>`}
        </div>
      </div>
    `;
  }

  function renderArticlesList(items){
    const list = $("#list");
    renderAdminTabs();
    renderContentSubTabs();

    list.insertAdjacentHTML("beforeend", `
      <div class="hr"></div>
      <div class="actions" style="margin:0 0 10px 0; flex-wrap:wrap;">
        <button class="btn btn-sm" id="art_new"><span class="dot"></span>Новая инструкция</button>
        <button class="btn btn-sm" id="art_reload"><span class="dot"></span>Обновить</button>
      </div>
      <div class="muted" style="margin:0 0 8px 0;">Инструкций: ${items.length}</div>
    `);

    $("#art_new").onclick = () => goAdmin("content:articles:new");
    $("#art_reload").onclick = () => loadArticles("");

    if(!items.length){
      list.insertAdjacentHTML("beforeend", `<div class="empty" style="padding:12px;color:var(--muted)">Пока нет записей в kb_articles.</div>`);
      return;
    }

    items.forEach(it => {
      const st = it.status ? `<span class="tag accent">${esc(it.status)}</span>` : "";
      const typeTitle = TYPE_LABELS[it.type] || (it.type || "");
      const tp = typeTitle ? `<span class="tag">${esc(typeTitle)}</span>` : "";
      const cat = it.category ? `<span class="tag">${esc(it.category)}</span>` : "";
      const ex = it.excerpt ? `<div class="muted" style="margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(it.excerpt)}</div>` : "";

      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/admin/${encodeURIComponent("content:articles:" + it.id)}`;
      a.innerHTML = `
        <div class="item-title">${esc(it.title || it.id)}</div>
        <div class="item-meta">${st}${tp}${cat}</div>
        ${ex}
      `;
      list.appendChild(a);
    });
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

  function bindActionsUI(actionsArr){
    const root = $("#viewer");
    if(!root) return;

    const rebuild = (arr) => {
      const box = $("#actionsBox");
      if(box) box.innerHTML = renderActionsBuilder(arr);
      bindActionsUI(arr);
    };

    const addBtn = $("#act_add");
    if(addBtn){
      addBtn.onclick = () => {
        const arr = Array.isArray(actionsArr) ? actionsArr.slice() : [];
        arr.push({ label:"", url:"", external:false });
        rebuild(arr);
      };
    }

    root.querySelectorAll("[data-act-del]").forEach(b => {
      b.onclick = () => {
        const i = parseInt(b.getAttribute("data-act-del"), 10);
        const arr = Array.isArray(actionsArr) ? actionsArr.slice() : [];
        if(!isNaN(i)) arr.splice(i, 1);
        rebuild(arr);
      };
    });
  }

  function bindEditor(isNew, initialActions){
    const root = $("#viewer");
    if(!root) return;

    bindTagsPalette();
    bindActionsUI(initialActions || []);

    const gen = $("#gen_id");
    if(gen){
      gen.onclick = () => {
        const idEl = $("#a_id");
        if(idEl && !idEl.value.trim()) idEl.value = genId();
      };
    }

    const saveBtn = $("#a_save");
    if(saveBtn){
      saveBtn.onclick = async () => {
        setBusy(true, "Сохраняю…");
        try{
          const id = normLower($("#a_id").value);
          if(!id){ setBusy(false); return alert("ID обязателен. Нажми 'Сгенерировать ID' или введи вручную."); }

          const row = {
            id,
            title: norm($("#a_title").value),
            category: normLower($("#a_category").value),
            type: normLower($("#a_type").value),
            status: normLower($("#a_status").value) || "draft",
            excerpt: norm($("#a_excerpt").value),
            roles: parseSelectedRoles(root),
            tags: parseSelectedTags(root),
            actions: readActionsFromUI(root),
            content_md: ($("#a_md").value || ""),
            has_inline_new: (/>[^<\r\n]+</.test(($("#a_md").value || "").toString()) || /&gt;[^&\r\n]+&lt;/.test(($("#a_md").value || "").toString()))
          };

          await sbArticlesUpsert(row);
          setBusy(false);
          alert("Сохранено ✅");
          goAdmin("content:articles:" + id);
          await loadArticles(id);
        }catch(e){
          console.error(e);
          setBusy(false);
          alert(e.message || String(e));
        }
      };
    }

    const delBtn = $("#a_del");
    if(delBtn){
      delBtn.onclick = async () => {
        const id = normLower($("#a_id").value);
        if(!id) return;
        if(!confirm("Удалить инструкцию?")) return;
        setBusy(true, "Удаляю…");
        try{
          await sbArticlesDelete(id);
          setBusy(false);
          alert("Удалено ✅");
          goAdmin("content:articles");
          await loadArticles("");
        }catch(e){
          console.error(e);
          setBusy(false);
          alert(e.message || String(e));
        }
      };
    }
  }

  async function loadArticles(openId){
    setPanelTitle("Админка");
    setStatus("…");
    MODE = "content";
    CONTENT_MODE = "articles";

    // While editor is open, block auth-driven rerenders to avoid "вылеты"
    try{ if(window.App) App._navLock = !!(openId && String(openId).length); }catch(e){}

    showLoading("Загрузка инструкций…");

    try{
      const items = await sbArticlesListAll();
      CAT_DICT = buildCatDict(items);

      renderArticlesList(items);
      setStatus(String(items.length));

      if(!openId){
        showViewer(`<div class="empty">Выбери инструкцию слева или создай новую.</div>`);
        return;
      }

      if(openId === "new"){
        const row = {
          id: "",
          title: "",
          category: "",
          type: "standard",
          status: "draft",
          excerpt: "",
          roles: ["staff"],
          tags: [],
          actions: [],
          content_md: ""
        };
        showViewer(editorHtml(row, true));
        bindEditor(true, row.actions);
        return;
      }

      const row = await sbArticlesGet(openId);
      showViewer(editorHtml(row, false));
      bindEditor(false, row.actions);

    }catch(e){
      console.error(e);
      showViewer(`<div class="empty">Ошибка загрузки инструкций: ${esc(e.message || String(e))}</div>`);
      setStatus("ошибка");
    }
  }

  async function loadContent(mode, openId){
    MODE = "content";
    CONTENT_MODE = mode || "articles";
    setPanelTitle("Админка");
    renderAdminTabs();
    renderContentSubTabs();

    if(CONTENT_MODE === "articles"){
      await loadArticles(openId || "");
      return;
    }

    setStatus("—");
    showViewer(`
      <h1 class="article-title">Контент → ${esc(CONTENT_MODE==="templates" ? "Шаблоны" : "Чек-листы")}</h1>
      <p class="article-sub">Скоро: редактор по варианту B.</p>
      <div class="hr"></div>
      <div class="empty">Пока раздел в разработке.</div>
    `);
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
        if(p.mode === "employees"){ await loadEmployees(); return; }
        if(p.mode === "tasks"){ await loadTasks(); return; }
        if(p.mode === "content"){ await loadContent(p.contentMode, p.id); return; }
        await loadEmployees();
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

