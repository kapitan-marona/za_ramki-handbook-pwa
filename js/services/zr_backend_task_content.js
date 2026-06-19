/* js/services/zr_backend_task_content.js
   Task comments, files, and links data methods.
*/
(function(){
  "use strict";

  function createTaskComments(){
    return {
      async listByTask(taskId){
        const r = await window.ZRBackend.db
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
        const r = await window.ZRBackend.db
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
        const r = await window.ZRBackend.db
          .rpc("add_task_comment", {
            p_task_id: taskId,
            p_body: body
          });

        if(r && r.error) throw r.error;
        return true;
      }
    };
  }

  function createTaskFiles(){
    return {
      async listByTask(taskId){
        const r = await window.ZRBackend.db
          .from("task_files")
          .select("id,task_id,bucket_id,object_path,file_name,mime_type,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    };
  }

  function createTaskLinks(){
    return {
      async listByTask(taskId){
        const r = await window.ZRBackend.db
          .from("task_links")
          .select("id,task_id,link_type,ref_id,url,label,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async create(row){
        const r = await window.ZRBackend.db
          .from("task_links")
          .insert(row)
          .select("id,task_id,link_type,ref_id,url,label,created_at")
          .single();

        if(r && r.error) throw r.error;
        return (r && r.data) ? r.data : null;
      },

      async remove(id){
        const r = await window.ZRBackend.db
          .from("task_links")
          .delete()
          .eq("id", id);

        if(r && r.error) throw r.error;
        return true;
      }
    };
  }

  window.ZRBackendTaskContent = {
    createTaskComments: createTaskComments,
    createTaskFiles: createTaskFiles,
    createTaskLinks: createTaskLinks
  };
})();
