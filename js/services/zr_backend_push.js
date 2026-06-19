/* js/services/zr_backend_push.js
   Push subscription storage methods.
*/
(function(){
  "use strict";

  function createPushSubscriptions(){
    return {
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
    };
  }

  window.ZRBackendPush = {
    createPushSubscriptions: createPushSubscriptions
  };
})();
