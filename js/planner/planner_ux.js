/* ZA RAMKI — Planner UX helpers (no modules) */
(function(){
  function sortMineFirst(tasks, userId){
    try{
      if(!Array.isArray(tasks) || !userId) return tasks;
      const uid = String(userId);
      return [...tasks].sort((a,b) => {
        const am = String(a && a.assignee_id || "") === uid ? 1 : 0;
        const bm = String(b && b.assignee_id || "") === uid ? 1 : 0;
        return bm - am;
      });
    }catch(e){
      console.warn("[PlannerUX] sortMineFirst error", e);
      return tasks;
    }
  }

  window.PlannerUX = { sortMineFirst };
})();
