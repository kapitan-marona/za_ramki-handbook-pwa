/* Template Runtime (isolation layer)
   - Adds/removes per-template CSS/JS safely
   - Does NOT touch global theme.css or :root
   - Designed so BriefPro stays untouched
*/
window.Utils = window.Utils || {};
Utils.TemplateRuntime = (() => {
  const HEAD_ATTR = "data-tpl-runtime";
  const CSS_ATTR  = "data-tpl-css";
  const JS_ATTR   = "data-tpl-js";

  function $(sel){ return document.querySelector(sel); }

  function reset(){
    // Remove injected CSS
    document.querySelectorAll(`link[${CSS_ATTR}]`).forEach((n) => n.remove());
    // Remove injected scripts
    document.querySelectorAll(`script[${JS_ATTR}]`).forEach((n) => n.remove());
    // Remove stored runtime markers if any
    document.querySelectorAll(`[${HEAD_ATTR}]`).forEach((n) => n.remove());
    // Note: we do NOT clear #viewer here – views decide what to render.
  }

  function mountRoot(templateId, viewerSel = "#viewer"){
    const viewer = $(viewerSel);
    if(!viewer) throw new Error(`TemplateRuntime: viewer not found: ${viewerSel}`);

    viewer.innerHTML = "";
    const root = document.createElement("div");
    root.className = `tpl-root tpl--${sanitizeId(templateId)}`;
    root.setAttribute("data-tpl-root", templateId);
    viewer.appendChild(root);
    return root;
  }

  function useCSS(templateId, href){
    if(!href) return null;
    const id = sanitizeId(templateId);
    // avoid duplicates
    const existing = document.querySelector(`link[${CSS_ATTR}="${id}"][href="${href}"]`);
    if(existing) return existing;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute(CSS_ATTR, id);
    document.head.appendChild(link);
    return link;
  }

  function useScript(templateId, src){
    if(!src) return null;
    const id = sanitizeId(templateId);
    const existing = document.querySelector(`script[${JS_ATTR}="${id}"][src="${src}"]`);
    if(existing) return existing;

    const s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.setAttribute(JS_ATTR, id);
    document.head.appendChild(s);
    return s;
  }

  function storageKey(templateId, version = 1){
    return `zr_tpl_${sanitizeId(templateId)}_v${version}`;
  }

  function sanitizeId(id){
    return String(id ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  return {
    reset,
    mountRoot,
    useCSS,
    useScript,
    storageKey,
    sanitizeId,
  };
})();
