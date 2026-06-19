/* js/services/zr_backend_core.js
   Shared auth/db wrappers for the backend facade.
*/
(function(){
  "use strict";

  function createAuth(requireProvider){
    return {
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
    };
  }

  function createDb(requireProvider){
    return {
      from(table){
        return requireProvider().from(table);
      },

      rpc(name, params){
        return requireProvider().rpc(name, params);
      }
    };
  }

  window.ZRBackendCore = {
    createAuth: createAuth,
    createDb: createDb
  };
})();
