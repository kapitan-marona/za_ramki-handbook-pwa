/* js/services/zr_backend_task_checklists.js
   Task checklist instance and runtime item data methods.
*/
(function(){
  "use strict";

  function createChecklistInstances(){
    return {
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
    };
  }

  function createTaskChecklistItems(){
    return {
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
      }
    };
  }

  window.ZRBackendTaskChecklists = {
    createChecklistInstances: createChecklistInstances,
    createTaskChecklistItems: createTaskChecklistItems
  };
})();
