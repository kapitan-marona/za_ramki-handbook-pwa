/* js/services/zr_backend.js
   Backend adapter facade.
   Phase 0: still uses Supabase internally.
   Future: can switch internals to Yandex API without changing views.
*/
(function(){
  "use strict";

  function requireSB(){
    if(!window.SB){
      throw new Error("Supabase client is not ready");
    }
    return window.SB;
  }

  window.ZRBackend = {
    mode: "supabase",

    rawSupabase(){
      return requireSB();
    },

    auth: {
      getSession(){
        return requireSB().auth.getSession();
      },

      refreshSession(){
        return requireSB().auth.refreshSession();
      },

      onAuthStateChange(cb){
        return requireSB().auth.onAuthStateChange(cb);
      },

      signOut(options){
        return requireSB().auth.signOut(options);
      },

      signInWithPassword(payload){
        return requireSB().auth.signInWithPassword(payload);
      },

      signInWithOtp(payload){
        return requireSB().auth.signInWithOtp(payload);
      },

      updateUser(payload){
        return requireSB().auth.updateUser(payload);
      },

      resetPasswordForEmail(email, options){
        return requireSB().auth.resetPasswordForEmail(email, options);
      }
    },

    db: {
      from(table){
        return requireSB().from(table);
      },

      rpc(name, params){
        return requireSB().rpc(name, params);
      }
    }
  };

  console.log("[ZRBackend] ready: supabase adapter");
})();