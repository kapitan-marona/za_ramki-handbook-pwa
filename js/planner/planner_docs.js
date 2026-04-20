(function(){
  if(window.PlannerDocs) return;

  function parseInternalDoc(f){
    if(!f) return null;
    if(String(f.bucket_id || "") !== "internal") return null;

    const p = String(f.object_path || "").trim();
    const label = (f.file_name || p);

    let m = p.match(/^#\/([^\/]+)\/(.+)$/);
    if(m){
      const section = m[1];
      const id = m[2];
      if(!["articles","checklists","templates"].includes(section)) return null;
      return { section, id, label, removable: false, source: "file" };
    }

    m = p.match(/^([^\/]+)\/(.+)$/);
    if(m){
      const section = m[1];
      const id = m[2];
      if(!["articles","checklists","templates"].includes(section)) return null;
      return { section, id, label, removable: false, source: "file" };
    }

    return null;
  }

  function parseTaskLink(link){
    if(!link) return null;

    const type = String(link.link_type || "").trim().toLowerCase();
    const refId = String(link.ref_id || "").trim();
    const url = String(link.url || "").trim();
    const label = String(link.label || "").trim() || "Открыть";
    const linkId = link.id ? String(link.id) : null;

    if(type === "article" && refId){
      return { section: "articles", id: refId, label, link_id: linkId, removable: true, source: "link" };
    }
    if(type === "checklist" && refId){
      return { section: "checklists", id: refId, label, link_id: linkId, removable: true, source: "link" };
    }
    if(type === "template" && refId){
      return { section: "templates", id: refId, label, link_id: linkId, removable: true, source: "link" };
    }
    if(type === "external" && url){
      return { section: "external", url, label, link_id: linkId, removable: true, source: "link" };
    }

    return null;
  }
  
  function removeDocRowFromTaskView(linkId){
    const host = document.getElementById("plDocs");
    if(!host || !linkId) return;

    const btn = host.querySelector(`.pl-doc-remove[data-link-id="${String(linkId)}"]`);
    if(!btn) return;

    const card = btn.closest(".zr-planner-doc-card");
    if(card) card.remove();

    const hasCards = !!host.querySelector(".zr-planner-doc-card");
    if(!hasCards){
      host.innerHTML = `<div class="muted" style="font-size:12px;">Связанных документов нет.</div>`;
    }
  }

  function create(deps){
    deps = deps || {};

    const esc = deps.esc || function(s){
      return (s==null?"":String(s))
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    };

    const plannerDocTypeLabel = deps.plannerDocTypeLabel || function(section){
      const s = String(section || "").trim().toLowerCase();
      if(s === "articles") return "ИНСТРУКЦИЯ";
      if(s === "templates") return "ШАБЛОН";
      if(s === "checklists") return "ЧЕК-ЛИСТ";
      if(s === "external") return "ССЫЛКА";
      return "ДОКУМЕНТ";
    };

    const fetchTaskLinks = deps.fetchTaskLinks;
    const fetchTaskFiles = deps.fetchTaskFiles;
    const parseTaskLinkFn = deps.parseTaskLink || parseTaskLink;
    const parseInternalDocFn = deps.parseInternalDoc || parseInternalDoc;
    const openPlannerDoc = deps.openPlannerDoc;
    const removeDocRowFromTaskView = deps.removeDocRowFromTaskView;

    async function loadDocs(task){
      const role = (window.App && App.session) ? String(App.session.role || "") : "";
      const isAdmin = role === "admin";
      const isArchived = !!(task && task.archived_at);
      const host = document.getElementById("plDocs");
      const section = document.getElementById("plDocsSection");
      const sidecol = section ? section.closest(".zr-planner-sidecol") : null;
      const grid = sidecol ? sidecol.closest(".zr-planner-grid") : null;
      const shouldKeepEmptySection = !!(isAdmin && !isArchived);

      const applyDocsVisibility = (showSection) => {
        if(section){
          section.style.display = showSection ? "" : "none";
        }
        if(sidecol){
          sidecol.style.display = showSection ? "" : "none";
        }
        if(grid){
          grid.classList.toggle("zr-planner-grid--no-sidecol", !showSection);
        }
      };

      if(!host) return;

      if(shouldKeepEmptySection){
        applyDocsVisibility(true);
        host.innerHTML = `<div class="muted" style="font-size:12px;">Загружаю…</div>`;
      }else{
        host.innerHTML = "";
      }

      try{
        const [links, files] = await Promise.all([
          fetchTaskLinks(task.id).catch(() => []),
          fetchTaskFiles(task.id).catch(() => [])
        ]);

        const docsFromLinks = (links || []).map(parseTaskLinkFn).filter(Boolean);
        const docsFromFiles = (files || []).map(parseInternalDocFn).filter(Boolean);
        const docs = [...docsFromLinks, ...docsFromFiles]
  .filter(d => d && d.section !== "checklists");

        const shouldShowSection = docs.length > 0 || shouldKeepEmptySection;
        applyDocsVisibility(shouldShowSection);

        if(docs.length === 0){
          if(shouldKeepEmptySection){
            host.innerHTML = `<div class="muted" style="font-size:12px;">Связанных документов нет.</div>`;
          }else{
            host.innerHTML = "";
          }
          return;
        }

        host.innerHTML = `
          <div class="zr-planner-docs-list">
            ${docs.map((d) => {
              const canRemove = !!(isAdmin && !isArchived && d.removable && d.link_id);
              const removeBtn = canRemove
                ? `<button class="btn btn-sm pl-btn-ghost zr-planner-doc-remove pl-doc-remove" data-link-id="${esc(d.link_id)}" type="button" title="Убрать">×</button>`
                : ``;

              const main = (d.section === "external")
                ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm pl-btn-ghost zr-planner-doc-link zr-planner-doc-link--external">
                    <span class="zr-planner-doc-copy">
                      <span class="zr-planner-doc-meta">${esc(plannerDocTypeLabel(d.section))}</span>
                      <span class="zr-planner-doc-label">${esc(d.label)}</span>
                    </span>
                  </a>`
                : `<button class="btn btn-sm pl-btn-ghost zr-planner-doc-link pl-doc" data-sec="${esc(d.section)}" data-id="${esc(d.id)}" type="button">
                    <span class="zr-planner-doc-copy">
                      <span class="zr-planner-doc-meta">${esc(plannerDocTypeLabel(d.section))}</span>
                      <span class="zr-planner-doc-label">${esc(d.label)}</span>
                    </span>
                  </button>`;

              return `
                <div class="zr-planner-doc-card">
                  ${main}
                  ${removeBtn}
                </div>
              `;
            }).join("")}
          </div>
        `;

        host.querySelectorAll(".pl-doc").forEach((b) => {
          b.onclick = () => openPlannerDoc(b.dataset.sec, b.dataset.id);
        });

        host.querySelectorAll(".pl-doc-remove").forEach((b) => {
          b.onclick = async () => {
            const linkId = b.dataset.linkId;
            if(!linkId) return;
            if(!confirm("Убрать этот документ из задачи?")) return;

            b.disabled = true;

            try{
              if(!window.PlannerAPI || typeof PlannerAPI.removeTaskLink !== "function"){
                throw new Error("removeTaskLink missing");
              }

              const docsBefore = await fetchTaskLinks(task.id).catch(() => []);
              const removingDoc = (docsBefore || [])
                .map(parseTaskLinkFn)
                .filter(Boolean)
                .find(x => String(x.link_id || "") === String(linkId));

              await PlannerAPI.removeTaskLink(linkId);


              if(removeDocRowFromTaskView){
                removeDocRowFromTaskView(linkId);
              }
            }catch(err){
              console.warn("[Planner] remove doc link error", err);
              const text = (err && (err.message || err.details || err.hint))
                ? (err.message || err.details || err.hint)
                : String(err);
              alert("Ошибка: " + text);
              b.disabled = false;
            }
          };
        });
      }catch(err){
        console.warn("[Planner] docs load error", err);
        const text = (err && (err.message || err.details || err.hint))
          ? (err.message || err.details || err.hint)
          : String(err);
        host.innerHTML = `<div class="muted" style="font-size:12px;">Ошибка загрузки документов: ${esc(text)}</div>`;
      }
    }

    return {
      loadDocs
    };
  }

  window.PlannerDocs = {
    create,
    parseInternalDoc,
    parseTaskLink,
    removeDocRowFromTaskView
  };
})();



