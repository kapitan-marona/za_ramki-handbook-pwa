/* ZA RAMKI — Planner Activity */
(function(){
  if(window.PlannerActivity) return;

  function esc(s){
    return (s==null?"":String(s))
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function formatDateTimeShort(ts){
    if(!ts) return "";
    try{
      const d = new Date(ts);
      return d.toLocaleString("ru-RU", {
        day:"2-digit",
        month:"2-digit",
        hour:"2-digit",
        minute:"2-digit"
      });
    }catch(_){
      return String(ts);
    }
  }

  function formatActivityText(a, deps){
    deps = deps || {};
    const statusLabel = deps.statusLabel || function(x){ return String(x || ""); };
    const resolvePersonLabel = deps.resolvePersonLabel || function(x){ return String(x || ""); };
    const uid = deps.uid || "";

    const type = String((a && a.type) || "");
    const p = (a && a.payload && typeof a.payload === "object") ? a.payload : {};

    if(type === "status_change"){
      const from = p.from ? statusLabel(p.from) : "—";
      const to = p.to ? statusLabel(p.to) : "—";
      return `Статус: ${from} → ${to}`;
    }

    if(type === "assignment_change"){
      const hasFrom = !!(p.from_assignee_id || p.from_assignee_name || p.from_assignee_display_name);
      const hasTo = !!(p.to_assignee_id || p.to_assignee_name || p.to_assignee_display_name);

      const fromLabel = resolvePersonLabel({
        id: p.from_assignee_id,
        display_name: p.from_assignee_display_name,
        full_name: p.from_assignee_name,
        name: p.from_assignee_label,
        email: p.from_assignee_email
      }, { uid, fallback: "Сотрудник" });

      const toLabel = resolvePersonLabel({
        id: p.to_assignee_id,
        display_name: p.to_assignee_display_name,
        full_name: p.to_assignee_name,
        name: p.to_assignee_label,
        email: p.to_assignee_email
      }, { uid, fallback: "Сотрудник" });

      if(!hasFrom && hasTo) return `Назначен сотрудник: ${toLabel}`;
      if(hasFrom && !hasTo) return `Исполнитель снят: ${fromLabel}`;
      if(hasFrom && hasTo) return `Исполнитель изменён: ${fromLabel} → ${toLabel}`;
      return "Исполнитель изменён";
    }

    if(type === "comment"){
      return "Добавлен комментарий";
    }

    if(type === "system"){
      const body = a && a.body ? String(a.body).trim() : "";
      return body || "Системное событие";
    }

    return "Событие";
  }

  function renderActivity(items, deps){
    deps = deps || {};
    const host = deps.host;
    if(!host) return;

    if(!items || items.length === 0){
      host.innerHTML = `<div class="zr-planner-muted">История пока пуста.</div>`;
      return;
    }

    host.innerHTML = `
      <div class="zr-planner-activity">
        ${items.map(a => `
          <div class="zr-card zr-card--row zr-planner-activity-row">
            <span class="zr-planner-activity-time">
              ${esc(formatDateTimeShort(a.created_at))}
            </span>
            <span class="zr-planner-activity-text">
              ${esc(formatActivityText(a, deps))}
            </span>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function loadActivity(task, deps){
    deps = deps || {};
    const host = deps.host;
    const fetchActivity = deps.fetchActivity;

    if(!host) return;
    host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;

    try{
      const items = await fetchActivity(task.id);
      renderActivity(items, deps);
    }catch(err){
      console.warn("[Planner] activity load error", err);
      const text = (err && (err.message || err.details || err.hint))
        ? (err.message || err.details || err.hint)
        : String(err);
      host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки истории: ${esc(text)}</div>`;
    }
  }

  window.PlannerActivity = {
    formatDateTimeShort,
    formatActivityText,
    renderActivity,
    loadActivity
  };
})();