window.Views = window.Views || {};
Views.Updates = (() => {
  const $ = (s) => document.querySelector(s);

  const ACK_PREFIX = "upd:ack:";
  const TTL_DAYS_DEFAULT = 3;

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function setStatus(t){ const el = $("#status"); if(el) el.textContent = t; }
  function setPanelTitle(t){ const el = $("#panelTitle"); if(el) el.textContent = t; }

  function isAck(id){ return !!localStorage.getItem(ACK_PREFIX + id); }
  function setAck(id){ localStorage.setItem(ACK_PREFIX + id, new Date().toISOString()); }

  function daysAgo(n){
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0,0,0,0);
    return d;
  }

  function parseDateYYYYMMDD(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || "").trim());
    if(!m) return null;
    const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
    const d = new Date(y, mo, da);
    if(Number.isNaN(d.getTime())) return null;
    d.setHours(0,0,0,0);
    return d;
  }

  function isVisibleByTTL(item){
    const ttl = Number.isFinite(Number(item.ttlDays)) ? Number(item.ttlDays) : TTL_DAYS_DEFAULT;
    const dt = parseDateYYYYMMDD(item.date);
    if(!dt) return true; // нет даты — показываем
    return dt >= daysAgo(ttl);
  }

  function updateTabBadge(items){
    const btn = document.querySelector('.tab[data-tab="updates"]');
    if(!btn) return;
    const unread = (items || []).filter(x => x && x.id && !isAck(x.id)).length;
    btn.textContent = unread ? `Обновления (${unread})` : "Обновления";
  }

  async function loadData(){
    const data = await API.json("./content/data/updates.json");
    const arr = Array.isArray(data) ? data : [];
    return arr.filter(x => x && x.id && isVisibleByTTL(x));
  }

  function renderCard(u){
    const id = u.id || "";
    const title = u.title || "Обновление";
    const date = u.date || "";
    const text = u.text || "";
    const link = u.link || "";
    const image = u.image || "";

    const acked = isAck(id);

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

    const disabledAttrs = acked
      ? 'disabled style="opacity:0.5; cursor:not-allowed; background:rgba(120,120,120,0.25); border-color:rgba(120,120,120,0.5);"'
      : '';

    return `
      <div style="border:1px solid var(--border); border-radius:16px; padding:14px; background: rgba(26,23,20,.55);">
        <div style="display:flex; gap:10px; align-items:flex-start; justify-content:space-between;">
          <div>
            <h1 class="article-title" style="margin:0">${esc(title)}</h1>
            <div class="article-sub" style="margin-top:6px">${esc(date)}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn upd-ack" data-upd-id="${esc(id)}" title="Принято" ${disabledAttrs}>
              <span class="dot"></span>👍 Принято
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
    if(list) list.innerHTML = "";
    if(viewer) viewer.innerHTML = `<div class="empty">Выберите обновление слева.</div>`;

    const items = await loadData();
    setStatus(`${items.length}`);
    updateTabBadge(items);

    const sorted = items.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));

    if(list){
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
    }

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
        if(viewer) viewer.innerHTML = `<div class="empty">Пока нет обновлений.</div>`;
        return;
      }
      id = pick.id;
    }

    const u = items.find(x => x.id === id);
    if(!u){
      if(viewer) viewer.innerHTML = `<div class="empty">Обновление не найдено (возможно, истёк срок показа).</div>`;
      return;
    }

    if(viewer) viewer.innerHTML = renderCard(u);

    const ackBtn = viewer ? viewer.querySelector(".upd-ack") : null;
    if(ackBtn && !ackBtn.disabled){
      ackBtn.onclick = async () => {
        const updId = ackBtn.dataset.updId;
        setAck(updId);
        await show();
        await open(updId);
      };
    }
  }

  return { show, open };
})();
