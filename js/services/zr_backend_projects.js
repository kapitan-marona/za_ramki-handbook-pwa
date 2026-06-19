/* js/services/zr_backend_projects.js
   Projects, project links, and project comments data methods.
*/
(function(){
  "use strict";

  function createProjects(){
    return {
      async list(){
        const r = await window.ZRBackend.db
          .from("projects")
          .select("id,title")
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async getBasic(id){
        if(!id) return null;

        const r = await window.ZRBackend.db
          .from("projects")
          .select("id,title")
          .eq("id", id)
          .maybeSingle();

        if(r && r.error && r.error.code !== "PGRST116") throw r.error;
        return r.data || null;
      },

      async listAdmin(){
        const r = await window.ZRBackend.db
          .from("projects")
          .select("id,title,notes,created_at")
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async create(row){
        const r = await window.ZRBackend.db
          .from("projects")
          .insert(row);

        if(r && r.error) throw r.error;
        return true;
      },

      async activeTaskCount(projectId){
        const r = await window.ZRBackend.db
          .from("tasks")
          .select("id", { count:"exact", head:true })
          .eq("project_id", projectId)
          .is("archived_at", null)
          .neq("status", "canceled");

        if(r && r.error) throw r.error;
        return Number(r.count || 0);
      },

      async update(id, row){
        const r = await window.ZRBackend.db
          .from("projects")
          .update(row)
          .eq("id", id);

        if(r && r.error) throw r.error;
        return true;
      },

      async delete(id){
        const r = await window.ZRBackend.db
          .from("projects")
          .delete()
          .eq("id", id)
          .select("id");

        if(r && r.error) throw r.error;

        if(!Array.isArray(r.data) || r.data.length === 0){
          throw new Error("Проект не удалён. Скорее всего, нет DELETE-политики в Supabase для таблицы projects.");
        }

        return true;
      },

      async listTasks(projectId){
        if(!projectId) return [];

        const r = await window.ZRBackend.db
          .from("tasks")
          .select("id,title,body,status,urgency,start_date,due_date,project_id,archived_at,created_at,updated_at")
          .eq("project_id", projectId)
          .is("archived_at", null)
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    };
  }

  function createProjectLinks(){
    return {
      async listByProject(projectId){
        if(!projectId) return [];

        const r = await window.ZRBackend.db
          .from("project_links")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending:true });

        if(r.error) throw r.error;
        return r.data || [];
      },

      async create(payload){
        const r = await window.ZRBackend.db
          .from("project_links")
          .insert(payload)
          .select()
          .single();

        if(r.error) throw r.error;
        return r.data;
      },

      async remove(id){
        const r = await window.ZRBackend.db
          .from("project_links")
          .delete()
          .eq("id", id);

        if(r.error) throw r.error;
        return true;
      }
    };
  }

  function createProjectComments(){
    return {
      async listByProject(projectId){
        if(!projectId) return [];

        const r = await window.ZRBackend.db
          .from("project_comments")
          .select(`
            id,
            body,
            created_at,
            author_id,
            author:profiles!project_comments_author_id_fkey(
              id,
              name,
              email
            )
          `)
          .eq("project_id", projectId)
          .is("deleted_at", null)
          .order("created_at", { ascending:true });

        if(r.error) throw r.error;
        return r.data || [];
      },

      async create(payload){
        const r = await window.ZRBackend.db
          .from("project_comments")
          .insert(payload)
          .select()
          .single();

        if(r.error) throw r.error;
        return r.data;
      },

      async remove(commentId){
        const r = await window.ZRBackend.db
          .from("project_comments")
          .update({
            deleted_at: new Date().toISOString()
          })
          .eq("id", commentId);

        if(r.error) throw r.error;

        return true;
      }
    };
  }

  window.ZRBackendProjects = {
    createProjects: createProjects,
    createProjectLinks: createProjectLinks,
    createProjectComments: createProjectComments
  };
})();
