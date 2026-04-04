window.Views = window.Views || {};

Views.Login = (() => {
  const $ = (s) => document.querySelector(s);

  async function show(){
    const viewer = document.querySelector("#viewer");
    const list = document.querySelector("#list");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    var recoveryMode = !!window.__authRecoveryMode;

    viewer.innerHTML =
      '<h1 class="article-title">' + (recoveryMode ? 'Создание пароля' : 'Вход') + '</h1>' +
      '<p class="article-sub">' +
        (recoveryMode
          ? 'Задайте новый пароль для входа в систему.'
          : 'Введите e-mail и пароль для входа в систему.') +
      '</p>' +
      '<div style="max-width:360px;">' +
        (recoveryMode
          ? ''
          : '<input id="loginEmail" type="email" placeholder="Email" style="width:100%; padding:10px; border-radius:12px; margin:10px 0;" />') +
        '<input id="loginPass" type="password" placeholder="' + (recoveryMode ? 'Новый пароль' : 'Пароль') + '" style="width:100%; padding:10px; border-radius:12px; margin:' + (recoveryMode ? '10px 0 10px 0' : '0 0 10px 0') + ';" />' +
        (recoveryMode
          ? '<input id="loginPass2" type="password" placeholder="Повторите пароль" style="width:100%; padding:10px; border-radius:12px; margin:0 0 10px 0;" />'
          : '') +
        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
          '<button id="loginBtn" class="btn">' + (recoveryMode ? 'Сохранить пароль' : 'Вход') + '</button>' +
        '</div>' +
        (!recoveryMode
          ? '<div style="margin-top:10px; color:#9fb0c7; font-size:13px;">Если пароль ещё не создан, администратор должен выдать доступ отдельно.</div>'
          : '') +
        '<div id="loginStatus" style="margin-top:10px; color:#9fb0c7;"></div>' +
        '<div id="loginError" style="margin-top:10px; color:#ff6b6b;"></div>' +
      '</div>';

    function setErr(t){ var e = $("#loginError"); if(e) e.textContent = t || ""; }
    function setStatus(t){ var e = $("#loginStatus"); if(e) e.textContent = t || ""; }

    async function doLogin(){
      try{
        setErr("");

        const emailEl = $("#loginEmail");
        const email = (((emailEl && emailEl.value) || "") + "").trim();
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

        if(typeof window.initAuth === "function") await window.initAuth();

        if(window.App && App.session && App.session.user){
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

    async function doSavePassword(){
      try{
        setErr("");
        setStatus("");

        const p1 = ($("#loginPass").value || "");
        const p2 = ($("#loginPass2").value || "");

        if(!p1 || !p2){
          setErr("Введите пароль два раза.");
          return;
        }

        if(p1 !== p2){
          setErr("Пароли не совпадают.");
          return;
        }

        if(p1.length < 6){
          setErr("Пароль должен быть не короче 6 символов.");
          return;
        }

        if(!window.SB || !SB.auth){
          setErr("Supabase не подключён.");
          return;
        }

        var btn = $("#loginBtn");
        if(btn) btn.disabled = true;

        const res = await SB.auth.updateUser({
          password: p1
        });

        if(res && res.error){
          setErr(res.error.message || "Не удалось сохранить пароль.");
          return;
        }

        window.__authRecoveryMode = false;
        try{ sessionStorage.removeItem("zr_auth_recovery"); }catch(e){}

        setStatus("Пароль сохранён. Выполняется вход...");

        if(typeof window.initAuth === "function") await window.initAuth();

        if(window.Router) Router.go("planner");
      }catch(e){
        console.warn("[Login] save password failed", e);
        setErr("Ошибка сохранения пароля. Смотри консоль.");
      }finally{
        var btn2 = $("#loginBtn");
        if(btn2) btn2.disabled = false;
      }
    }

    $("#loginBtn").onclick = recoveryMode ? doSavePassword : doLogin;

    $("#loginPass").addEventListener("keydown", (e) => {
      if(e.key === "Enter"){
        if(recoveryMode) doSavePassword();
        else doLogin();
      }
    });

    if(recoveryMode && $("#loginPass2")){
      $("#loginPass2").addEventListener("keydown", (e) => {
        if(e.key === "Enter") doSavePassword();
      });
    }
  }

  return { show };
})();