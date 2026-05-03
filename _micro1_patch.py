from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro1"))
shutil.copy2(api, api.with_suffix(".js.bak_micro1"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''      async list(){
        const r = await requireSB()
          .from("projects")
          .select("id,title")
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      },
'''

new_backend = '''      async list(){
        const r = await requireSB()
          .from("projects")
          .select("id,title")
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async getBasic(id){
        if(!id) return null;

        const r = await requireSB()
          .from("projects")
          .select("id,title")
          .eq("id", id)
          .maybeSingle();

        if(r && r.error && r.error.code !== "PGRST116") throw r.error;
        return r.data || null;
      },
'''

old_api = '''      if(newProjectId){
        const projRes = await SB
          .from("projects")
          .select("id,title")
          .eq("id", newProjectId)
          .maybeSingle();

        if(projRes && projRes.error && projRes.error.code !== "PGRST116") throw projRes.error;
        if(projRes && projRes.error && projRes.error.code === "PGRST116"){
          console.warn("[PlannerAPI] updateTask project lookup empty", {
            taskId,
            newProjectId,
            error: projRes.error
          });
        }
        newTitle = (projRes.data && projRes.data.title) ? String(projRes.data.title) : "";
      }
'''

new_api = '''      if(newProjectId){
        const project = await ZRBackend.projects.getBasic(newProjectId);
        newTitle = (project && project.title) ? String(project.title) : "";
      }
'''

if old_backend not in backend_text:
    raise SystemExit("Backend anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro1 patch applied")
