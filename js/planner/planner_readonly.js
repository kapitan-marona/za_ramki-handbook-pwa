/* ZA RAMKI — Planner read-only helpers (archived) */
(function(){
  function isArchived(task){
    return !!(task && task.archived_at);
  }

  function applyReadOnly(rootEl){
    try{
      if(!rootEl) return;
      rootEl.classList.add("pl-archived");
      rootEl.querySelectorAll("button, input, textarea, select").forEach(x => {
        try{ x.disabled = true; }catch(e){}
      });
    }catch(e){
      console.warn("[PlannerRO] applyReadOnly error", e);
    }
  }

  window.PlannerRO = { isArchived, applyReadOnly };
})();
