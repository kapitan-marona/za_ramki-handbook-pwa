/* js/services/zr_backend_kb.js
   Knowledge base articles, templates, checklists, and link search.
*/
(function(){
  "use strict";

  function createKb(){
    return {
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
    };
  }

  window.ZRBackendKb = {
    createKb: createKb
  };
})();
