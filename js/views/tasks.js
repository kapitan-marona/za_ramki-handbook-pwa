window.Views = window.Views || {};
Views.Tasks = (() => {
  const $ = (s) => document.querySelector(s);
  const ACK_PREFIX = "tsk:ack:";
  const ARCH_PREFIX = "tsk:arch:";

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function setStatus(t){ const el = $("#status"); if(el) el.textContent = t; }
  function setPanelTitle(t){ const el = $("#panelTitle"); if(el) el.textContent = t; }

  function isAck(id){ return !!localStorage.getItem(ACK_PREFIX + id); }
  function setAck(id){ localStorage.setItem(ACK_PREFIX + id, new Date().toISOString()); }
  function ackAll(items){ (items||[]).forEach(x => x?.id && setAck(x.id)); }

  function isArchivedLocal(id){ return !!localStorage.getItem(ARCH_PREFIX + id); }
  function setArchivedLocal(id){ localStorage.setItem(ARCH_PREFIX + id, new Date().toISOString()); }

  function formatDate(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s||"").trim());
    if(!m) return (s||"");
    return `${m[3]}.${m[2]}.${m[1]}`;
  }

  function urgencyLabel(u){
    const v = (u || "regular").toString().toLowerCase();
    if(v === "urgent") return { text: "Срочно", cls: "accent" };
    return { text: "Регулярно", cls: "" };
  }

  function updateTabBadge(items){
    const btn = document.querySelector('.tab[data-tab="tasks"]');
    if(!btn) return;
    const unread = (items || []).filter(x => x && x.id && !isAck(x.id) && !isArchivedLocal(x.id)).length;
    btn.textContent = unread ? `Задачи (${unread})` : "Задачи";
  }

  async function loadData(){
    const data = await API.json("./content/data/tasks.json");
    const arr = Array.isArray(data) ? data : [];
    return arr
      .filter(x => x && x.id)
      .filter(x => (x.status || "active") === "active")
      .filter(x => !isArchivedLocal(x.id));
  }

  function renderTile(t){
    const unread = !isAck(t.id);
    const urg = urgencyLabel(t.urgency);
    const date = formatDate(t.date || "");

    const who = t.assignee ? `👤 ${t.assignee}` : "";
    const whoTag = who ? `<span class="tag" title="${esc(who)}" style="max-width:190px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(who)}</span>` : "";

    return `
      <a class="item" href="#/tasks/${encodeURIComponent(t.id)}" style="display:block; text-decoration:none;">
        <div class="item-title">${esc(t.title || "Задача")}</div>
        <div class="item-meta" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          ${date ? `<span class="tag">${esc(date)}</span>` : ""}
          ${whoTag}
          <span class="tag ${urg.cls ? "accent" : ""}">${esc(urg.text)}</span>
          ${unread ? `<span class="tag accent">новое</span>` : `<span class="tag">прочитано</span>`}
        </div>
      </a>
    `;
  }

  function renderCard(t){
    const id = t.id || "";
    const title = t.title || "Задача";
    const date = formatDate(t.date || "");
    const assignee = t.assignee || "";
    const urg = urgencyLabel(t.urgency);
    const text = t.text || "";
    const link = t.link || "";
    const image = t.image || "";

    const acked = isAck(id);
    const disabledAck = acked
      ? 'disabled style="opacity:0.5; cursor:not-allowed; background:rgba(120,120,120,0.25); border-color:rgba(120,120,120,0.5);"'
      : '';

    const linkHtml = link
      ? `<p style="margin-top:10px"><a href="${esc(link)}" target="_blank" rel="noopener" style="color:var(--brand-headings)" title="${esc(link)}">🔗 ${esc(link)}</a></p>`
      : "";

    const imgHtml = image
      ? `<div style="margin-top:12px"><img src="${esc(image)}" alt="" style="max-width:100%; border-radius:14px; border:1px solid var(--border)" /></div>`
      : "";

    const textHtml = text
      ? (
          `<div class="markdown" style="opacity:.95; margin-top:10px">` +
          (window.marked ? marked.parse(text) : (`<pre>` + esc(text) + `</pre>`)) +
          `</div>`
        )
      : `<div class="empty" style="margin-top:10px">Нет текста</div>`;

    return `
      <div style="border:1px solid var(--border); border-radius:16px; padding:14px; background: rgba(26,23,20,.55);">
        <div style="display:flex; gap:10px; align-items:flex-start; justify-content:space-between;">
          <div>
            <h1 class="article-title" style="margin:0">${esc(title)}</h1>
            <div class="article-sub" style="margin-top:6px">${esc(date)}</div>
            ${assignee ? `<div class="article-sub">👤 ${esc(assignee)}</div>` : ""}
            <div class="article-sub">⏱ ${esc(urg.text)}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn upd-ack tsk-ack" data-tsk-id="${esc(id)}" title="Принято" ${disabledAck}>
              <span class="dot"></span>👍 Принято
            </button>
            <button class="btn tsk-done" data-tsk-id="${esc(id)}" title="Выполнено">
              <span class="dot"></span>✅ Выполнено
            </button>
          </div>
        </div>
        ${imgHtml}
        ${textHtml}
        ${linkHtml}
      </div>
    `;
  }

  async function show(){
    setPanelTitle("Задачи");
    const list = $("#list");
    const viewer = $("#viewer");
    if(list) list.innerHTML = "";
    if(viewer) viewer.innerHTML = "";

    const items = await loadData();
    setStatus(`${items.length}`);
    updateTabBadge(items);

    const sorted = items.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));

    // LEFT: список всех активных (и прочитанных тоже)
    if(list){
      const top = document.createElement("div");
      top.style.marginBottom = "10px";
      top.innerHTML = `<button class="btn tsk-ack-all" type="button">✅ Отметить всё прочитанным</button>`;
      list.appendChild(top);
      top.querySelector(".tsk-ack-all").onclick = async () => {
        ackAll(sorted);
        await show();
      };

      sorted.forEach(t => {
        const a = document.createElement("a");
        a.className = "item";
        a.href = `#/tasks/${encodeURIComponent(t.id)}`;
        const urg = urgencyLabel(t.urgency);
        const unread = !isAck(t.id);
        const date = formatDate(t.date || "");
        a.innerHTML = `
          <div class="item-title">${esc(t.title || "Задача")}</div>
          <div class="item-meta">
            ${date ? `<span class="tag">${esc(date)}</span>` : ""}
            ${t.assignee ? `<span class="tag">${esc(t.assignee)}</span>` : ""}
            <span class="tag ${urg.cls ? "accent" : ""}">${esc(urg.text)}</span>
            ${unread ? `<span class="tag accent">новое</span>` : `<span class="tag">прочитано</span>`}
          </div>`;
        list.appendChild(a);
      });
    }

    // MAIN: только непрочитанные плитки 3 в ряд
    if(viewer){
      const unread = sorted.filter(x => x && x.id && !isAck(x.id));
      if(!unread.length){
        viewer.innerHTML = `
          <div style="padding:24px; text-align:center;">
            <div style="font-size:72px; line-height:1; margin-bottom:10px;">😎</div>
            <div class="article-title" style="margin:0;">Всё разобрали</div>
            <div class="article-sub" style="margin-top:8px;">Новых задач нет</div>
          </div>
        `;
        return sorted;
      }

      viewer.innerHTML = `
        <div class="article-title" style="margin:0 0 12px 0; font-size:18px;">Новые задачи: ${unread.length}</div>
        <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px;">
          ${unread.map(renderTile).join("")}
        </div>
      `;
    }

    return sorted;
  }

  async function open(id){
    const viewer = $("#viewer");
    const items = await loadData();
    updateTabBadge(items);

    if(!id){
      await show();
      return;
    }

    const t = items.find(x => x.id === id);
    if(!t){
      if(viewer) viewer.innerHTML = `<div class="empty">Задача не найдена.</div>`;
      return;
    }

    if(viewer) viewer.innerHTML = renderCard(t);

    const ackBtn = viewer ? viewer.querySelector(".tsk-ack") : null;
    if(ackBtn && !ackBtn.disabled){
      ackBtn.onclick = async () => {
        setAck(ackBtn.dataset.tskId);
        await show();
        await open(id);
      };
    }

    const doneBtn = viewer ? viewer.querySelector(".tsk-done") : null;
    if(doneBtn){
      doneBtn.onclick = async () => {
        setArchivedLocal(doneBtn.dataset.tskId);
        await show();
      };
    }
  }

  return { show, open };
})();
