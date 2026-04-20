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
        <!-- planner duplicate title removed -->
      </div>
    `;

    const pills = (role === "admin")
      ? `
        <div style="padding:0 10px 10px 10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-sm pl-left ${state.leftFilter==="mine" ? "is-active" : ""}" data-f="mine" type="button">Мои задачи</button>
          <button class="btn btn-sm pl-left ${state.leftFilter==="all" ? "is-active" : ""}" data-f="all" type="button">Все</button>
        </div>
      `
      : "";

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
      const isSel = selectedId && String(selectedId) === String(t.id);

      const dateParts = [];
      if(t.start_date) dateParts.push(esc(startLabel(t.start_date)));
      if(t.due_date){
        dateParts.push(
          isOverdue(t)
            ? `<span class="pl-due is-overdue">${esc(dueLabel(t.due_date))}</span>`
            : esc(dueLabel(t.due_date))
        );
      }

      const statusText = t.status
        ? `<div class="zr-list-row-meta" style="margin-top:4px;">${esc(statusLabel(t.status))}</div>`
        : "";

      return `
        <div class="item ${isSel ? 'zr-list-row--active' : ''}" data-id="${esc(t.id)}">
          <div class="zr-list-row-title">${esc(t.title || "(без названия)")}</div>
          ${dateParts.length ? `<div class="zr-list-row-meta" style="margin-top:6px;">${dateParts.join(" · ")}</div>` : ""}
          ${statusText}
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
