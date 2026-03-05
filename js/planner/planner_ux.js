/* ZA RAMKI — Planner UX helpers (no modules) */
(function(){
  function asStr(x){ return (x == null) ? "" : String(x); }

  function dueKey(t){
    // sort: earliest due_date first; nulls last
    const d = asStr(t && t.due_date).trim();
    return d ? d : "9999-99-99";
  }

  function updatedKey(t){
    // sort: newest updated_at first
    const u = asStr(t && t.updated_at).trim();
    return u ? u : "";
  }

  function isMine(t, uid){
    return !!(uid && t && t.assignee_id && asStr(t.assignee_id) === uid);
  }

  function isCommon(t){
    return !(t && t.assignee_id);
  }

  function groupRank(t, uid){
    // 0 = mine, 1 = common, 2 = others
    if(isMine(t, uid)) return 0;
    if(isCommon(t)) return 1;
    return 2;
  }

  function sortMineFirst(tasks, userId){
    try{
      if(!Array.isArray(tasks) || !userId) return tasks;

      const uid = String(userId);

      return [...tasks].sort((a,b) => {
        // group: mine -> common -> others
        const ga = groupRank(a, uid);
        const gb = groupRank(b, uid);
        if(ga !== gb) return ga - gb;

        // inside group: due_date asc (nulls last)
        const da = dueKey(a);
        const db = dueKey(b);
        if(da !== db) return (da < db) ? -1 : 1;

        // then updated_at desc (newer first)
        const ua = updatedKey(a);
        const ub = updatedKey(b);
        if(ua !== ub) return (ua > ub) ? -1 : 1;

        return 0;
      });
    }catch(e){
      console.warn("[PlannerUX] sortMineFirst error", e);
      return tasks;
    }
  }

  window.PlannerUX = { sortMineFirst };
})();