/* ZA RAMKI Handbook — static viewer (no build tools) */

const $ = (sel) => document.querySelector(sel);

let INDEX = [];
let FILTER = "";

function escapeHtml(str){
  return (str ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function setStatus(text){
  $("#status").textContent = text;
}

function normalize(s){
  return (s ?? "").toString().toLowerCase().trim();
}

function matches(item, q){
  if(!q) return true;
  const hay = [
    item.title,
    item.categoryTitle,
    ...(item.tags || []),
    ...(item.roles || [])
  ].map(normalize).join(" | ");
  return hay.includes(q);
}

function renderList(){
  const q = normalize(FILTER);
  const list = $("#list");
  list.innerHTML = "";

  const filtered = INDEX.filter(it => matches(it, q));
  setStatus(`${filtered.length} / ${INDEX.length}`);

  if(filtered.length === 0){
    list.innerHTML = `<div class="empty" style="padding:12px;color:var(--muted)">Ничего не найдено.</div>`;
    return;
  }

  for(const it of filtered){
    const tags = (it.tags || []).slice(0, 4).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    const cat = it.categoryTitle ? `<span class="tag accent">${escapeHtml(it.categoryTitle)}</span>` : "";
    const roles = (it.roles || []).slice(0, 2).map(r => `<span class="tag">${escapeHtml(r)}</span>`).join("");

    const a = document.createElement("a");
    a.className = "item";
    a.href = `#/${encodeURIComponent(it.id)}`;
    a.innerHTML = `
      <div class="item-title">${escapeHtml(it.title)}</div>
      <div class="item-meta">${cat}${tags}${roles}</div>
    `;
    list.appendChild(a);
  }
}

async function loadIndex(){
  setStatus("загрузка…");
  const res = await fetch("./content/index.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Не найден content/index.json");
  const data = await res.json();

  // categories map for pretty labels
  let catMap = {};
  try{
    const cats = await (await fetch("./content/ui/categories.json", { cache:"no-store" })).json();
    catMap = Object.fromEntries(cats.map(c => [c.id, c.title]));
  }catch(e){ /* optional */ }

  INDEX = (data.items || []).map(it => ({
    ...it,
    categoryTitle: catMap[it.category] || it.category || ""
  })).sort((a,b) => (b.pinned===true)-(a.pinned===true) || (b.updatedAt||"").localeCompare(a.updatedAt||""));

  renderList();
}

async function openArticle(id){
  if(!id){
    $("#viewer").innerHTML = `
      <div class="empty">
        Выбери статью слева или используй поиск сверху.<br/>
        <br/>
        Подсказка: позже мы добавим роли, избранное и «что нового».
      </div>`;
    return;
  }

  const meta = INDEX.find(x => x.id === id);
  if(!meta){
    $("#viewer").innerHTML = `<div class="empty">Статья не найдена: <b>${escapeHtml(id)}</b></div>`;
    return;
  }

  setStatus("открываю…");
  const res = await fetch(meta.path, { cache: "no-store" });
  if(!res.ok){
    $("#viewer").innerHTML = `<div class="empty">Не удалось загрузить файл: <b>${escapeHtml(meta.path)}</b></div>`;
    return;
  }
  const md = await res.text();

  const roles = (meta.roles || []).map(r => `<span class="tag">${escapeHtml(r)}</span>`).join("");
  const tags = (meta.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const cat = meta.categoryTitle ? `<span class="tag accent">${escapeHtml(meta.categoryTitle)}</span>` : "";
  const updated = meta.updatedAt ? `Обновлено: ${escapeHtml(meta.updatedAt)}` : "";

  const html = window.marked ? window.marked.parse(md) : `<pre>${escapeHtml(md)}</pre>`;

  $("#viewer").innerHTML = `
    <h1 class="article-title">${escapeHtml(meta.title)}</h1>
    <p class="article-sub">${escapeHtml(updated)}</p>
    <div class="item-meta" style="margin-bottom:10px">${cat}${tags}${roles}</div>
    <div class="hr"></div>
    <div class="markdown">${html}</div>
  `;
  setStatus("готово");
}

function getRouteId(){
  const hash = location.hash || "";
  const m = hash.match(/^#\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : "";
}

function onRoute(){
  openArticle(getRouteId());
}

function boot(){
  $("#q").addEventListener("input", (e) => {
    FILTER = e.target.value || "";
    renderList();
  });

  window.addEventListener("hashchange", onRoute);

  loadIndex()
    .then(onRoute)
    .catch(err => {
      console.error(err);
      $("#viewer").innerHTML = `<div class="empty">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
      setStatus("ошибка");
    });
}

document.addEventListener("DOMContentLoaded", boot);
