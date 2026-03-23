(function(){
  if(window.PlannerLeft) return;

  function renderLeft(ctx){
    const {
      listEl,
      tasks,
      role,
      uid,
      state,
      esc,
      dueLabel,
      urgencyLabel,
      startLabel,
      statusLabel,
      isOverdue,
      shouldShowInLeft,
      getTaskAssigneeLabel,
      selectedId,
      goTask,
      sortMineFirst
    } = ctx || {};

    if(!listEl) return;

    const head = `
      <div style="padding:12px 10px 8px 10px;">
        <div class="zr-panel-topline">PLANNER</div>
        <div class="zr-panel-subline">Список задач и быстрый переход к деталям.</div>
      </div>
    `;

    const pills = (role === "admin")
      ? `
        <div style="padding:0 10px 10px 10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-sm pl-left ${state.leftFilter==="mine" ? "is-active" : ""}" data-f="mine" type="button">Мои</button>
          <button class="btn btn-sm pl-left ${state.leftFilter==="all" ? "is-active" : ""}" data-f="all" type="button">Все</button>
        </div>
      `
      : `
        <div style="padding:0 10px 10px 10px;"></div>
      `;

    listEl.innerHTML = head + pills + `<div id="plLeftList"></div>`;

    listEl.querySelectorAll(".pl-left").forEach((b) => {
      b.onclick = () => {
        state.leftFilter = b.dataset.f;
        renderLeft(ctx);
      };
    });

    const host = document.getElementById("plLeftList");
    if(!host) return;

    let leftTasks = (tasks || []).filter((t) => shouldShowInLeft(t, role, uid, state.leftFilter));

    if(leftTasks.length === 0){
      const emptyText = (role === "admin" && state.leftFilter === "mine")
        ? "Для фильтра «Мои» задач пока нет."
        : "В списке слева пока пусто.";

      host.innerHTML = `
        <div class="zr-empty-shell">${esc(emptyText)}</div>
      `;
      return;
    }

    try{
      if(typeof sortMineFirst === "function"){
        leftTasks = sortMineFirst(leftTasks, uid);
      }
    }catch(e){
      console.warn("[PlannerLeft] sortMineFirst error", e);
    }

    host.innerHTML = leftTasks.map((t) => {
      const due = t.due_date
        ? `<span class="pl-due ${isOverdue(t) ? "is-overdue" : ""}">${esc(dueLabel(t.due_date))}</span>`
        : "";

      const assigneeLabel = (role === "admin")
        ? getTaskAssigneeLabel(t, uid, { noYou: true })
        : "";
      const isSel = selectedId && String(selectedId) === String(t.id);
      const projectLine = t.project_title
        ? `<div class="item-meta" style="margin-top:6px;">${esc(t.project_title)}</div>`
        : "";

      return `
        <div class="item ${isSel ? 'zr-list-row--active' : ''}" data-id="${esc(t.id)}">
          <div class="zr-list-row-title">${esc(t.title || "(без названия)")}</div>
          ${projectLine}
          <div class="zr-list-row-meta">${[
            assigneeLabel,
            startLabel(t.start_date),
            due,
            urgencyLabel(t.urgency),
            (t.status ? statusLabel(t.status) : "")
          ].filter(Boolean).join(" · ")}</div>
        </div>
      `;
    }).join("");

    host.querySelectorAll(".item[data-id]").forEach((row) => {
      row.onclick = () => goTask(row.dataset.id);
    });
  }

  window.PlannerLeft = {
    renderLeft
  };
})();