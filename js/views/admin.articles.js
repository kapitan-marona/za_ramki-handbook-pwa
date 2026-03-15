window.Views = window.Views || {};

window.Views.AdminArticlesFactory = function(deps){
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
  const goAdmin = deps.goAdmin;
  const renderTagsPalette = deps.renderTagsPalette;
  const parseSelectedTags = deps.parseSelectedTags;
  const bindTagsPalette = deps.bindTagsPalette;
  const renderActionsBuilder = deps.renderActionsBuilder;
  const bindActionsUI = deps.bindActionsUI;
  const readActionsFromUI = deps.readActionsFromUI;
  const inpStyle = deps.inpStyle;
  const taStyle = deps.taStyle;
  const setMode = deps.setMode;
  const TYPE_LABELS = deps.TYPE_LABELS || {};

  if(!SB) throw new Error("Admin articles module: SB missing.");
  if(!esc || !norm || !normLower) throw new Error("Admin articles module: shared text helpers missing.");
  if(!setBusy || !setStatus || !setPanelTitle || !showViewer || !showLoading) throw new Error("Admin articles module: shared UI helpers missing.");
  if(!withTimeout || !ensureSession || !renderAdminTabs || !renderContentSubTabs || !goAdmin || !inpStyle || !taStyle || !setMode){
    throw new Error("Admin articles module: shared runtime helpers missing.");
  }
  if(!renderTagsPalette || !parseSelectedTags || !bindTagsPalette || !renderActionsBuilder || !bindActionsUI || !readActionsFromUI){
    throw new Error("Admin articles module: shared content helpers missing.");
  }

  const ARTICLE_TYPE_PRESETS = {
    standard: `## Цель
Кратко опиши, зачем нужна эта инструкция.

## Когда применять
Опиши ситуации, в которых используется.

## Описание
Основная часть инструкции.

## Важно
> Важно: укажи ключевые моменты.`,

    procedure: `## Шаги

### 1. Подготовка
Что нужно сделать перед началом.

### 2. Основные действия
Опиши пошагово процесс.

### 3. Проверка результата
Как понять, что всё сделано правильно.`,

    check: `## Чек-лист

- [ ] Пункт проверки 1
- [ ] Пункт проверки 2
- [ ] Пункт проверки 3

## Примечания
Дополнительные пояснения.`,

    reference: `## Описание
Кратко опиши, что это.

## Параметры / значения
•  

## Примеры
Приведи примеры использования.`,

    policy: `## Общие положения
Опиши правило или регламент.

## Обязательные требования
•  

## Ответственность
Кто отвечает за соблюдение.`
  };

  const TYPE_IDS = ["standard","procedure","check","reference","policy"];
  const ROLE_IDS = ["admin","staff"];

  let CAT_DICT = [];

  function maybeInsertPreset(isNew){
    try{
      if(!isNew) return "";

      const typeEl = document.getElementById("a_type");
      const mdEl = document.getElementById("a_md");
      if(!typeEl || !mdEl) return "";

      const type = String(typeEl.value || "").trim();
      if(!type) return "";

      const preset = ARTICLE_TYPE_PRESETS[type];
      if(!preset) return "";

      mdEl.value = preset;
      return preset;
    }catch(e){}
    return "";
  }

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
    await ensureSession();

    try{
      const p = SB.from("kb_articles").upsert(row, { onConflict:"id" }).select("id");
      const { error } = await withTimeout(p, 45000, "kb_articles upsert");
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

      console.warn("[Admin] kb_articles upsert transient, retrying once…", e);
      try{
        await new Promise(res => setTimeout(res, 600));
        await ensureSession();
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
      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <h1 class="article-title">Контент → Инструкции</h1>
            <p class="article-sub">${isNew ? "Создание новой инструкции (служебный режим)" : ("Редактирование: " + esc(id))}</p>
          </div>
        </div>
      </div>

      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div class="item-title">Основные поля</div>
        <div class="markdown" style="padding:0; margin-top:12px;">
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

          </div>
        </div>
      </div>

      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div class="item-title">Теги</div>
        <div class="item-meta" style="margin-top:10px;">
          <span class="tag">dictionary</span>
          <span class="tag">multi-select</span>
        </div>
        <div class="markdown" style="padding:0; margin-top:12px;">
          <div id="tagsPalette">${renderTagsPalette(tags)}</div>
          <div class="muted" style="margin-top:8px;">Выбрано: <span id="tagsChosen" class="mono">${esc(tags.join(", "))}</span></div>
        </div>
      </div>

      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div class="item-title">Кнопки действий</div>
        <div class="markdown" style="padding:0; margin-top:12px;">
          <div id="actionsBox">${renderActionsBuilder(actions)}</div>
        </div>
      </div>

      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div class="item-title">Контент (Markdown)</div>
        <div class="markdown" style="padding:0; margin-top:12px;">
          <textarea id="a_md" style="${taStyle}; min-height:220px;" rows="14">${esc(md)}</textarea>
        </div>
      </div>

      <div class="item" style="cursor:default;">
        <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
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
        <button class="btn btn-sm" id="art_reload"><span class="dot"></span>Обновить</button>
      </div>
      <div class="muted" style="margin:0 0 8px 0;">Инструкций: ${items.length}. Создание новых записей вне админки; здесь — редактирование существующих.</div>
    `);

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

  function bindEditor(isNew, initialActions){
    const root = $("#viewer");
    if(!root) return;

    let presetTouchedByUser = false;
    let lastAutoPresetType = "";
    let lastAutoPresetValue = "";

    bindTagsPalette();
    bindActionsUI(initialActions || []);

    const gen = $("#gen_id");
    if(gen){
      gen.onclick = () => {
        const idEl = $("#a_id");
        if(idEl && !idEl.value.trim()) idEl.value = genId();
      };
    }

    const mdEl = $("#a_md");
    const typeEl = $("#a_type");

    if(mdEl){
      mdEl.addEventListener("input", () => {
        if(!isNew) return;
        const currentType = typeEl ? String(typeEl.value || "").trim() : "";
        const expectedPreset = currentType ? String(ARTICLE_TYPE_PRESETS[currentType] || "") : "";
        const currentValue = String(mdEl.value || "");

        if(!currentValue.trim()){
          presetTouchedByUser = false;
          lastAutoPresetType = "";
          lastAutoPresetValue = "";
          return;
        }

        if(
          lastAutoPresetType &&
          currentType === lastAutoPresetType &&
          currentValue === lastAutoPresetValue &&
          expectedPreset === lastAutoPresetValue
        ){
          return;
        }

        if(expectedPreset && currentValue === expectedPreset){
          lastAutoPresetType = currentType;
          lastAutoPresetValue = expectedPreset;
          return;
        }

        presetTouchedByUser = true;
      });
    }

    if(typeEl){
      typeEl.addEventListener("change", () => {
        if(!isNew) return;
        if(!mdEl) return;
        if(presetTouchedByUser) return;

        const applied = maybeInsertPreset(isNew);
        if(applied){
          lastAutoPresetType = String(typeEl.value || "").trim();
          lastAutoPresetValue = applied;
        }
      });
    }

    const saveBtn = $("#a_save");
    if(saveBtn){
      saveBtn.onclick = async () => {
        if(window.__adminSaveLock) return;
        if(!window.__adminClickGuard("admin_save")) return;
        if(!window.__adminClickGuard("tpl_save")) return;
        window.__adminSaveLock = true;

        setBusy(true, "Сохраняю…");
        try{
          const id = normLower($("#a_id").value);
          if(!id){
            setBusy(false);
            window.__adminSaveLock = false;
            return alert("ID обязателен. Нажми 'Сгенерировать ID' или введи вручную.");
          }

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

          try{
            const targetHash = "#/admin/articles/" + encodeURIComponent(row.id);
            if(location.hash !== targetHash){
              setBusy(false);
              window.__adminSaveLock = false;
              location.hash = targetHash;
              return;
            }
          }catch(e){}

          setBusy(false);
          window.__adminSaveLock = false;

          alert("Сохранено ✅");
          goAdmin("content:articles:" + id);
          await loadArticles(id);
        }catch(e){
          console.error(e);
          setBusy(false);
          window.__adminSaveLock = false;
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
          window.__adminSaveLock = false;

          alert("Удалено ✅");
          goAdmin("content:articles");
          await loadArticles("");
        }catch(e){
          console.error(e);
          setBusy(false);
          window.__adminSaveLock = false;
          alert(e.message || String(e));
        }
      };
    }
  }

  async function loadArticles(openId){
    setPanelTitle("Админка");
    setStatus("…");
    setMode("content");

    try{ if(window.App) App._navLock = !!(openId && String(openId).length); }catch(e){}

    showLoading("Загрузка инструкций…");

    try{
      const items = await sbArticlesListAll();
      CAT_DICT = buildCatDict(items);

      renderArticlesList(items);
      setStatus(String(items.length));

      if(!openId){
        showViewer(`<div class="empty">Выбери существующую инструкцию слева для редактирования.</div>`);
        return;
      }

      if(openId === "new"){
        showViewer(`
          <div class="item" style="cursor:default; margin-bottom:12px;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div style="flex:1; min-width:240px;">
                <h1 class="article-title">Контент → Инструкции</h1>
                <p class="article-sub">Создание новых инструкций через админку отключено.</p>
              </div>
            </div>
          </div>

          <div class="item" style="cursor:default;">
            <div class="item-title">Edit-only mode</div>
            <div class="item-meta" style="margin-top:10px;">
              <span class="tag">articles</span>
              <span class="tag">edit_only</span>
              <span class="tag">no_create_in_admin</span>
            </div>
            <div style="margin-top:12px;">
              <div class="empty">Новые инструкции создаются вне админки. Здесь можно редактировать только существующие записи.</div>
            </div>
          </div>
        `);
        setStatus(String(items.length));
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

  return {
    load: loadArticles
  };
};