window.Views = window.Views || {};

Views.Admin = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").toString().replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  function setPanelTitle(t){ const el = $("#panelTitle"); if(el) el.textContent = t; }
  function setStatus(t){ const el = $("#status"); if(el) el.textContent = t; }

  function ensureAdmin(){
    return !!(window.App && App.session && App.session.user && App.session.role === "admin");
  }

  function viewerHtml(title, sub, bodyHtml){
    return `
      <h1 class="article-title">${esc(title)}</h1>
      <p class="article-sub">${esc(sub || "")}</p>
      <div class="hr"></div>
      ${bodyHtml || ""}
    `;
  }

  function renderAdminTabs(active){
    const tabs = [
      { id: "staff", title: "Сотрудники" },
      { id: "tasks", title: "Задачи" },
      { id: "content", title: "Контент" },
    ];
    return `
      <div class="actions" style="margin-top:0;">
        ${tabs.map(t => `
          <button class="btn btn-sm zr-admtab ${t.id === active ? "is-active" : ""}" data-adm="${t.id}">
            <span class="dot"></span>${esc(t.title)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function bindAdminTabs(){
    document.querySelectorAll(".zr-admtab").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-adm") || "staff";
        show(id);
      };
    });
  }

  async function fetchAllowlist(){
    if(!window.SB) throw new Error("Supabase не подключён.");
    // ожидаем таблицу public.allowlist: email (pk), role, enabled
    const res = await SB.from("allowlist").select("email, role, enabled").order("email", { ascending: true });
    if(res.error) throw res.error;
    return Array.isArray(res.data) ? res.data : [];
  }

  async function upsertAllowlistRow(email, role, enabled){
    if(!window.SB) throw new Error("Supabase не подключён.");
    const row = { email, role, enabled: !!enabled };
    const res = await SB.from("allowlist").upsert(row, { onConflict: "email" }).select("email, role, enabled").single();
    if(res.error) throw res.error;
    return res.data;
  }

  async function updateAllowlistRow(email, patch){
    if(!window.SB) throw new Error("Supabase не подключён.");
    const res = await SB.from("allowlist").update(patch).eq("email", email).select("email, role, enabled").single();
    if(res.error) throw res.error;
    return res.data;
  }

  async function deleteAllowlistRow(email){
    if(!window.SB) throw new Error("Supabase не подключён.");
    const res = await SB.from("allowlist").delete().eq("email", email);
    if(res.error) throw res.error;
    return true;
  }

  function roleSelectHtml(current){
    const v = (current === "admin" || current === "staff") ? current : "staff";
    return `
      <select class="mf-label-select zr-role" style="height:32px;">
        <option value="staff" ${v==="staff" ? "selected" : ""}>staff</option>
        <option value="admin" ${v==="admin" ? "selected" : ""}>admin</option>
      </select>
    `;
  }

  function enabledToggleHtml(enabled){
    return `
      <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; user-select:none;">
        <input type="checkbox" class="zr-enabled" ${enabled ? "checked" : ""} />
        <span class="muted">enabled</span>
      </label>
    `;
  }

  function renderAllowlistTable(rows){
    const r = Array.isArray(rows) ? rows : [];
    return `
      <div class="markdown">
        <blockquote class="kb-callout kb-important">
          <span class="kb-callout-title">Важно</span>
          Только admin видит и редактирует список доступов (allowlist).
        </blockquote>

        <div class="zr-form-grid" style="margin-top:12px;">
          <div class="zr-field" style="grid-column:1 / -1;">
            <span class="zr-label">Добавить сотрудника</span>
            <div class="zr-row-2" style="grid-template-columns: 1fr 160px;">
              <input id="al_email" class="zr-input" placeholder="email@example.com" />
              <select id="al_role" class="mf-label-select" style="height:40px;">
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
              <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
                <input id="al_enabled" type="checkbox" checked />
                <span class="muted">enabled</span>
              </label>
              <button class="btn btn-sm" id="al_add"><span class="dot"></span>Добавить / обновить</button>
              <span class="muted" id="al_msg"></span>
            </div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="muted" style="margin-bottom:8px;">Сотрудников: <b>${r.length}</b></div>

        <div class="bp-tablewrap" style="background: var(--item);">
          <table class="bp-table" style="min-width: 900px;">
            <thead>
              <tr>
                <th class="bp-th sticky">Email</th>
                <th class="bp-th mid">Роль</th>
                <th class="bp-th mid">Enabled</th>
                <th class="bp-th last">Действия</th>
              </tr>
            </thead>
            <tbody>
              ${r.map(x => `
                <tr data-email="${esc(x.email || "")}">
                  <td class="rr-sticky">
                    <div class="rr-namebox">
                      <div class="rr-nameview">${esc(x.email || "")}</div>
                    </div>
                  </td>
                  <td>
                    ${roleSelectHtml(x.role)}
                  </td>
                  <td>
                    ${enabledToggleHtml(!!x.enabled)}
                  </td>
                  <td>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                      <button class="btn btn-sm zr-save"><span class="dot"></span>Сохранить</button>
                      <button class="btn btn-sm rr-del-confirm zr-del" style="border-color: rgba(255,90,90,.55);">
                        <span class="dot"></span>Удалить
                      </button>
                    </div>
                    <div class="muted zr-rowmsg" style="margin-top:6px;"></div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function show(section = "staff"){
    const viewer = $("#viewer");
    const list = $("#list");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    setPanelTitle("Админка");
    setStatus("—");

    if(!ensureAdmin()){
      viewer.innerHTML = viewerHtml("Админка", "Доступ запрещён.", `<div class="empty">Только admin.</div>`);
      return;
    }

    // STAFF (allowlist)
    if(section === "staff"){
      viewer.innerHTML =
        viewerHtml("Админка", "Управление доступами и контентом.", renderAdminTabs("staff") + `<div id="adm_body"><div class="empty">Загрузка…</div></div>`);
      bindAdminTabs();

      try{
        const rows = await fetchAllowlist();
        setStatus(`${rows.length}`);
        $("#adm_body").innerHTML = renderAllowlistTable(rows);

        // add/upsert
        $("#al_add").onclick = async () => {
          const email = (($("#al_email").value || "") + "").trim().toLowerCase();
          const role = ($("#al_role").value || "staff").toString();
          const enabled = !!$("#al_enabled").checked;
          const msg = $("#al_msg");

          if(msg) msg.textContent = "";
          if(!email || !email.includes("@")){
            if(msg) msg.textContent = "Введите корректный email.";
            return;
          }
          if(role !== "admin" && role !== "staff"){
            if(msg) msg.textContent = "Роль должна быть admin или staff.";
            return;
          }

          try{
            await upsertAllowlistRow(email, role, enabled);
            if(msg) msg.textContent = "Сохранено ✅";
            // refresh
            const updated = await fetchAllowlist();
            setStatus(`${updated.length}`);
            $("#adm_body").innerHTML = renderAllowlistTable(updated);
            // rebind after rerender
            bindAdminTabs();
            // rebind current section actions
            show("staff");
          }catch(e){
            console.warn("[Admin] upsert failed", e);
            if(msg) msg.textContent = (e && e.message) ? e.message : "Ошибка сохранения.";
          }
        };

        // row actions
        document.querySelectorAll('tr[data-email]').forEach(tr => {
          const email = (tr.getAttribute("data-email") || "").trim();
          const roleSel = tr.querySelector("select.zr-role");
          const enCb = tr.querySelector("input.zr-enabled");
          const msg = tr.querySelector(".zr-rowmsg");

          const setRowMsg = (t) => { if(msg) msg.textContent = t || ""; };

          const saveBtn = tr.querySelector("button.zr-save");
          if(saveBtn){
            saveBtn.onclick = async () => {
              setRowMsg("");
              const role = roleSel ? (roleSel.value || "staff") : "staff";
              const enabled = enCb ? !!enCb.checked : false;
              try{
                await updateAllowlistRow(email, { role, enabled });
                setRowMsg("Сохранено ✅");
              }catch(e){
                console.warn("[Admin] update failed", e);
                setRowMsg((e && e.message) ? e.message : "Ошибка сохранения.");
              }
            };
          }

          const delBtn = tr.querySelector("button.zr-del");
          if(delBtn){
            delBtn.onclick = async () => {
              setRowMsg("");
              const ok = confirm(`Удалить из allowlist?\n\n${email}`);
              if(!ok) return;
              try{
                await deleteAllowlistRow(email);
                setRowMsg("Удалено ✅");
                // refresh
                const updated = await fetchAllowlist();
                setStatus(`${updated.length}`);
                $("#adm_body").innerHTML = renderAllowlistTable(updated);
                // full re-render to rebind everything
                show("staff");
              }catch(e){
                console.warn("[Admin] delete failed", e);
                setRowMsg((e && e.message) ? e.message : "Ошибка удаления.");
              }
            };
          }
        });

      }catch(e){
        console.warn("[Admin] allowlist load failed", e);
        const m = (e && e.message) ? e.message : "Ошибка загрузки.";
        $("#adm_body").innerHTML = `<div class="empty">Не удалось загрузить allowlist. ${esc(m)}</div>`;
      }

      return;
    }

    // TASKS stub
    if(section === "tasks"){
      viewer.innerHTML = viewerHtml(
        "Админка",
        "Задачи (в разработке).",
        renderAdminTabs("tasks") + `
          <div class="markdown">
            <div class="empty">
              Здесь будет создание задач по шаблону, чекбоксы, назначение ответственного, статусы, комментарии, архив.
              <div class="hr"></div>
              Первым делом подключим таблицы Supabase и минимальный CRUD без файлов.
            </div>
          </div>
        `
      );
      bindAdminTabs();
      return;
    }

    // CONTENT stub
    viewer.innerHTML = viewerHtml(
      "Админка",
      "Контент (в разработке).",
      renderAdminTabs("content") + `
        <div class="markdown">
          <div class="empty">
            Здесь будут редакторы: статьи/инструкции (markdown + publish), шаблоны, чек-листы — всё в Supabase.
          </div>
        </div>
      `
    );
    bindAdminTabs();
  }

  return { show };
})();
