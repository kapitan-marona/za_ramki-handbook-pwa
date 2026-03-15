window.Views = window.Views || {};

window.Views.AdminEmployeesFactory = function(deps){
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
  const inpStyle = deps.inpStyle;
  const setMode = deps.setMode;

  if(!SB) throw new Error("Admin employees module: SB missing.");
  if(!esc || !norm || !normLower) throw new Error("Admin employees module: shared text helpers missing.");
  if(!setBusy || !setStatus || !setPanelTitle || !showViewer || !showLoading) throw new Error("Admin employees module: shared UI helpers missing.");
  if(!withTimeout || !ensureSession || !renderAdminTabs || !inpStyle || !setMode) throw new Error("Admin employees module: shared runtime helpers missing.");

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
      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <h1 class="article-title">Админка → Сотрудники</h1>
            <p class="article-sub">Управление доступами (allowlist). Только admin.</p>
          </div>
        </div>
      </div>

      <div class="item" style="cursor:default; margin-bottom:12px;">
        <div class="item-title">Добавить / обновить доступ</div>
        <div class="item-meta" style="margin-top:10px;">
          <span class="tag">allowlist</span>
          <span class="tag">admin only</span>
        </div>

        <div class="markdown" style="padding:0; margin-top:12px;">
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

          <div style="display:flex; gap:12px; align-items:center; margin-top:10px; flex-wrap:wrap;">
            <label style="display:flex; gap:8px; align-items:center; user-select:none;">
              <input id="al_enabled" type="checkbox" checked />
              <span>enabled</span>
            </label>
            <button class="btn btn-sm" id="al_add"><span class="dot"></span>Добавить / обновить</button>
            <button class="btn btn-sm" id="al_reload"><span class="dot"></span>Обновить список</button>
          </div>
        </div>
      </div>

      <div class="item" style="cursor:default;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div class="item-title">Список сотрудников</div>
          <div class="item-meta">
            <span class="tag">Всего: ${(items||[]).length}</span>
          </div>
        </div>

        <div class="markdown" style="padding:0; margin-top:12px;">
          ${rows || `<div class="empty" style="padding:12px;color:var(--muted)">Список пуст.</div>`}
        </div>
      </div>
    `;
  }

  const api = {
    load: loadEmployees
  };

  function bindEmployees(){
    const root = $("#viewer");
    if(!root) return;

    $("#al_add").onclick = async () => {
      setBusy(true, "Сохраняю…");
      try{
        const email = normLower($("#al_email").value);
        if(!email || !email.includes("@")){
          setBusy(false);
          window.__adminSaveLock = false;
          return alert("Введи корректный email.");
        }

        const role = normLower($("#al_role").value) || "staff";
        const enabled = !!$("#al_enabled").checked;
        await sbAllowlistUpsert({ email, role, enabled });
        $("#al_email").value = "";
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

    $("#al_reload").onclick = () => api.load();

    root.querySelectorAll("[data-al-save]").forEach(btn => {
      btn.onclick = async () => {
        const email = btn.getAttribute("data-al-save");
        setBusy(true, "Сохраняю…");
        try{
          const role = root.querySelector(`[data-al-role="${CSS.escape(email)}"]`).value;
          const enabled = !!root.querySelector(`[data-al-enabled="${CSS.escape(email)}"]`).checked;
          await sbAllowlistUpsert({ email, role, enabled });
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

    root.querySelectorAll("[data-al-del]").forEach(btn => {
      btn.onclick = async () => {
        const email = btn.getAttribute("data-al-del");
        if(!confirm("Удалить из allowlist?")) return;
        setBusy(true, "Удаляю…");
        try{
          await sbAllowlistDelete(email);
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
  }

  async function loadEmployees(){
    setPanelTitle("Админка");
    setStatus("…");
    setMode("employees");
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

  return api;
};
