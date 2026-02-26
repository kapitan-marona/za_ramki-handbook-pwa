<PASTE THE FILE ABOVE HERE>
window.Views = window.Views || {};

Views.Login = (() => {
  const $ = (s) => document.querySelector(s);

  function esc(s){
    return (s ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function withTimeout(promise, ms, label){
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`Timeout (${ms}ms): ${label || "request"}`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  function setBusy(on, text){
    const btn = $("#loginBtn");
    const btnLink = $("#magicBtn");
    if(btn){
      btn.disabled = !!on;
      btn.textContent = on ? (text || "Входим…") : "Войти";
    }
    if(btnLink){
      btnLink.disabled = !!on;
      btnLink.textContent = on ? "Отправляю…" : "Войти по ссылке";
    }
  }

  async function show(){
    const viewer = document.querySelector("#viewer");
    const list = document.querySelector("#list");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    // if already logged in — go to articles
    if(window.App && App.session && App.session.user && App.session.ready === true){
      if(window.Router) Router.go("articles");
      return;
    }

    viewer.innerHTML =
      '<h1 class="article-title">Вход</h1>' +
      '<p class="article-sub">Пароль или magic link.</p>' +
      '<div style="max-width:380px;">' +
        '<div class="muted" style="margin:0 0 6px 2px;">Email</div>' +
        '<input id="loginEmail" type="email" autocomplete="email" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.18); color:var(--text); outline:none;" />' +
        '<div class="muted" style="margin:12px 0 6px 2px;">Пароль</div>' +
        '<input id="loginPass" type="password" autocomplete="current-password" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.18); color:var(--text); outline:none;" />' +
        '<div id="loginError" class="muted" style="margin-top:10px; color:#ffb4b4;"></div>' +
        '<div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">' +
          '<button class="btn" id="loginBtn"><span class="dot"></span>Войти</button>' +
          '<button class="btn btn-sm" id="magicBtn"><span class="dot"></span>Войти по ссылке</button>' +
        '</div>' +
        '<div class="muted" style="margin-top:10px;">Ссылка придёт на e-mail. Открой её на этом же устройстве.</div>' +
      '</div>';

    const setErr = (t) => { const e = $("#loginError"); if(e) e.textContent = t || ""; };

    const getEmail = () => (($("#loginEmail").value || "") + "").trim();

    async function finishAuthAndGo(){
      try{
        if(typeof window.initAuth === "function"){
          await withTimeout(window.initAuth(), 20000, "initAuth");
        }
        if(window.App && App.session && App.session.user){
          if(window.Router) Router.go("articles");
          return;
        }
        setErr("Не удалось завершить вход. Попробуй ещё раз.");
      }catch(e){
        setErr(e.message || "Ошибка авторизации. Смотри консоль.");
      }
    }

    async function doLogin(){
      try{
        setErr("");
        setBusy(true, "Входим…");

        const email = getEmail();
        const password = ($("#loginPass").value || "");

        if(!email || !password){
          setBusy(false);
          setErr("Введите e-mail и пароль.");
          return;
        }

        if(!window.SB || !SB.auth){
          setBusy(false);
          setErr("Supabase не подключён.");
          return;
        }

        const res = await withTimeout(
          SB.auth.signInWithPassword({ email, password }),
          15000,
          "signInWithPassword"
        );

        if(res && res.error){
          setBusy(false);
          setErr(res.error.message);
          return;
        }

        setBusy(false);
        await finishAuthAndGo();
      }catch(e){
        console.warn("[Login] failed", e);
        setBusy(false);
        setErr(e.message || "Ошибка входа. Смотри консоль.");
      }
    }

    async function doMagic(){
      try{
        setErr("");
        setBusy(true, "Отправляю…");

        const email = getEmail();
        if(!email){
          setBusy(false);
          setErr("Введите e-mail.");
          return;
        }

        if(!window.SB || !SB.auth){
          setBusy(false);
          setErr("Supabase не подключён.");
          return;
        }

        // Redirect back to this PWA root (hash router will handle the rest)
        const redirectTo = location.origin + location.pathname;

        const res = await withTimeout(
          SB.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }),
          20000,
          "signInWithOtp"
        );

        if(res && res.error){
          setBusy(false);
          setErr(res.error.message);
          return;
        }

        setBusy(false);
        setErr("Ссылка отправлена. Проверь почту (и спам).");
      }catch(e){
        console.warn("[Login] magic failed", e);
        setBusy(false);
        setErr(e.message || "Ошибка. Смотри консоль.");
      }
    }

    $("#loginBtn").onclick = doLogin;
    $("#magicBtn").onclick = doMagic;

    $("#loginPass").addEventListener("keydown", (e) => { if(e.key === "Enter") doLogin(); });

    // If the user opened the magic link and is back here, Supabase will detect the session in URL.
    // We gently try to finalize auth once.
    if(location.href.includes("access_token") || location.href.includes("refresh_token") || location.href.includes("type=recovery") || location.href.includes("type=magiclink")){
      setErr("Завершаю вход по ссылке…");
      setBusy(true, "Завершаю…");
      await finishAuthAndGo();
      setBusy(false);
    }
  }

  return { show };
})();