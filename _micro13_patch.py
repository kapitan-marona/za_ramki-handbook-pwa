from pathlib import Path
import shutil

root = Path(".")
backend = root / "js" / "services" / "zr_backend.js"
api = root / "js" / "planner" / "planner_api.js"

shutil.copy2(backend, backend.with_suffix(".js.bak_micro13"))
shutil.copy2(api, api.with_suffix(".js.bak_micro13"))

backend_text = backend.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")

old_backend = '''    taskComments: {
      async listByTask(taskId){
        const r = await requireSB()
          .from("task_comments")
          .select(`
            id,
            task_id,
            author_id,
            body,
            created_at,
            deleted_at,
            author:profiles!task_comments_author_id_fkey(
              id,
              name,
              email
            )
          `)
          .eq("task_id", taskId)
          .is("deleted_at", null)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },
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
            deleted_at,
            author:profiles!task_comments_author_id_fkey(
              id,
              name,
              email
            )
          `)
          .eq("task_id", taskId)
          .is("deleted_at", null)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
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
'''

old_api = '''    const SB = SBx();

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

new_api = '''    return await ZRBackend.taskComments.softDelete(commentId);
'''

if old_backend not in backend_text:
    raise SystemExit("Backend taskComments anchor not found")

if old_api not in api_text:
    raise SystemExit("Planner API deleteTaskComment anchor not found")

backend.write_text(backend_text.replace(old_backend, new_backend), encoding="utf-8")
api.write_text(api_text.replace(old_api, new_api), encoding="utf-8")

print("micro13 patch applied")
