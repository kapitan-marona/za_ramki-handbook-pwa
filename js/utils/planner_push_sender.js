window.sendPlannerPush = async function({ userId, title, body, url, tag }){
  try{
    if(!userId) return false;
    // safe dedupe (does NOT block UI)
    try{
      const key = [userId, tag].join("|");
      window.__plannerPushMap = window.__plannerPushMap || {};

      const now = Date.now();
      const last = window.__plannerPushMap[key] || 0;

      if(now - last < 5000){
        return false; // skip duplicate push ONLY
      }

      window.__plannerPushMap[key] = now;
    }catch(e){
      console.warn("[planner push] dedupe error", e);
    }

    const r = await fetch("https://oedmueajusqhekgnyfsl.functions.supabase.co/test-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: String(userId),
        title: String(title || "ZA RAMKI"),
        body: String(body || ""),
        url: String(url || "./#/planner"),
        tag: String(tag || ("planner-" + Date.now()))
      })
    });

    if(!r.ok){
      console.warn("[planner push] http error", r.status);
      return false;
    }

    return true;
  }catch(e){
    console.warn("[planner push] failed", e);
    return false;
  }
};
