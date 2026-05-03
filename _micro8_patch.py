from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro8"))
shutil.copy2(api, api.with_suffix(".js.bak_micro8"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''      async getById(id){
        if(!id) return null;

        const r = await requireSB()
          .from("tasks")
          .select("*, projects(title)")
          .eq("id", id)
          .maybeSingle();

        if(r && r.error) throw r.error;
        return r.data || null;
      }
    },
'''

new_backend = '''      async getById(id){
        if(!id) return null;

        const r = await requireSB()
          .from("tasks")
          .select("*, projects(title)")
          .eq("id", id)
          .maybeSingle();

        if(r && r.error) throw r.error;
        return r.data || null;
      },

      async archive(taskId){
        const r = await requireSB()
          .rpc("archive_task", { p_task_id: taskId });

        if(r && r.error) throw r.error;
        return true;
      }
    },
'''

old_api = '''    const SB = SBx();
    const r = await SB.rpc("archive_task", { p_task_id: taskId });
    if(r && r.error) throw r.error;
    return true;
'''

new_api = '''    return await ZRBackend.tasks.archive(taskId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend tasks.getById anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API archiveTask anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro8 patch applied")
