/* ZA RAMKI — PlannerAPI (data + RPC)
   Purpose: isolate Supabase calls from planner view.
   Rule: no top-level await; only functions returning Promises.
*/
(function(){
  if(window.PlannerAPI) return;

  function plannerPushDedupeKey(userId, event, taskId){
    return [
      String(userId || ""),
      String(event || ""),
      String(taskId || "")
    ].join("|");
  }

  function plannerPushAllowed(userId, event, taskId){
    try{
      if(!userId || !event || !taskId) return false;

      const now = Date.now();
      const key = plannerPushDedupeKey(userId, event, taskId);

      window.__plannerPushDedupeMap = window.__plannerPushDedupeMap || {};
      const last = Number(window.__plannerPushDedupeMap[key] || 0);

      if(now - last < 5000){
        return false;
      }

      window.__plannerPushDedupeMap[key] = now;
      return true;
    }catch(e){
      return true;
    }
  }

  async function fetchAllActiveTasks(opts){
    const role = opts && opts.role ? String(opts.role) : null;
    const today = opts && opts.today ? String(opts.today) : null;
    const currentUserId = opts && opts.userId
      ? String(opts.userId)
      : String(window.App?.session?.user?.id || "");

    let tasks = [];

    try{
      tasks = await ZRBackend.tasks.listActiveBasic();
    }catch(err){
      console.warn("[PlannerAPI] fetchAllActiveTasks error", err);
      return [];
    }

    if(role !== "admin"){
      const staffTaskIds = tasks
        .filter(t => String((t && t.role) || "all").trim() === "staff")
        .map(t => t && t.id ? String(t.id) : "")
        .filter(Boolean);

      let assigneesByTask = {};
      if(staffTaskIds.length > 0){
        try{
          assigneesByTask = await fetchTasksAssigneesBatch(staffTaskIds);
        }catch(err){
          console.warn("[PlannerAPI] assignee visibility filter error", err);
          assigneesByTask = {};
        }
      }

      tasks = tasks.filter(t => {
        const r = (t && t.role != null) ? String(t.role).trim() : "all";

        if(r === "admin") return false;
        if(!r || r === "all") return true;

        if(r === "staff"){
          const taskId = t && t.id ? String(t.id) : "";
          const assigneeIds = taskId && assigneesByTask[taskId]
            ? assigneesByTask[taskId].map(x => String(x))
            : [];

          const legacyAssigneeId = t && t.assignee_id ? String(t.assignee_id) : "";

          return !!currentUserId && (
            assigneeIds.includes(currentUserId) ||
            legacyAssigneeId === currentUserId
          );
        }

        return false;
      });
    }

    if(role !== "admin" && today){
      tasks = tasks.filter(t => !t.start_date || String(t.start_date) <= today);
    }

    return tasks;
  }

  async function setTaskStatus(taskId, newStatus){
    const before = await ZRBackend.tasks.getStatusSnapshot(taskId);

    await ZRBackend.tasks.setStatus(taskId, newStatus);

    // push moved to PlannerActions layer

    return true;
  }

  async function fetchChecklistItems(taskId){
    return await ZRBackend.taskChecklistItems.listByTask(taskId);
  }

  async function setChecklistDone(itemId, done){
    return await ZRBackend.taskChecklistItems.setDone(itemId, done);
  }

  async function fetchTaskFiles(taskId){
    return await ZRBackend.taskFiles.listByTask(taskId);
  }

  async function fetchComments(taskId){
    return await ZRBackend.taskComments.listByTask(taskId);
  }

  async function addTaskComment(taskId, body){
    await ZRBackend.taskComments.add(taskId, body);

    // push moved to PlannerActions layer

    return true;
  }

  async function deleteTaskComment(commentId){
    if(!commentId) throw new Error("commentId required");
    return await ZRBackend.taskComments.softDelete(commentId);
  }

  async function archiveTask(taskId){
    return await ZRBackend.tasks.archive(taskId);
  }

  async function archiveDoneTasks(){
    return await ZRBackend.tasks.archiveDone();
  }

  async function createTask(payload){
    const title = payload && payload.title ? String(payload.title).trim() : "";
    if(!title) throw new Error("Введите название задачи.");

    const row = {
      title,
      body: payload && payload.body != null ? String(payload.body) : "",
      status: "new",
      start_date: payload && payload.start_date ? String(payload.start_date) : (new Date().toISOString().slice(0,10)),
      due_date: payload && payload.due_date ? String(payload.due_date) : (new Date(Date.now()+86400000).toISOString().slice(0,10)),
      assignee_id: payload && payload.assignee_id ? payload.assignee_id : null,
      project_id: payload && payload.project_id ? payload.project_id : null,
      role: payload && payload.role ? String(payload.role) : "all",
      urgency: payload && payload.urgency ? String(payload.urgency) : "normal"
    };

    return await ZRBackend.tasks.create(row);
  }

  async function fetchProjects(){
    return await ZRBackend.projects.list();
  }

  async function logTaskActivity(taskId, type, body, payload){
    return await ZRBackend.taskActivity.log(taskId, type, body, payload);
  }

  async function updateTask(taskId, payload){
    if(!taskId) throw new Error("taskId required");

    const title = payload && payload.title ? String(payload.title).trim() : "";
    if(!title) throw new Error("Введите название задачи.");

    const before = await ZRBackend.tasks.getProjectSnapshot(taskId);

    const row = {
      title,
      body: payload && payload.body != null ? String(payload.body) : "",
      start_date: payload && payload.start_date ? String(payload.start_date) : null,
      due_date: payload && payload.due_date ? String(payload.due_date) : null,
      project_id: payload && payload.project_id ? payload.project_id : null,
      role: payload && payload.role ? String(payload.role) : "all",
      urgency: payload && payload.urgency ? String(payload.urgency) : "normal"
    };

    const updatedRow = await ZRBackend.tasks.update(taskId, row);

    const oldProjectId = before && before.project_id ? String(before.project_id) : "";
    const newProjectId = row.project_id ? String(row.project_id) : "";

    if(oldProjectId !== newProjectId){
      let newTitle = "";

      if(newProjectId){
        const project = await ZRBackend.projects.getBasic(newProjectId);
        newTitle = (project && project.title) ? String(project.title) : "";
      }

      const oldTitle = (before && before.projects && before.projects.title)
        ? String(before.projects.title)
        : "";

      let body = "Проект изменён";
      if(!oldProjectId && newProjectId){
        body = newTitle ? `Проект назначен: ${newTitle}` : "Проект назначен";
      }else if(oldProjectId && !newProjectId){
        body = oldTitle ? `Проект снят: ${oldTitle}` : "Проект снят";
      }else{
        const fromText = oldTitle || "без названия";
        const toText = newTitle || "без названия";
        body = `Проект изменён: ${fromText} → ${toText}`;
      }

      await logTaskActivity(taskId, "system", body, {
        kind: "project_change",
        old_project_id: oldProjectId || null,
        new_project_id: newProjectId || null,
        old_project_title: oldTitle || null,
        new_project_title: newTitle || null
      });
    }

    return updatedRow || null;
  }

  async function fetchTaskById(taskId, ctx){
    const row = await ZRBackend.tasks.getById(taskId);
    if(!row) return null;

    const role = ctx && ctx.role ? String(ctx.role) : null;
    const today = ctx && ctx.today ? String(ctx.today) : null;

    if(role === "admin") return row;

    const vis = row.role ? String(row.role) : "all";
    if(vis === "admin") return null;

    if(vis === "staff"){
      const currentUserId = ctx && ctx.userId
        ? String(ctx.userId)
        : String(window.App?.session?.user?.id || "");

      const assignees = await fetchTaskAssignees(taskId);
      const assigneeIds = (assignees || []).map(x => String(x.user_id || "")).filter(Boolean);
      const legacyAssigneeId = row.assignee_id ? String(row.assignee_id) : "";

      if(!currentUserId || (!assigneeIds.includes(currentUserId) && legacyAssigneeId !== currentUserId)){
        return null;
      }
    }

    if(today && row.start_date && String(row.start_date) > today) return null;

    return row;
  }

  async function fetchTaskActivity(taskId){
    return await ZRBackend.taskActivity.listByTask(taskId);
  }

  async function fetchTasksAssigneesBatch(taskIds){
    return await ZRBackend.taskAssignees.listByTasks(taskIds);
  }

  async function fetchTaskAssignees(taskId){
    return await ZRBackend.taskAssignees.listByTask(taskId);
  }

  async function fetchAssignablePeople(){
    return await ZRBackend.profiles.listBasic();
  }

  async function setTaskAssignees(taskId, userIds){
    if(!taskId) throw new Error("taskId required");

    const ids = Array.isArray(userIds)
      ? Array.from(new Set(userIds.map(x => String(x).trim()).filter(Boolean)))
      : [];

    const beforeIds = await ZRBackend.taskAssignees.listIdsByTask(taskId);

    const beforeKey = beforeIds.slice().sort().join("|");
    const nextKey = ids.slice().sort().join("|");

    if(beforeKey === nextKey){
      return true;
    }

    await ZRBackend.taskAssignees.replaceForTask(taskId, ids);

    const beforeOne = beforeIds.length ? String(beforeIds[0]) : null;
    const afterOne = ids.length ? String(ids[0]) : null;

    if(beforeOne !== afterOne){
      const allIds = [beforeOne, afterOne].filter(Boolean);

      let profilesMap = {};
      if(allIds.length > 0){
        const profiles = await ZRBackend.profiles.listByIds(allIds);

        (profiles || []).forEach(p => {
          profilesMap[String(p.id)] = p;
        });
      }

      const fromProfile = beforeOne ? profilesMap[String(beforeOne)] : null;
      const toProfile = afterOne ? profilesMap[String(afterOne)] : null;

      await logTaskActivity(taskId, "assignment_change", null, {
        from_assignee_id: beforeOne,
        to_assignee_id: afterOne,
        from_assignee_name: fromProfile && fromProfile.name ? String(fromProfile.name) : null,
        to_assignee_name: toProfile && toProfile.name ? String(toProfile.name) : null,
        from_assignee_email: fromProfile && fromProfile.email ? String(fromProfile.email) : null,
        to_assignee_email: toProfile && toProfile.email ? String(toProfile.email) : null
      });

      // push moved to PlannerActions layer
    }

    return true;
  }

  async function fetchTaskLinks(taskId){
    return await ZRBackend.taskLinks.listByTask(taskId);
  }

  async function addTaskLink(taskId, payload){
    if(!taskId) throw new Error("taskId required");
    if(!payload || typeof payload !== "object") throw new Error("payload required");

    const linkType = payload.link_type ? String(payload.link_type).trim().toLowerCase() : "";
    const refId = payload.ref_id ? String(payload.ref_id).trim() : "";
    const url = payload.url ? String(payload.url).trim() : "";
    const label = payload.label ? String(payload.label).trim() : "";

    if(!linkType) throw new Error("Укажите тип документа.");

    if(linkType === "external"){
      if(!url) throw new Error("Укажите ссылку.");
    }else{
      if(!["article","checklist","template"].includes(linkType)){
        throw new Error("Недопустимый тип документа.");
      }
      if(!refId) throw new Error("Укажите ID документа.");
    }

    // IMPORTANT:
    // For checklist links, ref_id must stay equal to the kb_checklists template id.
    // Do NOT encode task/user/instance identity into task_links.ref_id here.
    // Inline checklist runtime resolves task-scoped instances separately.
    const row = {
      task_id: taskId,
      link_type: linkType,
      ref_id: linkType === "external" ? null : refId,
      url: linkType === "external" ? url : null,
      label: label || null
    };

    return await ZRBackend.taskLinks.create(row);
  }

  async function removeTaskLink(linkId){
    if(!linkId) throw new Error("linkId required");
    return await ZRBackend.taskLinks.remove(linkId);
  }

  async function searchArticlesForLink(query){
    return await ZRBackend.kb.searchArticles(query);
  }

  async function searchTemplatesForLink(query){
    return await ZRBackend.kb.searchTemplates(query);
  }

  async function searchChecklistsForLink(query){
    return await ZRBackend.kb.searchChecklists(query);
  }
  
  async function clearTaskChecklist(taskId){
    return await ZRBackend.taskChecklistItems.clearByTask(taskId);
  }

  window.PlannerAPI = {
    fetchAllActiveTasks,
    setTaskStatus,
    fetchChecklistItems,
    setChecklistDone,
    fetchTaskFiles,
    fetchComments,
    addTaskComment,
    deleteTaskComment,
    createTask,
    fetchProjects,
    updateTask,
    logTaskActivity,
    archiveTask,
    archiveDoneTasks,
    fetchTaskById,
    fetchTaskActivity,
    fetchTaskAssignees,
    fetchTasksAssigneesBatch,
    fetchAssignablePeople,
    setTaskAssignees,
    fetchTaskLinks,
    addTaskLink,
    removeTaskLink,
    searchArticlesForLink,
    searchTemplatesForLink,
    searchChecklistsForLink,
    clearTaskChecklist
  };
})();







