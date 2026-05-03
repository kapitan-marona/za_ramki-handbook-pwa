from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro2"))
shutil.copy2(api, api.with_suffix(".js.bak_micro2"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''    allowlist: {
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
      }
    },

    allowlist: {
'''

old_api = '''    const r = await SB.from("tasks").insert(row).select("id").single();
    if(r && r.error) throw r.error;
    return r.data || null;
'''

new_api = '''    return await ZRBackend.tasks.create(row);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API createTask anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro2 patch applied")
