window.Views = window.Views || {};

window.Views.AdminChecklistsFactory = function(deps){
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
  const inpStyle = deps.inpStyle;
  const taStyle = deps.taStyle;
  const setMode = deps.setMode;

  if(!SB) throw new Error("Admin checklists module: SB missing.");
  if(!esc || !norm || !normLower) throw new Error("Admin checklists module: shared text helpers missing.");
  if(!setBusy || !setStatus || !setPanelTitle || !showViewer || !showLoading) throw new Error("Admin checklists module: shared UI helpers missing.");
  if(!withTimeout || !ensureSession || !renderAdminTabs || !renderContentSubTabs || !goAdmin || !inpStyle || !taStyle || !setMode){
    throw new Error("Admin checklists module: shared runtime helpers missing.");
  }

  async function loadChecklistsSource(){
    const p = SB.from("kb_checklists")
      .select("id,title,desc,url,actions,tags,published,sort,created_at,updated_at")
      .order("sort", { ascending:true })
      .order("title", { ascending:true });

    const { data, error } = await withTimeout(p, 12000, "kb_checklists list");
    if(error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function sbChecklistsGet(id){
    const p = SB.from("kb_checklists")
      .select("id,title,desc,url,actions,tags,published,sort,created_at,updated_at,items")
      .eq("id", id).single();
    const { data, error } = await withTimeout(p, 12000, "kb_checklists get");
    if(error) throw error;
    return data;
  }

  async function sbChecklistsUpsert(row){
    await ensureSession();

    try{
      const p = SB.from("kb_checklists").upsert(row, { onConflict:"id" }).select("id");
      const { error } = await withTimeout(p, 45000, "kb_checklists upsert");
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

      console.warn("[Admin] kb_checklists upsert transient, retrying once…", e);
      try{
        await new Promise(res => setTimeout(res, 600));
        await ensureSession();
      }catch(_e){}

      const p2 = SB.from("kb_checklists").upsert(row, { onConflict:"id" }).select("id");
      const { error: error2 } = await withTimeout(p2, 45000, "kb_checklists upsert retry");
      if(error2) throw error2;
    }
  }
  
  async function sbChecklistsDelete(id){
    await ensureSession();
    const p = SB.from("kb_checklists").delete().eq("id", id);
    const { error } = await withTimeout(p, 20000, "kb_checklists delete");
    if(error) throw error;
  }
  

  function normalizeChecklistEditorItems(items){
    if(!Array.isArray(items)) return [];
    return items
      .map(item => {
        if(typeof item === "string"){
          const text = norm(item);
          return text ? { text } : null;
        }
        if(item && typeof item === "object"){
          const text = norm(item.text);
          return text ? { text } : null;
        }
        return null;
      })
      .filter(Boolean);
  }

  function renderChecklistItemsEditor(items){
    const safeItems = Array.isArray(items) ? items : [];

    if(!safeItems.length){
      return `
        <div id="clItemsHost" class="zr-stack-sm">
          <div class="empty" style="padding:12px;color:var(--muted)">Пока нет пунктов. Можно сохранить пустой список или добавить новый пункт.</div>
        </div>
      `;
    }

    return `
      <div id="clItemsHost" class="zr-stack-sm">
        ${safeItems.map((item, index) => {
          const text = typeof item === "string"
            ? String(item)
            : (item && item.text != null ? String(item.text) : "");

          return `
            <div class="zr-admin-editor__field zr-admin-editor__field--full" data-cl-item-row="${index}">
              <div style="display:flex; gap:10px; align-items:flex-start;">
                <input
                  data-cl-item-input="${index}"
                  style="${inpStyle}; flex:1 1 auto;"
                  value="${esc(text)}"
                  placeholder="Текст пункта чек-листа"
                />
                <button
                  type="button"
                  class="btn btn-sm btn--ghost"
                  data-cl-item-remove="${index}"
                  aria-label="Удалить пункт"
                >Удалить</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function readChecklistItemsFromUi(root){
    const host = root && root.querySelector ? root.querySelector("#clItemsHost") : null;
    if(!host) return [];

    return Array.from(host.querySelectorAll("[data-cl-item-input]"))
      .map(input => {
        const text = norm(input.value);
        return text ? { text } : null;
      })
      .filter(Boolean);
  }

  function checklistAdminEditorHtml(row){
    const id = row.id || "";
    const title = row.title || "";
    const desc = row.desc || "";
    const items = normalizeChecklistEditorItems(row.items);
    const published = !!row.published;
    const sort = row.sort != null ? String(row.sort) : "1000";

    return `
      <div class="zr-admin-editor zr-stack-lg">
        <div class="zr-card zr-card--section zr-admin-editor__hero">
          <div class="zr-admin-editor__hero-head">
            <div class="zr-admin-editor__hero-main zr-stack-sm">
              <div class="zr-viewer-title-row">
                <h1 class="article-title">Контент → Чек-листы</h1>
              </div>
              <p class="article-sub">Редактирование существующей записи</p>
              <div class="zr-admin-editor__hero-meta">
                <span class="tag">checklists</span>
                <span class="tag">edit</span>
                ${id ? `<span class="tag mono">${esc(id)}</span>` : ""}
              </div>
            </div>
          </div>
        </div>

        <div class="zr-card zr-card--subtle zr-admin-editor__section zr-stack-md">
          <div class="zr-section-head">
            <div class="zr-section-title">Метаданные</div>
          </div>

          <div class="zr-admin-editor__grid">
            <div class="zr-admin-editor__field zr-admin-editor__field--full">
              <label class="zr-admin-editor__field-label" for="cl_id">ID</label>
              <input id="cl_id" style="${inpStyle}" value="${esc(id)}" disabled />
            </div>

            <div class="zr-admin-editor__field zr-admin-editor__field--full">
              <label class="zr-admin-editor__field-label" for="cl_title">Название</label>
              <input id="cl_title" style="${inpStyle}" value="${esc(title)}" />
            </div>

            <div class="zr-admin-editor__field zr-admin-editor__field--full">
              <label class="zr-admin-editor__field-label" for="cl_desc">Описание</label>
              <textarea id="cl_desc" style="${taStyle}; min-height:96px;" rows="4">${esc(desc)}</textarea>
            </div>

            <div class="zr-admin-editor__field">
              <label class="zr-admin-editor__field-label" for="cl_published">Published</label>
              <select id="cl_published" style="${inpStyle}">
                <option value="1" ${published ? "selected" : ""}>да</option>
                <option value="0" ${published ? "" : "selected"}>нет</option>
              </select>
            </div>

            <div class="zr-admin-editor__field">
              <label class="zr-admin-editor__field-label" for="cl_sort">Sort</label>
              <input id="cl_sort" type="number" style="${inpStyle}" value="${esc(sort)}" />
            </div>
          </div>
        </div>

        <div class="zr-card zr-card--section zr-admin-editor__section zr-stack-sm">
          <div class="zr-section-head" style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
            <div class="zr-section-title">Структура</div>
            <button type="button" class="btn btn-sm btn--ghost" id="cl_add_item">+ Добавить пункт</button>
          </div>
          ${renderChecklistItemsEditor(items)}
        </div>

        <div class="zr-card zr-card--subtle zr-admin-editor__section">
          <div class="zr-admin-editor__actions">
            <button class="btn btn--primary" id="cl_save">Сохранить</button>
            <button class="btn btn--danger" id="cl_del">Удалить</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderChecklistsList(items){
    const list = $("#list");
    renderAdminTabs();
    renderContentSubTabs();

    if(!items.length){
      list.insertAdjacentHTML("beforeend", `<div class="empty" style="padding:12px;color:var(--muted)">Пока нет записей в kb_checklists.</div>`);
      return;
    }

    items.forEach(it => {
      const tags = Array.isArray(it.tags) && it.tags.length
        ? it.tags.map(tag => `<span class="tag" data-tag-filter="${esc(String(tag))}">${esc(String(tag))}</span>`).join("")
        : "";
      const desc = it.desc ? `<div class="muted" style="margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">(it.desc)}</div>` : "";

      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/admin/${encodeURIComponent("content:checklists:" + it.id)}`;
      a.innerHTML = `
        <div class="item-title">${esc(it.title || it.id || "Чек-лист")}</div>
        <div class="item-meta">${tags}</div>
        ${desc}
      `;
      list.appendChild(a);
    });
  }

  function bindChecklistEditor(rowData){
    const root = $("#viewer");
    if(!root) return;

    let draftItems = normalizeChecklistEditorItems(rowData && rowData.items);

    const renderDraftItems = () => {
      const host = root.querySelector("#clItemsHost");
      if(!host) return;
      host.outerHTML = renderChecklistItemsEditor(draftItems);
    };

    const syncDraftFromInputs = () => {
      const inputs = Array.from(root.querySelectorAll("[data-cl-item-input]"));
      if(!inputs.length){
        draftItems = [];
        return;
      }

      draftItems = inputs.map(input => ({
        text: input.value != null ? String(input.value) : ""
      }));
    };

    root.addEventListener("input", (e) => {
      const input = e.target && e.target.matches ? (e.target.matches("[data-cl-item-input]") ? e.target : null) : null;
      if(!input) return;

      const idx = Number(input.getAttribute("data-cl-item-input"));
      if(!Number.isFinite(idx) || !draftItems[idx]) return;

      draftItems[idx].text = input.value != null ? String(input.value) : "";
    });

    const addItemBtn = root.querySelector("#cl_add_item");
    if(addItemBtn){
      addItemBtn.onclick = () => {
        syncDraftFromInputs();
        draftItems.push({ text: "" });
        renderDraftItems();

        setTimeout(() => {
          try{
            const inputs = root.querySelectorAll("[data-cl-item-input]");
            const last = inputs && inputs.length ? inputs[inputs.length - 1] : null;
            if(last) last.focus();
          }catch(e){}
        }, 0);
      };
    }

    root.addEventListener("click", (e) => {
      const removeBtn = e.target && e.target.closest ? e.target.closest("[data-cl-item-remove]") : null;
      if(!removeBtn) return;

      syncDraftFromInputs();

      const idx = Number(removeBtn.getAttribute("data-cl-item-remove"));
      if(!Number.isFinite(idx)) return;

      draftItems.splice(idx, 1);
      renderDraftItems();
    });

    const saveBtn = $("#cl_save");
    if(saveBtn){
      saveBtn.onclick = async () => {

        if(window.__adminSaveLock) return;
        if(!window.__adminClickGuard("admin_save")) return;
        if(!window.__adminClickGuard("tpl_save")) return;
        window.__adminSaveLock = true;

        setBusy(true, "Сохраняю…");
        try{
          const id = normLower($("#cl_id").value);
          if(!id){
            setBusy(false);
            window.__adminSaveLock = false;
            return alert("ID обязателен.");
          }

          const existing = await sbChecklistsGet(id);
          const sortRaw = norm($("#cl_sort").value);

          syncDraftFromInputs();
          const items = normalizeChecklistEditorItems(draftItems);

          const row = {
            id,
            title: norm($("#cl_title").value),
            desc: norm($("#cl_desc").value) || null,
            url: existing && Object.prototype.hasOwnProperty.call(existing, "url")
              ? (existing.url || null)
              : null,
            published: ($("#cl_published").value || "1") === "1",
            sort: sortRaw ? Number(sortRaw) : 1000,
            items
          };

          if(!row.title){
            setBusy(false);
            window.__adminSaveLock = false;
            return alert("Название обязательно.");
          }

          await sbChecklistsUpsert(row);

          try{
            const targetHash = "#/admin/checklists/" + encodeURIComponent(row.id);
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
          goAdmin("content:checklists:" + id);
          await loadAdminChecklists(id);
        }catch(e){
          console.error(e);
          setBusy(false);
          window.__adminSaveLock = false;
          alert(e.message || String(e));
        }
      };
    }
    
        const delBtn = $("#cl_del");
        if(delBtn){
          delBtn.onclick = async () => {
            const id = normLower($("#cl_id").value);
            if(!id) return;
            if(!confirm("Удалить чек-лист?")) return;

            setBusy(true, "Удаляю…");
            try{
              await sbChecklistsDelete(id);
              setBusy(false);
              window.__adminSaveLock = false;

              alert("Удалено ✅");
              goAdmin("content:checklists");
              await loadAdminChecklists("");
            }catch(e){
              console.error(e);
              setBusy(false);
              window.__adminSaveLock = false;
              alert(e.message || String(e));
            }
          };
        }

    setTimeout(() => {
      try{
        const el = root.querySelector("#cl_title");
        if(el) el.focus();
      }catch(e){}
    }, 30);
  }
  async function loadAdminChecklists(openId){
    setPanelTitle("Админка");
    setStatus("…");
    setMode("content");

    try{ if(window.App) App._navLock = !!(openId && String(openId).length); }catch(e){}

    showLoading("Загрузка чек-листов…");

    try{
      const items = await loadChecklistsSource();

      renderChecklistsList(items);
      setStatus(String(items.length));

      if(!openId){
        showViewer(`<div class="empty">Выбери существующий чек-лист слева для редактирования.</div>`);
        return;
      }

      if(openId === "new"){
        showViewer(`
          <div class="item" style="cursor:default; margin-bottom:12px;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div style="flex:1; min-width:240px;">
                <h1 class="article-title" style="font-size:18px; line-height:1.15;">Контент → Чек-листы</h1>
                <p class="article-sub">Создание новых чек-листов через админку отключено.</p>
              </div>
            </div>
          </div>

          <div class="item" style="cursor:default;">
            <div class="item-title">Edit-only mode</div>
            <div class="item-meta" style="margin-top:10px;">
              <span class="tag">checklists</span>
              <span class="tag">edit_only</span>
              <span class="tag">no_create_in_admin</span>
            </div>
            <div style="margin-top:12px;">
              <div class="empty">Новые чек-листы создаются вне админки. Здесь можно редактировать только существующие записи.</div>
            </div>
          </div>
        `);
        setStatus(String(items.length));
        return;
      }

      const row = await sbChecklistsGet(openId);
      showViewer(checklistAdminEditorHtml(row));
      bindChecklistEditor(row);

    }catch(e){
      console.error(e);
      showViewer(`<div class="empty">Ошибка загрузки чек-листов: ${esc(e.message || String(e))}</div>`);
      setStatus("ошибка");
    }
  }

  const api = {
    load: loadAdminChecklists
  };

  return api;
};
