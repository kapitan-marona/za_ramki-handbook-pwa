from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro12"))
shutil.copy2(api, api.with_suffix(".js.bak_micro12"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''    taskFiles: {
'''

new_backend = '''    taskComments: {
      async listByTask(taskId){
        const r = await requireSB()
          .from("task_comments")
          .select(`
            id,
            task_id,
            author_id,
            body,
            created_at,
            profiles:author_id(name,email)
          `)
          .eq("task_id", taskId)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    taskFiles: {
'''

old_api = '''    const SB = SBx();
    const r = await SB
      .from("task_comments")
      .select(`
        id,
        task_id,
        author_id,
        body,
        created_at,
        profiles:author_id(name,email)
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending:true });

    if(r && r.error) throw r.error;
    return r.data || [];
'''

new_api = '''    return await ZRBackend.taskComments.listByTask(taskId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskFiles anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API fetchComments anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro12 patch applied")
