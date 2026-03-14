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

  function renderList(){
    const list = $("#list");
    const viewer = $("#viewer");
    if(!list || !viewer) return;

    list.innerHTML = "";
    const current = getCurrentHash();
    const hasOpenChecklist = /^#\/checklists\/.+/.test(String(current || ""));
    if(!hasOpenChecklist){
      viewer.innerHTML = `<div class="empty">Выберите чек-лист слева.</div>`;
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
      list.innerHTML = `<div class="empty" style="padding:12px;">Ничего не найдено.</div>`;
      return;
    }

    filtered.forEach((c) => {
      const a = document.createElement("a");
      const cid = String(c.id || "");
      a.className = "item";
      a.href = "#/checklists/" + encodeURIComponent(cid);
      const tagsHtml = Array.isArray(c.tags) && c.tags.length
        ? c.tags.map(tag => `<span class="tag">${esc(String(tag))}</span>`).join("")
        : "";

      a.innerHTML = `
        <div class="item-title">${esc(c.title || "Чек-лист")}</div>
        <div class="item-meta">${tagsHtml}</div>`;

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
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${items.map((text, idx) => `
          <div class="item" style="cursor:default; padding:10px 12px;">
            <div class="item-meta">
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
      <div data-cl-groups-root="1" style="display:flex; flex-direction:column; gap:10px;">
        ${groups.map((group, idx) => {
          const title = group?.title || `Группа ${idx + 1}`;
          const rows = Array.isArray(group?.items) ? group.items : (Array.isArray(group?.steps) ? group.steps : []);
          const key = `g${idx}`;
          const expanded = state[key] !== false;

          return `
            <div class="item" data-cl-group="${esc(key)}" style="cursor:default; padding:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                <div class="item-title" style="margin:0;">${esc(title)}</div>
                <button
                  class="btn btn-sm"
                  type="button"
                  data-cl-group-toggle="${esc(key)}"
                  aria-expanded="${expanded ? "true" : "false"}"
                >${expanded ? "Свернуть" : "Показать"}</button>
              </div>

              <div
                data-cl-group-body="${esc(key)}"
                style="margin-top:10px; display:${expanded ? "block" : "none"};"
              >
                ${rows.length ? `
                  <div style="display:flex; flex-direction:column; gap:8px;">
                    ${rows.map((row, rowIdx) => `
                      <div class="item" style="cursor:default; padding:10px 12px;">
                        <div class="item-meta">
                          <span class="tag">${rowIdx + 1}</span>
                          <span>${esc(String(row || ""))}</span>
                        </div>
                      </div>
                    `).join("")}
                  </div>
                ` : `<div class="muted" style="font-size:12px;">Пустая группа.</div>`}
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
      return `<div style="line-height:1.6;">${esc(desc)}</div>`;
    }

    return `<div class="muted">Описание отсутствует. Используйте кнопку открытия чек-листа ниже.</div>`;
  }

  function renderResources(item){
    const resources = [];
    const actions = Array.isArray(item?.actions) ? item.actions : [];
    const url = (item?.url || "").toString().trim();

    if(actions.length){
      resources.push(`
        <div style="display:flex; flex-direction:column; gap:8px;">
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
          <div style="display:flex; flex-direction:column; gap:8px;">
            <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">
              <span class="dot"></span>Открыть чек-лист
            </a>
            <div class="muted" style="font-size:12px; line-height:1.5;">
              Ссылка: <span class="mono">${esc(url)}</span>
            </div>
          </div>
        `);
      }

      if(Array.isArray(item?.resources) && item.resources.length){
        resources.push(`
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:${url ? "12px" : "0"};">
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
      : `<div class="muted">Дополнительные ресурсы отсутствуют.</div>`;
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
      <div class="item" data-cl-section="header" style="cursor:default; margin-bottom:12px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <h1 class="article-title">${esc(item.title || "Чек-лист")}</h1>
            <p class="article-sub">${esc(subtitle)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm zr-mobile-only" id="clListBtn" type="button">Показать список</button>
            <button class="btn btn-sm" id="clBackBtn" type="button">${getChecklistCloseLabel()}</button>
          </div>
        </div>
      </div>

      <div class="item" data-cl-section="meta" style="cursor:default; margin-bottom:12px;">
        <div class="item-meta">${metaRow || `<span class="muted">Метаданные отсутствуют.</span>`}</div>
      </div>

      <div class="item" data-cl-section="body" style="cursor:default; margin-bottom:12px;">
        <div data-cl-body-root="1">${renderBody(item)}</div>
      </div>

      <div class="item" data-cl-section="resources" style="cursor:default;">
        <div class="item-title">Ресурсы</div>
        <div class="item-meta" style="margin-top:10px;">${renderResources(item)}</div>
      </div>
    `;

    const backBtn = document.getElementById("clBackBtn");
    if(backBtn){
      backBtn.onclick = () => goChecklistClose();
    }

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

