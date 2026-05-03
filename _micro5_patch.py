from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro5"))
shutil.copy2(api, api.with_suffix(".js.bak_micro5"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''    taskActivity: {
      async listByTask(taskId){
        const r = await requireSB()
          .from("task_activity")
          .select("id,task_id,actor_id,type,body,payload,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    allowlist: {
'''

new_backend = '''    taskActivity: {
      async listByTask(taskId){
        const r = await requireSB()
          .from("task_activity")
          .select("id,task_id,actor_id,type,body,payload,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    taskLinks: {
      async listByTask(taskId){
        const r = await requireSB()
          .from("task_links")
          .select("id,task_id,link_type,ref_id,url,label,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    allowlist: {
'''

old_api = '''    const SB = SBx();
    const r = await SB
      .from("task_links")
      .select("id,task_id,link_type,ref_id,url,label,created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending:false });

    if(r && r.error) throw r.error;
    return r.data || [];
'''

new_api = '''    return await ZRBackend.taskLinks.listByTask(taskId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskActivity anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API fetchTaskLinks anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro5 patch applied")
