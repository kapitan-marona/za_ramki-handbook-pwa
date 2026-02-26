window.Views = window.Views || {};
Views.Checklists = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  let _data = [];
  let _q = "";

  function setStatus(t){ $("#status").textContent = t; }
  function setPanelTitle(t){ $("#panelTitle").textContent = t; }

  function norm(s){ return (s ?? "").toString().toLowerCase(); }

  function renderList(){
    const list = $("#list");
    const viewer = $("#viewer");
    list.innerHTML = "";
    viewer.innerHTML = `<div class="empty">Выберите чек-лист слева.</div>`;

    const q = norm(_q).trim();
    const items = Array.isArray(_data) ? _data : [];
    const filtered = !q ? items : items.filter(x => {
      const t = norm(x.title);
      const d = norm(x.desc);
      const u = norm(x.url);
      const tags = Array.isArray(x.tags) ? norm(x.tags.join(" ")) : "";
      return (t.includes(q) || d.includes(q) || u.includes(q) || tags.includes(q));
    });

    setStatus(`${filtered.length}`);

    filtered.forEach((c) => {
      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/${encodeURIComponent("checklists")}/${encodeURIComponent(c.id || "")}`;
      a.innerHTML = `
        <div class="item-title">${esc(c.title || "Чек-лист")}</div>
        <div class="item-meta">
          ${c.tags && c.tags.length ? `<span class="tag">${esc(c.tags.join(", "))}</span>` : ""}
          <span class="tag accent">открыть</span>
        </div>`;
      list.appendChild(a);
    });
  }

  async function show(){
    setPanelTitle("Чек-листы");
    _data = await API.json("./content/data/checklists.json");
    renderList();
  }

  async function open(id){
    const viewer = $("#viewer");
    const item = (Array.isArray(_data) ? _data : []).find(x => (x.id || "") === (id || ""));
    if(!item){
      viewer.innerHTML = `<div class="empty">Чек-лист не найден.</div>`;
      return;
    }

    const url = (item.url || "").toString().trim();
    viewer.innerHTML = `
      <h1 class="article-title">${esc(item.title || "Чек-лист")}</h1>
      ${item.desc ? `<p class="article-sub">${esc(item.desc)}</p>` : `<p class="article-sub">Откроется в новой вкладке.</p>`}
      <div class="actions">
        ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener"><span class="dot"></span>Открыть чек-лист</a>` : ""}
      </div>
      ${url ? `<div class="hr"></div><div class="muted">Ссылка: <span class="mono">${esc(url)}</span></div>` : ""}
    `;
  }

  function setFilter(q){
    _q = (q ?? "").toString();
    renderList();
  }

  return { show, open, setFilter };
})();
