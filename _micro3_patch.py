from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro3"))
shutil.copy2(api, api.with_suffix(".js.bak_micro3"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''    tasks: {
      async create(row){
        const r = await requireSB()
          .from("tasks")
          .insert(row)
          .select("id")
          .single();

        if(r && r.error) throw r.error;
        return r.data || null;
      }
    },
'''

new_backend = '''    tasks: {
      async create(row){
        const r = await requireSB()
          .from("tasks")
          .insert(row)
          .select("id")
          .single();

        if(r && r.error) throw r.error;
        return r.data || null;
      },

      async getById(id){
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

old_api = '''    const SB = SBx();
    const r = await SB.from("tasks").select("*, projects(title)").eq("id", taskId).maybeSingle();
    if(r && r.error) throw r.error;

    const row = r.data || null;
'''

new_api = '''    const row = await ZRBackend.tasks.getById(taskId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend tasks anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API fetchTaskById anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro3 patch applied")
