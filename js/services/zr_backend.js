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
      async getSession(){
        try{
          return await requireSB().auth.getSession();
        }catch(e){
          var msg = String((e && e.message) || e || "");
          if(msg.indexOf("Invalid Refresh Token") !== -1 || msg.indexOf("Refresh Token Not Found") !== -1){
            try{
              await requireSB().auth.signOut({ scope: "local" });
            }catch(_e){}
            return { data: { session: null }, error: null };
          }
          throw e;
        }
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
    },

    projects: {
      async list(){
        const r = await requireSB()
          .from("projects")
          .select("id,title")
          .order("created_at", { ascending:false });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },

    profiles: {
      async listBasic(){
        const r = await requireSB()
          .from("profiles")
          .select("id,email,name,role,is_admin")
          .order("name", { ascending:true })
          .order("email", { ascending:true });

        if(r && r.error) throw r.error;
        return r.data || [];
      }
    },
    
    kb: {
      async searchArticles(query){
        const q = query ? String(query).trim() : "";

        let req = requireSB()
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

        let req = requireSB()
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

        let req = requireSB()
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

