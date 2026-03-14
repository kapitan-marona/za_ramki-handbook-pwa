window.ViewerFocus = (() => {

  const MOBILE_BP = 960;

  function isMobile(){
    return window.innerWidth <= MOBILE_BP;
  }

  function mainEl(){
    return document.querySelector(".main");
  }

  function listEl(){
    return document.querySelector(".panel");
  }

  function viewerEl(){
    return document.querySelector(".viewer");
  }

  function collapseList(){
    const m = mainEl();
    if(!m) return;
    m.classList.add("zr-focus");
  }

  function expandList(){
    const m = mainEl();
    if(!m) return;
    m.classList.remove("zr-focus");
  }

  function autoFocusOnOpen(){
    if(isMobile()) collapseList();
  }

  function injectToggle(){
    const viewer = viewerEl();
    if(!viewer) return;

    if(viewer.querySelector("[data-zr-list-toggle]")) return;

    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.textContent = "Список";
    btn.setAttribute("data-zr-list-toggle","1");

    btn.onclick = () => {
      const m = mainEl();
      if(!m) return;
      m.classList.toggle("zr-focus");
    };

    viewer.prepend(btn);
  }

  return {
    autoFocusOnOpen,
    injectToggle,
    collapseList,
    expandList
  };

})();
