window.Views = window.Views || {};
Views.Articles = (() => {
  console.log("[ARTICLES_BUILD] 2026-03-10 STEP1-2");
  const $ = (s) => document.querySelector(s);

  let INDEX = [];
  let FILTER = "";
  let CATMAP = {};
  const INS_LAST_HASH_KEY = "zr_ins_last_hash";
  const INS_RETURN_HASH_KEY = "zr_ins_return_hash";
  const INS_TOC_STATE_KEY = "zr_articles_toc_collapsed";
  const INS_SCROLL_KEY = "zr_articles_scroll_map";
  const INS_BODY_STATE_KEY = "zr_articles_body_state_map";

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

  function norm(s){
    return (s ?? "").toString().toLowerCase().trim();
  }

  function getMainPanel(){
    return document.querySelector(".panel");
  }

  function getMainViewer(){
    return document.querySelector(".viewer");
  }

  function enableMobileReadingMode(){
    document.body.classList.add("zr-mobile-reading");
    if(window.innerWidth > 960) return;

    const panel = getMainPanel();
    const viewer = getMainViewer();

    if(panel) panel.style.display = "none";
    if(viewer){
      viewer.style.display = "";
      viewer.style.width = "100%";
      viewer.style.maxWidth = "100%";
    }
  }

  function disableMobileReadingMode(){
    document.body.classList.remove("zr-mobile-reading");

    const panel = getMainPanel();
    const viewer = getMainViewer();

    if(panel) panel.style.display = "";
    if(viewer){
      viewer.style.display = "";
      viewer.style.width = "";
      viewer.style.maxWidth = "";
    }
  }

  function bindMobileListToggle(btn){
    if(!btn) return;

    const sync = () => {
      if(window.innerWidth > 960){
        btn.style.display = "none";
        return;
      }

      btn.style.display = "inline-flex";

      const panel = getMainPanel();
      const reading = !!(panel && panel.style.display === "none");

      btn.textContent = reading ? "Раскрыть список" : "Скрыть список";
      btn.setAttribute("aria-expanded", reading ? "false" : "true");
    };

    btn.onclick = () => {
      if(window.innerWidth > 960) return;

      const panel = getMainPanel();
      const hiddenNow = !!(panel && panel.style.display === "none");

      if(hiddenNow){
        disableMobileReadingMode();
      }else{
        enableMobileReadingMode();
      }

      sync();
    };

    sync();
  }

  function getStoredTocCollapsed(){
    try{
      return localStorage.getItem(INS_TOC_STATE_KEY) === "1";
    }catch(e){}
    return false;
  }

  function setStoredTocCollapsed(v){
    try{
      localStorage.setItem(INS_TOC_STATE_KEY, v ? "1" : "0");
    }catch(e){}
  }

  function getStoredArticleScroll(id){
    try{
      const raw = localStorage.getItem(INS_SCROLL_KEY) || "{}";
      const map = JSON.parse(raw);
      const v = map && id ? Number(map[String(id)]) : 0;
      return Number.isFinite(v) && v > 0 ? v : 0;
    }catch(e){}
    return 0;
  }

  function setStoredArticleScroll(id, top){
    try{
      if(!id) return;
      const raw = localStorage.getItem(INS_SCROLL_KEY) || "{}";
      const map = JSON.parse(raw);
      map[String(id)] = Math.max(0, Number(top) || 0);
      localStorage.setItem(INS_SCROLL_KEY, JSON.stringify(map));
    }catch(e){}
  }

  function getStoredArticleBodyExpanded(id){
    try{
      const raw = localStorage.getItem(INS_BODY_STATE_KEY) || "{}";
      const map = JSON.parse(raw);
      return !!(map && id && map[String(id)] === 1);
    }catch(e){}
    return false;
  }

  function setStoredArticleBodyExpanded(id, expanded){
    try{
      if(!id) return;
      const raw = localStorage.getItem(INS_BODY_STATE_KEY) || "{}";
      const map = JSON.parse(raw);
      map[String(id)] = expanded ? 1 : 0;
      localStorage.setItem(INS_BODY_STATE_KEY, JSON.stringify(map));
    }catch(e){}
  }

  function bindArticleScrollMemory(viewer, id){
    if(!viewer || !id) return;

    try{
      if(viewer.__zrArticleScrollHandler){
        viewer.removeEventListener("scroll", viewer.__zrArticleScrollHandler);
      }
    }catch(e){}

    const onScroll = () => {
      setStoredArticleScroll(id, viewer.scrollTop || 0);
    };

    viewer.__zrArticleScrollHandler = onScroll;
    viewer.addEventListener("scroll", onScroll, { passive:true });

    try{
      if(window.__zrArticleVisibilityHandler){
        document.removeEventListener("visibilitychange", window.__zrArticleVisibilityHandler);
      }
      if(window.__zrArticlePageHideHandler){
        window.removeEventListener("pagehide", window.__zrArticlePageHideHandler);
      }
    }catch(e){}

    window.__zrArticleVisibilityHandler = function(){
      if(document.visibilityState === "hidden"){
        setStoredArticleScroll(id, viewer.scrollTop || 0);
      }
    };

    window.__zrArticlePageHideHandler = function(){
      setStoredArticleScroll(id, viewer.scrollTop || 0);
    };

    document.addEventListener("visibilitychange", window.__zrArticleVisibilityHandler);
    window.addEventListener("pagehide", window.__zrArticlePageHideHandler);
  }

  function parseUpdatedAt(meta){
    const v = meta?.updatedAt || meta?.updated_at || "";
    if(!v) return null;

    const raw = String(v).trim();
    if(!raw) return null;

    // YYYY-MM-DD
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if(m){
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const d = parseInt(m[3], 10);
      return new Date(y, mo, d, 0, 0, 0, 0);
    }

    // DD.MM.YYYY
    m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
    if(m){
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const y = parseInt(m[3], 10);
      return new Date(y, mo, d, 0, 0, 0, 0);
    }

    const t = Date.parse(raw);
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
      md = md.replace(/>(.+?)</g, '<mark class="kb-newmark">$1</mark>');
      md = md.replace(/&gt;(.+?)&lt;/g, '<mark class="kb-newmark">$1</mark>');
    }else{
      md = md.replace(/>(.+?)</g, '$1');
      md = md.replace(/&gt;(.+?)&lt;/g, '$1');
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
      list.innerHTML = `<div class="zr-empty-shell">Ничего не найдено.</div>`;
      return;
    }

    const selectedId = (() => {
      try{
        const p = (window.Router && typeof Router.parse === "function") ? Router.parse() : null;
        return p && p.section === "articles" && p.param ? String(p.param) : "";
      }catch(e){}
      return "";
    })();

    for(const it of items){
      const isNew = !!it.hasInlineNew && isNewWindowActive(it, 7);
      const badge = isNew ? `<span class="kb-updated-badge">ОБНОВЛЕНО</span>` : "";
      const catTitle = CATMAP[it.category] || it.category || "";
      const cat = catTitle ? `<span class="tag accent">${esc(catTitle)}</span>` : "";
      const tags = (it.tags||[]).slice(0,4).map(t => `<span class="tag">${esc(t)}</span>`).join("");
      const roles = (it.roles||[]).slice(0,2).map(r => `<span class="tag">${esc(r)}</span>`).join("");

      const a = document.createElement("a");
      a.className = `zr-list-row ${selectedId === String(it.id) ? "zr-list-row--active" : ""}`;
      a.href = `#/${encodeURIComponent("articles")}/${encodeURIComponent(it.id)}`;
      a.innerHTML = `
        <div class="zr-list-row-title">${esc(it.title)}${badge}</div>
        <div class="zr-list-row-tags">${cat}${tags}${roles}</div>
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

  function decorateCallouts(md){
    md = (md ?? "").toString();

    const lines = md.split("\n");
    const out = [];

    const defs = [
      { key: "Важно:", cls: "kb-important", title: "ВАЖНО" },
      { key: "Не забудь:", cls: "kb-remember", title: "НЕ ЗАБУДЬ" },
      { key: "Нельзя:", cls: "kb-caution", title: "НЕЛЬЗЯ" },
      { key: "Осторожно:", cls: "kb-caution", title: "ОСТОРОЖНО" }
    ];

    for(let i = 0; i < lines.length; i++){
      const raw = lines[i];
      const line = String(raw || "");
      const trimmed = line.trim();

      const match = defs.find(d => trimmed.startsWith(">" + d.key));
      if(!match){
        out.push(raw);
        continue;
      }

      const body = trimmed.slice((">" + match.key).length).trim();

      out.push(
        `<div class="kb-callout ${match.cls}">` +
          `<div class="kb-callout-title">${esc(match.title)}</div>` +
          `<div class="kb-callout-body">${esc(body)}</div>` +
        `</div>`
      );
    }

    return out.join("\n");
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
      <div class="article-toc-title">Оглавление</div>
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
    viewer.appendChild(layout);

    const headerSection = main.querySelector('[data-ins-section="header"]');
    if(window.innerWidth <= 960 && headerSection && headerSection.parentNode){
      headerSection.insertAdjacentElement("afterend", toc);
    }else{
      layout.appendChild(toc);
    }

    const toggleBtn = main.querySelector("#insTocBtn");

    if(toggleBtn){
      const tocTitle = toc.querySelector(".article-toc-title");
      const tocList = toc.querySelector(".article-toc-list");

      const syncToggleState = () => {
        const collapsed = layout.classList.contains("zr-toc-collapsed");

        toggleBtn.textContent = "Оглавление";
        toggleBtn.setAttribute("aria-pressed", collapsed ? "false" : "true");
        toggleBtn.classList.toggle("is-active", !collapsed);
        toggleBtn.style.display = "inline-flex";

        if(window.innerWidth > 960){
          toc.style.display = collapsed ? "none" : "";
          layout.style.display = "grid";
          layout.style.gridTemplateColumns = collapsed ? "minmax(0,1fr)" : "minmax(0,1fr) 260px";

          if(tocTitle) tocTitle.style.display = "";
          if(tocList) tocList.style.display = "";
        }else{
          toc.style.display = collapsed ? "none" : "";
          if(tocTitle) tocTitle.style.display = collapsed ? "none" : "";
          if(tocList) tocList.style.display = collapsed ? "none" : "";
          layout.style.display = "block";
        }

        main.style.maxWidth = "";
        main.style.margin = "";
      };

      toggleBtn.addEventListener("click", () => {
        layout.classList.toggle("zr-toc-collapsed");
        setStoredTocCollapsed(layout.classList.contains("zr-toc-collapsed"));
        syncToggleState();
      });

      if(getStoredTocCollapsed()){
        layout.classList.add("zr-toc-collapsed");
      }

      syncToggleState();
    }

    const goToTocSection = (id) => {
      const target = document.getElementById(id);
      if(!target) return;

      const viewerStyle = window.getComputedStyle(viewer);
      const viewerIsScrollable =
        viewer &&
        viewerStyle &&
        viewerStyle.overflowY !== "visible" &&
        viewer.scrollHeight > viewer.clientHeight;

      if(viewerIsScrollable){
        const viewerRect = viewer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const top = viewer.scrollTop + (targetRect.top - viewerRect.top) - 16;

        viewer.scrollTo({
          top: Math.max(0, top),
          behavior: "smooth"
        });
        return;
      }

      const targetRect = target.getBoundingClientRect();
      const absoluteTop = window.scrollY + targetRect.top - 16;

      window.scrollTo({
        top: Math.max(0, absoluteTop),
        behavior: "smooth"
      });
    };

    toc.querySelectorAll("[data-toc]").forEach((a) => {
      let pointerHandled = false;

      const activate = (e) => {
        try{
          if(e) e.preventDefault();
        }catch(_){}

        const id = a.getAttribute("data-toc");
        if(!id) return;

        goToTocSection(id);
      };

      a.addEventListener("pointerup", (e) => {
        pointerHandled = true;
        activate(e);
        setTimeout(() => {
          pointerHandled = false;
        }, 80);
      });

      a.addEventListener("click", (e) => {
        if(pointerHandled){
          e.preventDefault();
          return;
        }
        activate(e);
      });
    });

    toc.querySelectorAll("[data-toc]").forEach(a => {
      const onActivate = (e) => {
        try{
          if(e) e.preventDefault();
        }catch(_){}

        try{
          if(e && typeof e.stopPropagation === "function") e.stopPropagation();
        }catch(_){}

        const id = a.getAttribute("data-toc");
        if(!id) return;

        goToTocSection(id);
      };

      a.addEventListener("click", onActivate);

      a.addEventListener("touchend", (e) => {
        onActivate(e);
      }, { passive:false });
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

  function getFavApi(){
    return window.ZRFavorites || null;
  }

  function isArticleFavorite(id){
    try{
      const api = getFavApi();
      return !!(api && api.isFavorite("articles", id));
    }catch(e){}
    return false;
  }

  function renderArticleFavoriteButton(id){
    const active = isArticleFavorite(id);
    return `<button class="btn btn-sm zr-fav-btn ${active ? "is-active" : ""}" id="insFavBtn" type="button" aria-pressed="${active ? "true" : "false"}" title="${active ? "Убрать из избранного" : "Добавить в избранное"}" aria-label="${active ? "Убрать из избранного" : "Добавить в избранное"}"><span class="zr-fav-btn__icon" aria-hidden="true">${active ? "★" : "☆"}</span><span class="zr-fav-btn__text">Избранное</span></button>`;
  }

  function bindArticleFavoriteButton(id){
    const btn = document.getElementById("insFavBtn");
    if(!btn) return;

    btn.onclick = () => {
      try{
        const api = getFavApi();
        if(!api) return;

        api.toggleFavorite("articles", id);
        const active = api.isFavorite("articles", id);

        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.setAttribute("title", active ? "Убрать из избранного" : "Добавить в избранное");
        btn.setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");

        const icon = btn.querySelector(".zr-fav-btn__icon");
        if(icon) icon.textContent = active ? "★" : "☆";
      }catch(e){
        console.error("[Favorites][Articles]", e);
      }
    };
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

  function getFavoriteArticleItems(){
    try{
      const api = getFavApi();
      if(!api || typeof api.getFavorites !== "function") return [];
      const store = api.getFavorites() || {};
      const ids = Array.isArray(store.articles) ? store.articles : [];
      if(!ids.length) return [];
      const map = new Map(INDEX.map(it => [String(it.id), it]));
      return ids.map(id => map.get(String(id))).filter(Boolean);
    }catch(e){}
    return [];
  }

  function renderFavoriteArticlesStart(){
    const items = getFavoriteArticleItems();

    if(!items.length){
      return `
        <div class="zr-empty-shell">
          Выбери статью слева или используй поиск сверху.<br/><br/>
          Подсказка: позже добавим роли, избранное и «что нового».
        </div>`;
    }

    return `
      <div class="zr-stack-md">
        <div class="zr-list-intro zr-stack-sm">
          <div class="zr-section-head">
            <div class="zr-section-title">Избранное</div>
          </div>
          <div class="item-meta">Быстрый доступ к сохранённым статьям.</div>
        </div>

        <div class="zr-stack-sm">
          ${items.map((it) => {
            const catTitle = CATMAP[it.category] || it.category || "";
            const cat = catTitle ? `<span class="tag accent">${esc(catTitle)}</span>` : "";
            const tags = (it.tags||[]).slice(0,4).map(t => `<span class="tag">${esc(t)}</span>`).join("");
            const roles = (it.roles||[]).slice(0,2).map(r => `<span class="tag">${esc(r)}</span>`).join("");
            const updated = it.updatedAt ? `<span class="tag">Обновлено: ${esc(formatMetaDate(it.updatedAt))}</span>` : "";

            return `
              <a class="zr-list-row" href="#/${encodeURIComponent("articles")}/${encodeURIComponent(it.id)}">
                <div class="zr-list-row-title">${esc(it.title || "Статья")}</div>
                <div class="zr-list-row-tags">${cat}${updated}${tags}${roles}</div>
              </a>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function setupArticleBodyCollapse(viewer, articleId){
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

    let expanded = !!getStoredArticleBodyExpanded(articleId);

    const applyExpandedState = () => {
      if(expanded){
        markdown.style.maxHeight = "";
        markdown.style.overflow = "";
      }else{
        markdown.style.maxHeight = limit + "px";
        markdown.style.overflow = "hidden";
        markdown.style.position = "relative";
      }
    };

    applyExpandedState();

    const controls = document.createElement("div");
    controls.setAttribute("data-ins-collapse","controls");
    controls.style.marginTop = "12px";
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.gap = "8px";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm";
    btn.textContent = expanded ? "Свернуть" : "Показать полностью";

    btn.onclick = () => {
      expanded = !expanded;
      setStoredArticleBodyExpanded(articleId, expanded);

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
    const viewer = $("#viewer");
    const savedScrollTop = id ? getStoredArticleScroll(id) : 0;

    if(!id){
      disableMobileReadingMode();
      viewer.innerHTML = renderFavoriteArticlesStart();
      enhanceArticleWithToc(viewer);
      return;
    }

    const meta = INDEX.find(x => x.id === id);
    if(!meta){
      disableMobileReadingMode();
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
      disableMobileReadingMode();
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

    md = decorateCallouts(md);
    const html = window.marked ? window.marked.parse(md) : `<pre>${esc(md)}</pre>`;
    viewer.innerHTML = `
      <div class="zr-stack-lg zr-viewer-shell">
        <div class="zr-inline-sm">
          <button class="btn btn-sm zr-mobile-only" id="insListBtn" type="button">Раскрыть список</button>
        </div>

        <div class="zr-card zr-card--section zr-stack-md" data-ins-section="header">
          <div class="zr-viewer-header-row">
            <div class="zr-viewer-header-main zr-stack-sm">
              <div class="zr-viewer-title-row">
                <h1 class="article-title">${esc(meta.title)}</h1>
              </div>
              <p class="article-sub">${esc(updated)}</p>
            </div>
            <div class="zr-viewer-header-actions">
              ${renderArticleFavoriteButton(meta.id)}
              <button class="btn btn-sm" id="insTocBtn" type="button" aria-pressed="false">Оглавление</button>
              <button class="btn btn-sm" id="insBackBtn" type="button">Закрыть</button>
            </div>
          </div>
        </div>

        <div class="zr-card zr-card--subtle zr-stack-sm" data-ins-section="meta">
          <div class="zr-section-head">
            <div class="zr-section-title">Мета</div>
          </div>
          <div class="item-meta">${renderMetaRow(meta)}${cat}${tags}${roles}</div>
        </div>

        <div class="zr-card zr-card--section zr-stack-md" data-ins-section="body">
          <div class="markdown zr-editorial-body">${html}</div>
        </div>

        <div class="zr-card zr-card--subtle zr-stack-sm" data-ins-section="resources">
          <div class="zr-section-head">
            <div class="zr-section-title">Ресурсы</div>
          </div>
          <div class="zr-resource-block">${renderActions(meta.actions)}</div>
        </div>
      </div>
    `;

    const backBtn = document.getElementById("insBackBtn");
    if(backBtn){
      backBtn.textContent = getInstructionCloseLabel();
      backBtn.onclick = () => goInstructionClose();
    }

    bindArticleFavoriteButton(meta.id);

    setupArticleBodyCollapse(viewer, meta.id);
    enhanceArticleWithToc(viewer);
    enableMobileReadingMode();

    const listBtn = document.getElementById("insListBtn");
    bindMobileListToggle(listBtn);

    bindArticleScrollMemory(viewer, meta.id);

    requestAnimationFrame(() => {
      try{
        viewer.scrollTop = savedScrollTop > 0 ? savedScrollTop : 0;
      }catch(e){}
    });

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
    return [];
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
    CATMAP = {};

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

    const fileMap = new Map();
    for(const it of fileItems){
      fileMap.set(it.id, it);
    }

    INDEX = sortItems(
      sbItems.map(it => {
        const prev = fileMap.get(it.id);
        if(prev && prev.path && !it.path) it.path = prev.path;
        return it;
      })
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


























