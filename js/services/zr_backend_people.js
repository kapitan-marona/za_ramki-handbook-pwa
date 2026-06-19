/* js/services/zr_backend_people.js
   Allowlist and profile data methods.
*/
(function(){
  "use strict";

  function createAllowlist(){
    return {
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
    };
  }

  function createProfiles(){
    return {
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
    };
  }

  window.ZRBackendPeople = {
    createAllowlist: createAllowlist,
    createProfiles: createProfiles
  };
})();
