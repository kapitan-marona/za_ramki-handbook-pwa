window.Views = window.Views || {};

Views.Admin = (() => {
  const $ = (s) => document.querySelector(s);

  async function show(){
    const viewer = $("#viewer");
    const list = $("#list");
    const status = $("#status");
    const title = $("#panelTitle");

    if(list) list.innerHTML = "";
    if(status) status.textContent = "—";
    if(title) title.textContent = "Админка";

    if(!viewer) return;

    viewer.innerHTML = `
      <h1 class="article-title">Админка</h1>
      <p class="article-sub">Раздел в разработке. Доступен только admin.</p>
      <div class="hr"></div>

      <div class="markdown">
        <blockquote class="kb-callout kb-important">
          <span class="kb-callout-title">Важно</span>
          Здесь появятся инструменты для управления базой и доступами.
        </blockquote>

        <h3>План</h3>
        <ul>
          <li>Allowlist: добавить/выключить email, назначить роль</li>
          <li>Пользователи: список активных, роль, last_seen</li>
          <li>Задачи: статусы, назначение, архив</li>
          <li>Логи: ошибки, отладка auth</li>
        </ul>

        <p class="muted">Сейчас это заглушка, чтобы закрепить роутинг и гейтинг по роли.</p>
      </div>
    `;
  }

  return { show };
})();
