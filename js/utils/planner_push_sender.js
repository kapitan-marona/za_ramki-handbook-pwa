window.sendPlannerPush = async function({ userId, title, body, url, tag }){

  const PUSH_ENDPOINT = window.ZR_PUSH_ENDPOINT || "";
  const PUSH_FUNCTION = window.ZR_PUSH_FUNCTION || "test-push";

  const DEBUG_PUSH = !!window.ZR_DEBUG_PUSH;

  try{
    if(DEBUG_PUSH){
      console.log("[planner push] called", {
        userId,
        title,
        body,
        url,
        tag,
        endpoint: PUSH_ENDPOINT || null,
        functionName: PUSH_ENDPOINT ? null : PUSH_FUNCTION
      });
    }

    if(!userId) return false;

    try{
      const key = [userId, tag].join("|");
      window.__plannerPushMap = window.__plannerPushMap || {};

      const now = Date.now();
      const last = window.__plannerPushMap[key] || 0;

      if(now - last < 5000){
        if(DEBUG_PUSH){
          console.log("[planner push] skipped duplicate", { key });
        }
        return false;
      }

      window.__plannerPushMap[key] = now;
    }catch(e){
      console.warn("[planner push] dedupe error", e);
    }

    const payload = {
      user_id: String(userId),
      title: String(title || "ZA RAMKI"),
      body: String(body || ""),
      url: String(url || "./#/planner"),
      tag: String(tag || ("planner-" + Date.now()))
    };

    if(!PUSH_ENDPOINT && (!window.SB || !window.SB.functions || typeof window.SB.functions.invoke !== "function")){
      console.warn("[planner push] Supabase functions client missing");
      return false;
    }

    const r = PUSH_ENDPOINT
      ? await fetch(PUSH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      : await window.SB.functions.invoke(PUSH_FUNCTION, {
          body: payload
        });

    if(PUSH_ENDPOINT && !r.ok){
      let details = "";
      try{ details = await r.text(); }catch(e){}

      console.warn("[planner push] http error", r.status, details);
      return false;
    }

    if(!PUSH_ENDPOINT && r && r.error){
      console.warn("[planner push] function error", r.error);
      return false;
    }

    if(DEBUG_PUSH){
      console.log("[planner push] sent", PUSH_ENDPOINT ? { status: r.status } : { data: r && r.data });
    }

    return true;
  }catch(e){
    console.warn("[planner push] failed", e);
    return false;
  }
};
