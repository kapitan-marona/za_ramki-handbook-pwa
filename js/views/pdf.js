window.Views = window.Views || {};
Views.PDF = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  function setStatus(t){ $("#status").textContent = t; }

  function isImage(path){
    return /\.(png|jpg|jpeg|webp|gif)$/i.test(path || "");
  }

  async function open(path){
    const viewer = $("#viewer");
    if(!path){
      viewer.innerHTML = `<div class="empty">Файл не выбран.</div>`;
      return;
    }

    // path comes like: assets/... (no leading ./ required)
    const url = "./" + String(path).replace(/^\.?\//, "");

    setStatus("открываю…");

    // IMAGE VIEW
    if(isImage(path)){
      viewer.innerHTML = `
        <h1 class="article-title">Пример (изображение)</h1>
        <p class="article-sub">${esc(path)}</p>

        <div class="actions">
          <a class="btn" href="${esc(url)}" target="_blank" rel="noopener"><span class="dot"></span>Открыть в новой вкладке</a>
          <a class="btn" href="${esc(url)}" download><span class="dot"></span>Скачать</a>
        </div>

        <div class="hr"></div>

        <div style="border:1px solid var(--border); border-radius:14px; overflow:hidden; background:rgba(26,23,20,.55)">
          <img src="${esc(url)}" alt="example" style="width:100%; height:auto; display:block;" />
        </div>
      `;
      setStatus("готово");
      return;
    }

    // PDF VIEW (default)
    viewer.innerHTML = `
      <h1 class="article-title">Подсказка (PDF)</h1>
      <p class="article-sub">${esc(path)}</p>

      <div class="actions">
        <a class="btn" href="${esc(url)}" target="_blank" rel="noopener"><span class="dot"></span>Открыть в новой вкладке</a>
        <a class="btn" href="${esc(url)}" download><span class="dot"></span>Скачать PDF</a>
      </div>

      <div class="hr"></div>

      <div style="height:72vh; border:1px solid var(--border); border-radius:14px; overflow:hidden; background:rgba(26,23,20,.55)">
        <iframe src="${esc(url)}" style="width:100%;height:100%;border:0" title="PDF viewer"></iframe>
      </div>
    `;
    setStatus("готово");
  }

  return { open };
})();
