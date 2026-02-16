window.Components = window.Components || {};

Components.MultiField = (() => {

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function safeUrl(u){
    const s = (u ?? "").toString().trim();
    if(!s) return "";
    // allow http(s) only; otherwise keep as text
    if(/^https?:\/\//i.test(s)) return s;
    return s; // we'll still display, but won't make it clickable unless it has http(s)
  }

  function render({ value, mode, placeholderText, placeholderLink, path }){
    const v = value || { text:"", links:[] };
    const links = Array.isArray(v.links) ? v.links : [];
    const pText = placeholderText || "";
    const pLink = placeholderLink || "https://…";

    if(mode === "view"){
      const txt = (v.text || "").trim();
      const linksHtml = links
        .map((u) => {
          const url = safeUrl(u);
          if(/^https?:\/\//i.test(url)){
            return `<div style="margin-top:6px"><a href="${esc(url)}" target="_blank" rel="noopener" style="color:var(--brand-headings); text-decoration-color: rgba(192,58,20,.55)">🔗 ${esc(url)}</a></div>`;
          }
          return url ? `<div style="margin-top:6px; color: var(--muted)">🔗 ${esc(url)}</div>` : "";
        })
        .join("");

      return `
        <div class="mf mf-view" data-mf-path="${esc(path)}">
          ${txt ? `<div style="white-space:pre-wrap">${esc(txt)}</div>` : `<div style="color:var(--muted)">${esc(pText || "")}</div>`}
          ${linksHtml}
        </div>
      `;
    }

    // edit mode
    const linksInputs = links.length
      ? links.map((u, idx) => `
          <div style="display:flex; gap:6px; align-items:center; margin-top:6px">
            <input
              class="mf-link"
              data-mf-path="${esc(path)}"
              data-mf-link-idx="${idx}"
              value="${esc(u)}"
              placeholder="${esc(pLink)}"
              style="flex:1; padding:8px 10px; border-radius:12px;"
            />
            <button
              type="button"
              class="btn mf-del-link"
              data-mf-path="${esc(path)}"
              data-mf-link-idx="${idx}"
              title="Удалить ссылку"
            ><span class="dot"></span>−</button>
          </div>
        `).join("")
      : "";

    return `
      <div class="mf mf-edit" data-mf-path="${esc(path)}">
        <textarea
          class="mf-text"
          data-mf-path="${esc(path)}"
          rows="3"
          placeholder="${esc(pText)}"
          style="width:100%; padding:10px; border-radius:12px;"
        >${esc(v.text || "")}</textarea>

        ${linksInputs}

        <div style="margin-top:8px">
          <button type="button" class="btn mf-add-link" data-mf-path="${esc(path)}">
            <span class="dot"></span>Добавить ссылку
          </button>
        </div>
      </div>
    `;
  }

  return { render };
})();
