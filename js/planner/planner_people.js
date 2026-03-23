(function(){
  if(window.PlannerPeople) return;

  function shortId(value){
    const s = value == null ? "" : String(value).trim();
    if(!s) return "";
    return s.length > 8 ? s.slice(0,8) : s;
  }

  function getTaskAssigneeLabel(task, uid, deps){
    deps = deps || {};
    const resolvePersonLabel = deps.resolvePersonLabel;

    const assignees = Array.isArray(task && task.assignees) ? task.assignees : [];
    if(assignees.length === 0) return "";

    if(assignees.length === 1){
      const label = resolvePersonLabel(assignees[0], { uid, fallback: "Сотрудник" });
      if(deps.noYou && label === "Вы"){
        return "Сотрудник"; // или имя если есть map (потом можно улучшить)
      }
      return label;
    }

    return `${assignees.length} исполнителя`;
  }

  function getTaskAssigneeDetails(task, peopleMap, uid, deps){
    const esc = deps.esc;
    const resolvePersonLabel = deps.resolvePersonLabel;

    const ids = Array.isArray(task && task.assignees)
      ? task.assignees.map(x => String(x)).filter(Boolean)
      : [];

    if(ids.length === 0){
      return {
        ids: [],
        text: '<span class="muted">Не назначен</span>'
      };
    }

    const labels = ids.map(id => {
      const person = peopleMap && peopleMap[id] ? peopleMap[id] : { id };
      return esc(resolvePersonLabel(person, { uid, fallback: "Сотрудник" }));
    });

    return {
      ids,
      text: labels.join(", ")
    };
  }

  function getTaskAssigneeIds(task){
    return Array.isArray(task && task.assignees)
      ? task.assignees.map(x => String(x)).filter(Boolean)
      : [];
  }

  function getTaskRoleScope(task){
    const s = String((task && task.role) || "all").trim().toLowerCase();
    return s || "all";
  }

  function canRoleSeeTask(task, role){
    const scope = getTaskRoleScope(task);
    if(role === "admin") return true;
    return scope === "all" || scope === "staff";
  }

  function isTaskMine(task, uid){
    if(!uid) return false;
    const assignees = getTaskAssigneeIds(task);
    return assignees.includes(String(uid));
  }

  function shouldShowInLeft(task, role, uid, leftFilter){
    if(!task) return false;
    if(!canRoleSeeTask(task, role)) return false;

    if(role === "admin" && leftFilter === "all") return true;

    const assignees = getTaskAssigneeIds(task);
    const mine = isTaskMine(task, uid);
    const unassigned = assignees.length === 0;

    if(role === "admin"){
      if(mine) return true;
      if(unassigned) return true;
      return false;
    }

    return mine || unassigned;
  }

  window.PlannerPeople = {
    shortId,
    getTaskAssigneeLabel,
    getTaskAssigneeDetails,
    getTaskAssigneeIds,
    getTaskRoleScope,
    canRoleSeeTask,
    isTaskMine,
    shouldShowInLeft
  };
})();