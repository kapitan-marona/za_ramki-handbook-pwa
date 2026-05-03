from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro13_retry"))
shutil.copy2(api, api.with_suffix(".js.bak_micro13_retry"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    taskFiles: {
'''

new_backend = '''        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async softDelete(commentId){
        const r = await requireSB()
          .from("task_comments")
          .update({
            deleted_at: new Date().toISOString()
          })
          .eq("id", commentId)
          .is("deleted_at", null);

        if(r && r.error) throw r.error;
        return true;
      }
    },

    taskFiles: {
'''

old_api = '''    const SB = SBx();
    if(!commentId) throw new Error("commentId required");

    const r = await SB
      .from("task_comments")
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq("id", commentId)
      .is("deleted_at", null);

    if(r && r.error) throw r.error;
    return true;
'''

new_api = '''    if(!commentId) throw new Error("commentId required");
    return await ZRBackend.taskComments.softDelete(commentId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskComments insertion anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API deleteTaskComment anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend, 1), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro13 retry patch applied")
