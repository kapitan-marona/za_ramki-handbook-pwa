window.Views = window.Views || {};
Views.Updates = (() => {
  const $ = (s) => document.querySelector(s);

  const ACK_PREFIX = "upd:ack:";
  const LIKE_PREFIX = "upd:like:";

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function setStatus(t){ $("#status").textContent = t; }
  function setPanelTitle(t){ $("#panelTitle").textContent = t; }

  function isAck(id){ return !!localStorage.getItem(ACK_PREFIX + id); }
  function setAck(id){ localStorage.setItem(ACK_PREFIX + id, new Date().toISOString()); }

  function isLiked(id){ return !!localStorage.getItem(LIKE_PREFIX + id); }
  function toggleLike(id){
    const k = LIKE_PREFIX + id;
    if(localStorage.getItem(k)) localStorage.removeItem(k);
    else localStorage.setItem(k, "1");
  }

  function updateTabBadge(items){
    const btn = document.querySelector('.tab[data-tab="updates"]');
    if(!btn) return;
    const unread = (items || []).filter(x => x && x.id && !isAck(x.id)).length;
    btn.textContent = unread ? `Обновления (${unread})` : "Обновления";
  }

  async function loadData(){
    const data = await API.json("./content/data/updates.json");
    return Array.isArray(data) ? data : [];
  }

  function renderCard(u){
    const id = u.id || "";
    const title = u.title || "Обновление";
    const date = u.date || "";
    const text = u.text || "";
    const link = u.link || "";
    const image = u.image || "";

    const acked = isAck(id);
    const liked = isLiked(id);

    const linkHtml = link
      ? `<p style="margin-top:10px"><a href="${esc(link)}" target="_blank" rel="noopener" style="color:var(--brand-headings)" title="${esc(link)}">🔗 ${esc(link)}</a></p>`
      : "";

    const imgHtml = image
      ? `<div style="margin-top:12px">
           <img src="${esc(image)}" alt="" style="max-width:100%; border-radius:14px; border:1px solid var(--border)" />
         </div>`
      : "";

    const textHtml = text
      ? `<div class="markdown" style="opacity:.95; margin-top:10px">${window.marked ? marked.parse(text) : `<pre>${esc(text)}</pre>`}</div>`
      : `<div class="empty" style="margin-top:10px">Нет текста</div>`;

    return `
      <div style="border:1px solid var(--border); border-radius:16px; padding:14px; background: rgba(26,23,20,.55);">
        <div style="display:flex; gap:10px; align-items:flex-start; justify-content:space-between;">
          <div>
            <h1 class="article-title" style="margin:0">${esc(title)}</h1>
            <div class="article-sub" style="margin-top:6px">${esc(date)}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn upd-like" data-upd-id="${esc(id)}" title="Лайк">
              <span class="dot"></span>${liked ? "👍 Убрано" : "👍 Лайк"}
            </button>
            <button class="btn upd-ack" data-upd-id="${esc(id)}" title="Принято">
              <span class="dot"></span>${acked ? "✅ Принято" : "✅ Принять"}
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
    setPanelTitle("Обновления");
    const list = $("#list");
    const viewer = $("#viewer");
    list.innerHTML = "";
    viewer.innerHTML = `<div class="empty">Выберите обновление слева.</div>`;

    const items = await loadData();
    setStatus(`${items.length}`);
    updateTabBadge(items);

    // newest first (if date exists)
    const sorted = items.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));

    sorted.forEach((u) => {
      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/${encodeURIComponent("updates")}/${encodeURIComponent(u.id)}`;

      const unread = u.id && !isAck(u.id);
      a.innerHTML = `
        <div class="item-title">${esc(u.title || "Обновление")}</div>
        <div class="item-meta">
          ${u.date ? `<span class="tag">${esc(u.date)}</span>` : ""}
          ${unread ? `<span class="tag accent">новое</span>` : `<span class="tag">прочитано</span>`}
        </div>`;
      list.appendChild(a);
    });

    return sorted;
  }

  async function open(id){
    const viewer = $("#viewer");
    const items = await loadData();
    updateTabBadge(items);

    if(!id){
      const sorted = items.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
      const pick = sorted.find(x => x && x.id && !isAck(x.id)) || sorted[0];
      if(!pick){
        viewer.innerHTML = `<div class="empty">Пока нет обновлений.</div>`;
        return;
      }
      id = pick.id;
    }

    const u = items.find(x => x.id === id);
    if(!u){
      viewer.innerHTML = `<div class="empty">Обновление не найдено.</div>`;
      return;
    }

    viewer.innerHTML = renderCard(u);

    const ackBtn = viewer.querySelector(".upd-ack");
    const likeBtn = viewer.querySelector(".upd-like");

    if(ackBtn){
      ackBtn.onclick = async () => {
        const updId = ackBtn.dataset.updId;
        setAck(updId);
        await show();
        await open(updId);
      };
    }

    if(likeBtn){
      likeBtn.onclick = async () => {
        const updId = likeBtn.dataset.updId;
        toggleLike(updId);
        await show();
        await open(updId);
      };
    }
  }

  return { show, open };
})();
