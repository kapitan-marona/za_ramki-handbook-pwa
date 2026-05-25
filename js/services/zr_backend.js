/* js/services/zr_backend.js
   Backend adapter facade.
   Phase 0: still uses Supabase internally.
   Future: can switch internals to Yandex API without changing views.
*/
(function(){
  "use strict";

  function getProvider(){
    return window.SB || null;
  }

  function requireProvider(){
    const provider = getProvider();

    if(!provider){
      throw new Error("Supabase client is not ready");
    }

    return provider;
  }

  /* temporary compatibility layer
     Phase: provider quarantine
  */
  function requireSB(){
    return requireProvider();
  }

  window.ZRBackend = {
    isReady(){
      return !!window.SB;
    },

    mode: "supabase",

    /* transitional provider accessor
       future-safe provider boundary
    */
    raw(){
      return requireProvider();
    },

    /* legacy compatibility alias
       remove later after full quarantine
    */
    rawSupabase(){
      return this.raw();
    },

    auth: {
      async getSession(){
        try{
          return await requireProvider().auth.getSession();
        }catch(e){
          var msg = String((e && e.message) || e || "");
          if(msg.indexOf("Invalid Refresh Token") !== -1 || msg.indexOf("Refresh Token Not Found") !== -1){
            try{
              await requireProvider().auth.signOut({ scope: "local" });
            }catch(_e){}
            return { data: { session: null }, error: null };
          }
          throw e;
        }
      },

      refreshSession(){
        return requireProvider().auth.refreshSession();
      },

      onAuthStateChange(cb){
        return requireProvider().auth.onAuthStateChange(cb);
      },

      signOut(options){
        return requireProvider().auth.signOut(options);
      },

      signInWithPassword(payload){
        return requireProvider().auth.signInWithPassword(payload);
      },

      signInWithOtp(payload){
        return requireProvider().auth.signInWithOtp(payload);
      },

      updateUser(payload){
        return requireProvider().auth.updateUser(payload);
      },

      resetPasswordForEmail(email, options){
        return requireProvider().auth.resetPasswordForEmail(email, options);
      }
    },

    db: {
      from(table){
        return requireProvider().from(table);
      },

      rpc(name, params){
        return requireProvider().rpc(name, params);
      }
    },

    projects: {
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
    },
    
    projectLinks: {

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
    },

    projectComments: {

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
      },  
    },

    tasks: {
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
          .from("tasks")
          .insert(row)
          .select("id")
          .single();

        if(r && r.error) throw r.error;
        return r.data || null;
      },
      
      async update(id, row){
        const r = await window.ZRBackend.db
          .from("tasks")
          .update(row)
          .eq("id", id)
          .select("id")
          .maybeSingle();

        if(r && r.error && r.error.code !== "PGRST116"){
          throw r.error;
        }

        return (r && r.data)
          ? r.data
          : { id };
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
    },

    taskActivity: {
      async listByTask(taskId){
        const r = await window.ZRBackend.db
          .from("task_activity")
          .select("id,task_id,actor_id,type,body,payload,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async log(taskId, type, body, payload){
        const r = await window.ZRBackend.db.rpc("log_task_activity", {
          p_task_id: taskId,
          p_type: String(type || "system"),
          p_body: body != null ? String(body) : null,
          p_payload: payload || {}
        });

        if(r && r.error) throw r.error;
        return true;
      }
    },

    taskAssignees: {
      async listByTask(taskId){
        const r = await window.ZRBackend.db
          .from("task_assignees")
          .select("user_id,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async listIdsByTask(taskId){
        const rows = await this.listByTask(taskId);

        return Array.isArray(rows)
          ? rows.map(x => String(x.user_id)).filter(Boolean)
          : [];
      },

      async listByTasks(taskIds){
        if(!Array.isArray(taskIds) || taskIds.length === 0) return {};

        const r = await window.ZRBackend.db
          .from("task_assignees")
          .select("task_id,user_id")
          .in("task_id", taskIds);

        if(r && r.error) throw r.error;

        const map = {};
        (r.data || []).forEach(row => {
          const tid = String(row.task_id);
          const uid = String(row.user_id);

          if(!map[tid]) map[tid] = [];
          map[tid].push(uid);
        });

        return map;
      },

      async replaceForTask(taskId, userIds){
        if(!taskId) throw new Error("taskId required");

        const ids = Array.isArray(userIds)
          ? Array.from(new Set(userIds.map(x => String(x).trim()).filter(Boolean)))
          : [];

        const del = await window.ZRBackend.db
          .from("task_assignees")
          .delete()
          .eq("task_id", taskId);

        if(del && del.error) throw del.error;

        if(ids.length > 0){
          const rows = ids.map(uid => ({
            task_id: taskId,
            user_id: uid
          }));

          const ins = await window.ZRBackend.db
            .from("task_assignees")
            .insert(rows);

          if(ins && ins.error) throw ins.error;
        }

        return true;
      }
    },
    
    checklistInstances: {
      async getTaskScoped(taskId, checklistId){
        if(!taskId) return null;

        const r = await window.ZRBackend.db
          .from("checklist_instances")
          .select("id,task_id,user_id,checklist_id,items_state,status,created_at,updated_at")
          .eq("task_id", String(taskId))
          .eq("checklist_id", String(checklistId))
          .order("created_at", { ascending:true })
          .limit(2);

        if(r && r.error) throw r.error;

        const rows = Array.isArray(r.data) ? r.data : [];

        if(rows.length > 1){
          console.warn("[Checklists] Duplicate task-scoped instances detected", {
            task_id: String(taskId),
            checklist_id: String(checklistId),
            count: rows.length
          });
        }

        return rows.length ? rows[0] : null;
      },

      async getLegacyUserScoped(userId, checklistId){
        if(!userId) return null;

        const r = await window.ZRBackend.db
          .from("checklist_instances")
          .select("id,task_id,user_id,checklist_id,items_state,status,created_at,updated_at")
          .eq("user_id", String(userId))
          .is("task_id", null)
          .eq("checklist_id", String(checklistId))
          .order("created_at", { ascending:true })
          .limit(2);

        if(r && r.error) throw r.error;

        const rows = Array.isArray(r.data) ? r.data : [];

        if(rows.length > 1){
          console.warn("[Checklists] Duplicate legacy user-scoped instances detected", {
            user_id: String(userId),
            checklist_id: String(checklistId),
            count: rows.length
          });
        }

        return rows.length ? rows[0] : null;
      },

      async create(payload){
        const r = await window.ZRBackend.db
          .from("checklist_instances")
          .insert(payload)
          .select("id,task_id,user_id,checklist_id,items_state,status,created_at,updated_at")
          .single();

        if(r && r.error) throw r.error;

        return r.data || null;
      },

      async updateItemsState(instanceId, itemsState){
        const r = await window.ZRBackend.db
          .from("checklist_instances")
          .update({
            items_state: itemsState,
            updated_at: new Date().toISOString()
          })
          .eq("id", String(instanceId))
          .select("id,task_id,items_state,updated_at")
          .single();

        if(r && r.error) throw r.error;

        return r.data || null;
      }
    },

    taskChecklistItems: {
      async listByTask(taskId){
        const r = await window.ZRBackend.db
          .from("task_checklist_items")
          .select("id,task_id,pos,text,done,done_at")
          .eq("task_id", taskId)
          .order("pos", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async setDone(itemId, done){
        const r = await window.ZRBackend.db
          .rpc("set_task_checklist_done", {
            p_item_id: itemId,
            p_done: !!done
          });

        if(r && r.error) throw r.error;
        return true;
      },

      async clearByTask(taskId){
        const r = await window.ZRBackend.db
          .from("task_checklist_items")
          .delete()
          .eq("task_id", taskId)
          .select("id");

        if(r && r.error) throw r.error;

        if(!Array.isArray(r.data) || r.data.length === 0){
          throw new Error("Чек-лист не удалён из задачи. Возможно, нет DELETE-политики для task_checklist_items или task_id не найден.");
        }

        return true;
      },
      
      async getTemplateItems(templateId){
        if(!templateId) return [];

        const r = await window.ZRBackend.db
          .from("kb_checklists")
          .select("items")
          .eq("id", templateId)
          .maybeSingle();

        if(r && r.error) throw r.error;

        const items = r && r.data
          ? r.data.items
          : null;

        return Array.isArray(items)
          ? items
          : [];
      },

      async hasTaskItems(taskId){
        if(!taskId) return false;

        const r = await window.ZRBackend.db
          .from("task_checklist_items")
          .select("id")
          .eq("task_id", taskId)
          .limit(1);

        if(r && r.error) throw r.error;

        return Array.isArray(r.data) && r.data.length > 0;
      },

      async insertRuntimeItems(rows){
        if(!Array.isArray(rows) || rows.length === 0){
          return true;
        }

        const r = await window.ZRBackend.db
          .from("task_checklist_items")
          .insert(rows);

        if(r && r.error) throw r.error;

        return true;
      },
    },

    taskComments: {
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
    },

    taskFiles: {
      async listByTask(taskId){
        const r = await window.ZRBackend.db
          .from("task_files")
          .select("id,task_id,bucket_id,object_path,file_name,mime_type,created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    taskLinks: {
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
    },
    
    pushSubscriptions: {
      async getByEndpoint(endpoint){
        if(!endpoint) return null;

        const r = await window.ZRBackend.db
          .from("push_subscriptions")
          .select("endpoint,is_active,user_id,user_role,updated_at")
          .eq("endpoint", endpoint)
          .maybeSingle();

        if(r && r.error) throw r.error;

        return r.data || null;
      },

      async upsert(row){
        const r = await window.ZRBackend.db
          .from("push_subscriptions")
          .upsert([row], { onConflict:"endpoint" });

        if(r && r.error) throw r.error;

        return true;
      }
    },

    allowlist: {
      async list(){
        const r = await window.ZRBackend.db
          .from("allowlist")
          .select("email,role,enabled")
          .order("email", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async upsert(row){
        const r = await window.ZRBackend.db
          .from("allowlist")
          .upsert(row, { onConflict:"email" });

        if(r && r.error) throw r.error;
        return true;
      },

      async delete(email){
        const r = await window.ZRBackend.db
          .from("allowlist")
          .delete()
          .eq("email", email);

        if(r && r.error) throw r.error;
        return true;
      }
    },

    profiles: {
      async listBasic(){
        const r = await window.ZRBackend.db
          .from("profiles")
          .select("id,email,name,role,is_admin")
          .order("name", { ascending:true })
          .order("email", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      },

      async listByIds(ids){
        const cleanIds = (ids || []).filter(Boolean).map(String);
        if(cleanIds.length === 0) return [];

        const r = await window.ZRBackend.db
          .from("profiles")
          .select("id,name,email")
          .in("id", cleanIds);

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },
    
    kb: {
      articles: {
        async listAll(){
          const r = await window.ZRBackend.db
            .from("kb_articles")
            .select("id,title,category,type,tags,roles,status,updated_at,excerpt,has_inline_new")
            .order("updated_at", { ascending:false });

          if(r && r.error) throw r.error;
          return r.data || [];
        },

        async get(id){
          const r = await window.ZRBackend.db
            .from("kb_articles")
            .select("id,title,category,type,tags,roles,status,updated_at,excerpt,content_md,actions,has_inline_new")
            .eq("id", id)
            .single();

          if(r && r.error) throw r.error;
          return r.data;
        },

        async listPublishedIndex(){
          const r = await window.ZRBackend.db
            .from("kb_articles")
            .select("id,title,category,tags,roles,updated_at,pinned,actions,status,has_inline_new")
            .eq("status","published")
            .order("pinned",{ ascending:false })
            .order("updated_at",{ ascending:false });

          if(r && r.error) throw r.error;

          return (r.data || []).map(row => ({
            id: row.id,
            title: row.title,
            category: row.category,
            tags: row.tags || [],
            roles: row.roles || [],
            updatedAt: row.updated_at,
            pinned: !!row.pinned,
            actions: row.actions || [],
            hasInlineNew: !!row.has_inline_new,
            source: "sb"
          }));
        },

        async getPublishedContent(id){
          const r = await window.ZRBackend.db
            .from("kb_articles")
            .select("content_md,actions,updated_at,category,tags,roles,title")
            .eq("id", id)
            .single();

          if(r && r.error) throw r.error;
          return r.data;
        },

        async upsert(row){
          const r = await window.ZRBackend.db
            .from("kb_articles")
            .upsert(row, { onConflict:"id" })
            .select("id");

          if(r && r.error) throw r.error;
          return true;
        },

        async delete(id){
          const r = await window.ZRBackend.db
            .from("kb_articles")
            .delete()
            .eq("id", id)
            .select("id");

          if(r && r.error) throw r.error;

          if(!Array.isArray(r.data) || r.data.length === 0){
            throw new Error("Инструкция не удалена. Возможно, нет DELETE-политики для таблицы kb_articles или id не найден.");
          }

          return true;
        }
      },

      templates: {
        async listAll(){
          const r = await window.ZRBackend.db
            .from("kb_templates")
            .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
            .order("sort", { ascending:true })
            .order("title", { ascending:true });

          if(r && r.error) throw r.error;
          return r.data || [];
        },

        async get(id){
          const r = await window.ZRBackend.db
            .from("kb_templates")
            .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
            .eq("id", id)
            .single();

          if(r && r.error) throw r.error;
          return r.data;
        },

        async listPublished(){
          const r = await window.ZRBackend.db
            .from("kb_templates")
            .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
            .eq("published", true)
            .order("sort", { ascending:true })
            .order("title", { ascending:true });

          if(r && r.error) throw r.error;
          return r.data || [];
        },

        async upsert(row){
          const r = await window.ZRBackend.db
            .from("kb_templates")
            .upsert(row, { onConflict:"id" })
            .select("id");

          if(r && r.error) throw r.error;
          return true;
        },

        async delete(id){
          const r = await window.ZRBackend.db
            .from("kb_templates")
            .delete()
            .eq("id", id)
            .select("id");

          if(r && r.error) throw r.error;

          if(!Array.isArray(r.data) || r.data.length === 0){
            throw new Error("Шаблон не удалён. Возможно, нет DELETE-политики для таблицы kb_templates или id не найден.");
          }

          return true;
        }
      },

      checklists: {
        async listAll(){
          const r = await window.ZRBackend.db
            .from("kb_checklists")
            .select("id,title,desc,url,actions,tags,published,sort,created_at,updated_at")
            .order("sort", { ascending:true })
            .order("title", { ascending:true });

          if(r && r.error) throw r.error;
          return r.data || [];
        },

        async get(id){
          const r = await window.ZRBackend.db
            .from("kb_checklists")
            .select("id,title,desc,url,actions,tags,published,sort,created_at,updated_at,items")
            .eq("id", id)
            .single();

          if(r && r.error) throw r.error;
          return r.data;
        },

        async listPublished(){
          const r = await window.ZRBackend.db
            .from("kb_checklists")
            .select("id,title,desc,url,actions,tags,published,sort,created_at,updated_at,items")
            .eq("published", true)
            .order("sort", { ascending:true })
            .order("title", { ascending:true });

          if(r && r.error) throw r.error;
          return r.data || [];
        },

        async upsert(row){
          const r = await window.ZRBackend.db
            .from("kb_checklists")
            .upsert(row, { onConflict:"id" })
            .select("id");

          if(r && r.error) throw r.error;
          return true;
        },

        async delete(id){
          const r = await window.ZRBackend.db
            .from("kb_checklists")
            .delete()
            .eq("id", id)
            .select("id");

          if(r && r.error) throw r.error;

          if(!Array.isArray(r.data) || r.data.length === 0){
            throw new Error("Чек-лист не удалён. Возможно, нет DELETE-политики для таблицы kb_checklists или id не найден.");
          }

          return true;
        }
      },

      async searchArticles(query){
        const q = query ? String(query).trim() : "";

        let req = window.ZRBackend.db
          .from("kb_articles")
          .select("id,title,category,updated_at")
          .eq("status", "published")
          .order("updated_at", { ascending:false })
          .limit(12);

        if(q){
          req = req.ilike("title", "%" + q + "%");
        }

        const r = await req;
        if(r && r.error) throw r.error;

        return (r.data || []).map(x => ({
          id: x.id,
          title: x.title,
          kind: "article"
        }));
      },

      async searchTemplates(query){
        const q = query ? String(query).trim() : "";

        let req = window.ZRBackend.db
          .from("kb_templates")
          .select("id,title,updated_at")
          .eq("published", true)
          .order("updated_at", { ascending:false })
          .limit(12);

        if(q){
          req = req.ilike("title", "%" + q + "%");
        }

        const r = await req;
        if(r && r.error) throw r.error;

        return (r.data || []).map(x => ({
          id: x.id,
          title: x.title,
          kind: "template"
        }));
      },

      async searchChecklists(query){
        const q = query ? String(query).trim() : "";

        let req = window.ZRBackend.db
          .from("kb_checklists")
          .select("id,title,updated_at")
          .eq("published", true)
          .order("updated_at", { ascending:false })
          .limit(12);

        if(q){
          req = req.ilike("title", "%" + q + "%");
        }

        const r = await req;
        if(r && r.error) throw r.error;

        return (r.data || []).map(x => ({
          id: x.id,
          title: x.title,
          kind: "checklist"
        }));
      }
    }
  };

  console.log("[ZRBackend] ready: supabase adapter");
})();

