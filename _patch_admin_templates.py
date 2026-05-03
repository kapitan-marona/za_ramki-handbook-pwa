from pathlib import Path

# --- 1. Patch zr_backend.js: add kb.templates semantic CRUD ---
p = Path("js/services/zr_backend.js")
text = p.read_text(encoding="utf-8")

if "templates: {" not in text:
    marker = "      async searchArticles(query){"
    insert = '''      templates: {
        async listAll(){
          const r = await requireSB()
            .from("kb_templates")
            .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
            .order("sort", { ascending:true })
            .order("title", { ascending:true });

          if(r && r.error) throw r.error;
          return r.data || [];
        },

        async get(id){
          const r = await requireSB()
            .from("kb_templates")
            .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
            .eq("id", id)
            .single();

          if(r && r.error) throw r.error;
          return r.data;
        },

        async upsert(row){
          const r = await requireSB()
            .from("kb_templates")
            .upsert(row, { onConflict:"id" })
            .select("id");

          if(r && r.error) throw r.error;
          return true;
        },

        async delete(id){
          const r = await requireSB()
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

'''
    if marker not in text:
        raise SystemExit("zr_backend.js: searchArticles marker not found")
    text = text.replace(marker, insert + marker, 1)
    p.write_text(text, encoding="utf-8", newline="\r\n")


# --- 2. Patch admin.templates.js: replace SB usage with Backend.kb.templates ---
p = Path("js/views/admin.templates.js")
text = p.read_text(encoding="utf-8")

text = text.replace("  const SB = deps.SB;\n", "  const Backend = window.ZRBackend;\n", 1)
text = text.replace(
    '  if(!SB) throw new Error("Admin templates module: SB missing.");',
    '  if(!Backend || !Backend.kb || !Backend.kb.templates) throw new Error("Admin templates module: ZRBackend.kb.templates missing.");',
    1
)

text = text.replace('''  async function sbTemplatesListAll(){
    const p = SB.from("kb_templates")
      .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
      .order("sort", { ascending:true })
      .order("title", { ascending:true });
    const { data, error } = await withTimeout(p, 12000, "kb_templates list");
    if(error) throw error;
    return data || [];
  }''', '''  async function sbTemplatesListAll(){
    return await withTimeout(Backend.kb.templates.listAll(), 12000, "kb_templates list");
  }''', 1)

text = text.replace('''  async function sbTemplatesGet(id){
    const p = SB.from("kb_templates")
      .select("id,title,format,link,actions,tags,published,sort,created_at,updated_at")
      .eq("id", id).single();
    const { data, error } = await withTimeout(p, 12000, "kb_templates get");
    if(error) throw error;
    return data;
  }''', '''  async function sbTemplatesGet(id){
    return await withTimeout(Backend.kb.templates.get(id), 12000, "kb_templates get");
  }''', 1)

text = text.replace('''      const p = SB.from("kb_templates").upsert(row, { onConflict:"id" }).select("id");
      const { error } = await withTimeout(p, 45000, "kb_templates upsert");
      if(error) throw error;''', '''      await withTimeout(Backend.kb.templates.upsert(row), 45000, "kb_templates upsert");''', 1)

text = text.replace('''      const p2 = SB.from("kb_templates").upsert(row, { onConflict:"id" }).select("id");
      const { error: error2 } = await withTimeout(p2, 45000, "kb_templates upsert retry");
      if(error2) throw error2;''', '''      await withTimeout(Backend.kb.templates.upsert(row), 45000, "kb_templates upsert retry");''', 1)

text = text.replace('''  async function sbTemplatesDelete(id){
    await ensureSession();
    const p = SB.from("kb_templates").delete().eq("id", id);
    const { error } = await withTimeout(p, 20000, "kb_templates delete");
    if(error) throw error;
  }''', '''  async function sbTemplatesDelete(id){
    await ensureSession();
    return await withTimeout(Backend.kb.templates.delete(id), 20000, "kb_templates delete");
  }''', 1)

p.write_text(text, encoding="utf-8", newline="\r\n")

print("PATCH OK")
