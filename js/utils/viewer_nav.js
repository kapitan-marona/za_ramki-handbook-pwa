/* ZA RAMKI — Shared Viewer Navigation Helpers (minimal)
   Phase: runtime stabilization only
   DO NOT expand beyond current scope
*/
(function(){

  if(window.ViewerNav) return;

  function getCurrentHash(){
    return String(location.hash || "");
  }

  function isPlannerTaskHash(hash){
    return /^#\/planner\/[^\/]+/.test(String(hash || ""));
  }

  function installTracker(opts){
    try{
      const LAST = opts.lastKey;
      const RETURN = opts.returnKey;

      if(!LAST || !RETURN) return;

      function remember(){
        try{
          const current = getCurrentHash();
          const prev = sessionStorage.getItem(LAST) || "";

          if(opts.isDetailHash(current)){
            if(isPlannerTaskHash(prev)){
              sessionStorage.setItem(RETURN, prev);
            }else if(opts.isListHash && opts.isListHash(prev)){
              sessionStorage.removeItem(RETURN);
            }
          }

          sessionStorage.setItem(LAST, current);
        }catch(e){}
      }

      remember();
      window.addEventListener("hashchange", remember);
    }catch(e){
      console.warn("[ViewerNav] tracker install error", e);
    }
  }

  function getReturnHash(key){
    try{
      const saved = sessionStorage.getItem(key) || "";
      if(isPlannerTaskHash(saved)) return saved;

      const last = sessionStorage.getItem("viewer_last_hash") || "";
      if(isPlannerTaskHash(last)) return last;
    }catch(e){}
    return "";
  }

  function getCloseLabel(returnHash){
    return isPlannerTaskHash(returnHash) ? "К задаче" : "Закрыть";
  }

  function goClose(returnHash, fallbackSection){
    try{
      if(isPlannerTaskHash(returnHash) && window.Router){
        const m = returnHash.match(/^#\/planner\/(.+)$/);
        if(m && m[1]){
          Router.go("planner", decodeURIComponent(m[1]));
          return;
        }
      }

      if(window.Router){
        Router.go(fallbackSection);
        return;
      }

      location.hash = fallbackSection ? "#/" + fallbackSection : "#/";
    }catch(e){
      console.warn("[ViewerNav] goClose error", e);
    }
  }

  function formatDMY(value){
    const s = String(value || "").trim();
    if(!s) return "";

    const plain = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(plain){
      return `${plain[3]}.${plain[2]}.${plain[1]}`;
    }

    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
    if(iso){
      return `${iso[3]}.${iso[2]}.${iso[1]}`;
    }

    const dt = new Date(s);
    if(!isNaN(dt)){
      const day = String(dt.getDate()).padStart(2,"0");
      const mon = String(dt.getMonth()+1).padStart(2,"0");
      const yr  = dt.getFullYear();
      return `${day}.${mon}.${yr}`;
    }

    return s;
  }

  window.ViewerNav = {
    installTracker,
    getReturnHash,
    getCloseLabel,
    goClose,
    formatDMY
  };

})();

(function(){
  if(window.__zrMiniHeaderInstalled) return;
  window.__zrMiniHeaderInstalled = true;

  function applyMiniHeaderState(viewer){
    if(!viewer) return;

    const y = viewer.scrollTop || 0;
    const maxScroll = Math.max(0, viewer.scrollHeight - viewer.clientHeight);
    const canMini = maxScroll > 100;

    if(!canMini){
      viewer.classList.remove("viewer-mini-header");
      return;
    }

    if(y > 28){
      viewer.classList.add("viewer-mini-header");
      return;
    }

    if(y < 12){
      viewer.classList.remove("viewer-mini-header");
    }
  }

  function installMiniHeader(){
    const viewer = document.querySelector("#viewer");
    if(!viewer) return;

    if(viewer.__zrMiniHeaderBound) return;
    viewer.__zrMiniHeaderBound = true;

    viewer.addEventListener("scroll", function(){
      applyMiniHeaderState(viewer);
    }, { passive:true });

    requestAnimationFrame(() => applyMiniHeaderState(viewer));
  }

  document.addEventListener("DOMContentLoaded", installMiniHeader);
  document.addEventListener("zr:view:open", installMiniHeader);
})();
