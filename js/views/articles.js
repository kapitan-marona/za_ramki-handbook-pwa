window.Views = window.Views || {};
Views.Articles = (() => {
  const $ = (s) => document.querySelector(s);

  let INDEX = [];
  let FILTER = "";
  let CATMAP = {};

  function esc(str){
    return (str ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function norm(s){ return (s ?? "").toString().toLowerCase().trim(); }

  function setStatus(t){ $("#status").textContent = t; }
  function setPanelTitle(t){ $("#panelTitle").textContent = t; }

  function matches(it, q){
    if(!q) return true;
    const hay = [
      it.title,
      CATMAP[it.category] || it.category,
      ...(it.tags||[]),
      ...(it.roles||[])
    ].map(norm).join(" | ");
    return hay.includes(q);
  }

  function renderList(){
    const list = $("#list");
    list.innerHTML = "";
    setPanelTitle("Статьи");

    const q = norm(FILTER);
    const items = INDEX.filter(it => matches(it, q));
    setStatus(`${items.length} / ${INDEX.length}`);

    if(items.length === 0){
      list.innerHTML = `<div class="empty" style="padding:12px;color:var(--muted)">Ничего не найдено.</div>`;
      return;
    }

    for(const it of items){
      const catTitle = CATMAP[it.category] || it.category || "";
      const cat = catTitle ? `<span class="tag accent">${esc(catTitle)}</span>` : "";
      const tags = (it.tags||[]).slice(0,4).map(t => `<span class="tag">${esc(t)}</span>`).join("");
      const roles = (it.roles||[]).slice(0,2).map(r => `<span class="tag">${esc(r)}</span>`).join("");

      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/${encodeURIComponent("articles")}/${encodeURIComponent(it.id)}`;
      a.innerHTML = `
        <div class="item-title">${esc(it.title)}</div>
        <div class="item-meta">${cat}${tags}${roles}</div>
      `;
      list.appendChild(a);
    }
  }

  function renderActions(actions){
    if(!actions || !actions.length) return "";
    const btns = actions.map(a => {
      const label = esc(a.label || "Открыть");
      const url = esc(a.url || "#");
      const target = a.external ? `target="_blank" rel="noopener"` : "";
      return `<a class="btn" href="${url}" ${target}><span class="dot"></span>${label}</a>`;
    }).join("");
    return `<div class="actions">${btns}</div>`;
  }

  async function openArticle(id){
    const viewer = $("#viewer");
    if(!id){
      viewer.innerHTML = `
        <div class="empty">
          Выбери статью слева или используй поиск сверху.<br/><br/>
          Подсказка: позже добавим роли, избранное и «что нового».
        </div>`;
      return;
    }

    const meta = INDEX.find(x => x.id === id);
    if(!meta){
      viewer.innerHTML = `<div class="empty">Статья не найдена: <b>${esc(id)}</b></div>`;
      return;
    }

    setStatus("открываю…");
    const md = await API.text(meta.path);

    const catTitle = CATMAP[meta.category] || meta.category || "";
    const cat = catTitle ? `<span class="tag accent">${esc(catTitle)}</span>` : "";
    const tags = (meta.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    const roles = (meta.roles||[]).map(r => `<span class="tag">${esc(r)}</span>`).join("");
    const updated = meta.updatedAt ? `Обновлено: ${esc(meta.updatedAt)}` : "";

    const html = window.marked ? window.marked.parse(md) : `<pre>${esc(md)}</pre>`;

    viewer.innerHTML = `
      <h1 class="article-title">${esc(meta.title)}</h1>
      <p class="article-sub">${esc(updated)}</p>
      <div class="item-meta" style="margin-bottom:10px">${cat}${tags}${roles}</div>
      ${renderActions(meta.actions)}
      <div class="hr"></div>
      <div class="markdown">${html}</div>
    `;
    setStatus("готово");
  }

  async function init(){
    // categories labels
    try{
      const cats = await API.json("./content/ui/categories.json");
      CATMAP = Object.fromEntries(cats.map(c => [c.id, c.title]));
    }catch(e){ CATMAP = {}; }

    const data = await API.json("./content/index.json");
    INDEX = (data.items || []).slice().sort((a,b) =>
      (b.pinned===true)-(a.pinned===true) || (b.updatedAt||"").localeCompare(a.updatedAt||"")
    );
  }

  return {
    async show(param){
      await init();
      renderList();
      await openArticle(param || "");
    },
    setFilter(q){
      FILTER = q || "";
      renderList();
    }
  };
})();
