window.Views = window.Views || {};

window.Views.AdminProjectsFactory = function(deps){
  deps = deps || {};

  const $ = deps.$ || function(s){ return document.querySelector(s); };
  const SB = deps.SB;

  const esc = deps.esc;
  const norm = deps.norm;
  const setBusy = deps.setBusy;
  const setStatus = deps.setStatus;
  const setPanelTitle = deps.setPanelTitle;
  const showViewer = deps.showViewer;
  const showLoading = deps.showLoading;
  const withTimeout = deps.withTimeout;
  const ensureSession = deps.ensureSession;
  const renderAdminTabs = deps.renderAdminTabs;
  const inpStyle = deps.inpStyle;
  const taStyle = deps.taStyle;
  const setMode = deps.setMode;

  if(!SB) throw new Error("Admin projects module: SB missing.");
  if(!esc || !norm) throw new Error("Admin projects module: shared text helpers missing.");
  if(!setBusy || !setStatus || !setPanelTitle || !showViewer || !showLoading) throw new Error("Admin projects module: shared UI helpers missing.");
  if(!withTimeout || !ensureSession || !renderAdminTabs || !inpStyle || !taStyle || !setMode) throw new Error("Admin projects module: shared runtime helpers missing.");

  async function sbProjectsList(){
    const p = SB.from("projects")
      .select("id,title,notes,created_at")
      .order("created_at", { ascending:false });
    const { data, error } = await withTimeout(p, 12000, "projects list");
    if(error) throw error;
    return data || [];
  }

  async function sbProjectsInsert(row){
    await ensureSession();
    const p = SB.from("projects").insert(row);
    const { error } = await withTimeout(p, 20000, "projects insert");
    if(error) throw error;
  }

  async function sbProjectTaskCount(projectId){
    const p = SB.from("tasks")
      .select("id", { count:"exact", head:true })
      .eq("project_id", projectId);

    const { count, error } = await withTimeout(p, 12000, "project task count");
    if(error) throw error;
    return Number(count || 0);
  }

  async function sbProjectsUpdate(id, row){
    await ensureSession();
    const p = SB.from("projects").update(row).eq("id", id);
    const { error } = await withTimeout(p, 20000, "projects update");
    if(error) throw error;
  }

  async function sbProjectsDelete(id){
    await ensureSession();
    const p = SB.from("projects").delete().eq("id", id);
    const { error } = await withTimeout(p, 20000, "projects delete");
    if(error) throw error;
  }

  function projectsHtml(items){
    const rows = (items || []).map(it => `
      <div class="item">
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:220px;">
              <div class="item-title">${esc(it.title || "(без названия)")}</div>
              <div class="muted" style="margin-top:4px;">ID: <span class="mono">${esc(it.id || "")}</span></div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-sm" data-pr-edit-toggle="${esc(it.id)}"><span class="dot"></span>Редактировать</button>
              <button class="btn btn-sm" data-pr-del="${esc(it.id)}"><span class="dot"></span>Удалить</button>
            </div>
          </div>

          <div data-pr-view="${esc(it.id)}">
            ${it.notes ? `<div class="muted" style="margin-top:2px;">${esc(it.notes)}</div>` : `<div class="muted" style="margin-top:2px;">Заметки пусты.</div>`}
          </div>

          <div data-pr-edit-box="${esc(it.id)}" style="display:none;">
            <div>
              <div class="muted" style="margin:0 0 6px 2px;">Название</div>
              <input data-pr-title="${esc(it.id)}" style="${inpStyle}" value="${esc(it.title || "")}" />
            </div>

            <div style="margin-top:10px;">
              <div class="muted" style="margin:0 0 6px 2px;">Заметки</div>
              <textarea data-pr-notes="${esc(it.id)}" style="${taStyle}; min-height:90px;" rows="4">${esc(it.notes || "")}</textarea>
            </div>

            <div style="display:flex; gap:8px; align-items:center; margin-top:12px; flex-wrap:wrap;">
              <button class="btn btn-sm" data-pr-save="${esc(it.id)}"><span class="dot"></span>Сохранить</button>
              <button class="btn btn-sm" data-pr-cancel="${esc(it.id)}"><span class="dot"></span>Отмена</button>
            </div>
          </div>
        </div>
      </div>
    `).join("");

    return `
      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <h1 class="article-title">Админка → Проекты</h1>
            <p class="article-sub">Минимальное создание проектов.</p>
          </div>
        </div>
      </div>

      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div class="item-title">Создать проект</div>
        <div class="item-meta" style="margin-top:10px;">
          <span class="tag">projects</span>
          <span class="tag">minimal</span>
        </div>

        <div class="markdown" style="padding:0; margin-top:12px;">
          <div>
            <div class="muted" style="margin:0 0 6px 2px;">Название</div>
            <input id="pr_title" style="${inpStyle}" />
          </div>

          <div style="margin-top:10px;">
            <div class="muted" style="margin:0 0 6px 2px;">Заметки (опционально)</div>
            <textarea id="pr_notes" style="${taStyle}; min-height:90px;" rows="4"></textarea>
          </div>

          <div style="display:flex; gap:12px; align-items:center; margin-top:12px; flex-wrap:wrap;">
            <button class="btn btn-sm" id="pr_add"><span class="dot"></span>Создать проект</button>
          </div>
        </div>
      </div>

      <div class="item" style="cursor:default;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div class="item-title">Список проектов</div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-sm" id="pr_reload"><span class="dot"></span>Обновить список</button>
            <div class="item-meta">
              <span class="tag">Всего: ${(items||[]).length}</span>
            </div>
          </div>
        </div>

        <div class="markdown" style="padding:0; margin-top:12px;">
          ${rows || `<div class="empty" style="padding:12px;color:var(--muted)">Список пуст.</div>`}
        </div>
      </div>
    `;
  }

  const api = {
    load: loadProjects
  };

  function bindProjects(){
    const root = $("#viewer");
    if(!root) return;

    $("#pr_add").onclick = async () => {
      setBusy(true, "Создаю…");
      try{
        const title = norm($("#pr_title").value);
        const notes = norm($("#pr_notes").value);

        if(!title){
          setBusy(false);
          window.__adminSaveLock = false;
          return alert("Название обязательно.");
        }

        await sbProjectsInsert({
          title,
          notes: notes || null
        });

        $("#pr_title").value = "";
        $("#pr_notes").value = "";

        setBusy(false);
        window.__adminSaveLock = false;

        await api.load();
      }catch(e){
        console.error(e);
        setBusy(false);
        window.__adminSaveLock = false;
        alert(e.message || String(e));
      }
    };

    $("#pr_reload").onclick = () => api.load();

    root.querySelectorAll("[data-pr-edit-toggle]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-pr-edit-toggle");
        if(!id) return;

        const box = root.querySelector(`[data-pr-edit-box="${CSS.escape(id)}"]`);
        if(box) box.style.display = "";
      };
    });

    root.querySelectorAll("[data-pr-cancel]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-pr-cancel");
        if(!id) return;

        const box = root.querySelector(`[data-pr-edit-box="${CSS.escape(id)}"]`);
        if(box) box.style.display = "none";
      };
    });

    root.querySelectorAll("[data-pr-save]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-pr-save");
        if(!id) return;

        const titleEl = root.querySelector(`[data-pr-title="${CSS.escape(id)}"]`);
        const notesEl = root.querySelector(`[data-pr-notes="${CSS.escape(id)}"]`);

        const title = norm(titleEl ? titleEl.value : "");
        const notes = norm(notesEl ? notesEl.value : "");

        if(!title){
          alert("Название обязательно.");
          return;
        }

        setBusy(true, "Сохраняю…");
        try{
          await sbProjectsUpdate(id, {
            title,
            notes: notes || null
          });

          setBusy(false);
          window.__adminSaveLock = false;

          await api.load();
        }catch(e){
          console.error(e);
          setBusy(false);
          window.__adminSaveLock = false;
          alert(e.message || String(e));
        }
      };
    });

    root.querySelectorAll("[data-pr-del]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-pr-del");
        if(!id) return;
        if(!confirm("Удалить проект?")) return;

        setBusy(true, "Проверяю…");
        try{
          const taskCount = await sbProjectTaskCount(id);
          if(taskCount > 0){
            setBusy(false);
            window.__adminSaveLock = false;
            alert("Проект нельзя удалить: к нему привязаны задачи.");
            return;
          }

          setBusy(true, "Удаляю…");
          await sbProjectsDelete(id);
          setBusy(false);
          window.__adminSaveLock = false;

          await api.load();
        }catch(e){
          console.error(e);
          setBusy(false);
          window.__adminSaveLock = false;

          const msg = String((e && (e.message || e.details || e.hint)) || e || "");
          alert(msg || "Не удалось удалить проект.");
        }
      };
    });
  }

  async function loadProjects(){
    setPanelTitle("Админка");
    setStatus("…");
    setMode("projects");
    renderAdminTabs();
    showLoading("Загрузка проектов…");

    try{
      const items = await sbProjectsList();
      showViewer(projectsHtml(items));
      bindProjects();
      setStatus(String(items.length));
    }catch(e){
      console.error(e);
      showViewer(`<div class="empty">Ошибка проектов: ${esc(e.message || String(e))}</div>`);
      setStatus("ошибка");
    }
  }

  return api;
};