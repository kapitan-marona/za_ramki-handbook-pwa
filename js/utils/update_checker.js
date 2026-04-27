(function(){
  const CHECK_INTERVAL_MS = 30 * 60 * 1000; 

  function getCurrentVersion(){
    return String(window.ZR_APP_VERSION || "");
  }

  function showUpdateNotice(message){
    if(document.getElementById("zrUpdateNotice")) return;

    const box = document.createElement("div");
    box.id = "zrUpdateNotice";
    box.innerHTML = `
      <div class="zr-update-notice__text">
        ${message || "Доступно обновление системы."}
      </div>
      <button class="zr-update-notice__btn" type="button">
        Обновить
      </button>
    `;

    document.body.appendChild(box);

    const btn = box.querySelector("button");
    if(btn){
      btn.onclick = () => {
        window.location.reload(true);
      };
    }
  }

  async function checkVersion(){
    try{
      const res = await fetch("./version.json?ts=" + Date.now(), {
        cache: "no-store"
      });

      if(!res.ok) return;

      const data = await res.json();
      const remoteVersion = data && data.version ? String(data.version) : "";
      const currentVersion = getCurrentVersion();

      if(remoteVersion && currentVersion && remoteVersion !== currentVersion){
        showUpdateNotice(data.message);
      }
    }catch(e){}
  }

  window.ZRUpdateChecker = { check: checkVersion };

  checkVersion();
  setInterval(checkVersion, CHECK_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible"){
      checkVersion();
    }
  });

  window.addEventListener("focus", () => {
    checkVersion();
  });

  window.addEventListener("pageshow", () => {
    checkVersion();
  });
})();