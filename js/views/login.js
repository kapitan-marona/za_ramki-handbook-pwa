window.Views = window.Views || {};

Views.Login = (() => {
  const $ = (s) => document.querySelector(s);

  async function show(){
    const viewer = document.querySelector("#viewer");
    const list = document.querySelector("#list");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    viewer.innerHTML =
      '<h1 class="article-title">Вход</h1>' +
      '<p class="article-sub">Введите e-mail и пароль.</p>' +
      '<div style="max-width:360px;">' +
        '<input id="loginEmail" type="email" placeholder="Email" style="width:100%; padding:10px; border-radius:12px; margin:10px 0;" />' +
        '<input id="loginPass" type="password" placeholder="Пароль" style="width:100%; padding:10px; border-radius:12px; margin:0 0 10px 0;" />' +
        '<button id="loginBtn" class="btn">Вход</button>' +
        '<div id="loginError" style="margin-top:10px; color:#ff6b6b;"></div>' +
      '</div>';

    function setErr(t){ var e = $("#loginError"); if(e) e.textContent = t || ""; }

    async function doLogin(){
      // LOGIN_MARKER_001
      try{
        setErr("");

        const email = (($("#loginEmail").value || "") + "").trim();
        const password = ($("#loginPass").value || "");

        if(!email || !password){
          setErr("Введите e-mail и пароль.");
          return;
        }

        if(!window.SB || !SB.auth){
          setErr("Supabase не подключён.");
          return;
        }

        const res = await SB.auth.signInWithPassword({ email: email, password: password });
        if(res && res.error){
          setErr(res.error.message);
          return;
        }

        // Вместо повторного initAuth(): применяем сессию напрямую
        const user = (res && res.data && res.data.session) ? res.data.session.user : null;
        if(typeof window.applySession === "function") await window.applySession(user);
        if(window.App && App.session) App.session.ready = true;

        if(window.App && App.session && App.session.user){
          if(App.session.role === "admin" || App.session.role === "staff"){
            if(window.Router) Router.go("articles");
            return;
          }
        }

        setErr("Нет доступа (роль не назначена).");
      }catch(e){
        console.warn("[Login] failed", e);
        setErr("Ошибка входа. Смотри консоль.");
      }
    }

    $("#loginBtn").onclick = doLogin;

    $("#loginPass").addEventListener("keydown", (e) => {
      if(e.key === "Enter") doLogin();
    });
  }

  return { show };
})();
