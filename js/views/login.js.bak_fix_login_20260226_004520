window.Views = window.Views || {};

Views.Login = (() => {
  const $ = (s) => document.querySelector(s);

  function setErr(msg){
    var el = $("#loginError");
    if(el) el.textContent = msg || "";
  }

  async function show(){
    const viewer = document.querySelector("#viewer");
    const list = document.querySelector("#list");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    viewer.innerHTML =
      '<h1 class="article-title">Вход</h1>' +
      '<p class="article-sub">Только для сотрудников.</p>' +
      '<div style="max-width:360px;">' +
        '<input id="loginEmail" type="email" placeholder="Email" style="width:100%; padding:10px; border-radius:12px; margin: 10px 0;">' +
        '<input id="loginPass" type="password" placeholder="Пароль" style="width:100%; padding:10px; border-radius:12px; margin: 0 0 10px 0;">' +
        '<button id="loginBtn" class="btn">Войти</button>' +
        '<div id="loginError" style="margin-top:10px; color:#ff6b6b;"></div>' +
      '</div>';

    var btn = $("#loginBtn");
    if(!btn) return;

    btn.onclick = async function(){
      setErr("");
      var email = (($("#loginEmail") && $("#loginEmail").value) || "").trim();
      var password = (($("#loginPass") && $("#loginPass").value) || "");

      if(!email || !password){
        setErr("Введите email и пароль.");
        return;
      }

      if(!window.SB || !SB.auth){
        setErr("Supabase не подключён.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Входим…";

      try{
        var res = await SB.auth.signInWithPassword({ email: email, password: password });
        if(res && res.error){
          setErr(res.error.message || "Ошибка входа.");
          return;
        }

        // onAuthStateChange обновит header и render() пустит дальше
        if(window.Router) Router.go("articles");
      }finally{
        btn.disabled = false;
        btn.textContent = "Войти";
      }
    };
  }

  return { show };
})();
