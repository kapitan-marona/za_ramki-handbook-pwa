/* js/services/zr_backend_tasks.js
   Core task data methods.
*/
(function(){
  "use strict";

  function createTasks(){
    return {
      async listActiveBasic(){
        const r = await window.ZRBackend.db
          .from("tasks")
          .select("id,title,body,status,urgency,role,project_id,assignee_id,start_date,due_date,archived_at,created_at,updated_at,projects(title)")
          .is("archived_at", null)
          .order("due_date", { ascending:true, nullsFirst:false })
          .order("updated_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async create(row){
        const r = await window.ZRBackend.db
          .rpc("create_task_admin", {
            p_title: row && row.title != null ? String(row.title) : "",
            p_body: row && row.body != null ? String(row.body) : "",
            p_start_date: row && row.start_date ? String(row.start_date) : null,
            p_due_date: row && row.due_date ? String(row.due_date) : null,
            p_project_id: row && row.project_id ? row.project_id : null,
            p_role: row && row.role ? String(row.role) : "all",
            p_urgency: row && row.urgency ? String(row.urgency) : "normal"
          });

        if(r && r.error) throw r.error;
        return r.data ? { id: r.data } : null;
      },

      async update(id, row){
        const r = await window.ZRBackend.db
          .rpc("update_task_admin", {
            p_task_id: id,
            p_title: row && row.title != null ? String(row.title) : "",
            p_body: row && row.body != null ? String(row.body) : "",
            p_start_date: row && row.start_date ? String(row.start_date) : null,
            p_due_date: row && row.due_date ? String(row.due_date) : null,
            p_project_id: row && row.project_id ? row.project_id : null,
            p_role: row && row.role ? String(row.role) : "all",
            p_urgency: row && row.urgency ? String(row.urgency) : "normal"
          });

        if(r && r.error && r.error.code !== "PGRST116"){
          throw r.error;
        }

        return { id: (r && r.data) ? r.data : id };
      },

      async getById(id){
        if(!id) return null;

        const r = await window.ZRBackend.db
          .from("tasks")
          .select("*, projects(title)")
          .eq("id", id)
          .maybeSingle();

        if(r && r.error) throw r.error;
        return r.data || null;
      },

      async setStatus(taskId, newStatus){
        const r = await window.ZRBackend.db.rpc("set_task_status", {
          p_new_status: newStatus,
          p_task_id: taskId
        });

        if(r && r.error) throw r.error;
        return true;
      },

      async getStatusSnapshot(id){
        if(!id) return null;

        const r = await window.ZRBackend.db
          .from("tasks")
          .select("id,title,status")
          .eq("id", id)
          .single();

        if(r && r.error) throw r.error;
        return r.data || null;
      },

      async getProjectSnapshot(id){
        if(!id) return null;

        const r = await window.ZRBackend.db
          .from("tasks")
          .select("id,project_id,projects(title)")
          .eq("id", id)
          .maybeSingle();

        if(r && r.error && r.error.code !== "PGRST116"){
          throw r.error;
        }

        if(r && r.error && r.error.code === "PGRST116"){
          console.warn("[ZRBackend] getProjectSnapshot: task not visible or not found", {
            taskId: id,
            error: r.error
          });
        }

        return r.data || null;
      },

      async archive(taskId){
        const r = await window.ZRBackend.db
          .rpc("archive_task", { p_task_id: taskId });

        if(r && r.error) throw r.error;
        return true;
      },

      async archiveDone(){
        const r = await window.ZRBackend.db
          .rpc("archive_done_tasks");

        if(r && r.error) throw r.error;
        return (r && r.data != null) ? r.data : 0;
      }
    };
  }

  window.ZRBackendTasks = {
    createTasks: createTasks
  };
})();
