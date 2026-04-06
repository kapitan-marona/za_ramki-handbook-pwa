window.PlannerChecklistRuntime = (function(){
  let ctx = {};

  function init(nextCtx){
    ctx = nextCtx || {};
  }

  function getChecklistHost(){
    return (ctx && typeof ctx.getChecklistHost === "function")
      ? ctx.getChecklistHost()
      : document.getElementById("plChecklist");
  }

  function syncChecklistHeaderButton(hasItems){
    const addBtn = document.getElementById("plAddChecklistBtn");
    const removeBtn = document.getElementById("plRemoveChecklistBtn");

    if(addBtn){
      addBtn.style.display = hasItems ? "none" : "";
    }

    if(removeBtn){
      removeBtn.style.display = hasItems ? "" : "none";
    }
  }

  async function fetchChecklistItems(taskId){
    if(!window.PlannerData) throw new Error("PlannerData missing");
    return await PlannerData.fetchChecklistItems(taskId);
  }

  function renderChecklist(items, isReadOnly){
    const host = getChecklistHost();
    if(!host) return;
    
    const hasItems = Array.isArray(items) && items.length > 0;
    syncChecklistHeaderButton(hasItems);

    const esc = (ctx && typeof ctx.esc === "function")
      ? ctx.esc
      : function(s){
          return (s==null?"":String(s))
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
        };

    if(!items || items.length === 0){
      host.innerHTML = `<div class="zr-planner-muted">Пункты пока не добавлены.</div>`;
      return;
    }

    const doneCount = items.filter(x => !!x.done).length;
    const total = items.length;

    host.innerHTML = `
      <div class="zr-planner-checklist">
        <div class="zr-planner-checklist-summary">${doneCount}/${total} выполнено</div>
        <div class="zr-planner-checklist-list">
          ${items.map(it => `
            <label class="zr-card zr-card--row zr-planner-checklist-row" style="cursor:${isReadOnly ? "default" : "pointer"};">
              <input
                type="checkbox"
                class="pl-ci"
                data-id="${esc(it.id)}"
                ${it.done ? "checked" : ""}
                ${isReadOnly ? "disabled" : ""}
              >
              <span class="zr-planner-checklist-text ${it.done ? "is-done" : ""}">${esc(it.text || "(пусто)")}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `;
    try{
      const removeBtn = document.getElementById("plRemoveChecklistBtn");

      if(removeBtn){
        removeBtn.onclick = null;
      }

      if(!isReadOnly && ctx && ctx.getSelectedTaskId && removeBtn){
        const taskId = ctx.getSelectedTaskId();

        if(taskId){
          removeBtn.onclick = async () => {
            if(!confirm("Удалить чек-лист из задачи?")) return;

            try{
              await PlannerAPI.clearTaskChecklist(taskId);
            }catch(err){
              console.warn("[ChecklistRuntime] clear runtime error", err);
              alert("Ошибка удаления");
              return;
            }

            try{
              const links = await PlannerAPI.fetchTaskLinks(taskId);
              console.log("[DEBUG links after remove]", links);
              const checklistLink = (links || []).find(l => String(l.link_type || "") === "checklist");

              if(checklistLink){
                await PlannerAPI.removeTaskLink(checklistLink.id);
              }
            }catch(err){
              console.warn("[ChecklistRuntime] link cleanup warning", err);
            }

            try{
              const fresh = await fetchChecklistItems(taskId);
              renderChecklist(fresh, false);
              // task is not available in renderChecklist scope; no re-bind needed after remove
            }catch(err){
              console.warn("[ChecklistRuntime] refresh after remove warning", err);
              renderChecklist([], false);
            }
          };
        }
      }
    }catch(e){
      console.warn("[ChecklistRuntime] action bind error", e);
    }      
    
  }

  function bindChecklist(task){
    const host = getChecklistHost();
    if(!host) return;

    host.querySelectorAll(".pl-ci").forEach(cb => {
      cb.onchange = async () => {
        const id = cb.dataset.id;
        const newDone = !!cb.checked;

        cb.disabled = true;

        try{
          try{
            if(task && String(task.status || "") === "taken"){
              await PlannerActions.setStatus(task.id, "in_progress");
            }
          }catch(e){
            console.warn("[Planner] auto-progress error", e);
          }

          const rpc = await (PlannerAPI.setChecklistDone(id, newDone).then(() => ({ error: null })).catch(error => ({ error })));
          if(rpc && rpc.error) throw rpc.error;

          const needFull = (String(task.status || "") === "taken");

          if(needFull){
            const tasks2 = await ctx.fetchAllActiveTasks();
            ctx.renderLeft(tasks2);

            const sel2 = ctx.getSelectedTaskId();
            if(sel2){
              const t2 = tasks2.find(x => String(x.id) === String(sel2));
              if(t2) ctx.renderDetails(t2);
            }
          }else{
            const row = cb.closest(".zr-planner-checklist-row");
            const textEl = row ? row.querySelector(".zr-planner-checklist-text") : null;

            if(textEl){
              textEl.classList.toggle("is-done", newDone);
            }

            const all = Array.from(host.querySelectorAll(".pl-ci"));
            const doneCount = all.filter(x => x.checked).length;
            const total = all.length;
            const summary = host.querySelector(".zr-planner-checklist-summary");

            if(summary){
              summary.textContent = `${doneCount}/${total} выполнено`;
            }

            cb.disabled = false;
          }
        }catch(err){
          console.warn("[Planner] checklist toggle error", err);
          const items = await fetchChecklistItems(task.id);
          renderChecklist(items);
          bindChecklist(task);
        }
      };
    });
  }

  async function loadChecklist(task, isReadOnly){
    try{
      const items = await fetchChecklistItems(task.id);
      const safeItems = Array.isArray(items) ? items : [];

      renderChecklist(safeItems, !!isReadOnly);
      bindChecklist(task);
    }catch(err){
      console.warn("[Planner] checklist load error", err);
      const host = getChecklistHost();
      const esc = (ctx && typeof ctx.esc === "function")
        ? ctx.esc
        : function(s){
            return (s==null?"":String(s))
              .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
              .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
          };

      if(host){
        const text = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : String(err);
        host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки чекбоксов: ${esc(text)}</div>`;
      }
    }
  }

  return {
    init,
    fetchChecklistItems,
    renderChecklist,
    bindChecklist,
    loadChecklist
  };
})();


