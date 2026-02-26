window.Views = window.Views || {};
Views.Admin = (() => {
  const $ = (s) => document.querySelector(s);

  const TYPE_LABELS = {
    standard:  "Стандарт",
    procedure: "Пошаговая инструкция",
    check:     "Проверка",
    reference: "Референс",
    policy:    "Документация"
  };

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function norm(s){ return (s ?? "").toString().trim(); }

  function setStatus(t){ const el = $("#status"); if(el) el.textContent = t; }
  function setPanelTitle(t){ const el = $("#panelTitle"); if(el) el.textContent = t; }

  function toCsv(arr){
    return Array.isArray(arr) ? arr.join(", ") : "";
  }
  function fromCsv(s){
    return (s || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
  }

  function parseActions(s){
    const raw = (s || "").trim();
    if(!raw) return [];
    try{
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    }catch(e){
      throw new Error("Actions должен быть JSON-массивом. Пример: [{\"label\":\"Открыть\",\"url\":\"#\",\"external\":false}]");
    }
  }

  async function sbSelectAll(){
    if(!window.SB) throw new Error("Supabase не готов");
    const { data, error } = await SB
      .from("kb_articles")
      .select("id,title,category,type,tags,roles,status,pinned,updated_at")
      .order("updated_at", { ascending: false });

    if(error) throw error;
    return data || [];
  }

  async function sbGetOne(id){
    const { data, error } = await SB
      .from("kb_articles")
      .select("id,title,category,type,tags,roles,status,pinned,content_md,actions,updated_at")
      .eq("id", id)
      .single();

    if(error) throw error;
    return data;
  }

  async function sbUpsert(row){
    const { data, error } = await SB
      .from("kb_articles")
      .upsert(row, { onConflict: "id" })
      .select("id")
      .single();

    if(error) throw error;
    return data;
  }

  async function sbDelete(id){
    const { error } = await SB.from("kb_articles").delete().eq("id", id);
    if(error) throw error;
  }

  function renderList(items){
    const list = $("#list");
    if(!list) return;

    list.innerHTML = `
      <div class="actions" style="margin-bottom:10px; flex-wrap:wrap;">
        <button class="btn btn-sm" id="adm_new"><span class="dot"></span>Новая инструкция</button>
        <button class="btn btn-sm" id="adm_reload"><span class="dot"></span>Обновить</button>
      </div>
    `;

    if(!items.length){
      list.insertAdjacentHTML("beforeend", `<div class="empty" style="padding:12px;color:var(--muted)">Пока нет записей в kb_articles.</div>`);
    } else {
      items.forEach(it => {
        const typeTitle = TYPE_LABELS[it.type] || (it.type || "");
        const t = typeTitle ? `<span class="tag">${esc(typeTitle)}</span>` : "";
        const st = it.status ? `<span class="tag accent">${esc(it.status)}</span>` : "";
        const pin = it.pinned ? `<span class="tag">pinned</span>` : "";
        const cat = it.category ? `<span class="tag">${esc(it.category)}</span>` : "";

        const a = document.createElement("a");
        a.className = "item";
        a.href = `#/admin/${encodeURIComponent(it.id)}`;
        a.innerHTML = `
          <div class="item-title">${esc(it.title || it.id)}</div>
          <div class="item-meta">${st}${t}${cat}${pin}</div>
        `;
        list.appendChild(a);
      });
    }

    $("#adm_new").onclick = () => openEditorNew();
    $("#adm_reload").onclick = () => loadAndRender("");
  }

  function openEditorNew(){
    const v = $("#viewer");
    v.innerHTML = editorHtml({
      id: "",
      title: "",
      category: "",
      type: "standard",
      tags: [],
      roles: [],
      status: "draft",
      pinned: false,
      content_md: "",
      actions: []
    }, true);

    bindEditor(true);
  }

  function typeOptions(selected){
    const ids = ["standard","procedure","check","reference","policy"];
    return ids.map(id => {
      const t = TYPE_LABELS[id] || id;
      return `<option value="${esc(id)}" ${id===selected ? "selected" : ""}>${esc(t)}</option>`;
    }).join("");
  }

  function editorHtml(row, isNew){
    const actionsStr = JSON.stringify(row.actions || [], null, 2);

    return `
      <h1 class="article-title">Админка → Инструкции</h1>
      <p class="article-sub">${isNew ? "Создание новой инструкции" : ("Редактирование: " + esc(row.id))}</p>
      <div class="hr"></div>

      <div class="markdown">
        <div class="zr-form-grid">

          <div class="zr-field" style="grid-column:1 / -1;">
            <span class="zr-label">ID (латиница, без пробелов)</span>
            <input id="a_id" class="zr-input" value="${esc(row.id)}" ${isNew ? "" : "disabled"} />
          </div>

          <div class="zr-field" style="grid-column:1 / -1;">
            <span class="zr-label">Заголовок</span>
            <input id="a_title" class="zr-input" value="${esc(row.title)}" />
          </div>

          <div class="zr-field">
            <span class="zr-label">Раздел (category)</span>
            <input id="a_category" class="zr-input" value="${esc(row.category || "")}" />
          </div>

          <div class="zr-field">
            <span class="zr-label">Тип (только для админа)</span>
            <select id="a_type" class="zr-input">
              ${typeOptions(row.type || "")}
            </select>
          </div>

          <div class="zr-field">
            <span class="zr-label">Статус</span>
            <select id="a_status" class="zr-input">
              ${["draft","published","archived"].map(s => `<option value="${s}" ${s===(row.status||"")?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>

          <div class="zr-field">
            <span class="zr-label">Pinned</span>
            <select id="a_pinned" class="zr-input">
              <option value="0" ${row.pinned ? "" : "selected"}>нет</option>
              <option value="1" ${row.pinned ? "selected" : ""}>да</option>
            </select>
          </div>

          <div class="zr-field" style="grid-column:1 / -1;">
            <span class="zr-label">Теги (через запятую)</span>
            <input id="a_tags" class="zr-input" value="${esc(toCsv(row.tags))}" />
          </div>

          <div class="zr-field" style="grid-column:1 / -1;">
            <span class="zr-label">Роли (через запятую)</span>
            <input id="a_roles" class="zr-input" value="${esc(toCsv(row.roles))}" />
          </div>

          <div class="zr-field" style="grid-column:1 / -1;">
            <span class="zr-label">Actions (JSON массив)</span>
            <textarea id="a_actions" class="zr-input" rows="6">${esc(actionsStr)}</textarea>
          </div>

          <div class="zr-field" style="grid-column:1 / -1;">
            <span class="zr-label">Контент (Markdown)</span>
            <textarea id="a_md" class="zr-input" rows="16">${esc(row.content_md || "")}</textarea>
          </div>

        </div>

        <div class="zr-actions-right">
          <button class="btn" id="a_save"><span class="dot"></span>Сохранить</button>
          ${isNew ? "" : `<button class="btn" id="a_del"><span class="dot"></span>Удалить</button>`}
        </div>
      </div>
    `;
  }

  function bindEditor(isNew){
    const get = (id) => $(id);

    $("#a_save").onclick = async () => {
      try{
        const id = norm(get("#a_id").value);
        if(!id) return alert("ID обязателен.");

        const row = {
          id,
          title: norm(get("#a_title").value),
          category: norm(get("#a_category").value),
          type: norm(get("#a_type").value),
          status: norm(get("#a_status").value) || "draft",
          pinned: get("#a_pinned").value === "1",
          tags: fromCsv(get("#a_tags").value),
          roles: fromCsv(get("#a_roles").value),
          actions: parseActions(get("#a_actions").value),
          content_md: (get("#a_md").value || "")
        };

        await sbUpsert(row);
        alert("Сохранено ✅");
        await loadAndRender(id);
        location.hash = `#/admin/${encodeURIComponent(id)}`;
      }catch(e){
        console.error(e);
        alert(e.message || String(e));
      }
    };

    const del = $("#a_del");
    if(del){
      del.onclick = async () => {
        const id = norm($("#a_id").value);
        if(!id) return;
        if(!confirm("Удалить инструкцию?")) return;
        try{
          await sbDelete(id);
          alert("Удалено ✅");
          await loadAndRender("");
          location.hash = "#/admin";
        }catch(e){
          console.error(e);
          alert(e.message || String(e));
        }
      };
    }
  }

  async function loadAndRender(openId){
    setPanelTitle("Админка");
    setStatus("…");

    const v = $("#viewer");
    v.innerHTML = `<div class="empty">Загрузка…</div>`;

    try{
      const items = await sbSelectAll();
      renderList(items);
      setStatus(String(items.length));

      if(openId){
        const row = await sbGetOne(openId);
        v.innerHTML = editorHtml(row, false);
        bindEditor(false);
      }else{
        v.innerHTML = `<div class="empty">Выбери инструкцию слева или создай новую.</div>`;
      }
    }catch(e){
      console.error(e);
      $("#list").innerHTML = "";
      v.innerHTML = `
        <h1 class="article-title">Админка</h1>
        <p class="article-sub">Не удалось загрузить kb_articles</p>
        <div class="hr"></div>
        <div class="markdown">
          <code class="mono">${esc(e.message || String(e))}</code>
          <div style="height:10px"></div>
          <div class="muted">Проверь, что ты admin, и что в таблице kb_articles есть поля: id,title,category,type,tags,roles,status,pinned,content_md,actions,updated_at.</div>
        </div>
      `;
      setStatus("ошибка");
    }
  }

  return {
    async show(param){
      await loadAndRender(param || "");
    }
  };
})();
