// ZA RAMKI — Planner Push Sender (transport only)
window.sendPlannerPush = async function({ users, payload }){
  try{
    if(!users || !users.length) return;

    await fetch("https://oedmueajusqhekgnyfsl.functions.supabase.co/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        users,
        payload
      })
    });

  }catch(e){
    console.warn("[PlannerPush] send failed", e);
  }
};