/* ZA RAMKI — Planner actions wiring (buttons) */
(function(){
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function openCreateDialog(opts){
    opts = opts || {};
    const onCreate = opts.onCreate;

    // avoid duplicates
    const existing = document.getElementById("plCreateOverlay");
    if(existing){ try{ existing.remove(); }catch(e){} }

    const nowIso = new Date().toISOString().slice(0,10);
    const tomorrowIso = new Date(Date.now()+86400000).toISOString().slice(0,10);

    const overlay = document.createElement("div");
    overlay.id = "plCreateOverlay";
    overlay.style.cssText = [
      "position:fixed; inset:0; z-index:9999;",
      "background:rgba(0,0,0,.55);",
      "display:flex; align-items:center; justify-content:center;",
      "padding:16px;"
    ].join("");

    overlay.innerHTML = `
      <div class="item" style="width:min(560px, 96vw); cursor:default; padding:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:700; letter-spacing:.06em;">Новая задача</div>
          <button class="btn btn-sm" id="plCreateClose" type="button">Закрыть</button>
        </div>

        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Название *</div>
            <input class="pl-control" id="plCreateTitle" placeholder="Например: согласовать макет кухни" />
          </div>

          <div>
            <div class="muted" style="font-size:12px; margin-bottom:6px;">Описание</div>
            <textarea class="pl-control pl-textarea" id="plCreateBody" rows="3" placeholder="Коротко: что сделать, где смотреть, какие критерии…"></textarea>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Старт</div>
              <input class="pl-control" id="plCreateStart" type="date" value="${esc(nowIso)}" />
            </div>
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Дедлайн</div>
              <input class="pl-control" id="plCreateDue" type="date" value="${esc(tomorrowIso)}" />
            </div>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Видимость</div>
              <select class="pl-control" id="plCreateRole">
                <option value="all" selected>all</option>
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div style="flex:1; min-width:160px;">
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Срочность</div>
              <select class="pl-control" id="plCreateUrgency">
                <option value="normal" selected>normal</option>
                <option value="urgent">urgent</option>
                <option value="high">high</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>

          <div style="display:flex; gap:10px; align-items:center; justify-content:flex-end; margin-top:4px;">
            <span class="muted" id="plCreateMsg" style="font-size:12px; flex:1;"></span>
            <button class="btn" id="plCreateDo" type="button">Создать</button>
          </div>
        </div>
      </div>
    `;

    function close(){
      try{ overlay.remove(); }catch(e){}
      try{ document.removeEventListener("keydown", onKey); }catch(e){}
    }
    function onKey(e){
      if(e && e.key === "Escape") close();
    }

    overlay.addEventListener("click", (e) => { if(e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById("plCreateClose");
    if(closeBtn) closeBtn.onclick = close;

    const doBtn = document.getElementById("plCreateDo");
    const msg = document.getElementById("plCreateMsg");

    if(doBtn){
      doBtn.onclick = async () => {
        const titleEl = document.getElementById("plCreateTitle");
        const bodyEl = document.getElementById("plCreateBody");
        const startEl = document.getElementById("plCreateStart");
        const dueEl = document.getElementById("plCreateDue");
        const roleEl = document.getElementById("plCreateRole");
        const urgEl  = document.getElementById("plCreateUrgency");

        const title = titleEl && titleEl.value ? titleEl.value.trim() : "";
        if(!title){ if(msg) msg.textContent = "Название обязательно."; return; }

        doBtn.disabled = true;
        if(msg) msg.textContent = "Создаю…";

        try{
          const payload = {
            title,
            body: bodyEl && bodyEl.value != null ? String(bodyEl.value) : "",
            start_date: startEl && startEl.value ? String(startEl.value) : nowIso,
            due_date: dueEl && dueEl.value ? String(dueEl.value) : tomorrowIso,
            role: roleEl && roleEl.value ? String(roleEl.value) : "all",
            urgency: urgEl && urgEl.value ? String(urgEl.value) : "normal"
          };

          if(typeof onCreate !== "function") throw new Error("onCreate handler missing");
          const created = await onCreate(payload);

          close();
          return created;
        }catch(err){
          console.warn("[PlannerActions] create error", err);
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          if(msg) msg.textContent = "Ошибка: " + t;
          doBtn.disabled = false;
        }
      };
    }

    // focus title
    try{
      const t = document.getElementById("plCreateTitle");
      if(t) t.focus();
    }catch(e){}
  }

  function wireCreateButton(onClick){
    const b = document.getElementById("plCreateTask");
    if(b) b.onclick = onClick;
  }

  function wireQuickCreate(onClick){
    const b = document.getElementById("plQuickCreate");
    if(b) b.onclick = onClick;
  }

  window.PlannerActions = { wireCreateButton, wireQuickCreate, openCreateDialog };
})();
