/* ZA RAMKI — PlannerAPI (data + RPC)
   Purpose: isolate Supabase calls from planner view.
   Rule: no top-level await; only functions returning Promises.
*/
(function(){
  if(window.PlannerAPI) return;

  function SBx(){
    if(!window.SB) throw new Error("SB not available");
    return window.SB;
  }

  async function fetchAllActiveTasks(opts){
    const SB = SBx();
    const role = opts && opts.role ? String(opts.role) : null;
    const today = opts && opts.today ? String(opts.today) : null;

    const res = await SB
      .from("tasks")
      .select("id,title,body,status,urgency,role,project_id,assignee_id,start_date,due_date,archived_at,created_at,updated_at,projects(title)")
      .is("archived_at", null)
      .order("due_date", { ascending:true, nullsFirst:false })
      .order("updated_at", { ascending:false });

    if(res && res.error){
      console.warn("[PlannerAPI] fetchAllActiveTasks error", res.error);
      return [];
    }

    let tasks = res.data || [];

    if(role !== "admin"){
      tasks = tasks.filter(t => {
        const r = (t && t.role != null) ? String(t.role).trim() : "all";
        if(!r || r === "all") return true;
        if(r === "staff") return true;
        return false;
      });
    }

    if(role !== "admin" && today){
      tasks = tasks.filter(t => !t.start_date || String(t.start_date) <= today);
    }

    return tasks;
  }

  async function setTaskStatus(taskId, newStatus){
    const SB = SBx();
    const r = await SB.rpc("set_task_status", { p_new_status: newStatus, p_task_id: taskId });
    if(r && r.error) throw r.error;
    return true;
  }

  async function fetchChecklistItems(taskId){
    const SB = SBx();
    const r = await SB
      .from("task_checklist_items")
      .select("id,task_id,pos,text,done,done_at")
      .eq("task_id", taskId)
      .order("pos", { ascending:true });
    if(r && r.error) throw r.error;
    return r.data || [];
  }

  async function setChecklistDone(itemId, done){
    const SB = SBx();
    const r = await SB.rpc("set_task_checklist_done", { p_item_id: itemId, p_done: !!done });
    if(r && r.error) throw r.error;
    return true;
  }

  async function fetchTaskFiles(taskId){
    const SB = SBx();
    const r = await SB
      .from("task_files")
      .select("id,task_id,bucket_id,object_path,file_name,mime_type,created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending:true });
    if(r && r.error) throw r.error;
    return r.data || [];
  }

  async function fetchComments(taskId){
    const SB = SBx();
    const r = await SB
      .from("task_comments")
      .select("id,task_id,author_id,body,created_at,deleted_at")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .order("created_at", { ascending:true });
    if(r && r.error) throw r.error;
    return r.data || [];
  }

  async function addTaskComment(taskId, body){
    const SB = SBx();
    const r = await SB.rpc("add_task_comment", { p_task_id: taskId, p_body: body });
    if(r && r.error) throw r.error;
    return true;
  }

  async function archiveTask(taskId){
    const SB = SBx();
    const r = await SB.rpc("archive_task", { p_task_id: taskId });
    if(r && r.error) throw r.error;
    return true;
  }

  async function archiveDoneTasks(){
    const SB = SBx();
    const r = await SB.rpc("archive_done_tasks");
    if(r && r.error) throw r.error;
    return (r && r.data != null) ? r.data : 0;
  }

  async function createTask(payload){
    const SB = SBx();
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

    const r = await SB.from("tasks").insert(row).select("id").single();
    if(r && r.error) throw r.error;
    return r.data || null;
  }

  async function fetchProjects(){
    const SB = SBx();
    const r = await SB
      .from("projects")
      .select("id,title")
      .order("created_at", { ascending:false });

    if(r && r.error) throw r.error;
    return r.data || [];
  }

  async function logTaskActivity(taskId, type, body, payload){
    const SB = SBx();

    const r = await SB.rpc("log_task_activity", {
      p_task_id: taskId,
      p_type: String(type || "system"),
      p_body: body != null ? String(body) : null,
      p_payload: payload || {}
    });

    if(r && r.error) throw r.error;
    return true;
  }

  async function updateTask(taskId, payload){
    const SB = SBx();
    if(!taskId) throw new Error("taskId required");

    const title = payload && payload.title ? String(payload.title).trim() : "";
    if(!title) throw new Error("Введите название задачи.");

    const beforeRes = await SB
      .from("tasks")
      .select("id,project_id,projects(title)")
      .eq("id", taskId)
      .single();

    if(beforeRes && beforeRes.error) throw beforeRes.error;
    const before = beforeRes.data || null;

    const row = {
      title,
      body: payload && payload.body != null ? String(payload.body) : "",
      start_date: payload && payload.start_date ? String(payload.start_date) : null,
      due_date: payload && payload.due_date ? String(payload.due_date) : null,
      project_id: payload && payload.project_id ? payload.project_id : null,
      role: payload && payload.role ? String(payload.role) : "all",
      urgency: payload && payload.urgency ? String(payload.urgency) : "normal"
    };

    const r = await SB
      .from("tasks")
      .update(row)
      .eq("id", taskId)
      .select("id")
      .single();

    if(r && r.error) throw r.error;

    const oldProjectId = before && before.project_id ? String(before.project_id) : "";
    const newProjectId = row.project_id ? String(row.project_id) : "";

    if(oldProjectId !== newProjectId){
      let newTitle = "";

      if(newProjectId){
        const projRes = await SB
          .from("projects")
          .select("id,title")
          .eq("id", newProjectId)
          .single();

        if(projRes && projRes.error) throw projRes.error;
        newTitle = (projRes.data && projRes.data.title) ? String(projRes.data.title) : "";
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

    return r.data || null;
  }

  async function fetchTaskById(taskId, ctx){
    const SB = SBx();
    const r = await SB.from("tasks").select("*, projects(title)").eq("id", taskId).maybeSingle();
    if(r && r.error) throw r.error;

    const row = r.data || null;
    if(!row) return null;

    const role = ctx && ctx.role ? String(ctx.role) : null;
    const today = ctx && ctx.today ? String(ctx.today) : null;

    if(role === "admin") return row;

    const vis = row.role ? String(row.role) : "all";
    if(vis === "admin") return null;

    if(today && row.start_date && String(row.start_date) > today) return null;

    return row;
  }

  async function fetchTaskActivity(taskId){
    const SB = SBx();
    const r = await SB
      .from("task_activity")
      .select("id,task_id,actor_id,type,body,payload,created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending:false });

    if(r && r.error) throw r.error;
    return r.data || [];
  }

  async function fetchTasksAssigneesBatch(taskIds){
    const SB = SBx();
    if(!Array.isArray(taskIds) || taskIds.length === 0) return {};

    const r = await SB
      .from("task_assignees")
      .select("task_id,user_id")
      .in("task_id", taskIds);

    if(r && r.error) throw r.error;

    const map = {};
    (r.data || []).forEach(row => {
      const tid = String(row.task_id);
      const uid = String(row.user_id);

      if(!map[tid]) map[tid] = [];
      map[tid].push(uid);
    });

    return map;
  }

  async function fetchTaskAssignees(taskId){
    const SB = SBx();
    const r = await SB
      .from("task_assignees")
      .select("user_id,created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending:true });

    if(r && r.error) throw r.error;
    return r.data || [];
  }

  async function fetchTaskLinks(taskId){
    const SB = SBx();
    const r = await SB
      .from("task_links")
      .select("id,task_id,link_type,ref_id,url,label,created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending:true });

    if(r && r.error) throw r.error;
    return r.data || [];
  }

  async function addTaskLink(taskId, payload){
    const SB = SBx();
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

    const row = {
      task_id: taskId,
      link_type: linkType,
      ref_id: linkType === "external" ? null : refId,
      url: linkType === "external" ? url : null,
      label: label || null
    };

    const r = await SB
      .from("task_links")
      .insert(row)
      .select("id,task_id,link_type,ref_id,url,label,created_at")
      .single();

    if(r && r.error) throw r.error;
    return r.data || null;
  }

  async function removeTaskLink(linkId){
    const SB = SBx();
    if(!linkId) throw new Error("linkId required");

    const r = await SB
      .from("task_links")
      .delete()
      .eq("id", linkId);

    if(r && r.error) throw r.error;
    return true;
  }

  async function searchArticlesForLink(query){
    const SB = SBx();
    const q = query ? String(query).trim() : "";

    let req = SB
      .from("kb_articles")
      .select("id,title,category,updated_at")
      .order("updated_at", { ascending:false })
      .limit(12);

    if(q){
      req = req.ilike("title", "%" + q + "%");
    }

    const r = await req;
    if(r && r.error) throw r.error;
    return r.data || [];
  }

  window.PlannerAPI = {
    fetchAllActiveTasks,
    setTaskStatus,
    fetchChecklistItems,
    setChecklistDone,
    fetchTaskFiles,
    fetchComments,
    addTaskComment,
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
    fetchTaskLinks,
    addTaskLink,
    removeTaskLink,
    searchArticlesForLink
  };
})();
