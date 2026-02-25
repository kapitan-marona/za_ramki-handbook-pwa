window.Views = window.Views || {};

Views.Login = (() => {
  const $ = (s) => document.querySelector(s);

  async function show(){
    const viewer = document.querySelector("#viewer");
    const list = document.querySelector("#list");
    if(list) list.innerHTML = "";

    viewer.innerHTML = `
      <h1 class="article-title">Вход</h1>
      <p class="article-sub">Только для сотрудников.</p>

      <div style="max-width:360px;">
        <input id="loginEmail" type="email" placeholder="Email" style="width:100%; padding:10px; border-radius:12px; margin: 10px 0;">
        <input id="loginPass" type="password" placeholder="Пароль" style="width:100%; padding:10px; border-radius:12px; margin: 0 0 10px 0;">
        <button id="loginBtn" class="btn">Войти</button>
        <div id="loginError" style="margin-top:10px; color:#ff6b6b;"></div>
      </div>
    `;

    $("#loginBtn").onclick = async () => {
      const email = ($("#loginEmail").value || "").trim();
      const password = ($("#loginPass").value || "");

      if(!window.SB){
        $("#loginError").textContent = "Supabase не подключён.";
        return;
      }

      const { error } = await SB.auth.signInWithPassword({ email, password });
      if(error){
        $("#loginError").textContent = error.message;
        return;
      }

      location.hash = "#/articles";
      location.reload();
    };
  }

  return { show };
})();
