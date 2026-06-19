/* js/services/zr_backend_task_meta.js
   Task activity and assignee data methods.
*/
(function(){
  "use strict";

  function createTaskActivity(){
    return {
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
    };
  }

  function createTaskAssignees(){
    return {
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
    };
  }

  window.ZRBackendTaskMeta = {
    createTaskActivity: createTaskActivity,
    createTaskAssignees: createTaskAssignees
  };
})();
