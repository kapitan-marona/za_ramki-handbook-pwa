window.Views = window.Views || {};
Views.Articles = (() => {
  console.log("[ARTICLES_BUILD] 2026-03-10 STEP1-2");
  const $ = (s) => document.querySelector(s);

  let INDEX = [];
  let FILTER = "";
  let CATMAP = {};
  const INS_LAST_HASH_KEY = "zr_ins_last_hash";
  const INS_RETURN_HASH_KEY = "zr_ins_return_hash";

  function getCurrentHash(){
    return String(location.hash || "");
  }

  function isArticleHash(hash){
    return /^#\/articles(?:\/|$)/.test(String(hash || ""));
  }

  function isArticleDetailHash(hash){
    return /^#\/articles\/[^\/]+/.test(String(hash || ""));
  }

  function isPlannerTaskHash(hash){
    return /^#\/planner\/[^\/]+/.test(String(hash || ""));
  }

  function installInstructionContextTracker(){
    try{
      if(window.__zrInstructionContextTrackerInstalled) return;
      window.__zrInstructionContextTrackerInstalled = true;

      if(window.ViewerNav && typeof ViewerNav.installTracker === "function"){
        ViewerNav.installTracker({
          lastKey: INS_LAST_HASH_KEY,
          returnKey: INS_RETURN_HASH_KEY,
          isDetailHash: isArticleDetailHash,
          isListHash: function(hash){
            return String(hash || "") === "#/articles";
          }
        });
      }
    }catch(e){}
  }

  function getInstructionReturnHash(){
    try{
      if(window.ViewerNav && typeof ViewerNav.getReturnHash === "function"){
        return ViewerNav.getReturnHash(INS_RETURN_HASH_KEY) || "#/articles";
      }
    }catch(e){}
    return "#/articles";
  }

  function getInstructionCloseLabel(){
    try{
      if(window.ViewerNav && typeof ViewerNav.getCloseLabel === "function"){
        return ViewerNav.getCloseLabel(getInstructionReturnHash());
      }
    }catch(e){}
    return isPlannerTaskHash(getInstructionReturnHash()) ? "К задаче" : "Закрыть";
  }

  function goInstructionClose(){
    const target = getInstructionReturnHash();

    try{
      if(window.ViewerNav && typeof ViewerNav.goClose === "function"){
        ViewerNav.goClose(target, "articles");
        return;
      }
    }catch(e){}

    location.hash = isPlannerTaskHash(target) ? target : "#/articles";
  }

  installInstructionContextTracker();
  function esc(str){
    return (str ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function norm(s){ return (s ?? "").toString().toLowerCase().trim(); }

  function parseUpdatedAt(meta){
    const v = meta?.updatedAt || meta?.updated_at || "";
    if(!v) return null;

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim());
    if(m){
      const y = parseInt(m[1],10), mo = parseInt(m[2],10)-1, d = parseInt(m[3],10);
      return new Date(y, mo, d, 0, 0, 0, 0);
    }

    const t = Date.parse(String(v));
    if(Number.isFinite(t)) return new Date(t);
    return null;
  }

  function isNewWindowActive(meta, days=7){
    const dt = parseUpdatedAt(meta);
    if(!dt) return false;
    const ms = days * 24 * 60 * 60 * 1000;
    return (Date.now() - dt.getTime()) <= ms;
  }

  function applyInlineNewMarkers(md, active){
    md = (md ?? "").toString();

    if(active){
      md = md.replace(/>([^<\r\n]+)</g, '<mark class="kb-newmark">$1</mark>');
      md = md.replace(/&gt;([^&\r\n]+)&lt;/g, '<mark class="kb-newmark">$1</mark>');
    }else{
      md = md.replace(/>([^<\r\n]+)</g, '$1');
      md = md.replace(/&gt;([^&\r\n]+)&lt;/g, '$1');
    }

    return md;
  }

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
      const isNew = isNewWindowActive(it, 7);
      const badge = isNew ? `<span class="kb-updated-badge">обновлено</span>` : "";
      const catTitle = CATMAP[it.category] || it.category || "";
      const cat = catTitle ? `<span class="tag accent">${esc(catTitle)}</span>` : "";
      const tags = (it.tags||[]).slice(0,4).map(t => `<span class="tag">${esc(t)}</span>`).join("");
      const roles = (it.roles||[]).slice(0,2).map(r => `<span class="tag">${esc(r)}</span>`).join("");

      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/${encodeURIComponent("articles")}/${encodeURIComponent(it.id)}`;
      a.innerHTML = `
        <div class="item-title">${esc(it.title)}${badge}</div>
        <div class="item-meta">${cat}${tags}${roles}</div>
      `;
      list.appendChild(a);
    }
  }

  function normalizeMd(md){
    md = (md ?? "").toString();
    if(md.includes("\\n") || md.includes("\\r\\n")){
      md = md.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
    }
    return md;
  }

  function decorateCallouts(html){
    if(!html) return html;

    const rules = [
      { re: /<blockquote>\s*<p>\s*(?:<strong>)?\s*Важно:\s*(?:<\/strong>)?\s*/gi,
        cls: "kb-important", title: "☝️ ВАЖНО" },

      { re: /<blockquote>\s*<p>\s*(?:<strong>)?\s*(Нельзя|Осторожно):\s*(?:<\/strong>)?\s*/gi,
        cls: "kb-caution", title: "❌ ОСТОРОЖНО" },

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

  function slugify(s){
    return (s ?? "")
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]+/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  function setupArticleToc(viewer){
    if(!viewer) return;

    const mdRoot = viewer.querySelector(".markdown");
    if(!mdRoot) return;

    const h2s = Array.from(mdRoot.querySelectorAll("h2"));
    if(!h2s.length) return;

    const used = new Set();
    h2s.forEach((h, idx) => {
      let id = h.getAttribute("id");
      if(!id){
        id = slugify(h.textContent) || ("h2-" + (idx+1));
      }
      let base = id, n = 2;
      while(used.has(id)) id = base + "-" + (n++);
      used.add(id);
      h.setAttribute("id", id);
    });

    const toc = document.createElement("aside");
    toc.className = "article-toc";
    toc.innerHTML = `
      <button class="btn zr-toc-toggle" type="button" aria-expanded="true" title="Свернуть оглавление">→</button>
      <div class="article-toc-title">В этой инструкции</div>
      <nav class="article-toc-list">
        ${h2s.map(h => `<a href="#${h.id}" data-toc="${h.id}">${esc(h.textContent || "")}</a>`).join("")}
      </nav>
    `;

    const layout = document.createElement("div");
    layout.className = "article-layout";

    const main = document.createElement("div");
    main.className = "article-main";

    Array.from(viewer.childNodes).forEach(n => main.appendChild(n));
    layout.appendChild(main);
    layout.appendChild(toc);
    viewer.appendChild(layout);

    const toggleBtn = toc.querySelector(".zr-toc-toggle");
    if(toggleBtn){
      const syncToggleState = () => {
        const collapsed = layout.classList.contains("zr-toc-collapsed");
        toggleBtn.textContent = collapsed ? "←" : "→";
        toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        toggleBtn.setAttribute("title", collapsed ? "Развернуть оглавление" : "Свернуть оглавление");
      };

      toggleBtn.addEventListener("click", () => {
        layout.classList.toggle("zr-toc-collapsed");
        syncToggleState();
      });

      if(window.innerWidth <= 960){
        layout.classList.add("zr-toc-collapsed");
      }

      syncToggleState();
    }

    toc.querySelectorAll("[data-toc]").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const id = a.getAttribute("data-toc");
        const target = mdRoot.querySelector("#" + CSS.escape(id));
        if(!target) return;
        viewer.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "smooth" });
      });
    });

    const links = new Map();
    toc.querySelectorAll("[data-toc]").forEach(a => links.set(a.getAttribute("data-toc"), a));

    let activeId = "";
    const setActive = (id) => {
      if(!id || id === activeId) return;
      activeId = id;
      links.forEach((el, key) => el.classList.toggle("is-active", key === id));
    };

    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(en => en.isIntersecting)
        .sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if(visible.length){
        setActive(visible[0].target.getAttribute("id"));
      }
    }, {
      root: viewer,
      threshold: [0.01, 0.1],
      rootMargin: "-10% 0px -70% 0px"
    });

    h2s.forEach(h => io.observe(h));
    setActive(h2s[0].getAttribute("id"));
  }

  function enhanceArticleWithToc(viewer){
    const old = viewer.querySelector(".article-layout");
    if(old){
      const main = old.querySelector(".article-main");
      if(main){
        viewer.innerHTML = "";
        Array.from(main.childNodes).forEach(n => viewer.appendChild(n));
      }else{
        old.remove();
      }
    }
    setupArticleToc(viewer);
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

  function formatMetaDate(value){
    try{
      if(window.ViewerNav && typeof ViewerNav.formatDMY === "function"){
        return ViewerNav.formatDMY(value);
      }
    }catch(e){}
    return String(value || "").trim();
  }

  function renderMetaRow(meta){
    const author =
      meta?.author ||
      meta?.author_name ||
      meta?.created_by_name ||
      meta?.created_by ||
      "";

    const created =
      meta?.createdAt ||
      meta?.created_at ||
      "";

    const updated =
      meta?.updatedAt ||
      meta?.updated_at ||
      "";

    const linked =
      meta?.linkedFrom ||
      meta?.linked_from ||
      "";

    const parts = [];

    if(author)  parts.push(`<span class="tag">Автор: ${esc(String(author))}</span>`);
    if(created) parts.push(`<span class="tag">Создано: ${esc(formatMetaDate(created))}</span>`);
    if(updated) parts.push(`<span class="tag">Обновлено: ${esc(formatMetaDate(updated))}</span>`);
    if(linked)  parts.push(`<span class="tag">Связано с: ${esc(String(linked))}</span>`);

    return parts.join("");
  }

  function goArticlesList(){
    try{
      if(window.Router && typeof Router.go === "function"){
        Router.go("articles");
        return;
      }
    }catch(e){}
    location.hash = "#/articles";
  }

  function setupArticleBodyCollapse(viewer){
    if(!viewer) return;

    const section = viewer.querySelector('[data-ins-section="body"]');
    if(!section) return;

    const markdown = section.querySelector(".markdown");
    if(!markdown) return;

    const oldControls = section.querySelector('[data-ins-collapse="controls"]');
    if(oldControls) oldControls.remove();

    markdown.style.maxHeight = "";
    markdown.style.overflow = "";
    markdown.style.position = "";

    const limit = 520;
    const fullHeight = markdown.scrollHeight || 0;
    if(fullHeight <= limit) return;

    let expanded = false;

    markdown.style.maxHeight = limit + "px";
    markdown.style.overflow = "hidden";
    markdown.style.position = "relative";

    const controls = document.createElement("div");
    controls.setAttribute("data-ins-collapse","controls");
    controls.style.marginTop = "12px";
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.gap = "8px";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm";
    btn.textContent = "Показать полностью";

    btn.onclick = () => {
      expanded = !expanded;

      if(expanded){
        markdown.style.maxHeight = "";
        markdown.style.overflow = "";
        btn.textContent = "Свернуть";
      }else{
        markdown.style.maxHeight = limit + "px";
        markdown.style.overflow = "hidden";
        btn.textContent = "Показать полностью";
        try{
          section.scrollIntoView({ block:"start", behavior:"smooth" });
        }catch(e){}
      }
    };

    controls.appendChild(btn);
    section.appendChild(controls);
  }

  async function openArticle(id){
    const viewer = $("#viewer"); if(viewer) viewer.scrollTop = 0;

    if(!id){
      viewer.innerHTML = `
        <div class="empty">
          Выбери статью слева или используй поиск сверху.<br/><br/>
          Подсказка: позже добавим роли, избранное и «что нового».
        </div>`;
      enhanceArticleWithToc(viewer);
      return;
    }

    const meta = INDEX.find(x => x.id === id);
    if(!meta){
      viewer.innerHTML = `<div class="empty">Статья не найдена: <b>${esc(id)}</b></div>`;
      enhanceArticleWithToc(viewer);
      return;
    }

    setStatus("открываю…");

    let md = "";

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

    if(!md && meta.path){
      try{
        md = await API.text(meta.path);
      }catch(e){
        console.error("File open error:", e);
      }
    }

    if(!md){
      viewer.innerHTML = `<div class="empty">Не удалось загрузить статью</div>`;
      enhanceArticleWithToc(viewer);
      setStatus("ошибка");
      return;
    }

    md = normalizeMd(md);
    const inlineNewActive = isNewWindowActive(meta, 7) && !!meta.hasInlineNew;
    md = applyInlineNewMarkers(md, inlineNewActive);
    const catTitle = CATMAP[meta.category] || meta.category || "";
    const cat = catTitle ? `<span class="tag accent">${esc(catTitle)}</span>` : "";
    const tags = (meta.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    const roles = (meta.roles||[]).map(r => `<span class="tag">${esc(r)}</span>`).join("");
    const updated = meta.updatedAt ? `Обновлено: ${esc(formatMetaDate(meta.updatedAt))}` : "";

    const html0 = window.marked ? window.marked.parse(md) : `<pre>${esc(md)}</pre>`;
    const html = decorateCallouts(html0);
    viewer.innerHTML = `
      <div class="item" data-ins-section="header" style="cursor:default; margin-bottom:12px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <h1 class="article-title">${esc(meta.title)}</h1>
            <p class="article-sub">${esc(updated)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-sm" id="insBackBtn" type="button">Закрыть</button>
          </div>
        </div>
      </div>

      <div class="item" data-ins-section="meta" style="cursor:default; margin-bottom:12px;">
        <div class="item-meta">${renderMetaRow(meta)}${cat}${tags}${roles}</div>
      </div>

      <div class="item" data-ins-section="body" style="cursor:default; margin-bottom:12px;">
        <div class="markdown">${html}</div>
      </div>

      <div class="item" data-ins-section="resources" style="cursor:default;">
        <div class="item-title">Ресурсы</div>
        <div class="item-meta" style="margin-top:10px;">${renderActions(meta.actions)}</div>
      </div>
    `;
    const backBtn = document.getElementById("insBackBtn");
    if(backBtn){
      backBtn.textContent = getInstructionCloseLabel();
      backBtn.onclick = () => goInstructionClose();
    }
    setupArticleBodyCollapse(viewer);
    enhanceArticleWithToc(viewer);
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
      hasInlineNew: !!it.hasInlineNew,
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
      .select("id,title,category,tags,roles,updated_at,pinned,actions,status,has_inline_new")
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
      hasInlineNew: !!r.has_inline_new,
      source: "sb"
    }));
  }

  async function init(){
    try{
      const cats = await API.json("./content/ui/categories.json");
      CATMAP = Object.fromEntries(cats.map(c => [c.id, c.title]));
    }catch(e){ CATMAP = {}; }

    let fileItems = [];
    try{
      fileItems = await loadFileIndex();
    }catch(e){
      console.warn("File index load failed:", e);
      fileItems = [];
    }

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

    const map = new Map();
    for(const it of fileItems){
      map.set(it.id, it);
    }
    for(const it of sbItems){
      const prev = map.get(it.id);
      if(prev && prev.path && !it.path) it.path = prev.path;
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
