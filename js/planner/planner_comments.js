(function(){
  if(window.PlannerComments) return;

  function fmtCommentTs(ts){
    if(!ts) return "";
    try{
      const d = new Date(ts);
      const dd = String(d.getDate()).padStart(2,"0");
      const mm = String(d.getMonth() + 1).padStart(2,"0");
      const hh = String(d.getHours()).padStart(2,"0");
      const mi = String(d.getMinutes()).padStart(2,"0");
      return `${dd}.${mm}, ${hh}:${mi}`;
    }catch(_){
      return String(ts);
    }
  }

  function renderComments(ctx){
    const host = ctx.host;
    if(!host) return;

    const task = ctx.task;
    const items = Array.isArray(ctx.items) ? ctx.items : [];
    const uid = ctx.uid;
    const esc = ctx.esc;
    const resolvePersonLabel = ctx.resolvePersonLabel;

    const list = (items.length === 0)
      ? `<div class="zr-planner-muted">Комментариев пока нет.</div>`
      : `<div class="zr-planner-comments">
          ${items.map((c) => {
            const author = resolvePersonLabel({
              id: c.author_id,
              display_name: c.author_display_name,
              full_name: c.author_name,
              name: c.author_label,
              email: c.author_email
            }, { uid, fallback: "Автор" });

            const ts = fmtCommentTs(c.created_at);
            const canDeleteOwn = !!(uid && c && c.author_id && String(c.author_id) === String(uid));

            const deleteBtn = canDeleteOwn
              ? `<button
                  class="btn btn-sm pl-btn-ghost pl-comment-delete"
                  data-comment-id="${esc(c.id)}"
                  type="button"
                  title="Удалить комментарий"
                >Удалить</button>`
              : ``;

            return `
              <div class="zr-card zr-card--row zr-planner-comment-row">
                <div class="zr-planner-comment-meta">
                  <span class="zr-planner-comment-author">${esc(author)}</span>
                  <span class="zr-planner-comment-time">${esc(ts)}</span>
                  ${deleteBtn}
                </div>
                <div class="zr-planner-comment-main">
                  <span class="zr-planner-comment-author-inline">${esc(author)}:</span>
                  <span class="zr-planner-comment-body-inline">${esc(c.body || "")}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>`;

    host.innerHTML = `
      ${list}
      <div class="zr-planner-comment-compose">
        <textarea id="plCommentInput" rows="3" class="pl-control pl-textarea" placeholder="Напишите комментарий…"></textarea>
        <div class="zr-planner-comment-footer">
          <button class="btn btn-sm pl-btn-primary" id="plCommentSend" type="button">Отправить</button>
          <span class="zr-planner-muted" id="plCommentMsg"></span>
        </div>
      </div>
    `;

    const send = document.getElementById("plCommentSend");
    const inp = document.getElementById("plCommentInput");
    const msg = document.getElementById("plCommentMsg");

    host.querySelectorAll(".pl-comment-delete").forEach((btn) => {
      btn.onclick = async () => {
        const commentId = btn.dataset.commentId;
        if(!commentId) return;
        if(!confirm("Удалить комментарий?")) return;

        btn.disabled = true;

        try{
          if(!window.PlannerAPI || typeof PlannerAPI.deleteTaskComment !== "function"){
            throw new Error("deleteTaskComment missing");
          }

          await PlannerAPI.deleteTaskComment(commentId);

          const row = btn.closest(".zr-planner-comment-row");
          if(row){
            try{ row.remove(); }catch(e){}
          }

          const list = host.querySelector(".zr-planner-comments");
          const hasRows = !!(list && list.querySelector(".zr-planner-comment-row"));

          if(list && !hasRows){
            list.outerHTML = `<div class="zr-planner-muted">Комментариев пока нет.</div>`;
          }
        }catch(err){
          console.warn("[Planner] delete comment error", err);
          const t = (err && (err.message || err.details || err.hint))
            ? (err.message || err.details || err.hint)
            : String(err);
          alert("Ошибка: " + t);
          btn.disabled = false;
        }
      };
    });

    if(send){
      send.onclick = async () => {
        const text = (inp && inp.value) ? inp.value.trim() : "";
        if(!text){
          if(msg) msg.textContent = "Пустой комментарий.";
          return;
        }

        send.disabled = true;
        if(msg) msg.textContent = "Сохраняю…";

        try{
          try{
            if(task && String(task.status || "") === "taken"){
              await window.PlannerActions.setStatus(task.id, "in_progress");
            }
          }catch(e){
            console.warn("[Planner] auto-progress error", e);
          }

          const r = await (
            window.PlannerAPI.addTaskComment(task.id, text)
              .then(() => ({ error: null }))
              .catch(error => ({ error }))
          );

          try{
            const assignees = ctx.getTaskAssigneeIds(task);
            const targetUserId = assignees.length ? String(assignees[0]) : "";
            const actorId = String(window.App?.session?.user?.id || "");

            if(
              targetUserId &&
              targetUserId !== actorId &&
              typeof window.sendPlannerPush === "function"
            ){
              window.sendPlannerPush({
                userId: targetUserId,
                title: "ZA RAMKI",
                body: (task && task.title ? task.title + " — новый комментарий" : "Новый комментарий"),
                url: "./#/planner/" + task.id,
                tag: "planner-comment_added-" + task.id
              });
            }
          }catch(e){
            console.warn("[PlannerPush] comment_added error", e);
          }

          if(r && r.error) throw r.error;

          if(inp) inp.value = "";
          if(msg) msg.textContent = "Готово.";

          await ctx.loadComments(task);
        }catch(err){
          console.warn("[Planner] add comment error", err);
          const t = (err && (err.message || err.details || err.hint))
            ? (err.message || err.details || err.hint)
            : String(err);
          if(msg) msg.textContent = "Ошибка: " + t;
          send.disabled = false;
        }
      };
    }
  }

  async function loadComments(ctx){
    const host = ctx.host;
    if(host) host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;

    try{
      const items = await ctx.fetchComments(ctx.task.id);
      renderComments({
        ...ctx,
        items
      });
    }catch(err){
      console.warn("[Planner] comments load error", err);
      const text = (err && (err.message || err.details || err.hint))
        ? (err.message || err.details || err.hint)
        : String(err);

      if(host){
        host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки комментариев: ${ctx.esc(text)}</div>`;
      }
    }
  }

  window.PlannerComments = {
    fmtCommentTs,
    renderComments,
    loadComments
  };
})();