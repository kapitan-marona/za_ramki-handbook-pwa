/* ZA RAMKI — PlannerData (thin data layer over PlannerAPI) */
(function(){
  if(window.PlannerData) return;

  function APIx(){
    if(!window.PlannerAPI) throw new Error("PlannerAPI missing");
    return window.PlannerAPI;
  }

  function asString(value){
    if(value == null) return "";
    return String(value).trim();
  }

  function firstFilled(){
    for(let i = 0; i < arguments.length; i++){
      const s = asString(arguments[i]);
      if(s) return s;
    }
    return "";
  }

  function emailLocalPart(email){
    const s = asString(email);
    if(!s || !s.includes("@")) return "";
    return s.split("@")[0].replace(/[._-]+/g, " ").trim();
  }

  function pickPersonId(input){
    if(!input) return "";

    if(typeof input === "string"){
      const s = asString(input);
      return s.includes("@") ? "" : s;
    }

    if(typeof input !== "object") return "";

    return firstFilled(
      input.id,
      input.user_id,
      input.profile_id,
      input.member_id,
      input.assignee_id,
      input.author_id,
      input.employee_id,
      input.uid
    );
  }

  function pickPersonLabel(input){
    if(!input) return "";

    if(typeof input === "string"){
      const s = asString(input);
      if(!s) return "";
      if(s.includes("@")) return emailLocalPart(s);
      return "";
    }

    if(typeof input !== "object") return "";

    const direct = firstFilled(
      input.display_name,
      input.full_name,
      input.name,
      input.label,
      input.title,
      input.username
    );
    if(direct) return direct;

    const emailBased = emailLocalPart(firstFilled(input.email, input.user_email, input.author_email));
    if(emailBased) return emailBased;

    const nestedKeys = [
      "profile",
      "user",
      "author",
      "assignee",
      "member",
      "employee",
      "person"
    ];

    for(const key of nestedKeys){
      const nested = input[key];
      const label = pickPersonLabel(nested);
      if(label) return label;
    }

    return "";
  }

  function pickPersonEmail(input){
    if(!input || typeof input !== "object") return "";
    return firstFilled(input.email, input.user_email, input.author_email);
  }

  function normalizeTask(task){
    if(!task) return task;

    const rawAssignees = Array.isArray(task.assignees)
      ? task.assignees
      : (task.assignee_id ? [task.assignee_id] : []);

    const assignees = rawAssignees
      .map(x => typeof x === "object" ? pickPersonId(x) : asString(x))
      .filter(Boolean);

    const assignee_labels_by_id = {};
    rawAssignees.forEach(x => {
      if(x && typeof x === "object"){
        const id = pickPersonId(x);
        const label = pickPersonLabel(x);
        if(id && label) assignee_labels_by_id[id] = label;
      }
    });

    const project_title = task && task.projects && task.projects.title
      ? String(task.projects.title)
      : "";

    return {
      ...task,
      assignees,
      assignee_labels_by_id,
      project_title
    };
  }

  function normalizeTasks(tasks){
    return Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
  }

  async function fetchTasksAssigneesBatch(taskIds){
    return await APIx().fetchTasksAssigneesBatch(taskIds);
  }

  function applyBatchAssignees(task, batchValue){
    const currentLabels = (task && task.assignee_labels_by_id && typeof task.assignee_labels_by_id === "object")
      ? { ...task.assignee_labels_by_id }
      : {};

    const raw = Array.isArray(batchValue) ? batchValue : [];
    const assignees = raw
      .map(x => typeof x === "object" ? pickPersonId(x) : asString(x))
      .filter(Boolean);

    raw.forEach(x => {
      if(x && typeof x === "object"){
        const id = pickPersonId(x);
        const label = pickPersonLabel(x);
        if(id && label) currentLabels[id] = label;
      }
    });

    return {
      ...task,
      assignees: assignees.length ? assignees : task.assignees,
      assignee_labels_by_id: currentLabels
    };
  }

  async function enrichTasksWithAssignees(tasks){
    const items = normalizeTasks(tasks);
    const ids = items.map(t => t && t.id).filter(Boolean);

    if(ids.length === 0) return items;

    const map = await fetchTasksAssigneesBatch(ids);

    return items.map(task => {
      const tid = String(task.id);
      return applyBatchAssignees(task, map ? map[tid] : []);
    });
  }

  function normalizeComment(item){
    if(!item) return item;

    const authorSource =
      item.author ||
      item.user ||
      item.profile ||
      item.created_by_profile ||
      null;

    const author_id = firstFilled(
      item.author_id,
      item.created_by,
      pickPersonId(authorSource)
    );

    const author_display_name = firstFilled(
      item.author_display_name,
      item.author_name,
      item.author_label,
      pickPersonLabel(authorSource)
    );

    const author_email = firstFilled(
      item.author_email,
      pickPersonEmail(authorSource)
    );

    return {
      ...item,
      author_id,
      author_display_name,
      author_email
    };
  }

  function normalizeComments(items){
    return Array.isArray(items) ? items.map(normalizeComment) : [];
  }

  function normalizeActivityItem(item){
    if(!item) return item;

    const payload = (item.payload && typeof item.payload === "object")
      ? { ...item.payload }
      : {};

    const fromSource =
      payload.from_assignee ||
      payload.from_user ||
      payload.from_profile ||
      payload.from_member ||
      null;

    const toSource =
      payload.to_assignee ||
      payload.to_user ||
      payload.to_profile ||
      payload.to_member ||
      null;

    payload.from_assignee_id = firstFilled(
      payload.from_assignee_id,
      pickPersonId(fromSource)
    );

    payload.to_assignee_id = firstFilled(
      payload.to_assignee_id,
      pickPersonId(toSource)
    );

    payload.from_assignee_display_name = firstFilled(
      payload.from_assignee_display_name,
      payload.from_assignee_name,
      payload.from_assignee_label,
      pickPersonLabel(fromSource)
    );

    payload.to_assignee_display_name = firstFilled(
      payload.to_assignee_display_name,
      payload.to_assignee_name,
      payload.to_assignee_label,
      pickPersonLabel(toSource)
    );

    payload.from_assignee_email = firstFilled(
      payload.from_assignee_email,
      pickPersonEmail(fromSource)
    );

    payload.to_assignee_email = firstFilled(
      payload.to_assignee_email,
      pickPersonEmail(toSource)
    );

    return {
      ...item,
      payload
    };
  }

  function normalizeActivity(items){
    return Array.isArray(items) ? items.map(normalizeActivityItem) : [];
  }

  async function fetchAllActiveTasks(ctx){
    const tasks = await APIx().fetchAllActiveTasks(ctx);

    try{
      return await enrichTasksWithAssignees(tasks);
    }catch(err){
      console.warn("[PlannerData] enrichTasksWithAssignees fallback", err);
      return normalizeTasks(tasks);
    }
  }

  async function fetchChecklistItems(taskId){
    return await APIx().fetchChecklistItems(taskId);
  }

  async function fetchTaskFiles(taskId){
    return await APIx().fetchTaskFiles(taskId);
  }

  async function fetchComments(taskId){
    const items = await APIx().fetchComments(taskId);
    return normalizeComments(items);
  }

  async function fetchActivity(taskId){
    const items = await APIx().fetchTaskActivity(taskId);
    return normalizeActivity(items);
  }

  async function fetchTaskAssignees(taskId){
    const items = await APIx().fetchTaskAssignees(taskId);
    return Array.isArray(items) ? items.map(x => {
      if(x && typeof x === "object"){
        return {
          ...x,
          id: firstFilled(x.id, x.user_id, x.profile_id, x.member_id),
          display_name: firstFilled(x.display_name, x.full_name, x.name, x.label, pickPersonLabel(x)),
          email: firstFilled(x.email, x.user_email)
        };
      }
      return x;
    }) : [];
  }

  async function fetchTaskLinks(taskId){
    return await APIx().fetchTaskLinks(taskId);
  }

  async function fetchTaskById(taskId, ctx){
    const task = await APIx().fetchTaskById(taskId, ctx);

    try{
      const enriched = await enrichTasksWithAssignees([task]);
      return enriched[0] || normalizeTask(task);
    }catch(err){
      console.warn("[PlannerData] fetchTaskById enrich fallback", err);
      return normalizeTask(task);
    }
  }

  window.PlannerData = {
    fetchAllActiveTasks,
    fetchChecklistItems,
    fetchTaskFiles,
    fetchComments,
    fetchActivity,
    fetchTaskAssignees,
    fetchTasksAssigneesBatch,
    enrichTasksWithAssignees,
    fetchTaskLinks,
    fetchTaskById
  };
})();
