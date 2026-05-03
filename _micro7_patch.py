from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro7"))
shutil.copy2(api, api.with_suffix(".js.bak_micro7"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''      async create(row){
        const r = await requireSB()
          .from("task_links")
          .insert(row)
          .select("id,task_id,link_type,ref_id,url,label,created_at")
          .single();

        if(r && r.error) throw r.error;
        return (r && r.data) ? r.data : null;
      }
    },
'''

new_backend = '''      async create(row){
        const r = await requireSB()
          .from("task_links")
          .insert(row)
          .select("id,task_id,link_type,ref_id,url,label,created_at")
          .single();

        if(r && r.error) throw r.error;
        return (r && r.data) ? r.data : null;
      },

      async remove(id){
        const r = await requireSB()
          .from("task_links")
          .delete()
          .eq("id", id);

        if(r && r.error) throw r.error;
        return true;
      }
    },
'''

old_api = '''    const SB = SBx();
    if(!linkId) throw new Error("linkId required");

    const r = await SB
      .from("task_links")
      .delete()
      .eq("id", linkId);

    if(r && r.error) throw r.error;
    return true;
'''

new_api = '''    if(!linkId) throw new Error("linkId required");
    return await ZRBackend.taskLinks.remove(linkId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskLinks.create anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API removeTaskLink anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro7 patch applied")
