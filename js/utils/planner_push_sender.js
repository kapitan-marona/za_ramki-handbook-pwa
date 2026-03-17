window.sendPlannerPush = async function({ userId, title, body, url, tag }){
  try{
    if(!userId) return false;

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