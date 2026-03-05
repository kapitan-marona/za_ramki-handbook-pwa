window.Views = window.Views || {};

Views.Planner = (() => {
  console.log("[PLANNER_BUILD] 2026-03-03");

  function esc(s){
    return (s==null?"":String(s))
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function todayISO(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  function getSelectedTaskId(){
    try{
      const p = (window.Router && typeof Router.parse === "function") ? Router.parse() : null;
      return p && p.param ? String(p.param) : null;
    }catch(e){
      return null;
    }
  }

  function goTask(id){
    // Single source of truth: Router.go()
    try{
      if(window.Router && typeof Router.go === "function"){
        if(id) Router.go("planner", String(id));
        else Router.go("planner");
        return;
      }
    }catch(e){}
    // Fallback
    location.hash = id ? ("#/planner/" + encodeURIComponent(String(id))) : "#/planner";
  }
function fmtDM(iso){
    if(!iso) return "";
    const s = String(iso);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}` : s;
  }

  function dueLabel(iso){
    return iso ? `до ${fmtDM(iso)}` : "";
  }

  function startLabel(iso){
    return iso ? `с ${fmtDM(iso)}` : "";
  }

  function urgencyLabel(u){
    if(u == null) return "";
    const s = String(u).trim().toLowerCase();
    if(!s) return "";
    if(s === "normal" || s === "low") return "";
    // show as "Срочно" for high/urgent/anything non-normal
    if(s === "high" || s === "urgent") return "Срочно";
    return "Срочно";
  }
function statusLabel(code){
    if(code === "new") return "Новая задача";
    if(code === "taken") return "Принята в работу";
    if(code === "in_progress") return "В работе";
    if(code === "problem") return "Есть проблема";
    if(code === "done") return "Завершена";
    if(code === "canceled") return "Отменена";
    return code;
  }

  async function show(){
    const listEl = document.getElementById("list");
    const viewerEl = document.getElementById("viewer");
    const titleEl = document.getElementById("panelTitle");
    if(!listEl || !viewerEl) return;
    if(titleEl) titleEl.textContent = "PLANNER";

    const role = window.App?.session?.role || null;
    const uid  = window.App?.session?.user?.id || null;

    window.__plannerState = window.__plannerState || { leftFilter: "mine", ownerKey: null }; // mine | all
    let state = window.__plannerState;
    // Reset planner UI state when user/role changes (prevents state leaking between accounts)
    const ownerKey = ((window.App && App.session && App.session.user) ? App.session.user.id : "anon") + "|" + ((window.App && App.session) ? (App.session.role || "none") : "none");
    if(state.ownerKey !== ownerKey){
      window.__plannerState = { leftFilter: "mine", ownerKey };
    }else{
      state.ownerKey = ownerKey;
    }
    // rebind after possible reset
    const today = todayISO();
    const selectedId = getSelectedTaskId();
const isOverdue = (t) => !!(t.due_date && String(t.due_date) < today && t.status !== "done");

    // ---------- DATA (SELECT-only) ----------
    async function fetchAllActiveTasks(){
      if(!window.PlannerAPI) throw new Error("PlannerAPI missing");
      return await PlannerAPI.fetchAllActiveTasks({ role, today });
    }
    // ---------- LEFT ----------
    function renderLeft(tasks){
      const head = `
        <div style="padding:10px 10px 6px 10px;">
          <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
          <div class="muted" style="margin-top:6px; font-size:12px;">
            today: ${esc(today)}${role ? ` · роль: ${esc(role)}` : ""}${uid ? ` · user: ${esc(uid.slice(0,8))}…` : ""}
          </div>
        </div>
      `;

      const pills = (role === "admin")
        ? `
          <div style="padding:0 10px 10px 10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm pl-left ${state.leftFilter==="mine" ? "is-active" : ""}" data-f="mine" type="button">Мои</button>
            <button class="btn btn-sm pl-left ${state.leftFilter==="all" ? "is-active" : ""}" data-f="all" type="button">Все</button>
          </div>
        `
        : `
          <div style="padding:0 10px 10px 10px;">
</div>
        `;

      listEl.innerHTML = head + pills + `<div id="plLeftList"></div>`;
// bind pills
      listEl.querySelectorAll(".pl-left").forEach(b => {
        b.onclick = () => { state.leftFilter = b.dataset.f; show(); };
      });

      const host = document.getElementById("plLeftList");
      if(!host) return;

      let leftTasks = tasks.filter(t => {
        const isMine = uid && t.assignee_id && String(t.assignee_id) === String(uid);
        const isCommon = !t.assignee_id;
        if(state.leftFilter === "all" && role === "admin") return true;
        return isMine || isCommon;
      });

      if(leftTasks.length === 0){
        host.innerHTML = `
          <div class="item" style="cursor:default;">
            <div class="item-meta"><span class="muted">В списке слева пока пусто.</span></div>
          </div>
        `;
        return;
      }

      // [PlannerUX] sortMineFirst: my tasks first in left list
      try{
        if(window.PlannerUX && typeof PlannerUX.sortMineFirst === "function"){
          leftTasks = PlannerUX.sortMineFirst(leftTasks, uid);
        }else if(uid){
          leftTasks = [...leftTasks].sort((a,b) => {
            const am = (a.assignee_id && String(a.assignee_id) === String(uid)) ? 1 : 0;
            const bm = (b.assignee_id && String(b.assignee_id) === String(uid)) ? 1 : 0;
            return bm - am;
          });
        }
      }catch(e){ console.warn("[Planner] left sortMineFirst error", e); }
      host.innerHTML = leftTasks.map(t => {
        const due = dueLabel(t.due_date);
        const st  = t.status ? `· ${esc(statusLabel(t.status))}` : "";
        const badge = isOverdue(t) ? `<span class="tag" style="margin-left:6px;">Срок истёк</span>` : ``;

        const r = (t.role ? String(t.role) : "all");
        const rLabel = (r === "staff") ? "S" : (r === "admin") ? "A" : "ALL";
        const roleBadge = `<span class="tag" style="margin-left:6px; font-size:10px; padding:2px 6px;">${rLabel}</span>`;
        const isSel = selectedId && String(selectedId) === String(t.id);
        return `
          <div class="item" data-id="${esc(t.id)}" style="${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
            <div class="item-title">${esc(t.title || "(без названия)")}${roleBadge}${badge}</div>
            <div class="item-meta">${[startLabel(t.start_date), dueLabel(t.due_date), urgencyLabel(t.urgency), (t.status ? statusLabel(t.status) : "")].filter(Boolean).join(" · ")}</div>
          </div>
        `;
      }).join("");

      host.querySelectorAll(".item[data-id]").forEach(row => {
        row.onclick = () => goTask(row.dataset.id);
      });
    }

    // ---------- RIGHT ----------
    function renderRightHeader(tasks){
      const total = Array.isArray(tasks) ? tasks.length : 0;
      const done = total ? tasks.filter(t => t.status === "done").length : 0;
      const pct = total ? Math.round((done / total) * 100) : 0;

      viewerEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px;">
          <div>
            <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
            <div class="muted" style="margin-top:6px; font-size:12px;">Обзор по статусам · клик по карточке открывает детали</div>

            <div style="margin-top:10px; height:6px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:var(--brand-accent, #c45a2a);"></div>
            </div>
            <div class="muted" style="margin-top:6px; font-size:12px;">Прогресс дня: ${done}/${total} (${pct}%)</div>
          </div>

          ${(role === "admin" && done > 0) ? `<button class="btn btn-sm" id="plArchiveDone" type="button">В архив: завершённые</button>` : ``}
          ${role === "admin" ? `<button class="btn btn-sm" id="plQuickCreate" type="button">+ Задача</button>` : ``}
          <button class="btn btn-sm" id="plRefresh" type="button">Обновить</button>
        </div>

        <div id="plBoard"></div>
      `;

      const rf = document.getElementById("plRefresh");
      const qc = document.getElementById("plQuickCreate");
      if(qc) qc.onclick = () => {
        try{
          if(!window.PlannerActions || typeof PlannerActions.openCreateDialog !== "function"){
            alert("Create UI missing");
            return;
          }
          PlannerActions.openCreateDialog({
            onCreate: async (payload) => {
              qc.disabled = true;
              try{
                const created = await PlannerAPI.createTask(payload);
                if(created && created.id){
                  location.hash = "#/planner/" + encodeURIComponent(String(created.id));
                }else{
                  show();
                }
                return created;
              }finally{
                qc.disabled = false;
              }
            }
          });
        }catch(err){
          console.warn("[Planner] openCreateDialog error", err);
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          alert("Ошибка: " + t);
        }
      };

      var ad = document.getElementById("plArchiveDone");
      if(ad) ad.onclick = async () => {
        if(!confirm("Перенести все завершённые задачи в архив?")) return;

        ad.disabled = true;
        try{
          if(!window.PlannerAPI || typeof PlannerAPI.archiveDoneTasks !== "function"){
            throw new Error("archiveDoneTasks RPC not wired");
          }
          const n = await PlannerAPI.archiveDoneTasks();
          alert("Готово. В архив перенесено: " + String(n || 0));
          show();
        }catch(err){
          console.warn("[Planner] archive done error", err);
          const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          alert("Ошибка: " + t);
          ad.disabled = false;
        }
      };
      if(rf) rf.onclick = () => show();
}

    function renderBoard(tasks){
      const board = document.getElementById("plBoard");
      if(!board) return;

      const cols = [
        { key:"new", label:"Новые задачи", match: (t) => t.status === "new" },
        { key:"work", label:"В работе", match: (t) => ["taken","in_progress","problem"].includes(t.status) },
        { key:"done", label:"Завершено", match: (t) => t.status === "done" },
      ];

      const colHtml = cols.map(c => {
        const items = tasks.filter(c.match);
        const cards = items.length
          ? items.map(t => {
              const due = dueLabel(t.due_date);
              const isProblem = (String(t.status || "") === "problem");
              const isSel = selectedId && String(selectedId) === String(t.id);
              return `
                <div class="item" data-id="${esc(t.id)}" style="margin-top:10px; ${isProblem ? 'outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 12px 30px rgba(0,0,0,.35);' : ''} ${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
                  <div class="item-title">${esc(t.title || "(без названия)")}</div>
                  <div class="item-meta">${[startLabel(t.start_date), dueLabel(t.due_date), (isOverdue(t) ? "Срок истёк" : ""), urgencyLabel(t.urgency), statusLabel(t.status || "")].filter(Boolean).map(esc).join(" · ")}</div>
                </div>
              `;
            }).join("")
          : `<div class="muted" style="padding:10px 2px; font-size:12px;">Пусто</div>`;

        return `
          <div style="flex:1; min-width:260px; padding:10px 12px; border:1px solid rgba(255,255,255,.10); border-radius:16px;">
            <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px;">
              <div style="font-weight:650;">${esc(c.label)}</div>
              <div class="muted" style="font-size:12px;">${items.length}</div>
            </div>
            ${cards}
          </div>
        `;
      }).join("");

      board.innerHTML = `
        <div style="display:flex; gap:12px; overflow:auto; padding:0 12px 12px 12px;">
          ${colHtml}
        </div>
      `;

      viewerEl.querySelectorAll(".item[data-id]").forEach(card => {
        card.style.cursor = "pointer";
        card.onclick = () => goTask(card.dataset.id);
      });
    }

        async function rpcSetStatus(taskId, newStatus){
    if(!window.PlannerAPI) throw new Error("PlannerAPI missing");
    return await PlannerAPI.setTaskStatus(taskId, newStatus);
  }// Future rail: first real action (checklist/comment/file) should move taken -> in_progress
    async function ensureInProgress(task){
      if(!task) return false;
      const cur = String(task.status || "");
      if(cur === "taken"){
        await rpcSetStatus(task.id, "in_progress");
        return true;
      }
      return false;
    }
    async function fetchChecklistItems(taskId){
    if(!window.PlannerAPI) throw new Error("PlannerAPI missing");
    return await PlannerAPI.fetchChecklistItems(taskId);
  }function renderChecklist(items){
      const host = document.getElementById("plChecklist");
      if(!host) return;

      if(!items || items.length === 0){
        host.innerHTML = `<div class="muted" style="font-size:12px;">Пункты пока не добавлены.</div>`;
        return;
      }

      const doneCount = items.filter(x => !!x.done).length;
      const total = items.length;

      host.innerHTML = `
        <div class="muted" style="font-size:12px; margin-bottom:8px;">${doneCount}/${total} выполнено</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${items.map(it => `
            <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
              <input type="checkbox" class="pl-ci" data-id="${esc(it.id)}" ${it.done ? "checked" : ""} style="margin-top:3px;">
              <span style="${it.done ? "opacity:.75; text-decoration:line-through;" : ""}">${esc(it.text || "(пусто)")}</span>
            </label>
          `).join("")}
        </div>
      `;
    }

    function bindChecklist(task){
      const host = document.getElementById("plChecklist");
      if(!host) return;

      host.querySelectorAll(".pl-ci").forEach(cb => {
        cb.onchange = async () => {
          const id = cb.dataset.id;
          const newDone = !!cb.checked;

          // optimistic disable
          host.querySelectorAll(".pl-ci").forEach(x => x.disabled = true);

          try{
            // auto-progress: taken -> in_progress on first action
            try{
              if(task && String(task.status || "") === "taken"){
                await rpcSetStatus(task.id, "in_progress");
              }
            }catch(e){
              console.warn("[Planner] auto-progress error", e);
            }
            const rpc = await (PlannerAPI.setChecklistDone(id, newDone).then(() => ({ error: null })).catch(error => ({ error })));
            if(rpc && rpc.error) throw rpc.error;

            // If this was the first action, RPC may have bumped task taken -> in_progress.
            // To avoid blinking: reload checklist only, then do a full refresh only if status likely changed.
            const needFull = (String(task.status || "") === "taken");

            if(needFull){
              // local refresh (anti-jitter): status may have changed taken -> in_progress
              const tasks2 = await fetchAllActiveTasks();
              renderLeft(tasks2);

              const sel2 = getSelectedTaskId();
              if(sel2){
                const t2 = tasks2.find(x => String(x.id) === String(sel2));
                if(t2) renderDetails(t2);
              }
            }else{
              const items = await fetchChecklistItems(task.id);
              renderChecklist(items);
              bindChecklist(task);
            }
          }catch(err){
            console.warn("[Planner] checklist toggle error", err);
            const items = await fetchChecklistItems(task.id);
            renderChecklist(items);
            bindChecklist(task);
          }
        };
      });
    }

    async function loadChecklist(task){
      try{
        const items = await fetchChecklistItems(task.id);
        renderChecklist(items);
        bindChecklist(task);
      }catch(err){
        console.warn("[Planner] checklist load error", err);
        const host = document.getElementById("plChecklist");
        if(host){
          const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
          host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки чекбоксов: ${esc(text)}</div>`;
        }
      }
    }
    async function fetchTaskFiles(taskId){
    if(!window.PlannerAPI) throw new Error("PlannerAPI missing");
    return await PlannerAPI.fetchTaskFiles(taskId);
  }function parseInternalDoc(f){
      if(!f) return null;
      if(String(f.bucket_id || "") !== "internal") return null;

      const p = String(f.object_path || "").trim();
      const label = (f.file_name || p);

      // preferred format (same as admin internal links): "#/section/id"
      let m = p.match(/^#\/([^\/]+)\/(.+)$/);
      if(m){
        const section = m[1];
        const id = m[2];
        if(!["articles","checklists","templates"].includes(section)) return null;
        return { section, id, label };
      }

      // fallback: "section/id"
      m = p.match(/^([^\/]+)\/(.+)$/);
      if(m){
        const section = m[1];
        const id = m[2];
        if(!["articles","checklists","templates"].includes(section)) return null;
        return { section, id, label };
      }

      return null;
    }

    async function loadDocs(task){
      const host = document.getElementById("plDocs");
      if(!host) return;
      host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;

      try{
        const files = await fetchTaskFiles(task.id);
        const docs = files.map(parseInternalDoc).filter(Boolean);

        if(docs.length === 0){
          host.innerHTML = `<div class="muted" style="font-size:12px;">Связанных документов нет.</div>`;
          return;
        }

        host.innerHTML = `
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${docs.map(d => `<button class="btn btn-sm pl-doc" data-sec="${esc(d.section)}" data-id="${esc(d.id)}" type="button">${esc(d.label)}</button>`).join("")}
          </div>
        `;

        host.querySelectorAll(".pl-doc").forEach(b => {
          b.onclick = () => Router.go(b.dataset.sec, b.dataset.id);
        });
      }catch(err){
        console.warn("[Planner] docs load error", err);
        const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
        host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки документов: ${esc(text)}</div>`;
      }
    }

    async function fetchComments(taskId){
    if(!window.PlannerAPI) throw new Error("PlannerAPI missing");
    return await PlannerAPI.fetchComments(taskId);
  }function renderComments(task, items){
      const host = document.getElementById("plComments");
      if(!host) return;

      const list = (!items || items.length === 0)
        ? `<div class="muted" style="font-size:12px;">Комментариев пока нет.</div>`
        : `<div style="display:flex; flex-direction:column; gap:10px;">
            ${items.map(c => `
              <div class="item" style="cursor:default;">
                <div class="item-meta" style="font-size:12px;">
                  <span class="muted">${esc(String(c.created_at || "").replace("T"," ").slice(0,16))}</span>
                  ${c.author_id ? `<span class="muted"> · ${esc(String(c.author_id).slice(0,8))}…</span>` : ``}
                </div>
                <div style="margin-top:6px;">${esc(c.body || "")}</div>
              </div>
            `).join("")}
          </div>`;

      host.innerHTML = `
        ${list}
        <div style="margin-top:12px;">
          <textarea id="plCommentInput" rows="3" class="pl-control pl-textarea" placeholder="Напишите комментарий…"></textarea>
          <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
            <button class="btn btn-sm" id="plCommentSend" type="button">Отправить</button>
            <span class="muted" id="plCommentMsg" style="font-size:12px;"></span>
          </div>
        </div>
      `;

      const send = document.getElementById("plCommentSend");
      const inp = document.getElementById("plCommentInput");
      const msg = document.getElementById("plCommentMsg");

      if(send){
        send.onclick = async () => {
          const text = (inp && inp.value) ? inp.value.trim() : "";
          if(!text){ if(msg) msg.textContent = "Пустой комментарий."; return; }

          send.disabled = true;
          if(msg) msg.textContent = "Сохраняю…";

          try{
            // auto-progress: taken -> in_progress on first comment
            try{
              if(task && String(task.status || "") === "taken"){
                await rpcSetStatus(task.id, "in_progress");
              }
            }catch(e){
              console.warn("[Planner] auto-progress error", e);
            }
            const r = await (PlannerAPI.addTaskComment(task.id, text).then(() => ({ error: null })).catch(error => ({ error })));
            if(r && r.error) throw r.error;
            if(inp) inp.value = "";
            if(msg) msg.textContent = "Готово.";
            await loadComments(task);
          }catch(err){
            console.warn("[Planner] add comment error", err);
            const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
            if(msg) msg.textContent = "Ошибка: " + t;
            send.disabled = false;
          }
        };
      }
    }

    async function loadComments(task){
      const host = document.getElementById("plComments");
      if(host) host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;
      try{
        const items = await fetchComments(task.id);
        renderComments(task, items);
      }catch(err){
        console.warn("[Planner] comments load error", err);
        const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
        if(host) host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки комментариев: ${esc(text)}</div>`;
      }
    }
    function renderDetails(task){
      const due = task.due_date ? `<span class="pill">${esc(dueLabel(task.due_date))}</span>` : "";
      const st  = task.status ? `<span class="pill">${esc(statusLabel(task.status))}</span>` : "";

      const cur = String(task.status || "new");
      const overduePill = isOverdue(task) ? `<span class="pill">Срок истёк</span>` : "";
      const isAdmin = (role === "admin");
      const isArchived = !!task.archived_at;
      const archivedPill = isArchived ? `<span class="pill">В архиве</span>` : "";

      const next = [];
      if(cur === "new") next.push(["taken","Взять в работу"]);
      if(cur === "taken") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
      if(cur === "in_progress") next.push(["problem","Возникла проблема"], ["done","Успешно завершена"]);
      if(cur === "problem") next.push(["in_progress","Проблема решена"], ["done","Успешно завершена"]);
      if(isAdmin && cur !== "canceled" && cur !== "done") next.push(["canceled","Отменить задачу"]);

      const archiveBtnHtml = (!isArchived && isAdmin)
        ? `<button class="btn btn-sm" id="plArchiveTask" type="button">Перенести задачу в архив</button>`
        : ``;

      const actionsHtml = (next.length === 0 && !archiveBtnHtml) ? "" : `
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          ${next.map(([s,label]) => `<button class="btn btn-sm pl-status" data-s="${esc(s)}" type="button">${esc(label)}</button>`).join("")}
          ${archiveBtnHtml}
        </div>
        ${next.length > 0 ? `<div class="muted pl-status-msg" style="margin-top:8px; font-size:12px;"></div>` : ``}
      `;
      const urg = urgencyLabel(task.urgency) ? `<span class="pill">${esc(urgencyLabel(task.urgency))}</span>` : "";
      const start = task.start_date ? `<span class="pill">${esc(startLabel(task.start_date))}</span>` : "";
      const detailsProblemStyle = (cur === "problem")
        ? "outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 10px 26px rgba(0,0,0,.35);"
        : "";

      viewerEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px;">
          <div style="font-weight:700; letter-spacing:.08em;">PLANNER</div>
          <button class="btn btn-sm" id="plBack" type="button">Назад</button>
        </div>

        <div class="item" style="cursor:default;">
          <div class="item-title">${esc(task.title || "(без названия)")}</div>
          <div class="item-meta" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            ${start}${due}${overduePill}${archivedPill}${urg}${st}
          </div>
        </div>

        ${actionsHtml}

        <!-- Row 1: core + docs -->
        <div style="display:flex; gap:12px; padding:0 12px; align-items:flex-start; flex-wrap:wrap;">
          <!-- Left: core -->
          <div style="flex:2; min-width:320px;">
            

            <div class="item" style="cursor:default;">
              <div class="item-title">Пункты задачи</div>
              <div class="item-meta" id="plChecklist" style="margin-top:10px;"></div>
            </div>

            <div class="item" style="cursor:default;">
              <div class="item-title">Описание</div>
              <div class="item-meta" style="margin-top:8px;">${task.body ? esc(task.body) : '<span class="muted">Описание пустое.</span>'}</div>
            </div>
          </div>

          <!-- Right: linked docs -->
          <div style="flex:1; min-width:240px;">
            <div class="item" style="cursor:default;">
              <div class="item-title">Документы</div>
              <div class="item-meta" id="plDocs" style="margin-top:10px;"></div>
</div>
          </div>
        </div>

        <!-- Row 2: comments -->
        <div style="padding:0 12px 12px 12px;">
          <div class="item" style="cursor:default;">
            <div class="item-title">Комментарии</div>
            <div class="item-meta" id="plComments" style="margin-top:10px;"></div>
          </div>
        </div>
      `;

      const back = document.getElementById("plBack");
      if(back) back.onclick = (e) => {
        try{ if(e) e.preventDefault(); }catch(_){}
        if(window.Router && Router.go){
          Router.go("planner");
        }else{
          location.hash = "#/planner";
        }
      };
// bind status buttons (RPC)
      viewerEl.querySelectorAll(".pl-status").forEach(btn => {
        btn.onclick = async () => {
          const s = btn.dataset.s;
          const msg = viewerEl.querySelector(".pl-status-msg");

          viewerEl.querySelectorAll(".pl-status").forEach(x => x.disabled = true);
          if(msg) msg.textContent = "Сохраняю…";

          try{
            await rpcSetStatus(task.id, s);
            if(msg) msg.textContent = "Готово.";
            // local refresh (anti-jitter): update list + details without re-mounting full planner
            const tasks2 = await fetchAllActiveTasks();
            renderLeft(tasks2);

            const sel2 = getSelectedTaskId();
            if(sel2){
              const t2 = tasks2.find(x => String(x.id) === String(sel2));
              if(t2) renderDetails(t2);
            }
          }catch(err){
            console.warn("[Planner] set status error", err);
            const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
            if(msg) msg.textContent = "Ошибка: " + text;
            viewerEl.querySelectorAll(".pl-status").forEach(x => x.disabled = false);
          }
        };
      });

      // archive button (admin)
      var _plArchiveBtn = document.getElementById("plArchiveTask");
      if(_plArchiveBtn){
        _plArchiveBtn.onclick = async () => {
          if(!confirm("Перенести задачу в архив?")) return;
          _plArchiveBtn.disabled = true;
          try{
            if(!window.PlannerAPI || typeof PlannerAPI.archiveTask !== "function"){
              throw new Error("archiveTask RPC not wired");
            }
            await PlannerAPI.archiveTask(task.id);
            goTask(null);
          }catch(err){
            console.warn("[Planner] archive task error", err);
            const t = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
            alert("Ошибка: " + t);
            _plArchiveBtn.disabled = false;
          }
        };
      }

      // archived task = read-only
      if(isArchived){
        if(window.PlannerRO && typeof PlannerRO.applyReadOnly === "function"){
          PlannerRO.applyReadOnly(viewerEl);
        }else{
          viewerEl.classList.add("pl-archived");
        viewerEl.querySelectorAll("button, input, textarea, select").forEach(x => { try{ x.disabled = true; }catch(e){} });
        }

        // still render blocks (but no interactions)
        loadChecklist(task);
        loadDocs(task);
        loadComments(task);
        return;
      }
loadChecklist(task);
      loadDocs(task);
      loadComments(task);
    }

    function renderEmpty(){
      renderRightHeader([]);
      const board = document.getElementById("plBoard");
      if(!board) return;

      if(role === "admin"){
        board.innerHTML = `
          <div class="empty" style="text-align:center;">
            <h2>PLANNER пуст.</h2>
            <p>Создайте первую задачу.</p>
            <div style="margin-top:16px;">
              <button class="btn" id="plCreateTask" type="button">Создать задачу</button>
            </div>
          </div>
        `;
      }else{
        board.innerHTML = `
          <div class="empty" style="text-align:center;">
            <div style="font-size:72px;">😎</div>
            <div style="margin-top:12px;">Новых задач нет. Всё разобрали.</div>
          </div>
        `;
      }
    }

    // ---------- FLOW ----------
    const tasks = await fetchAllActiveTasks();

    renderLeft(tasks);

    if(!tasks || tasks.length === 0){
      renderEmpty();
      // [PlannerActions] wireCreateButton: minimal create flow (admin only)
      try{
        if(role === "admin" && window.PlannerActions && typeof PlannerActions.wireCreateButton === "function"){
          PlannerActions.wireCreateButton(() => {
            if(!window.PlannerActions || typeof PlannerActions.openCreateDialog !== "function"){
              alert("Create UI missing");
              return;
            }
            PlannerActions.openCreateDialog({
              onCreate: async (payload) => {
                const created = await PlannerAPI.createTask(payload);
                if(created && created.id){
                  location.hash = "#/planner/" + encodeURIComponent(String(created.id));
                }else{
                  show();
                }
                return created;
              }
            });
          });
        }
      }catch(e){
        console.warn("[Planner] wireCreateButton error", e);
      }

      return;
    }

    if(selectedId){
      const t = tasks.find(x => String(x.id) === String(selectedId));
      if(t) renderDetails(t);
      else {
        // fetchTaskById fallback (archived by direct link, read-only)
        try{
          if(window.PlannerAPI && typeof PlannerAPI.fetchTaskById === "function"){
            const one = await PlannerAPI.fetchTaskById(selectedId, { role, today });
            if(one && one.archived_at){
              renderDetails(one);
              return;
            }
          }
        }catch(err){
          console.warn("[Planner] fetchTaskById fallback error", err);
        }

        renderRightHeader([]);
        const board = document.getElementById("plBoard");
        if(board) board.innerHTML = `<div class="empty"><span class="muted">Задача не найдена или нет доступа.</span></div>`;
      }
    }else{
      renderRightHeader([]);
      renderBoard(tasks);
    }

    try{ console.log("[Planner] tasks", tasks.length, "leftFilter", state.leftFilter); }catch(e){}
  }

  return { show };
})();





















































































