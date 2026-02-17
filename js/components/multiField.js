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
    return s;
  }

  function shortLabel(url){
    const clean = (url || "").replace(/^https?:\/\//i, "");
    const n = 7;
    return clean.length > n ? (clean.slice(0, n) + "…") : clean;
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
          if(!url) return "";
          const label = shortLabel(url);

          if(/^https?:\/\//i.test(url)){
            return `
              <div class="mf-linkrow">
                <a href="${esc(url)}"
                   target="_blank"
                   rel="noopener"
                   title="${esc(url)}"
                   class="mf-linkview">🔗 ${esc(label)}</a>
              </div>`;
          }

          return `<div class="mf-linkrow mf-muted" title="${esc(url)}">🔗 ${esc(label)}</div>`;
        })
        .join("");

      return `
        <div class="mf mf-view" data-mf-path="${esc(path)}">
          ${txt ? `<div class="mf-textview">${esc(txt)}</div>` : `<div class="mf-muted">${esc(pText || "")}</div>`}
          ${linksHtml}
        </div>
      `;
    }

    // edit mode
    const linksInputs = links.length
      ? links.map((u, idx) => `
          <div class="mf-row">
            <input
              class="mf-link"
              data-mf-path="${esc(path)}"
              data-mf-link-idx="${idx}"
              value="${esc(u)}"
              placeholder="${esc(pLink)}"
            />
            <button
              type="button"
              class="btn btn-sm btn-icon mf-del-link"
              data-mf-path="${esc(path)}"
              data-mf-link-idx="${idx}"
              title="Удалить ссылку"
            >−</button>
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
        >${esc(v.text || "")}</textarea>

        <div class="mf-actions">
          <button type="button" class="btn btn-sm mf-add-link" data-mf-path="${esc(path)}">+ ссылка</button>
        </div>

        ${linksInputs}
      </div>
    `;
  }

  return { render };
})();
