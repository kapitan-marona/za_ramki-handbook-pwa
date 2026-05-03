from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro14"))
shutil.copy2(api, api.with_suffix(".js.bak_micro14"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''      async softDelete(commentId){
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
'''

new_backend = '''      async softDelete(commentId){
        const r = await requireSB()
          .from("task_comments")
          .update({
            deleted_at: new Date().toISOString()
          })
          .eq("id", commentId)
          .is("deleted_at", null);

        if(r && r.error) throw r.error;
        return true;
      },

      async add(taskId, body){
        const r = await requireSB()
          .rpc("add_task_comment", {
            p_task_id: taskId,
            p_body: body
          });

        if(r && r.error) throw r.error;
        return true;
      }
    },
'''

old_api = '''    const r = await SB.rpc("add_task_comment", { p_task_id: taskId, p_body: body });
    if(r && r.error) throw r.error;
'''

new_api = '''    await ZRBackend.taskComments.add(taskId, body);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskComments.softDelete anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API addTaskComment RPC anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro14 patch applied")
