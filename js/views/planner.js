// js/views/planner.js
window.Views = window.Views || {};

Views.Planner = (() => {

  function show(){
    const role = window.App?.session?.role || null;

    const listEl = document.getElementById("list");
    const viewerEl = document.getElementById("viewer");
    const titleEl = document.getElementById("panelTitle");

    titleEl.textContent = "PLANNER";
    listEl.innerHTML = "";

    if(role === "admin"){
      viewerEl.innerHTML = `
        <div class="empty">
          <h2>Планировщик пуст.</h2>
          <p>Создайте первую задачу.</p>
          <div class="actions">
            <button class="btn" disabled>
              <span class="dot"></span>
              Новая задача (скоро)
            </button>
          </div>
        </div>
      `;
      return;
    }

    if(role === "staff"){
      viewerEl.innerHTML = `
        <div class="empty" style="text-align:center;">
          <div style="font-size:72px;">😎</div>
          <div style="margin-top:12px;">
            Новых задач нет. Всё разобрали.
          </div>
        </div>
      `;
      return;
    }

    // если не авторизован
    viewerEl.innerHTML = `
      <div class="empty">
        Войдите в систему, чтобы увидеть задачи.
      </div>
    `;
  }

  return { show };
})();
