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
    const n = 22;
    return clean.length > n ? (clean.slice(0, n) + "…") : clean;
  }

  function normalize(value){
    const v = value || {};
    const links = Array.isArray(v.links) ? v.links : [];

    let textItems = Array.isArray(v.textItems) ? v.textItems : [];
    const legacyText = (v.text ?? "").toString();
    if(!textItems.length && legacyText.trim()){
      textItems = [legacyText];
    }

    return { ...v, links, textItems };
  }

  function render({ value, mode, placeholderText, placeholderLink, path }){
    const v = normalize(value);
    const links = v.links;
    const textItems = v.textItems;

    const pText = placeholderText || "";
    const pLink = placeholderLink || "https://…";

    if(mode === "view"){
      const textsHtml = textItems.length
        ? textItems
            .map((t) => {
              const s = (t || "").trim();
              return s ? `<div class="mf-textview">${esc(s)}</div>` : "";
            })
            .join("")
        : `<div class="mf-muted">${esc(pText || "")}</div>`;

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
          ${textsHtml}
          ${linksHtml}
        </div>
      `;
    }

    // edit mode: NO text field by default; user adds via "+ инфо"
    const textInputs = textItems.length
      ? textItems.map((t, idx) => `
          <div class="mf-row">
            <textarea
              class="mf-textitem"
              data-mf-path="${esc(path)}"
              data-mf-text-idx="${idx}"
              rows="2"
              placeholder="${esc(pText)}"
            >${esc(t || "")}</textarea>
            <button
              type="button"
              class="btn btn-sm btn-icon mf-del-text"
              data-mf-path="${esc(path)}"
              data-mf-text-idx="${idx}"
              title="Удалить инфо"
            >−</button>
          </div>
        `).join("")
      : "";

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
        <div class="mf-actions">
          <button type="button" class="btn btn-sm mf-add-text" data-mf-path="${esc(path)}">+ инфо</button>
          <button type="button" class="btn btn-sm mf-add-link" data-mf-path="${esc(path)}">+ ссылка</button>
        </div>

        ${textInputs}
        ${linksInputs}
      </div>
    `;
  }

  return { render };
})();
