window.Views = window.Views || {};

Views.Login = (() => {
  const $ = (s) => document.querySelector(s);

  function buildRedirectTo(){
    // hash-router friendly: возвращаемся на текущую страницу, дальше app сам разрулит
    // (важно, чтобы домен/путь был разрешён в Supabase Auth Redirect URLs)
    try{
      return window.location.origin + window.location.pathname;
    }catch(e){
      return undefined;
    }
  }

  async function show(){
    const viewer = document.querySelector("#viewer");
    const list = document.querySelector("#list");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    viewer.innerHTML =
      '<h1 class="article-title">Вход</h1>' +
      '<p class="article-sub">Можно войти по паролю или получить ссылку на e-mail.</p>' +

      '<div style="max-width:380px;">' +
        '<input id="loginEmail" type="email" placeholder="Email" style="width:100%; padding:10px; border-radius:12px; margin:10px 0;" />' +
        '<input id="loginPass" type="password" placeholder="Пароль (если есть)" style="width:100%; padding:10px; border-radius:12px; margin:0 0 10px 0;" />' +

        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
          '<button id="loginBtn" class="btn"><span class="dot"></span>Войти по паролю</button>' +
          '<button id="magicBtn" class="btn"><span class="dot"></span>Войти по ссылке</button>' +
        '</div>' +

        '<div id="loginError" style="margin-top:10px; color:#ff6b6b;"></div>' +
        '<div id="loginInfo" style="margin-top:8px; color:var(--muted);"></div>' +
      '</div>';

    function setErr(t){
      var e = $("#loginError");
      if(e) e.textContent = t || "";
    }
    function setInfo(t){
      var e = $("#loginInfo");
      if(e) e.textContent = t || "";
    }
    function setBusy(isBusy){
      var b1 = $("#loginBtn");
      var b2 = $("#magicBtn");
      var em = $("#loginEmail");
      var pw = $("#loginPass");
      if(b1) b1.disabled = !!isBusy;
      if(b2) b2.disabled = !!isBusy;
      if(em) em.disabled = !!isBusy;
      if(pw) pw.disabled = !!isBusy;
    }

    async function doPasswordLogin(){
      // LOGIN_MARKER_002_PASSWORD
      try{
        setErr(""); setInfo("");
        const email = (($("#loginEmail").value || "") + "").trim().toLowerCase();
        const password = ($("#loginPass").value || "");

        if(!email || !password){
          setErr("Введите e-mail и пароль.");
          return;
        }
        if(!window.SB || !SB.auth){
          setErr("Supabase не подключён.");
          return;
        }

        setBusy(true);

        const res = await SB.auth.signInWithPassword({ email, password });
        if(res && res.error){
          setErr(res.error.message);
          return;
        }

        // применяем сессию напрямую (роль подтянется внутри applySession)
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
        console.warn("[Login] password login failed", e);
        setErr("Ошибка входа. Смотри консоль.");
      }finally{
        setBusy(false);
      }
    }

    async function doMagicLink(){
      // LOGIN_MARKER_003_MAGIC
      try{
        setErr(""); setInfo("");

        const email = (($("#loginEmail").value || "") + "").trim().toLowerCase();
        if(!email){
          setErr("Введите e-mail.");
          return;
        }
        if(!email.includes("@")){
          setErr("Введите корректный e-mail.");
          return;
        }
        if(!window.SB || !SB.auth){
          setErr("Supabase не подключён.");
          return;
        }

        setBusy(true);

        const redirectTo = buildRedirectTo();
        const res = await SB.auth.signInWithOtp({
          email,
          options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
        });

        if(res && res.error){
          setErr(res.error.message);
          return;
        }

        setInfo("Готово. Проверьте почту — мы отправили ссылку для входа.");
      }catch(e){
        console.warn("[Login] magic link failed", e);
        setErr("Не удалось отправить ссылку. Смотри консоль.");
      }finally{
        setBusy(false);
      }
    }

    $("#loginBtn").onclick = doPasswordLogin;
    $("#magicBtn").onclick = doMagicLink;

    $("#loginPass").addEventListener("keydown", (e) => {
      if(e.key === "Enter") doPasswordLogin();
    });
  }

  return { show };
})();
