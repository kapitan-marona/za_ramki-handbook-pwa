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
      .select("id,title,body,status,urgency,role,assignee_id,start_date,due_date,archived_at,created_at,updated_at")
      .is("archived_at", null)
      .order("due_date", { ascending:true, nullsFirst:false })
      .order("updated_at", { ascending:false });

    if(res && res.error){
      console.warn("[PlannerAPI] fetchAllActiveTasks error", res.error);
      return [];
    }

    let tasks = res.data || [];

    // UI publish rule (non-admin)
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
  async function createTask(payload){
    const SB = SBx();
    const title = payload && payload.title ? String(payload.title).trim() : "";
    if(!title) throw new Error("Введите название задачи.");

    const row = {
      title,
      body: payload && payload.body ? String(payload.body) : null,
      status: "new",
      start_date: payload && payload.start_date ? String(payload.start_date) : null,
      due_date: payload && payload.due_date ? String(payload.due_date) : null,
      assignee_id: payload && payload.assignee_id ? payload.assignee_id : null,
      role: payload && payload.role ? String(payload.role) : null,
      urgency: payload && payload.urgency ? String(payload.urgency) : null
    };

    const r = await SB.from("tasks").insert(row).select("id").single();
    if(r && r.error) throw r.error;
    return r.data || null;
  }

  window.PlannerAPI = {
      fetchAllActiveTasks,
      setTaskStatus,
      fetchChecklistItems,
      setChecklistDone,
      fetchTaskFiles,
      fetchComments,
      addTaskComment,
      createTask
  };
})();


