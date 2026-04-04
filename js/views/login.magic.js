console.log("[LOGIN_MAGIC_BUILD] 2026-03-26 09:30");

window.Views = window.Views || {};

Views.Login = (() => {
  const $ = (s) => document.querySelector(s);

  async function show(){
    const viewer = document.querySelector("#viewer");
    const list = document.querySelector("#list");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    // ===== RECOVERY MODE UI =====
    if(window.__authRecoveryMode){
      viewer.innerHTML =
        '<h1 class="article-title">Создание пароля</h1>' +
        '<p class="article-sub">Введите новый пароль для доступа к системе.</p>' +
        '<div style="max-width:360px;">' +
          '<input id="newPass" type="password" placeholder="Новый пароль" style="width:100%; padding:10px; border-radius:12px; margin:10px 0;" />' +
          '<input id="newPass2" type="password" placeholder="Повторите пароль" style="width:100%; padding:10px; border-radius:12px; margin:0 0 10px 0;" />' +
          '<button id="savePassBtn" class="btn">Сохранить пароль</button>' +
          '<div id="loginError" style="margin-top:10px; color:#ff6b6b;"></div>' +
        '</div>';

      function setErr(t){ var e = document.querySelector("#loginError"); if(e) e.textContent = t || ""; }

      document.querySelector("#savePassBtn").onclick = async function(){
        try{
          setErr("");

          var p1 = document.querySelector("#newPass").value || "";
          var p2 = document.querySelector("#newPass2").value || "";

          if(!p1 || !p2){
            setErr("Введите пароль и подтверждение.");
            return;
          }

          if(p1 !== p2){
            setErr("Пароли не совпадают.");
            return;
          }

          if(!window.SB || !SB.auth){
            setErr("Supabase не подключён.");
            return;
          }

          var res = await SB.auth.updateUser({ password: p1 });

          if(res && res.error){
            setErr(res.error.message || "Ошибка сохранения пароля.");
            return;
          }

                    window.__authRecoveryMode = false;
          try{ sessionStorage.removeItem("zr_auth_recovery"); }catch(e){}


          if(typeof window.initAuth === "function") await window.initAuth();

          if(window.Router) Router.go("planner");

        }catch(e){
          console.warn("[Recovery] set password failed", e);
          setErr("Ошибка. Смотри консоль.");
        }
      };

      return;
    }

    viewer.innerHTML =
      '<h1 class="article-title">Вход</h1>' +
      '<p class="article-sub">Введите e-mail и пароль или войдите по ссылке из письма.</p>' +
      '<div style="max-width:360px;">' +
        '<input id="loginEmail" type="email" placeholder="Email" style="width:100%; padding:10px; border-radius:12px; margin:10px 0;" />' +
        '<input id="loginPass" type="password" placeholder="Пароль" style="width:100%; padding:10px; border-radius:12px; margin:0 0 10px 0;" />' +
        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
          '<button id="loginBtn" class="btn">Вход</button>' +
          '<button id="magicLinkBtn" class="btn" type="button">Войти по ссылке</button>' +
          '<button id="resetPassBtn" class="btn" type="button">Задать или сменить пароль</button>' +
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

        const email = (($("#loginEmail").value || "") + "").trim().toLowerCase();

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

        // DEBUG: очищаем локальный битый refresh token, чтобы он не шумел в консоли
        try{
          await SB.auth.signOut({ scope: "local" });
          console.log("[MAGIC_LINK] local auth cleared before send");
        }catch(clearErr){
          console.warn("[MAGIC_LINK] local signOut warning", clearErr);
        }

        const redirectTo = window.location.origin + "/";

        const res = await SB.auth.signInWithOtp({
          email: email,
          options: {
            emailRedirectTo: redirectTo,
            shouldCreateUser: true
          }
        });

        console.log("[MAGIC_LINK] request email =", email);
        console.log("[MAGIC_LINK] redirectTo =", redirectTo);
        console.log("[MAGIC_LINK] raw response =", res);

        if(res && res.error){
          console.error("[MAGIC_LINK] send failed", res.error);
          setErr(res.error.message || "Не удалось отправить ссылку.");
          return;
        }

        setStatus("Ссылка для входа отправлена на e-mail. Проверьте почту и папку Спам.");
      }catch(e){
        console.error("[MAGIC_LINK] unexpected error", e);
        setErr("Ошибка отправки ссылки. Смотри консоль.");
      }finally{
        var loginBtn2 = $("#loginBtn");
        var magicBtn2 = $("#magicLinkBtn");
        if(loginBtn2) loginBtn2.disabled = false;
        if(magicBtn2) magicBtn2.disabled = false;
      }
    }
    
        async function doResetPassword(){
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
        var resetBtn = $("#resetPassBtn");
        if(loginBtn) loginBtn.disabled = true;
        if(magicBtn) magicBtn.disabled = true;
        if(resetBtn) resetBtn.disabled = true;

        const res = await SB.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });

        if(res && res.error){
          setErr(res.error.message || "Не удалось отправить письмо для смены пароля.");
          return;
        }

        setStatus("Ссылка для создания или смены пароля отправлена на e-mail. Проверьте почту.");
      }catch(e){
        console.warn("[Login] reset password failed", e);
        setErr("Ошибка отправки письма. Смотри консоль.");
      }finally{
        var loginBtn2 = $("#loginBtn");
        var magicBtn2 = $("#magicLinkBtn");
        var resetBtn2 = $("#resetPassBtn");
        if(loginBtn2) loginBtn2.disabled = false;
        if(magicBtn2) magicBtn2.disabled = false;
        if(resetBtn2) resetBtn2.disabled = false;
      }
    }

    $("#loginBtn").onclick = doLogin;
    $("#magicLinkBtn").onclick = doMagicLink;
    $("#resetPassBtn").onclick = doResetPassword;

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







