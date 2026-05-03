from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro15"))
shutil.copy2(api, api.with_suffix(".js.bak_micro15"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''    taskComments: {
'''

new_backend = '''    taskChecklistItems: {
      async listByTask(taskId){
        const r = await requireSB()
          .from("task_checklist_items")
          .select("id,task_id,pos,text,done,done_at")
          .eq("task_id", taskId)
          .order("pos", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    taskComments: {
'''

old_api = '''    const SB = SBx();
    const r = await SB
      .from("task_checklist_items")
      .select("id,task_id,pos,text,done,done_at")
      .eq("task_id", taskId)
      .order("pos", { ascending:true });
    if(r && r.error) throw r.error;
    return r.data || [];
'''

new_api = '''    return await ZRBackend.taskChecklistItems.listByTask(taskId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskComments anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API fetchChecklistItems anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro15 patch applied")
