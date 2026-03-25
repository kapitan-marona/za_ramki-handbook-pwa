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
      '<p class="article-sub">Введите e-mail и пароль или войдите по ссылке из письма.</p>' +
      '<div style="max-width:360px;">' +
        '<input id="loginEmail" type="email" placeholder="Email" style="width:100%; padding:10px; border-radius:12px; margin:10px 0;" />' +
        '<input id="loginPass" type="password" placeholder="Пароль" style="width:100%; padding:10px; border-radius:12px; margin:0 0 10px 0;" />' +
        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
          '<button id="loginBtn" class="btn">Вход</button>' +
          '<button id="magicLinkBtn" class="btn" type="button">Войти по ссылке</button>' +
        '</div>' +
        '<div id="loginStatus" style="margin-top:10px; color:#9fb0c7;"></div>' +
        '<div id="loginError" style="margin-top:10px; color:#ff6b6b;"></div>' +
      '</div>';

    function setErr(t){ var e = $("#loginError"); if(e) e.textContent = t || ""; }
    function setStatus(t){ var e = $("#loginStatus"); if(e) e.textContent = t || ""; }

    async function doLogin(){
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

        // подтягиваем сессию + роль
        if(typeof window.initAuth === "function") await window.initAuth();

        if(window.App && App.session && App.session.user){
          // роль обязательна, иначе initAuth уже вылогинил
          if(App.session.role === "admin" || App.session.role === "staff"){
            if(window.Router) Router.go("planner");
            return;
          }
        }

        setErr("Нет доступа (роль не назначена).");
      }catch(e){
        console.warn("[Login] failed", e);
        setErr("Ошибка входа. Смотри консоль.");
      }
    }

    async function doMagicLink(){
      try{
        setErr("");
        setStatus("");

        const email = (($("#loginEmail").value || "") + "").trim();

        if(!email){
          setErr("Введите e-mail.");
          return;
        }

        if(!window.SB || !SB.auth){
          setErr("Supabase не подключён.");
          return;
        }

        var loginBtn = $("#loginBtn");
        var magicBtn = $("#magicLinkBtn");
        if(loginBtn) loginBtn.disabled = true;
        if(magicBtn) magicBtn.disabled = true;

        const res = await SB.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: "https://crm.za-ramki.com/"
          }
        });

        if(res && res.error){
          setErr(res.error.message || "Не удалось отправить ссылку.");
          return;
        }

        setStatus("Ссылка для входа отправлена на e-mail. Проверьте почту.");
      }catch(e){
        console.warn("[Login] magic link failed", e);
        setErr("Ошибка отправки ссылки. Смотри консоль.");
      }finally{
        var loginBtn2 = $("#loginBtn");
        var magicBtn2 = $("#magicLinkBtn");
        if(loginBtn2) loginBtn2.disabled = false;
        if(magicBtn2) magicBtn2.disabled = false;
      }
    }

    $("#loginBtn").onclick = doLogin;
    $("#magicLinkBtn").onclick = doMagicLink;

    $("#loginPass").addEventListener("keydown", (e) => {
      if(e.key === "Enter") doLogin();
    });

    $("#loginEmail").addEventListener("keydown", (e) => {
      if(e.key === "Enter" && !($("#loginPass").value || "")){
        doMagicLink();
      }
    });
  }

  return { show };
})();



