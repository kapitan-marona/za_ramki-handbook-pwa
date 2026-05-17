window.PlannerDetailSections = (() => {
  function create(deps){
    deps = deps || {};

    const esc = deps.esc || function(s){
      return (s==null?"":String(s))
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    };

    const getSelectedTaskId = deps.getSelectedTaskId || function(){ return null; };
    const resolvePersonLabel = deps.resolvePersonLabel || function(x){ return String(x || ""); };
    const getTaskAssigneeIds = deps.getTaskAssigneeIds || function(){ return []; };
    const plannerDocTypeLabel = deps.plannerDocTypeLabel || function(x){ return String(x || ""); };
    const statusLabel = deps.statusLabel || function(x){ return String(x || ""); };
    const uid = deps.uid || "";
    const isCurrentDetailTask = deps.isCurrentDetailTask || function(){ return true; };
    
    function abortIfTaskChanged(taskId, returnValue){
      const expectedTaskId = String(taskId || "");

      if(!expectedTaskId){
        return false;
      }

      if(!isCurrentDetailTask(expectedTaskId)){
        return returnValue === undefined ? true : returnValue;
      }

      return false;
    }

    async function fetchTaskFiles(taskId){
      if(!window.PlannerData) throw new Error("PlannerData missing");
      return await PlannerData.fetchTaskFiles(taskId);
    }

    async function fetchTaskLinks(taskId){
      if(!window.PlannerData) throw new Error("PlannerData missing");
      return await PlannerData.fetchTaskLinks(taskId);
    }

    async function fetchComments(taskId){
      if(!window.PlannerData) throw new Error("PlannerData missing");
      return await PlannerData.fetchComments(taskId);
    }

    async function fetchActivity(taskId){
      if(!window.PlannerData) throw new Error("PlannerData missing");
      return await PlannerData.fetchActivity(taskId);
    }

    function parseInternalDoc(f){
      if(!window.PlannerDocs || typeof PlannerDocs.parseInternalDoc !== "function"){
        throw new Error("PlannerDocs.parseInternalDoc missing");
      }
      return PlannerDocs.parseInternalDoc(f);
    }

    function parseTaskLink(link){
      if(!window.PlannerDocs || typeof PlannerDocs.parseTaskLink !== "function"){
        throw new Error("PlannerDocs.parseTaskLink missing");
      }
      return PlannerDocs.parseTaskLink(link);
    }

    function removeDocRowFromTaskView(linkId){
      if(!window.PlannerDocs || typeof PlannerDocs.removeDocRowFromTaskView !== "function"){
        throw new Error("PlannerDocs.removeDocRowFromTaskView missing");
      }
      return PlannerDocs.removeDocRowFromTaskView(linkId);
    }

    function openPlannerDoc(section, id){
      const sec = String(section || "").trim();
      const refId = String(id || "").trim();
      if(!sec || !refId) return;

      if(!["articles","checklists","templates"].includes(sec)) return;

      try{
        if(sec === "checklists"){
          const taskId = getSelectedTaskId();
          if(taskId){
            try{
              sessionStorage.setItem("zr_checklists_open_context", JSON.stringify({
                source: "planner",
                taskId: String(taskId),
                checklistId: String(refId)
              }));
            }catch(e){}
          }
        }

        if(typeof Router !== "undefined" && typeof Router.go === "function"){
          Router.go(sec, refId);
          return;
        }
      }catch(e){
      }

      location.hash = "#/" + encodeURIComponent(sec) + "/" + encodeURIComponent(refId);
    }

    const plannerDocsRuntime = (window.PlannerDocs && typeof PlannerDocs.create === "function")
      ? PlannerDocs.create({
          esc,
          plannerDocTypeLabel,
          fetchTaskLinks,
          fetchTaskFiles,
          parseTaskLink,
          parseInternalDoc,
          openPlannerDoc,
          removeDocRowFromTaskView
        })
      : null;

    async function loadChecklist(task, isReadOnly){
      const host = document.getElementById("plChecklist");
      const section = document.getElementById("plChecklistSection");
      const role = (window.App && App.session) ? String(App.session.role || "") : "";
      const isAdmin = role === "admin";
      const isArchived = !!(task && task.archived_at);
      const shouldKeepEmptySection = !!(isAdmin && !isArchived);

      try{
        if(!window.PlannerChecklistRuntime){
          throw new Error("PlannerChecklistRuntime missing");
        }

        if(!shouldKeepEmptySection && host){
          host.innerHTML = "";
        }

        const items = await PlannerChecklistRuntime.fetchChecklistItems(task.id);
        const safeItems = Array.isArray(items) ? items : [];
        
        if(abortIfTaskChanged(task.id)){
          return;
        }
        
        const shouldShowSection = safeItems.length > 0 || shouldKeepEmptySection;

        if(section){
          section.style.display = shouldShowSection ? "" : "none";
        }

        if(safeItems.length > 0){
          PlannerChecklistRuntime.renderChecklist(safeItems, !!isReadOnly);
        }else{
          if(host){
            host.innerHTML = "";
          }

          if(shouldKeepEmptySection){
            const hasInlineRendered = !!(
              host &&
              host.querySelector &&
              host.querySelector(".zr-planner-inline-cl")
            );

            if(!hasInlineRendered){
              PlannerChecklistRuntime.renderChecklist([], !!isReadOnly);
            }
          }
        }

        if(!isReadOnly && shouldShowSection){
          PlannerChecklistRuntime.bindChecklist(task);
        }
      }catch(err){
        if(section){
          section.style.display = "";
        }
        if(host){
          const text = (err && (err.message || err.details || err.hint))
            ? (err.message || err.details || err.hint)
            : String(err);
          host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки чекбоксов: ${esc(text)}</div>`;
        }
      }
    }

    async function loadDocs(task){
      if(plannerDocsRuntime && typeof plannerDocsRuntime.loadDocs === "function"){
        return await plannerDocsRuntime.loadDocs(task);
      }
      throw new Error("plannerDocsRuntime.loadDocs missing");
    }

    async function loadComments(task, isReadOnly){
      if(!window.PlannerComments || typeof PlannerComments.loadComments !== "function"){
        throw new Error("PlannerComments.loadComments missing");
      }

      const host = document.getElementById("plComments");

      const result = await PlannerComments.loadComments({
        host,
        task,
        uid,
        esc,
        resolvePersonLabel,
        getTaskAssigneeIds,
        fetchComments,
        loadComments,
        isReadOnly: !!isReadOnly
      });

      if(abortIfTaskChanged(task.id)){
        return;
      }

      return result;
    }

    async function loadActivity(task){
      if(!window.PlannerActivity || typeof PlannerActivity.loadActivity !== "function"){
        throw new Error("PlannerActivity.loadActivity missing");
      }

      const host = document.getElementById("plActivity");
      return await PlannerActivity.loadActivity(task, {
        host,
        fetchActivity,
        statusLabel,
        resolvePersonLabel,
        uid
      });
    }

    async function loadDetailSections(task, checklistReadOnly){
      const expectedTaskId = String(task && task.id || "");

      if(abortIfTaskChanged(expectedTaskId, false)){
        return false;
      }

      await loadChecklist(task, checklistReadOnly);

      if(abortIfTaskChanged(expectedTaskId, false)){
        return false;
      }

      await loadDocs(task);

      if(abortIfTaskChanged(expectedTaskId, false)){
        return false;
      }

      await loadComments(task, checklistReadOnly);

      if(abortIfTaskChanged(expectedTaskId, false)){
        return false;
      }

      await loadActivity(task);

      if(abortIfTaskChanged(expectedTaskId, false)){
        return false;
      }

      return true;
    }

    return {
      fetchTaskFiles,
      fetchTaskLinks,
      fetchComments,
      fetchActivity,
      parseInternalDoc,
      parseTaskLink,
      openPlannerDoc,
      removeDocRowFromTaskView,
      loadChecklist,
      loadDocs,
      loadComments,
      loadActivity,
      loadDetailSections
    };
  }

  return { create };
})();


