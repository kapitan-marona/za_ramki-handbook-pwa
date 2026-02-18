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

  // Backward compatible normalization:
  // - keeps v.textItems / v.links
  // - adds v.blocks (ordered list) if missing
  function normalize(value){
    const v = value || {};
    const links = Array.isArray(v.links) ? v.links : [];

    let textItems = Array.isArray(v.textItems) ? v.textItems : [];
    const legacyText = (v.text ?? "").toString();
    if(!textItems.length && legacyText.trim()){
      textItems = [legacyText];
    }

    let blocks = Array.isArray(v.blocks) ? v.blocks : null;
    if(!blocks){
      // cannot restore historical interleaving from old data, so fallback: texts then links
      blocks = [];
      textItems.forEach(t => blocks.push({ t:"text", v: (t ?? "").toString() }));
      links.forEach(u => blocks.push({ t:"link", v: (u ?? "").toString() }));
    } else {
      // sanitize
      blocks = blocks
        .filter(b => b && (b.t === "text" || b.t === "link"))
        .map(b => ({ t: b.t, v: (b.v ?? "").toString() }));
    }

    return { ...v, links, textItems, blocks };
  }

  function render({ value, mode, placeholderText, placeholderLink, path }){
    const v = normalize(value);
    const blocks = v.blocks;

    const pText = placeholderText || "";
    const pLink = placeholderLink || "https://…";

    if(mode === "view"){
      const html = blocks.length
        ? blocks.map((b) => {
            if(b.t === "text"){
              const s = (b.v || "").trim();
              return s
                ? `<div class="mf-textview">${esc(s)}</div>`
                : "";
            }
            const url = safeUrl(b.v);
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
          }).join("")
        : `<div class="mf-muted">${esc(pText || "")}</div>`;

      return `
        <div class="mf mf-view" data-mf-path="${esc(path)}">
          ${html}
        </div>
      `;
    }

    // edit mode: renders ordered blocks (text/link/text/link...)
    const inputs = blocks.length
      ? blocks.map((b, idx) => {
          if(b.t === "text"){
            return `
              <div class="mf-row">
                <textarea
                  class="mf-textitem mf-block"
                  data-mf-path="${esc(path)}"
                  data-mf-kind="text"
                  data-mf-idx="${idx}"
                  rows="2"
                  placeholder="${esc(pText)}"
                >${esc(b.v || "")}</textarea>
                <button
                  type="button"
                  class="btn btn-sm btn-icon mf-del-block"
                  data-mf-path="${esc(path)}"
                  data-mf-idx="${idx}"
                  title="Удалить"
                >−</button>
              </div>
            `;
          }

          return `
            <div class="mf-row">
              <input
                class="mf-link mf-block"
                data-mf-path="${esc(path)}"
                data-mf-kind="link"
                data-mf-idx="${idx}"
                value="${esc(b.v || "")}"
                placeholder="${esc(pLink)}"
              />
              <button
                type="button"
                class="btn btn-sm btn-icon mf-del-block"
                data-mf-path="${esc(path)}"
                data-mf-idx="${idx}"
                title="Удалить"
              >−</button>
            </div>
          `;
        }).join("")
      : "";

    return `
      <div class="mf mf-edit" data-mf-path="${esc(path)}">
        <div class="mf-actions">
          <button type="button" class="btn btn-sm mf-add-text" data-mf-path="${esc(path)}">+ инфо</button>
          <button type="button" class="btn btn-sm mf-add-link" data-mf-path="${esc(path)}">+ ссылка</button>
        </div>

        ${inputs}
      </div>
    `;
  }

  return { render };
})();
