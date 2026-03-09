/* ZA RAMKI — PlannerState (pure derived state helpers) */
(function(){
  if(window.PlannerState) return;

  function asArray(v){
    return Array.isArray(v) ? v : [];
  }

  function isOverdue(task, today){
    if(!task || !today) return false;
    return !!(task.due_date && String(task.due_date) < String(today) && task.status !== "done");
  }

  function sortBoardItems(tasks){
    return [...asArray(tasks)].sort((a,b) => {
      const da = a && a.due_date ? String(a.due_date) : "9999-99-99";
      const db = b && b.due_date ? String(b.due_date) : "9999-99-99";
      if(da !== db) return da < db ? -1 : 1;

      const ua = a && a.updated_at ? String(a.updated_at) : "";
      const ub = b && b.updated_at ? String(b.updated_at) : "";
      if(ua !== ub) return ua > ub ? -1 : 1;

      return 0;
    });
  }

  function groupBoardTasks(tasks){
    const items = asArray(tasks);
    return {
      new: items.filter(t => t && t.status === "new"),
      work: items.filter(t => t && ["taken","in_progress","problem"].includes(t.status)),
      done: items.filter(t => t && t.status === "done")
    };
  }

  function getProgress(tasks){
    const items = asArray(tasks);
    const total = items.length;
    const done = items.filter(t => t && t.status === "done").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }

  window.PlannerState = {
    isOverdue,
    sortBoardItems,
    groupBoardTasks,
    getProgress
  };
})();
