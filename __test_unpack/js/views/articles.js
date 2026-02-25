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

  function normalizeMd(md){
    md = (md ?? "").toString();
    // Если в базе/файле текст попал как строка с буквальными "\n"
    if(md.includes("\\n") || md.includes("\\r\\n")){
      md = md.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
    }
    return md;
  }

  function decorateCallouts(html){
    if(!html) return html;

    const rules = [
      // > **Важно:** ...  или  > Важно: ...
      { re: /<blockquote>\s*<p>\s*(?:<strong>)?\s*Важно:\s*(?:<\/strong>)?\s*/gi,
        cls: "kb-important", title: "☝️ ВАЖНО" },

      { re: /<blockquote>\s*<p>\s*(?:<strong>)?\s*(Нельзя|Осторожно):\s*(?:<\/strong>)?\s*/gi,
        cls: "kb-caution", title: "❌ ОСТОРОЖНО" },

      { re: /<blockquote>\s*<p>\s*(?:<strong>)?\s*Недавнее:\s*(?:<\/strong>)?\s*/gi,
        cls: "kb-recent", title: "🕒 НЕДАВНЕЕ" },

      { re: /<blockquote>\s*<p>\s*(?:<strong>)?\s*Не забудь:\s*(?:<\/strong>)?\s*/gi,
        cls: "kb-remember", title: "✨ НЕ ЗАБУДЬ" },
    ];

    for(const r of rules){
      html = html.replace(
        r.re,
        `<blockquote class="kb-callout ${r.cls}"><p><span class="kb-callout-title">${r.title}</span> `
      );
    }

    return html;
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

    let md = "";

    // 1) Supabase приоритет
    if(meta.source === "sb"){
      if(window.SB){
        const { data, error } = await SB
          .from("kb_articles")
          .select("content_md,actions,updated_at,category,tags,roles,title")
          .eq("id", id)
          .single();

        if(!error && data){
          md = data.content_md || "";
          meta.title = meta.title || data.title;
          meta.category = meta.category || data.category;
          meta.tags = (meta.tags && meta.tags.length) ? meta.tags : (data.tags || []);
          meta.roles = (meta.roles && meta.roles.length) ? meta.roles : (data.roles || []);
          meta.updatedAt = meta.updatedAt || data.updated_at;
          meta.actions = (meta.actions && meta.actions.length) ? meta.actions : (data.actions || []);
        } else {
          console.error("KB open error:", error);
        }
      }
    }

    // 2) fallback на файлы
    if(!md && meta.path){
      try{
        md = await API.text(meta.path);
      }catch(e){
        console.error("File open error:", e);
      }
    }

    if(!md){
      viewer.innerHTML = `<div class="empty">Не удалось загрузить статью</div>`;
      setStatus("ошибка");
      return;
    }

    md = normalizeMd(md);

    const catTitle = CATMAP[meta.category] || meta.category || "";
    const cat = catTitle ? `<span class="tag accent">${esc(catTitle)}</span>` : "";
    const tags = (meta.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    const roles = (meta.roles||[]).map(r => `<span class="tag">${esc(r)}</span>`).join("");
    const updated = meta.updatedAt ? `Обновлено: ${esc(meta.updatedAt)}` : "";

    const html0 = window.marked ? window.marked.parse(md) : `<pre>${esc(md)}</pre>`;
    const html = decorateCallouts(html0);

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

  function sortItems(items){
    return items.sort((a,b) => {
      const ap = !!a.pinned, bp = !!b.pinned;
      if(ap !== bp) return ap ? -1 : 1;
      const ad = (a.updatedAt || "").toString();
      const bd = (b.updatedAt || "").toString();
      if(ad !== bd) return ad > bd ? -1 : 1;
      return (a.title || "").localeCompare(b.title || "");
    });
  }

  async function loadFileIndex(){
    const raw = await API.json("./content/index.json");
    const items = Array.isArray(raw?.items) ? raw.items : [];
    return items.map(it => ({
      id: it.id,
      title: it.title,
      category: it.category,
      tags: it.tags || [],
      roles: it.roles || [],
      updatedAt: it.updatedAt,
      pinned: !!it.pinned,
      path: it.path,
      actions: it.actions || [],
      source: "file"
    }));
  }

  async function loadSbIndex(){
    if(!window.SB) throw new Error("Supabase not ready");

    const { data, error } = await SB
      .from("kb_articles")
      .select("id,title,category,tags,roles,updated_at,pinned,actions,status")
      .eq("status","published")
      .order("pinned",{ ascending:false })
      .order("updated_at",{ ascending:false });

    if(error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      tags: r.tags || [],
      roles: r.roles || [],
      updatedAt: r.updated_at,
      pinned: !!r.pinned,
      actions: r.actions || [],
      source: "sb"
    }));
  }

  async function init(){
    // categories labels (optional)
    try{
      const cats = await API.json("./content/ui/categories.json");
      CATMAP = Object.fromEntries(cats.map(c => [c.id, c.title]));
    }catch(e){ CATMAP = {}; }

    // 1) файловый индекс (надёжный fallback)
    let fileItems = [];
    try{
      fileItems = await loadFileIndex();
    }catch(e){
      console.warn("File index load failed:", e);
      fileItems = [];
    }

    // 2) Supabase; если не получилось или пусто — остаёмся на файлах
    let sbItems = [];
    try{
      sbItems = await loadSbIndex();
    }catch(e){
      console.warn("Supabase index load failed:", e);
      sbItems = [];
    }

    if(!sbItems.length){
      INDEX = sortItems(fileItems);
      return;
    }

    // 3) merge без дублей: Supabase приоритет по id
    const map = new Map();
    for(const it of fileItems){
      map.set(it.id, it);
    }
    for(const it of sbItems){
      const prev = map.get(it.id);
      if(prev && prev.path && !it.path) it.path = prev.path; // запасной fallback
      map.set(it.id, it);
    }

    INDEX = sortItems(Array.from(map.values()));
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
