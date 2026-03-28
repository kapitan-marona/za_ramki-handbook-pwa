(function(){
  if(window.PlannerInlineChecklists) return;

  const PL_INLINE_CL_STATE_KEY = "zr_planner_inline_checklists_state";

  function normalizePlannerInlineItemsState(raw){
    if(!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    const next = {};
    Object.keys(raw).forEach((key) => {
      next[String(key)] = !!raw[key];
    });
    return next;
  }

  function getPlannerInlineItemChecked(itemsState, idx){
    return !!normalizePlannerInlineItemsState(itemsState)[String(idx)];
  }

  function getPlannerInlineChecklistUiState(){
    try{
      return JSON.parse(sessionStorage.getItem(PL_INLINE_CL_STATE_KEY) || "{}") || {};
    }catch(e){
      return {};
    }
  }

  function setPlannerInlineChecklistUiState(next){
    try{
      sessionStorage.setItem(PL_INLINE_CL_STATE_KEY, JSON.stringify(next || {}));
    }catch(e){}
  }

  function isPlannerInlineChecklistExpanded(taskId, checklistId){
    const map = getPlannerInlineChecklistUiState();
    const key = String(taskId || "") + "::" + String(checklistId || "");
    return map[key] !== false;
  }

  function setPlannerInlineChecklistExpanded(taskId, checklistId, expanded){
    const map = getPlannerInlineChecklistUiState();
    const key = String(taskId || "") + "::" + String(checklistId || "");
    map[key] = !!expanded;
    setPlannerInlineChecklistUiState(map);
  }

  function getPlannerInlineChecklistItems(def){
    const groups = Array.isArray(def && def.groups) ? def.groups : [];
    if(groups.length){
      let flatIndex = -1;
      return groups.map((group, groupIdx) => {
        const rows = Array.isArray(group && group.items)
          ? group.items
          : (Array.isArray(group && group.steps) ? group.steps : []);

        return {
          key: "g" + groupIdx,
          title: (group && group.title) ? String(group.title) : ("Группа " + (groupIdx + 1)),
          rows: rows.map((row, rowIdx) => {
            flatIndex += 1;
            return {
              index: flatIndex,
              order: rowIdx + 1,
              text: String(row || "")
            };
          })
        };
      });
    }

    const items = Array.isArray(def && def.items)
      ? def.items
      : (Array.isArray(def && def.steps) ? def.steps : []);

    return [{
      key: "plain",
      title: "",
      rows: items.map((row, idx) => ({
        index: idx,
        order: idx + 1,
        text: String(row || "")
      }))
    }];
  }

  function getChecklistInstanceOwnerUserId(task){
    try{
      const assigneeId = Array.isArray(task && task.assignees) && task.assignees.length
        ? String(task.assignees[0] || "").trim()
        : "";

      if(assigneeId) return assigneeId;

      const currentUserId =
        window?.App?.session?.user?.id ||
        window?.SB?.auth?.user?.()?.id ||
        "";

      return String(currentUserId || "").trim();
    }catch(e){
      return "";
    }
  }


  function getChecklistInstanceOwnerUserId(task){
    try{
      const assigneeId = Array.isArray(task && task.assignees) && task.assignees.length
        ? String(task.assignees[0] || "").trim()
        : "";

      if(assigneeId) return assigneeId;

      const currentUserId =
        window?.App?.session?.user?.id ||
        window?.SB?.auth?.user?.()?.id ||
        "";

      return String(currentUserId || "").trim();
    }catch(e){
      return "";
    }
  }

  function getPlannerChecklistApi(){
    if(window.ZRPlannerChecklistAPI) return window.ZRPlannerChecklistAPI;

    window.ZRPlannerChecklistAPI = {
      getCurrentUserId(){
        const userId =
          window?.App?.session?.user?.id ||
          window?.SB?.auth?.user?.()?.id ||
          "";

        if(!userId){
          throw new Error("Checklist user is not resolved.");
        }

        return String(userId);
      },

      async getInstance(taskId, checklistId, ownerUserId){
        if(!window.SB) throw new Error("Supabase client is not available.");
        if(!taskId) throw new Error("Checklist task_id is required.");
        if(!checklistId) throw new Error("Checklist checklist_id is required.");

        let query = SB
          .from("checklist_instances")
          .select("id,task_id,user_id,checklist_id,items_state,status,created_at,updated_at")
          .eq("task_id", String(taskId))
          .eq("checklist_id", String(checklistId));

        if(ownerUserId){
          query = query.eq("user_id", String(ownerUserId));
        }

        const { data, error } = await query
          .order("created_at", { ascending:true })
          .limit(2);

        if(error) throw error;

        const rows = Array.isArray(data) ? data : [];
        if(rows.length > 1){
          console.warn("[PlannerInlineChecklist] Duplicate instances detected for task_id + checklist_id", {
            task_id: String(taskId),
            checklist_id: String(checklistId),
            count: rows.length
          });
        }

        return rows.length ? rows[0] : null;
      },

      async createInstance(taskId, checklistId, ownerUserId){
        if(!window.SB) throw new Error("Supabase client is not available.");
        if(!taskId) throw new Error("Checklist task_id is required.");
        if(!checklistId) throw new Error("Checklist checklist_id is required.");

        const userId = ownerUserId ? String(ownerUserId) : this.getCurrentUserId();

        const payload = {
          task_id: String(taskId),
          user_id: userId,
          checklist_id: String(checklistId),
          items_state: {}
        };

        const { data, error } = await SB
          .from("checklist_instances")
          .insert(payload)
          .select("id,task_id,user_id,checklist_id,items_state,status,created_at,updated_at")
          .single();

        if(error) throw error;
        return data || null;
      },

      async resolveInstance(taskId, checklistId, ownerUserId){
        const existing = await this.getInstance(taskId, checklistId, ownerUserId);
        if(existing) return existing;

        try{
          return await this.createInstance(taskId, checklistId, ownerUserId);
        }catch(err){
          const fallback = await this.getInstance(taskId, checklistId, ownerUserId);
          if(fallback) return fallback;
          throw err;
        }
      },

      async deleteInstance(taskId, checklistId, ownerUserId){
        if(!window.SB) throw new Error("Supabase client is not available.");
        if(!taskId) throw new Error("Checklist task_id is required.");
        if(!checklistId) throw new Error("Checklist checklist_id is required.");

        let query = SB
          .from("checklist_instances")
          .delete()
          .eq("task_id", String(taskId))
          .eq("checklist_id", String(checklistId));

        if(ownerUserId){
          query = query.eq("user_id", String(ownerUserId));
        }

        const { error } = await query;

        if(error) throw error;
        return true;
      },

      async updateItemsState(instanceId, itemsState){
        if(!window.SB) throw new Error("Supabase client is not available.");

        const safeState = normalizePlannerInlineItemsState(itemsState);

        const { data, error } = await SB
          .from("checklist_instances")
          .update({
            items_state: safeState,
            updated_at: new Date().toISOString()
          })
          .eq("id", String(instanceId))
          .select("id,task_id,items_state,updated_at")
          .single();

        if(error) throw error;
        return data || null;
      }
    };

    return window.ZRPlannerChecklistAPI;
  }

  async function fetchInlineChecklistDocs(task, deps){
    const fetchTaskLinks = deps.fetchTaskLinks;
    const fetchTaskFiles = deps.fetchTaskFiles;
    const parseTaskLink = deps.parseTaskLink;
    const parseInternalDoc = deps.parseInternalDoc;

    const [links, files] = await Promise.all([
      fetchTaskLinks(task.id).catch(() => []),
      fetchTaskFiles(task.id).catch(() => [])
    ]);

    const docsFromLinks = (links || []).map(parseTaskLink).filter(Boolean);
    const docsFromFiles = (files || []).map(parseInternalDoc).filter(Boolean);

    const all = [...docsFromLinks, ...docsFromFiles]
      .filter(d => d && d.section === "checklists" && d.id);

    const map = new Map();
    all.forEach((d) => {
      const id = String(d.id || "");
      if(!id) return;
      if(!map.has(id)) map.set(id, d);
    });

    return Array.from(map.values());
  }

  async function fetchInlineChecklistDefs(checklistIds){
    const ids = Array.isArray(checklistIds)
      ? checklistIds.map(x => String(x)).filter(Boolean)
      : [];

    if(!ids.length) return [];

    if(!window.SB) throw new Error("Supabase client is not available.");

    const { data, error } = await SB
      .from("kb_checklists")
      .select("id,title,desc,items,published,sort,created_at,updated_at")
      .in("id", ids)
      .eq("published", true);

    if(error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const byId = new Map(rows.map(x => [String(x.id), x]));

    return ids.map(id => byId.get(String(id))).filter(Boolean);
  }

  function renderInlineChecklistBlocks(task, defs, isReadOnly, deps){
    const esc = deps.esc;
    const runtime = window.__plannerInlineChecklistRuntime || {};
    const disabledAttr = isReadOnly ? 'disabled' : '';
    const isAdmin = String(window?.App?.session?.role || "") === "admin";

    return `
      <div class="zr-planner-inline-checklists">
        ${defs.map((def) => {
          const checklistId = String(def.id || "");
          const linkId = String(def.__task_link_id || "");
          const rt = runtime[checklistId] || {};
          const itemsState = normalizePlannerInlineItemsState(rt.itemsState || {});
          const expanded = isPlannerInlineChecklistExpanded(task.id, checklistId);
          const groups = getPlannerInlineChecklistItems(def);

          return `
            <div class="zr-card zr-card--subtle zr-planner-inline-cl" data-inline-cl="${esc(checklistId)}">
              <div class="zr-planner-inline-cl-head">
                <button
                  class="btn btn-sm pl-btn-ghost zr-planner-inline-cl-toggle"
                  type="button"
                  data-inline-cl-toggle="${esc(checklistId)}"
                  aria-expanded="${expanded ? "true" : "false"}"
                >${expanded ? "▾" : "▸"} ${esc(def.title || "Чек-лист")}</button>

                <div class="zr-inline-md" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span
                    class="zr-planner-inline-cl-status"
                    data-inline-cl-status="${esc(checklistId)}"
                  ></span>

                  ${(isAdmin && !isReadOnly && linkId) ? `
                    <button
                      class="btn btn-sm pl-btn-danger-soft"
                      type="button"
                      data-inline-cl-remove="${esc(checklistId)}"
                      data-inline-cl-link-id="${esc(linkId)}"
                    >Удалить</button>
                  ` : ``}
                </div>
              </div>

              <div
                class="zr-planner-inline-cl-body"
                data-inline-cl-body="${esc(checklistId)}"
                style="display:${expanded ? "block" : "none"};"
              >
                ${groups.map((group) => `
                  <div class="zr-planner-inline-cl-group">
                    ${group.title ? `<div class="zr-planner-inline-cl-group-title">${esc(group.title)}</div>` : ``}

                    <div class="zr-planner-inline-cl-list">
                      ${group.rows.length ? group.rows.map((row) => `
                        <label class="zr-card zr-card--row zr-planner-inline-cl-row">
                          <input
                            type="checkbox"
                            data-inline-cl-checkbox="1"
                            data-checklist-id="${esc(checklistId)}"
                            data-item-index="${esc(row.index)}"
                            ${getPlannerInlineItemChecked(itemsState, row.index) ? "checked" : ""}
                            ${disabledAttr}
                          >
                          ${group.title ? `<span class="tag">${esc(row.order)}</span>` : ``}
                          <span class="zr-planner-inline-cl-text">${esc(row.text)}</span>
                        </label>
                      `).join("") : `<div class="zr-planner-muted">Пустой чек-лист.</div>`}
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function setInlineChecklistStatus(checklistId, text, tone){
    const host = document.querySelector('[data-inline-cl-status="' + String(checklistId) + '"]');
    if(!host) return;

    host.textContent = text ? String(text) : "";
    host.setAttribute("data-tone", tone ? String(tone) : "neutral");
  }

  function setInlineChecklistInputsDisabled(checklistId, disabled){
    const root = document.querySelector('[data-inline-cl="' + String(checklistId) + '"]');
    if(root){
      root.classList.toggle("is-saving", !!disabled);
    }

    document.querySelectorAll('[data-inline-cl-checkbox="1"][data-checklist-id="' + String(checklistId) + '"]').forEach((el) => {
      try{
        el.setAttribute("aria-disabled", disabled ? "true" : "false");
      }catch(e){}
    });
  }

  function bindInlineChecklistToggles(task){
    document.querySelectorAll("[data-inline-cl-toggle]").forEach((btn) => {
      btn.onclick = () => {
        const checklistId = String(btn.getAttribute("data-inline-cl-toggle") || "");
        if(!checklistId) return;

        const body = document.querySelector('[data-inline-cl-body="' + checklistId + '"]');
        if(!body) return;

        const expanded = body.style.display !== "none";
        const nextExpanded = !expanded;

        body.style.display = nextExpanded ? "block" : "none";
        btn.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
        btn.textContent = (nextExpanded ? "▾ " : "▸ ") + btn.textContent.replace(/^[▾▸]\s*/, "");

        setPlannerInlineChecklistExpanded(task.id, checklistId, nextExpanded);
      };
    });
  }

  function bindInlineChecklistCheckboxes(task, isReadOnly, deps){
    if(isReadOnly) return;

    const fetchAllActiveTasks = deps.fetchAllActiveTasks;
    const renderLeft = deps.renderLeft;
    const getSelectedTaskId = deps.getSelectedTaskId;
    const renderDetails = deps.renderDetails;

    window.__plannerInlineChecklistBusy = window.__plannerInlineChecklistBusy || {};

    document.querySelectorAll('[data-inline-cl-checkbox="1"]').forEach((input) => {
      input.onchange = async () => {
        const checklistId = String(input.getAttribute("data-checklist-id") || "");
        const itemIndex = String(input.getAttribute("data-item-index") || "");

        if(!checklistId || itemIndex === "") return;

        const runtime = window.__plannerInlineChecklistRuntime || {};
        const rt = runtime[checklistId];

        if(!rt || !rt.instanceId){
          input.checked = false;
          setInlineChecklistStatus(checklistId, "Instance не найден", "error");
          return;
        }

        if(window.__plannerInlineChecklistBusy[checklistId]){
          input.checked = getPlannerInlineItemChecked(rt.itemsState, itemIndex);
          return;
        }

        const prevState = normalizePlannerInlineItemsState(rt.itemsState || {});
        const nextState = normalizePlannerInlineItemsState(rt.itemsState || {});
        nextState[itemIndex] = !!input.checked;
        rt.itemsState = nextState;

        window.__plannerInlineChecklistBusy[checklistId] = true;
        setInlineChecklistInputsDisabled(checklistId, true);
        setInlineChecklistStatus(checklistId, "Сохранение…", "saving");

        try{
          let needFullRefresh = false;

          try{
            if(task && String(task.status || "") === "taken"){
              await PlannerActions.setStatus(task.id, "in_progress");
              needFullRefresh = true;
            }
          }catch(e){
            console.warn("[PlannerInlineChecklist] auto-progress error", e);
          }

          const saved = await getPlannerChecklistApi().updateItemsState(rt.instanceId, nextState);
          rt.itemsState = normalizePlannerInlineItemsState(saved && saved.items_state ? saved.items_state : nextState);
          setInlineChecklistStatus(checklistId, "Сохранено", "success");

          if(needFullRefresh){
            const tasks2 = await fetchAllActiveTasks();
            renderLeft(tasks2);

            const sel2 = getSelectedTaskId();
            if(sel2){
              const t2 = tasks2.find(x => String(x.id) === String(sel2));
              if(t2) renderDetails(t2);
            }
            return;
          }
        }catch(err){
          console.warn("[PlannerInlineChecklist] save error", err);
          rt.itemsState = prevState;
          input.checked = getPlannerInlineItemChecked(prevState, itemIndex);
          setInlineChecklistStatus(checklistId, "Ошибка сохранения", "error");
        }finally{
          window.__plannerInlineChecklistBusy[checklistId] = false;
          setInlineChecklistInputsDisabled(checklistId, false);
        }
      };
    });
  }

  function bindInlineChecklistRemoveButtons(task, isReadOnly){
    if(isReadOnly) return;
    if(String(window?.App?.session?.role || "") !== "admin") return;

    document.querySelectorAll("[data-inline-cl-remove]").forEach((btn) => {
      btn.onclick = async () => {
        const checklistId = String(btn.getAttribute("data-inline-cl-remove") || "");
        const linkId = String(btn.getAttribute("data-inline-cl-link-id") || "");

        if(!checklistId || !linkId) return;
        if(!confirm("Удалить чек-лист из задачи?")) return;

        btn.disabled = true;

        try{
          if(!window.PlannerAPI || typeof PlannerAPI.removeTaskLink !== "function"){
            throw new Error("removeTaskLink missing");
          }

          await PlannerAPI.removeTaskLink(linkId);

          try{
            await getPlannerChecklistApi().deleteInstance(task.id, checklistId, getChecklistInstanceOwnerUserId(task));
          }catch(e){
            console.warn("[PlannerInlineChecklist] deleteInstance warning", e);
          }

          removeInlineChecklistFromTaskView(checklistId);
        }catch(err){
          console.warn("[PlannerInlineChecklist] remove linked checklist error", err);
          const text = (err && (err.message || err.details || err.hint))
            ? (err.message || err.details || err.hint)
            : String(err);
          alert("Ошибка: " + text);
          btn.disabled = false;
        }
      };
    });
  }

  function removeInlineChecklistFromTaskView(checklistId){
    const safeId = String(checklistId || "");
    if(!safeId) return;

    const host = document.getElementById("plChecklist");
    if(!host) return;

    host.querySelectorAll('[data-inline-cl="' + safeId + '"]').forEach((node) => {
      try{ node.remove(); }catch(e){}
    });

    try{
      if(window.__plannerInlineChecklistRuntime){
        delete window.__plannerInlineChecklistRuntime[safeId];
      }
    }catch(e){}

    try{
      if(window.__plannerInlineChecklistBusy){
        delete window.__plannerInlineChecklistBusy[safeId];
      }
    }catch(e){}

    const wrap = host.querySelector(".zr-planner-inline-checklists");
    if(wrap && !wrap.querySelector(".zr-planner-inline-cl")){
      try{ wrap.remove(); }catch(e){}
    }

    const hasPlannerItems =
      !!host.querySelector(".zr-planner-checklist") ||
      !!host.querySelector(".zr-planner-checklist-list") ||
      !!host.querySelector(".pl-ci");

    const hasInlineItems = !!host.querySelector(".zr-planner-inline-cl");

    if(!hasPlannerItems && !hasInlineItems){
      host.innerHTML = `<div class="zr-planner-muted">Пункты пока не добавлены.</div>`;
    }
  }

  async function loadInlineChecklists(task, isReadOnly, taskItems, opts, deps){
    const host = document.getElementById("plChecklist");
    if(!host) return;

    try{
      host.querySelectorAll(".zr-planner-inline-checklists").forEach((node) => {
        try{ node.remove(); }catch(e){}
      });

      window.__plannerInlineChecklistRuntime = {};
      window.__plannerInlineChecklistBusy = {};

      const currentText = (host.textContent || "").trim();
      const hasEmptyPlaceholder =
        currentText === "Пункты пока не добавлены." ||
        currentText === "Не удалось загрузить чек-лист.";

      if(hasEmptyPlaceholder){
        host.innerHTML = "";
      }

      const docs = await fetchInlineChecklistDocs(task, deps);
      if(!docs.length){
        return;
      }

      const defs = await fetchInlineChecklistDefs(docs.map(d => d.id));
      if(!defs.length){
        return;
      }

      const docsByChecklistId = {};
      docs.forEach((doc) => {
        const id = String(doc && doc.id ? doc.id : "");
        if(!id || docsByChecklistId[id]) return;
        docsByChecklistId[id] = doc;
      });

      const defsWithLinks = defs.map((def) => {
        const doc = docsByChecklistId[String(def && def.id ? def.id : "")] || {};
        return {
          ...def,
          __task_link_id: String(
            doc.link_id ||
            doc.task_link_id ||
            doc.raw_link_id ||
            doc.id_link ||
            ""
          )
        };
      });

      const api = getPlannerChecklistApi();
      const runtime = {};
      const ownerUserId = getChecklistInstanceOwnerUserId(task);

      for(const def of defs){
        const instance = await api.resolveInstance(task.id, def.id, ownerUserId);
        runtime[String(def.id)] = {
          instanceId: String(instance && instance.id ? instance.id : ""),
          itemsState: normalizePlannerInlineItemsState(instance && instance.items_state ? instance.items_state : {})
        };
      }

      window.__plannerInlineChecklistRuntime = runtime;

      if(!Array.isArray(taskItems) || taskItems.length === 0){
        host.innerHTML = "";
      }

      host.insertAdjacentHTML("beforeend", renderInlineChecklistBlocks(task, defsWithLinks, !!isReadOnly, deps));

      bindInlineChecklistToggles(task);
      bindInlineChecklistRemoveButtons(task, !!isReadOnly);
      bindInlineChecklistCheckboxes(task, !!isReadOnly, deps);
    }catch(err){
      console.warn("[PlannerInlineChecklist] load error", err);

      if(!Array.isArray(taskItems) || taskItems.length === 0){
        host.innerHTML = `<div class="zr-planner-muted">Не удалось загрузить чек-лист.</div>`;
      }else{
        host.insertAdjacentHTML("beforeend", `<div class="zr-planner-muted">Часть чек-листов не загрузилась.</div>`);
      }
    }
  }

  window.PlannerInlineChecklists = {
    getPlannerChecklistApi,
    normalizePlannerInlineItemsState,
    getPlannerInlineItemChecked,
    getPlannerInlineChecklistUiState,
    setPlannerInlineChecklistUiState,
    isPlannerInlineChecklistExpanded,
    setPlannerInlineChecklistExpanded,
    getPlannerInlineChecklistItems,
    fetchInlineChecklistDocs,
    fetchInlineChecklistDefs,
    renderInlineChecklistBlocks,
    setInlineChecklistStatus,
    setInlineChecklistInputsDisabled,
    bindInlineChecklistToggles,
    bindInlineChecklistCheckboxes,
    removeInlineChecklistFromTaskView,
    loadInlineChecklists
  };
})();

