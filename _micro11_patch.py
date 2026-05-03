from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro11"))
shutil.copy2(api, api.with_suffix(".js.bak_micro11"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''    taskLinks: {
'''

new_backend = '''    taskFiles: {
      async listByTask(taskId){
        const r = await requireSB()
          .from("task_files")
          .select("id,task_id,bucket_id,object_path,file_name,mime_type,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    taskLinks: {
'''

old_api = '''    const SB = SBx();
    const r = await SB
      .from("task_files")
      .select("id,task_id,bucket_id,object_path,file_name,mime_type,created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending:true });
    if(r && r.error) throw r.error;
    return r.data || [];
'''

new_api = '''    return await ZRBackend.taskFiles.listByTask(taskId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskLinks anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API fetchTaskFiles anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro11 patch applied")
