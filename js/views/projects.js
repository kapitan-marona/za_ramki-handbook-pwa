window.Views = window.Views || {};

Views.Projects = (() => {
  const $ = (s) => document.querySelector(s);

  let _projects = [];
  let _activeProjectId = "";

  function esc(s){
    return (s == null ? "" : String(s))
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function setPanelTitle(t){
    const el = $("#panelTitle");
    if(el) el.textContent = t;
  }

  function setStatus(t){
    const el = $("#status");
    if(el) el.textContent = t;
  }

  function statusLabel(status){
    const map = {
      new: "Новая",
      taken: "Взята",
      in_progress: "В работе",
      problem: "Проблема",
      done: "Готово",
      canceled: "Отменена"
    };
    return map[status] || status || "—";
  }

  function urgencyLabel(urgency){
    const map = { low:"Низкая", normal:"Обычная", urgent:"Срочно" };
    return map[urgency] || urgency || "—";
  }

  function fmtDate(value){
    if(!value) return "";
    try{
      const s = String(value).slice(0, 10);
      const parts = s.split("-");
      if(parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }catch(e){}
    return String(value || "");
  }

  function renderProjectList(){
    const list = $("#list");
    if(!list) return;

    if(!_projects.length){
      list.innerHTML = '<div class="empty">Проекты пока не созданы.</div>';
      return;
    }

    list.innerHTML = _projects.map(function(p){
      const active = String(p.id) === String(_activeProjectId);
      return `
        <div class="item ${active ? 'zr-list-row--active' : ''}" data-project-id="${esc(p.id)}">
          <div class="item-title">${esc(p.title || "Без названия")}</div>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-project-id]").forEach(function(row){
      row.onclick = function(){
        const id = row.getAttribute("data-project-id") || "";
        if(id) openProject(id);
      };
    });
  }

  function renderProjectShell(project){
    const viewer = $("#viewer");
    if(!viewer) return;

    viewer.innerHTML = `
      <div class="zr-planner-detail zr-project-detail">

        <section class="zr-card zr-card--section zr-planner-hero">
          <div class="zr-planner-hero-top">

            <div class="zr-planner-hero-main">
              <h1 class="zr-planner-title">
                ${esc(project.title || "Проект")}
              </h1>

              <div class="zr-planner-meta">
                <span class="pill">
                  Контейнер проекта
                </span>

                <span class="pill">
                  Ссылки, комментарии и задачи
                </span>
              </div>
            </div>

            <div class="zr-planner-actions-admin">
              <button
                type="button"
                class="btn btn--ghost"
                id="zrProjectsReload"
              >
                Обновить
              </button>
            </div>

          </div>
        </section>

        <div class="zr-planner-grid zr-planner-grid--no-sidecol">

          <div class="zr-planner-maincol">

            <section class="zr-card zr-card--section zr-planner-section">
              <div class="zr-section-head">
                <div class="zr-section-title">
                  Ссылки проекта
                </div>
              </div>

              <div class="zr-stack-md">

                <div class="zr-card zr-card--subtle">
                  <div class="zr-stack-sm">

                    <input
                      id="zrProjectLinkLabel"
                      class="pl-control"
                      type="text"
                      placeholder="Название ссылки"
                    />

                    <input
                      id="zrProjectLinkUrl"
                      class="pl-control"
                      type="url"
                      placeholder="https://..."
                    />

                    <div class="zr-planner-actions-admin">
                      <button
                        type="button"
                        class="btn btn--ghost"
                        id="zrProjectAddLinkBtn"
                      >
                        Добавить ссылку
                      </button>
                    </div>

                  </div>
                </div>

                <div id="zrProjectLinks">
                  <div class="empty">Загружаю ссылки…</div>
                </div>

              </div>
            </section>

            <section class="zr-card zr-card--section zr-planner-section">
              <div class="zr-section-head">
                <div class="zr-section-title">
                  Комментарии
                </div>
              </div>

              <div id="zrProjectComments" class="zr-comments-surface">
                <div class="empty">Загружаю комментарии…</div>
              </div>

              <div id="zrProjectCommentsComposer"></div>
            </section>

            <section class="zr-card zr-card--section zr-planner-section">
              <div class="zr-section-head">
                <div class="zr-section-title">
                  Задачи проекта
                </div>

                <span
                  class="tag"
                  id="zrProjectsTaskCount"
                >
                  Загрузка…
                </span>
              </div>

              <div id="zrProjectsTasks">
                <div class="empty">Загружаю задачи…</div>
              </div>
            </section>

          </div>

        </div>

      </div>
    `;

    const addLinkBtn = $("#zrProjectAddLinkBtn");

    if(addLinkBtn){
      addLinkBtn.onclick = async function(){

        const labelEl = $("#zrProjectLinkLabel");
        const urlEl = $("#zrProjectLinkUrl");

        const label = String(labelEl?.value || "").trim();
        const url = String(urlEl?.value || "").trim();

        if(!url){
          alert("Введите ссылку");
          return;
        }

        addLinkBtn.disabled = true;

        try{

          await ZRBackend.projectLinks.create({
            project_id: project.id,
            label,
            url,
            created_by:
              window.App?.session?.user?.id ||
              null
          });

          labelEl.value = "";
          urlEl.value = "";

          const nextLinks =
            await ZRBackend.projectLinks.listByProject(project.id);

          renderProjectLinks(nextLinks || []);

        }catch(e){
          console.warn("[Projects] add link failed", e);
          alert("Не удалось добавить ссылку.");
        }finally{
          addLinkBtn.disabled = false;
        }

      };
    }
  }

  function renderProjectLinks(links){
    const box = $("#zrProjectLinks");
    if(!box) return;

    if(!Array.isArray(links) || !links.length){
      box.innerHTML = '<div class="empty">У проекта пока нет ссылок.</div>';
      return;
    }

    box.innerHTML = links.map(function(link){

      const url = String(link.url || "").trim();

      return `
        <div class="zr-project-link-chip-wrap">

          <a
            class="zr-project-link-chip"
            href="${esc(url)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="zr-project-link-chip-label">
              ${esc(link.label || url || "Ссылка")}
            </span>
          </a>

          <button
            type="button"
            class="zr-project-link-chip-remove"
            data-project-link-remove="${esc(link.id)}"
            aria-label="Удалить ссылку"
          >
            <span>×</span>
          </button>

        </div>
      `;

    }).join("");

    box
      .querySelectorAll("[data-project-link-remove]")
      .forEach(function(btn){

        btn.onclick = async function(e){

          e.preventDefault();
          e.stopPropagation();

          const id =
            btn.getAttribute("data-project-link-remove") || "";

          if(!id) return;

          if(!confirm("Удалить ссылку?")){
            return;
          }

          btn.disabled = true;

          try{
            
            const wrap =
              btn.closest(".zr-project-link-chip-wrap");

            if(wrap){
              wrap.style.opacity = ".45";
              wrap.style.pointerEvents = "none";
            }

            await ZRBackend.projectLinks.remove(id);

            const nextLinks =
              await ZRBackend.projectLinks.listByProject(_activeProjectId);

            renderProjectLinks(nextLinks || []);

          }catch(err){

            console.warn("[Projects] remove link failed", err);

            alert("Не удалось удалить ссылку.");

            btn.disabled = false;
          }

        };

      });
  }
  
  function renderProjectComments(comments, projectId){
    const host = $("#zrProjectComments");
    if(!host) return;

    if(!window.PlannerComments || typeof PlannerComments.renderComments !== "function"){
      host.innerHTML = '<div class="empty">PlannerComments runtime missing.</div>';
      return;
    }

    const uid =
      window.App?.session?.user?.id ||
      window.Auth?.user?.id ||
      window.__session?.user?.id ||
      "";

    window.__zrLastProjectComments = comments;
    
    PlannerComments.renderComments({
      host,
      task: {
        id: projectId,
        status: ""
      },

      items: Array.isArray(comments)
        ? comments.map(function(c){

            const profile = c.author || {};

            return {
              ...c,

              author_id:
                c.author_id,

              author_name:
                profile.name || "",

              author_email:
                profile.email || "",

              author_display_name:
                profile.name || ""
            };
          })
        : [],

      uid,

      esc,

      isReadOnly: false,

      inputId: "zrProjectCommentInput",
      sendBtnId: "zrProjectCommentSend",
      msgId: "zrProjectCommentMsg",

      resolvePersonLabel:
        window.PlannerPeople?.resolvePersonLabel ||
        function(person, opts){
          opts = opts || {};

          const currentUserId = String(opts.uid || "");
          const personId = String(person?.id || "");

          if(currentUserId && personId && currentUserId === personId){
            return "Вы";
          }

          return (
            person?.full_name ||
            person?.display_name ||
            person?.name ||
            person?.email ||
            opts.fallback ||
            "Автор"
          );
        },

      getTaskAssigneeIds: function(){
        return [];
      },

      createComment: async function(_, body){
        await ZRBackend.projectComments.create({
          project_id: projectId,
          author_id: uid || null,
          body
        });

        let nextComments = [];

        try{
          nextComments = await ZRBackend.projectComments.listByProject(projectId);
        }catch(e){
          console.warn("[Projects] comments reload failed", e);
        }

        renderProjectComments(nextComments || [], projectId);
      },
      
      deleteComment: async function(commentId){

        await ZRBackend.projectComments.remove(commentId);

      },

      loadComments: async function(){}
    });
  }
  
  function renderProjectCommentsComposer(projectId){
    return;
  }

  function renderTasks(tasks){
    const box = $("#zrProjectsTasks");
    const count = $("#zrProjectsTaskCount");
    if(count) count.textContent = "Задач: " + (Array.isArray(tasks) ? tasks.length : 0);
    if(!box) return;

    if(!Array.isArray(tasks) || !tasks.length){
      box.innerHTML = '<div class="empty">У этого проекта пока нет активных задач.</div>';
      return;
    }

    box.innerHTML = tasks.map(function(t){
      const due = fmtDate(t.due_date);
      const start = fmtDate(t.start_date);
      return `
        <div class="item" data-task-id="${esc(t.id)}" style="margin:8px 0;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:220px;">
              <div class="item-title">${esc(t.title || "Без названия")}</div>
              ${t.body ? `<div class="muted" style="margin-top:6px;">${esc(t.body).slice(0, 180)}</div>` : ""}
            </div>
            <div class="item-meta" style="justify-content:flex-end;">
              <span class="tag">${esc(statusLabel(t.status))}</span>
              <span class="tag">${esc(urgencyLabel(t.urgency))}</span>
              ${due ? `<span class="tag">Дедлайн: ${esc(due)}</span>` : ""}
              ${start ? `<span class="tag">Старт: ${esc(start)}</span>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");

    box.querySelectorAll("[data-task-id]").forEach(function(row){
      row.onclick = function(){
        const id = row.getAttribute("data-task-id") || "";
        if(window.Router && typeof Router.go === "function") Router.go("planner", id);
        else location.hash = "#/planner/" + encodeURIComponent(id);
      };
    });
  }

  async function openProject(projectId){
    _activeProjectId = String(projectId || "");
    const project = _projects.find(p => String(p.id) === _activeProjectId) || null;
    renderProjectList();

    if(!project){
      const viewer = $("#viewer");
      if(viewer) viewer.innerHTML = '<div class="empty">Проект не найден.</div>';
      return;
    }

    renderProjectShell(project);

    try{
      if(!window.ZRBackend || !ZRBackend.projects || typeof ZRBackend.projects.listTasks !== "function"){
        throw new Error("ZRBackend.projects.listTasks missing");
      }
      let tasks = [];
      let links = [];
      let comments = [];

      try{
        tasks = await ZRBackend.projects.listTasks(_activeProjectId);
      }catch(e){
        console.warn("[Projects] tasks failed", e);
      }

      try{
        links = await ZRBackend.projectLinks.listByProject(_activeProjectId);
      }catch(e){
        console.warn("[Projects] links failed", e);
      }

      try{
        comments = await ZRBackend.projectComments.listByProject(_activeProjectId);
      }catch(e){
        console.warn("[Projects] comments failed", e);
      }

      console.log(
        "[Projects] loaded tasks",
        _activeProjectId,
        tasks
      );

      renderTasks(tasks || []);
      renderProjectLinks(links || []);
      renderProjectComments(
        comments || [],
        _activeProjectId
      );
    }catch(e){
      console.warn("[Projects] task load failed", e);
      const box = $("#zrProjectsTasks");
      if(box) box.innerHTML = '<div class="empty">Не удалось загрузить задачи проекта. Проверь консоль.</div>';
      const count = $("#zrProjectsTaskCount");
      if(count) count.textContent = "Ошибка";
    }
  }

  async function show(param){
    setPanelTitle("Проекты");
    setStatus("0");

    const list = $("#list");
    const viewer = $("#viewer");
    if(list) list.innerHTML = '<div class="empty">Загружаю проекты…</div>';
    if(viewer) viewer.innerHTML = '<div class="empty">Выберите проект слева.</div>';

    try{
      if(!window.ZRBackend || !ZRBackend.projects || typeof ZRBackend.projects.list !== "function"){
        throw new Error("ZRBackend.projects.list missing");
      }

      _projects = await ZRBackend.projects.list();
      _activeProjectId = param || (_projects[0] && _projects[0].id) || "";
      renderProjectList();

      if(_activeProjectId) await openProject(_activeProjectId);
      else if(viewer) viewer.innerHTML = '<div class="empty">Проекты пока не созданы.</div>';
    }catch(e){
      console.warn("[Projects] load failed", e);
      if(list) list.innerHTML = '<div class="empty">Не удалось загрузить проекты.</div>';
      if(viewer) viewer.innerHTML = '<div class="empty">Ошибка загрузки проектов. Проверь консоль.</div>';
    }
  }

  return { show };
})();
