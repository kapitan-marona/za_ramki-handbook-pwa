(function(){
  if(window.PlannerBoard) return;

  function renderBoard(ctx){
    const {
      board,
      viewerEl,
      tasks,
      esc,
      dueLabel,
      startLabel,
      urgencyLabel,
      statusLabel,
      isOverdue,
      selectedId,
      goTask
    } = ctx || {};

    if(!board) return;

    const grouped = window.PlannerState
      ? PlannerState.groupBoardTasks(tasks)
      : {
          new: tasks.filter(t => t.status === "new"),
          work: tasks.filter(t => ["taken","in_progress","problem"].includes(t.status)),
          done: tasks.filter(t => t.status === "done")
        };

    const cols = [
      { key:"new", label:"Новые задачи" },
      { key:"work", label:"В работе" },
      { key:"done", label:"Завершено" },
    ];

    const colHtml = cols.map((c) => {
      let items = grouped[c.key] || [];

      items = window.PlannerState
        ? PlannerState.sortBoardItems(items)
        : [...items].sort((a,b) => {
            const da = a && a.due_date ? String(a.due_date) : "9999-99-99";
            const db = b && b.due_date ? String(b.due_date) : "9999-99-99";
            if(da !== db) return da < db ? -1 : 1;

            const ua = a && a.updated_at ? String(a.updated_at) : "";
            const ub = b && b.updated_at ? String(b.updated_at) : "";
            if(ua !== ub) return ua > ub ? -1 : 1;

            return 0;
          });

      const cards = items.length
        ? items.map((t) => {
            const due = t.due_date
              ? `<span class="pl-due ${isOverdue(t) ? "is-overdue" : ""}">${esc(dueLabel(t.due_date))}</span>`
              : "";

            const isProblem = (String(t.status || "") === "problem");
            const isSel = selectedId && String(selectedId) === String(t.id);
            const projectLine = t.project_title
              ? `<div class="item-meta" style="margin-top:6px;">${esc(t.project_title)}</div>`
              : "";

            return `
              <div class="item" data-id="${esc(t.id)}" style="margin-top:10px; ${isProblem ? 'outline:1px solid rgba(255,80,80,.45); box-shadow:0 0 0 1px rgba(255,80,80,.18), 0 12px 30px rgba(0,0,0,.35);' : ''} ${isSel ? 'outline:1px solid rgba(255,255,255,.18); box-shadow:0 0 0 1px rgba(196,90,42,.25), 0 12px 30px rgba(0,0,0,.35);' : ''}">
                <div class="item-title">${esc(t.title || "(без названия)")}</div>
                ${projectLine}
                <div class="item-meta">${[
                  startLabel(t.start_date),
                  dueLabel(t.due_date),
                  urgencyLabel(t.urgency),
                  statusLabel(t.status || "")
                ].filter(Boolean).map(esc).join(" · ")}</div>
              </div>
            `;
          }).join("")
        : `<div class="zr-board-col-empty">Пусто</div>`;

      return `
        <div class="zr-board-col">
          <div class="zr-board-col-head">
            <div class="zr-board-col-title">${esc(c.label)}</div>
            <div class="zr-board-col-count">${items.length}</div>
          </div>
          ${cards}
        </div>
      `;
    }).join("");

    board.innerHTML = `
      <div style="display:flex; gap:12px; overflow:auto; padding:0 12px 12px 12px;">
        ${colHtml}
      </div>
    `;

    if(viewerEl){
      viewerEl.querySelectorAll(".item[data-id]").forEach((card) => {
        card.style.cursor = "pointer";
        card.onclick = () => goTask(card.dataset.id);
      });
    }
  }

  window.PlannerBoard = {
    renderBoard
  };
})();