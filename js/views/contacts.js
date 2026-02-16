window.Views = window.Views || {};
Views.Contacts = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (str) => (str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  function setStatus(t){ $("#status").textContent = t; }
  function setPanelTitle(t){ $("#panelTitle").textContent = t; }

  async function show(){
    setPanelTitle("Контакты");
    const list = $("#list");
    const viewer = $("#viewer");
    list.innerHTML = "";
    viewer.innerHTML = `<div class="empty">Выберите контакт слева.</div>`;

    const data = await API.json("./content/data/contacts.json");
    setStatus(`${data.length}`);

    data.forEach((c, i) => {
      const a = document.createElement("a");
      a.className = "item";
      a.href = `#/${encodeURIComponent("contacts")}/${encodeURIComponent(String(i))}`;
      a.innerHTML = `
        <div class="item-title">${esc(c.team || "Контакт")}</div>
        <div class="item-meta">
          ${c.person ? `<span class="tag">${esc(c.person)}</span>` : ""}
          ${c.telegram ? `<span class="tag">${esc(c.telegram)}</span>` : ""}
        </div>`;
      list.appendChild(a);
    });

    return data;
  }

  async function open(param){
    const viewer = $("#viewer");
    const data = await API.json("./content/data/contacts.json");
    const idx = Number(param);
    const c = Number.isFinite(idx) ? data[idx] : null;

    if(!c){
      viewer.innerHTML = `<div class="empty">Выберите контакт слева.</div>`;
      return;
    }

    const phoneLink = c.phone ? `<a class="btn" href="tel:${esc(c.phone)}"><span class="dot"></span>Позвонить</a>` : "";
    const mailLink  = c.email ? `<a class="btn" href="mailto:${esc(c.email)}"><span class="dot"></span>Email</a>` : "";
    const tgLink    = c.telegram ? `<a class="btn" href="https://t.me/${esc(c.telegram).replace("@","")}" target="_blank" rel="noopener"><span class="dot"></span>Telegram</a>` : "";

    viewer.innerHTML = `
      <h1 class="article-title">${esc(c.team || "Контакт")}</h1>
      <p class="article-sub">${esc(c.person || "")}</p>
      <div class="actions">${phoneLink}${mailLink}${tgLink}</div>
      <div class="hr"></div>
      <div class="kv">
        ${c.phone ? `<div><b>Телефон:</b> ${esc(c.phone)}</div>` : ""}
        ${c.email ? `<div><b>Email:</b> ${esc(c.email)}</div>` : ""}
        ${c.telegram ? `<div><b>Telegram:</b> ${esc(c.telegram)}</div>` : ""}
        ${c.notes ? `<div style="margin-top:10px"><b>Заметки:</b> ${esc(c.notes)}</div>` : ""}
      </div>
    `;
  }

  return { show, open };
})();
