window.Views = window.Views || {};
Views.Checklists = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const CL_LAST_HASH_KEY = "zr_checklists_last_hash";
  const CL_RETURN_HASH_KEY = "zr_checklists_return_hash";
  const CL_GROUPS_STATE_KEY = "zr_checklists_groups_state";

  let _data = [];
  let _q = "";

  function setStatus(t){
    const el = $("#status");
    if(el) el.textContent = t;
  }

  function setPanelTitle(t){
    const el = $("#panelTitle");
    if(el) el.textContent = t;
  }

  function norm(s){
    return (s ?? "").toString().toLowerCase();
  }

  function getCurrentHash(){
    return String(location.hash || "");
  }

  function isChecklistHash(hash){
    return /^#\/checklists(?:\/|$)/.test(String(hash || ""));
  }

  function isPlannerTaskHash(hash){
    return /^#\/planner\/[^\/]+/.test(String(hash || ""));
  }

  function installChecklistContextTracker(){
    try{
      if(window.__zrChecklistContextTrackerInstalled) return;
      window.__zrChecklistContextTrackerInstalled = true;

      if(window.ViewerNav && typeof ViewerNav.installTracker === "function"){
        ViewerNav.installTracker({
          lastKey: CL_LAST_HASH_KEY,
          returnKey: CL_RETURN_HASH_KEY,
          isDetailHash: isChecklistHash,
          isListHash: function(hash){
            return String(hash || "") === "#/checklists";
          }
        });
      }
    }catch(e){}
  }

  function getChecklistReturnHash(){
    try{
      if(window.ViewerNav && typeof ViewerNav.getReturnHash === "function"){
        return ViewerNav.getReturnHash(CL_RETURN_HASH_KEY) || "#/checklists";
      }
    }catch(e){}
    return "#/checklists";
  }

  function getChecklistCloseLabel(){
    try{
      if(window.ViewerNav && typeof ViewerNav.getCloseLabel === "function"){
        return ViewerNav.getCloseLabel(getChecklistReturnHash());
      }
    }catch(e){}
    return isPlannerTaskHash(getChecklistReturnHash()) ? "К задаче" : "Закрыть";
  }

  function goChecklistClose(){
    const target = getChecklistReturnHash();

    try{
      if(window.ViewerNav && typeof ViewerNav.goClose === "function"){
        ViewerNav.goClose(target, "checklists");
        return;
      }
    }catch(e){}

    location.hash = isPlannerTaskHash(target) ? target : "#/checklists";
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

      btn.textContent = reading ? "Показать список" : "Скрыть список";
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

  function getLinkedFromMeta(){
    return "";
  }

  function formatDate(d){
    try{
      if(window.ViewerNav && typeof ViewerNav.formatDMY === "function"){
        return ViewerNav.formatDMY(d);
      }
    }catch(e){}
    return String(d || "");
  }

  function getFavApi(){
    return window.ZRFavorites || null;
  }

  function isChecklistFavorite(id){
    try{
      const api = getFavApi();
      return !!(api && api.isFavorite("checklists", id));
    }catch(e){}
    return false;
  }

  function renderChecklistFavoriteButton(id){
    const active = isChecklistFavorite(id);
    return `<button class="btn btn-sm zr-fav-btn ${active ? "is-active" : ""}" id="clFavBtn" type="button" aria-pressed="${active ? "true" : "false"}" title="${active ? "Убрать из избранного" : "Добавить в избранное"}" aria-label="${active ? "Убрать из избранного" : "Добавить в избранное"}"><span class="zr-fav-btn__icon" aria-hidden="true">${active ? "★" : "☆"}</span><span class="zr-fav-btn__text">Избранное</span></button>`;
  }

  function bindChecklistFavoriteButton(id){
    const btn = document.getElementById("clFavBtn");
    if(!btn) return;

    btn.onclick = () => {
      try{
        const api = getFavApi();
        if(!api) return;

        api.toggleFavorite("checklists", id);
        const active = api.isFavorite("checklists", id);

        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.setAttribute("title", active ? "Убрать из избранного" : "Добавить в избранное");
        btn.setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");

        const icon = btn.querySelector(".zr-fav-btn__icon");
        if(icon) icon.textContent = active ? "★" : "☆";
      }catch(e){
        console.error("[Favorites][Checklists]", e);
      }
    };
  }

  function renderMetaRow(item){
    let created =
      item?.createdAt ||
      item?.created_at ||
      "";

    let updated =
      item?.updatedAt ||
      item?.updated_at ||
      "";

    const author =
      item?.author ||
      item?.author_name ||
      "";

    const tags = Array.isArray(item?.tags) ? item.tags : [];

    const parts = [];

    if(author)  parts.push(`<span class="tag">Автор: ${esc(String(author))}</span>`);
    if(created){ created = formatDate(created); parts.push(`<span class="tag">Создано: ${esc(String(created))}</span>`); }
    if(updated && updated !== created){ updated = formatDate(updated); parts.push(`<span class="tag">Обновлено: ${esc(String(updated))}</span>`); }

    const linked = getLinkedFromMeta();
    if(linked) parts.push(linked);

    tags.forEach(tag => {
      parts.push(`<span class="tag">${esc(String(tag))}</span>`);
    });

    return parts.join("");
  }

  function getFavoriteChecklistItems(){
    try{
      const api = getFavApi();
      if(!api || typeof api.getFavorites !== "function") return [];
      const store = api.getFavorites() || {};
      const ids = Array.isArray(store.checklists) ? store.checklists : [];
      if(!ids.length) return [];
      const map = new Map((_data || []).map(it => [String(it.id), it]));
      return ids.map(id => map.get(String(id))).filter(Boolean);
    }catch(e){}
    return [];
  }

  function renderFavoriteChecklistsStart(){
    const items = getFavoriteChecklistItems();

    if(!items.length){
      return `<div class="zr-empty-shell">Выберите чек-лист слева.</div>`;
    }

    return `
      <div class="zr-stack-md">
        <div class="zr-list-intro zr-stack-sm">
          <div class="zr-section-head">
            <div class="zr-section-title">Избранное</div>
          </div>
          <div class="item-meta">Быстрый доступ к сохранённым чек-листам.</div>
        </div>

        <div class="zr-stack-sm">
          ${items.map((c) => {
            const tagsHtml = Array.isArray(c.tags) && c.tags.length
              ? c.tags.map(tag => `<span class="tag">${esc(String(tag))}</span>`).join("")
              : "";
            const updated = (c.updated_at || c.updatedAt)
              ? `<span class="tag">Обновлено: ${esc(formatDate(c.updated_at || c.updatedAt))}</span>`
              : "";

            return `
              <a class="zr-list-row" href="#/checklists/${encodeURIComponent(String(c.id || ""))}">
                <div class="zr-list-row-title">${esc(c.title || "Чек-лист")}</div>
                <div class="zr-list-row-tags">${updated}${tagsHtml}</div>
              </a>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderList(){
    const list = $("#list");
    const viewer = $("#viewer");
    if(!list || !viewer) return;

    list.innerHTML = "";
    const current = getCurrentHash();
    const hasOpenChecklist = /^#\/checklists\/.+/.test(String(current || ""));
    if(!hasOpenChecklist){
      viewer.innerHTML = renderFavoriteChecklistsStart();
    }

    const q = norm(_q).trim();
    const items = Array.isArray(_data) ? _data : [];
    const filtered = !q ? items : items.filter(x => {
      const t = norm(x.title);
      const d = norm(x.desc);
      const u = norm(x.url);
      const tags = Array.isArray(x.tags) ? norm(x.tags.join(" ")) : "";
      return (t.includes(q) || d.includes(q) || u.includes(q) || tags.includes(q));
    });

    setStatus(`${filtered.length} / ${items.length}`);

    if(filtered.length === 0){
      list.innerHTML = `<div class="zr-empty-shell">Ничего не найдено.</div>`;
      return;
    }

    const selectedId = (() => {
      try{
        const p = (window.Router && typeof Router.parse === "function") ? Router.parse() : null;
        return p && p.page === "checklists" && p.param ? String(p.param) : "";
      }catch(e){}
      return "";
    })();

    filtered.forEach((c) => {
      const a = document.createElement("a");
      const cid = String(c.id || "");
      a.className = `zr-list-row ${selectedId === cid ? "zr-list-row--active" : ""}`;
      a.href = "#/checklists/" + encodeURIComponent(cid);
      const tagsHtml = Array.isArray(c.tags) && c.tags.length
        ? c.tags.map(tag => `<span class="tag">${esc(String(tag))}</span>`).join("")
        : "";

      a.innerHTML = `
        <div class="zr-list-row-title">${esc(c.title || "Чек-лист")}</div>
        <div class="zr-list-row-tags">${tagsHtml}</div>`;

      a.onclick = (e) => {
        e.preventDefault();
        if(window.Router && typeof Router.go === "function"){
          Router.go("checklists", cid);
          return;
        }
        location.hash = "#/checklists/" + encodeURIComponent(cid);
      };

      list.appendChild(a);
    });
  }

  function getGroupStateMap(){
    try{
      return JSON.parse(sessionStorage.getItem(CL_GROUPS_STATE_KEY) || "{}") || {};
    }catch(e){
      return {};
    }
  }

  function setGroupStateMap(next){
    try{
      sessionStorage.setItem(CL_GROUPS_STATE_KEY, JSON.stringify(next || {}));
    }catch(e){}
  }

  function getChecklistGroupState(checklistId){
    const all = getGroupStateMap();
    return all[checklistId] || {};
  }

  function setChecklistGroupState(checklistId, groupKey, expanded){
    const all = getGroupStateMap();
    all[checklistId] = all[checklistId] || {};
    all[checklistId][groupKey] = !!expanded;
    setGroupStateMap(all);
  }

  function renderPlainItems(items){
    if(!Array.isArray(items) || !items.length) return "";
    return `
      <div class="zr-stack-sm">
        ${items.map((text, idx) => `
          <div class="zr-card zr-card--row">
            <div class="item-meta zr-inline-md">
              <input type="checkbox" class="cl-checkbox">
              <span>${esc(String(text || ""))}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderGroups(item){
    const groups = Array.isArray(item?.groups) ? item.groups : [];
    if(!groups.length) return "";

    const state = getChecklistGroupState(String(item.id || ""));
    return `
      <div data-cl-groups-root="1" class="zr-stack-md">
        ${groups.map((group, idx) => {
          const title = group?.title || `Группа ${idx + 1}`;
          const rows = Array.isArray(group?.items) ? group.items : (Array.isArray(group?.steps) ? group.steps : []);
          const key = `g${idx}`;
          const expanded = state[key] !== false;

          return `
            <div class="zr-card zr-card--subtle zr-stack-sm" data-cl-group="${esc(key)}">
              <div class="zr-section-head">
                <div class="zr-section-title">${esc(title)}</div>
                <button
                  class="btn btn-sm"
                  type="button"
                  data-cl-group-toggle="${esc(key)}"
                  aria-expanded="${expanded ? "true" : "false"}"
                >${expanded ? "Свернуть" : "Показать"}</button>
              </div>

              <div
                data-cl-group-body="${esc(key)}"
                style="display:${expanded ? "block" : "none"};"
              >
                ${rows.length ? `
                  <div class="zr-stack-sm">
                    ${rows.map((row, rowIdx) => `
                      <div class="zr-card zr-card--row">
                        <div class="item-meta">
                          <span class="tag">${rowIdx + 1}</span>
                          <span>${esc(String(row || ""))}</span>
                        </div>
                      </div>
                    `).join("")}
                  </div>
                ` : `<div class="zr-muted-note">Пустая группа.</div>`}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderBody(item){
    const groupsHtml = renderGroups(item);
    if(groupsHtml) return groupsHtml;

    const items = Array.isArray(item?.items) ? item.items : (Array.isArray(item?.steps) ? item.steps : []);
    if(items.length) return renderPlainItems(items);

    const desc = (item?.desc || "").toString().trim();
    if(desc){
      return `<div class="markdown zr-editorial-body">${esc(desc)}</div>`;
    }

    return `<div class="zr-muted-note">Описание отсутствует. Используйте кнопку открытия чек-листа ниже.</div>`;
  }

  function renderResources(item){
    const resources = [];
    const actions = Array.isArray(item?.actions) ? item.actions : [];
    const url = (item?.url || "").toString().trim();

    if(actions.length){
      resources.push(`
        <div class="zr-stack-sm">
          ${actions.map((a) => {
            const label = esc(a?.label || "Открыть");
            const href = esc(a?.url || "#");
            const external = !!a?.external;
            const target = external ? `target="_blank" rel="noopener"` : "";
            return `<a class="btn" href="${href}" ${target}><span class="dot"></span>${label}</a>`;
          }).join("")}
        </div>
      `);
    }else{
      if(url){
        resources.push(`
          <div class="zr-stack-sm">
            <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">
              <span class="dot"></span>Открыть чек-лист
            </a>
            <div class="zr-muted-note">
              Ссылка: <span class="mono">${esc(url)}</span>
            </div>
          </div>
        `);
      }

      if(Array.isArray(item?.resources) && item.resources.length){
        resources.push(`
          <div class="zr-stack-sm" style="${url ? "margin-top:12px;" : ""}">
            ${item.resources.map((r) => {
              const label = esc(r?.label || r?.title || "Ресурс");
              const href = esc(r?.url || "#");
              return `<a class="btn" href="${href}" target="_blank" rel="noopener"><span class="dot"></span>${label}</a>`;
            }).join("")}
          </div>
        `);
      }
    }

    return resources.length
      ? resources.join("")
      : `<div class="zr-muted-note">Дополнительные ресурсы отсутствуют.</div>`;
  }

  function setupBodyCollapse(viewer){
    if(!viewer) return;

    const section = viewer.querySelector('[data-cl-section="body"]');
    if(!section) return;

    const body = section.querySelector('[data-cl-body-root="1"]');
    if(!body) return;

    const oldControls = section.querySelector('[data-cl-collapse="controls"]');
    if(oldControls) oldControls.remove();

    body.style.maxHeight = "";
    body.style.overflow = "";
    body.style.position = "";

    const limit = 520;
    const fullHeight = body.scrollHeight || 0;
    if(fullHeight <= limit) return;

    let expanded = false;

    body.style.maxHeight = limit + "px";
    body.style.overflow = "hidden";
    body.style.position = "relative";

    const controls = document.createElement("div");
    controls.setAttribute("data-cl-collapse","controls");
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
        body.style.maxHeight = "";
        body.style.overflow = "";
        btn.textContent = "Свернуть";
      }else{
        body.style.maxHeight = limit + "px";
        body.style.overflow = "hidden";
        btn.textContent = "Показать полностью";
        try{
          section.scrollIntoView({ block:"start", behavior:"smooth" });
        }catch(e){}
      }
    };

    controls.appendChild(btn);
    section.appendChild(controls);
  }

  function bindGroupToggles(item){
    const viewer = $("#viewer");
    if(!viewer) return;

    viewer.querySelectorAll("[data-cl-group-toggle]").forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-cl-group-toggle") || "";
        const body = viewer.querySelector(`[data-cl-group-body="${CSS.escape(key)}"]`);
        if(!body) return;

        const expanded = body.style.display !== "none";
        const nextExpanded = !expanded;

        body.style.display = nextExpanded ? "block" : "none";
        btn.textContent = nextExpanded ? "Свернуть" : "Показать";
        btn.setAttribute("aria-expanded", nextExpanded ? "true" : "false");

        setChecklistGroupState(String(item.id || ""), key, nextExpanded);
      };
    });
  }

  async function loadChecklistsFromSupabase(){
    if(!window.SB) return [];

    const { data, error } = await SB
      .from("kb_checklists")
      .select("id,title,desc,url,actions,tags,published,sort,created_at,updated_at,items")
      .eq("published", true)
      .order("sort", { ascending:true })
      .order("title", { ascending:true });

    if(error){
      console.error("[Checklists] Supabase load error:", error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  async function show(param){
    setPanelTitle("Чек-листы");
    _data = await loadChecklistsFromSupabase();
    renderList();

    if(param){
      await open(param);
      return;
    }

    disableMobileReadingMode();
  }

  async function open(id){
    const viewer = $("#viewer"); if(viewer) viewer.scrollTop = 0;
    if(!viewer) return;

    const item = (Array.isArray(_data) ? _data : []).find(x => String(x.id) === String(id));
    if(!item){
      disableMobileReadingMode();
      viewer.innerHTML = `<div class="empty">Чек-лист не найден.</div>`;
      return;
    }

    const desc = (item.desc || "").toString().trim();
    const subtitle = desc || "Проверьте содержимое и при необходимости откройте внешний чек-лист.";
    const metaRow = renderMetaRow(item);

    viewer.innerHTML = `
      <div class="zr-stack-lg zr-viewer-shell">
        <div class="zr-card zr-card--section zr-stack-md" data-cl-section="header">
          <div class="zr-viewer-header-row">
            <div class="zr-viewer-header-main zr-stack-sm">
              <div class="zr-viewer-title-row">
                <h1 class="article-title">${esc(item.title || "Чек-лист")}</h1>
                ${renderChecklistFavoriteButton(item.id)}
              </div>
              <p class="article-sub">${esc(subtitle)}</p>
            </div>
            <div class="zr-viewer-header-actions">
              <button class="btn btn-sm zr-mobile-only" id="clListBtn" type="button">Показать список</button>
              <button class="btn btn-sm" id="clBackBtn" type="button">${getChecklistCloseLabel()}</button>
            </div>
          </div>
        </div>

        <div class="zr-card zr-card--subtle zr-stack-sm" data-cl-section="meta">
          <div class="zr-section-head">
            <div class="zr-section-title">Мета</div>
          </div>
          <div class="item-meta">${metaRow || `<span class="zr-muted-note">Метаданные отсутствуют.</span>`}</div>
        </div>

        <div class="zr-card zr-card--section zr-stack-md" data-cl-section="body">
          <div data-cl-body-root="1">${renderBody(item)}</div>
        </div>

        <div class="zr-card zr-card--subtle zr-stack-sm" data-cl-section="resources">
          <div class="zr-section-head">
            <div class="zr-section-title">Ресурсы</div>
          </div>
          <div class="zr-resource-block">${renderResources(item)}</div>
        </div>
      </div>
    `;

    const backBtn = document.getElementById("clBackBtn");
    if(backBtn){
      backBtn.onclick = () => goChecklistClose();
    }

    bindChecklistFavoriteButton(item.id);

    const listBtn = document.getElementById("clListBtn");
    bindMobileListToggle(listBtn);

    bindGroupToggles(item);
    setupBodyCollapse(viewer);
    enableMobileReadingMode();
  }

  function setFilter(q){
    _q = (q ?? "").toString();
    renderList();
  }

  installChecklistContextTracker();

  return { show, open, setFilter };
})();







