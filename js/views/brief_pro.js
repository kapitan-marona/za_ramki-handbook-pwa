window.Views = window.Views || {};
Views.BriefPro = (() => {
  const $ = (s) => document.querySelector(s);

  const KEY = "tpl:brief_visualizer_pro:v1";

  const defaultCell = () => ({ text:"", links:[] });
  const defaultRoom = () => ({
    name: "",
    walls: defaultCell(),
    floor: defaultCell(),
    ceiling: defaultCell(),
    doors: defaultCell(),
    plinth: defaultCell(),
    light: defaultCell(),
    furniture: defaultCell(),
    concept: defaultCell(),
    notes: defaultCell()
  });

  const defaultState = () => ({
    mode: "edit", // edit | view
    rooms: [ defaultRoom() ],
    // second block (below table) – we will add next step
    meta: {
      surveyPhotosLink: "",
      lightDwg: "",
      furniturePlanDwg: "",
      drawingsPdf: "",
      conceptLink: "",
      radiators: "",
      ceilingsDoorsEtc: ""
    }
  });

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return defaultState();
      const s = JSON.parse(raw);
      return { ...defaultState(), ...s };
    }catch(e){
      return defaultState();
    }
  }

  function save(state){
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function setStatus(t){
    const el = $("#status");
    if(el) el.textContent = t;
  }

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function getByPath(state, path){
    // path like rooms.0.walls
    const parts = path.split(".");
    let cur = state;
    for(const p of parts){
      if(cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function setByPath(state, path, value){
    const parts = path.split(".");
    let cur = state;
    for(let i=0;i<parts.length-1;i++){
      cur = cur[parts[i]];
    }
    cur[parts[parts.length-1]] = value;
  }

  function buildExportText(state){
    const cols = Components.RoomRow.getCols();

    const lines = [];
    lines.push("ТЗ ДЛЯ ВИЗУАЛИЗАТОРА — ZA RAMKI");
    lines.push("================================");
    lines.push("");

    state.rooms.forEach((r, idx) => {
      lines.push(`Помещение: ${r.name || "(не указано)"}`);
      lines.push("--------------------------------");

      cols.forEach(c => {
        const cell = r[c.key] || { text:"", links:[] };
        const txt = (cell.text || "").trim();
        const links = Array.isArray(cell.links) ? cell.links.filter(Boolean) : [];
        if(!txt && links.length === 0) return;

        lines.push(`${c.label}:`);
        if(txt) lines.push(`- ${txt}`);
        links.forEach(u => lines.push(`- ${u}`));
        lines.push("");
      });

      lines.push("");
    });

    // meta (second block) – we fill later; keep keys ready
    const m = state.meta || {};
    const metaLines = [];
    const addMeta = (label, val) => {
      const v = (val || "").trim();
      if(v) metaLines.push(`${label}: ${v}`);
    };

    addMeta("Фото на замере (ссылка/папка)", m.surveyPhotosLink);
    addMeta("Ссылка на свет (DWG)", m.lightDwg);
    addMeta("Ссылка на план мебели (DWG)", m.furniturePlanDwg);
    addMeta("Ссылка на чертежи (PDF)", m.drawingsPdf);
    addMeta("Ссылка на концепт", m.conceptLink);
    addMeta("Радиаторы", m.radiators);
    addMeta("Потолки/двери/прочее", m.ceilingsDoorsEtc);

    if(metaLines.length){
      lines.push("ФАЙЛЫ / ДОП. ИНФО");
      lines.push("-----------------");
      lines.push(...metaLines);
      lines.push("");
    }

    return lines.join("\n");
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function render(state){
    const viewer = $("#viewer");
    const cols = Components.RoomRow.getCols();

    const modeLabel = state.mode === "edit" ? "Редактирование" : "Просмотр";
    const modeBtn = state.mode === "edit"
      ? `<button class="btn" id="bp_to_view"><span class="dot"></span>Перейти в просмотр</button>`
      : `<button class="btn" id="bp_to_edit"><span class="dot"></span>Редактировать</button>`;

    const addRoomBtn = state.mode === "edit"
      ? `<button class="btn" id="bp_add_room"><span class="dot"></span>Добавить помещение</button>`
      : "";

    viewer.innerHTML = `
      <h1 class="article-title">ТЗ визуализатору — PRO</h1>
      <p class="article-sub">Режим: <b>${esc(modeLabel)}</b>. Автосохранение включено.</p>

      <div class="actions">
        ${modeBtn}
        ${addRoomBtn}
        <button class="btn" id="bp_copy"><span class="dot"></span>Скопировать</button>
        <button class="btn" id="bp_download"><span class="dot"></span>Скачать .txt</button>
      </div>

      <div class="hr"></div>

      <div style="overflow:auto; border:1px solid var(--border); border-radius:14px; background: rgba(26,23,20,.55);">
        <table style="border-collapse:separate; border-spacing:0; min-width:1700px; width:100%;">
          <thead>
            <tr>
              <th rowspan="2" style="position:sticky; left:0; background: rgba(26,23,20,.92); z-index:2; text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:220px;">
                Наименование помещения
              </th>

              <th colspan="5" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); color:var(--brand-headings);">
                Геометрия помещения
              </th>

              <th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Свет</th>
              <th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Мебель / Декор</th>
              <th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Ссылка на концепт</th>
              <th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Допы к черновикам или примечания</th>
            </tr>
            <tr>
              ${["Стены, цвет","Пол","Потолок","Двери","Плинтус, карниз"].map(h => `
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">${esc(h)}</th>
              `).join("")}
            </tr>
          </thead>

          <tbody>
            ${state.rooms.map((r, idx) => Components.RoomRow.render({ room: r, idx, mode: state.mode })).join("")}
          </tbody>
        </table>
      </div>

      <div class="hr"></div>

      <div class="markdown" style="opacity:.95">
        <h2>Файлы и ссылки проекта</h2>
        <p style="color:var(--muted)">Этот блок мы добавим следующим шагом (ниже таблицы): фото на замере, DWG/PDF, концепт, радиаторы, потолки/двери и т.д.</p>
      </div>
    `;

    bind(viewer, state);
    setStatus(String(state.rooms.length));
  }

  function bind(root, state){
    const rerender = () => render(state);

    // mode toggle
    const toView = root.querySelector("#bp_to_view");
    if(toView) toView.onclick = () => { state.mode = "view"; save(state); rerender(); };

    const toEdit = root.querySelector("#bp_to_edit");
    if(toEdit) toEdit.onclick = () => { state.mode = "edit"; save(state); rerender(); };

    // add room
    const addRoom = root.querySelector("#bp_add_room");
    if(addRoom) addRoom.onclick = () => {
      state.rooms.push(defaultRoom());
      save(state);
      rerender();
    };

    // copy / download
    const btnCopy = root.querySelector("#bp_copy");
    if(btnCopy) btnCopy.onclick = async () => {
      const text = buildExportText(state);
      await navigator.clipboard.writeText(text);
      alert("Скопировано ✅");
    };

    const btnDl = root.querySelector("#bp_download");
    if(btnDl) btnDl.onclick = () => {
      downloadText("TZ_vizualizatoru_PRO.txt", buildExportText(state));
    };

    // event delegation for table inputs/buttons
    root.addEventListener("input", (e) => {
      const t = e.target;

      // room name
      if(t.classList.contains("rr-name")){
        const idx = Number(t.dataset.roomIdx);
        if(Number.isFinite(idx) && state.rooms[idx]){
          state.rooms[idx].name = t.value;
          save(state);
        }
        return;
      }

      // multiField text
      if(t.classList.contains("mf-text")){
        const path = t.dataset.mfPath;
        const cell = getByPath(state, path) || { text:"", links:[] };
        cell.text = t.value;
        setByPath(state, path, cell);
        save(state);
        return;
      }

      // multiField link input
      if(t.classList.contains("mf-link")){
        const path = t.dataset.mfPath;
        const li = Number(t.dataset.mfLinkIdx);
        const cell = getByPath(state, path) || { text:"", links:[] };
        if(!Array.isArray(cell.links)) cell.links = [];
        if(Number.isFinite(li)){
          cell.links[li] = t.value;
          setByPath(state, path, cell);
          save(state);
        }
        return;
      }
    });

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if(!btn) return;

      // delete room
      if(btn.classList.contains("rr-del")){
        const idx = Number(btn.dataset.roomIdx);
        if(Number.isFinite(idx)){
          state.rooms.splice(idx, 1);
          if(state.rooms.length === 0) state.rooms.push(defaultRoom());
          save(state);
          rerender();
        }
        return;
      }

      // add link
      if(btn.classList.contains("mf-add-link")){
        const path = btn.dataset.mfPath;
        const cell = getByPath(state, path) || { text:"", links:[] };
        if(!Array.isArray(cell.links)) cell.links = [];
        cell.links.push("");
        setByPath(state, path, cell);
        save(state);
        rerender();
        return;
      }

      // delete link
      if(btn.classList.contains("mf-del-link")){
        const path = btn.dataset.mfPath;
        const li = Number(btn.dataset.mfLinkIdx);
        const cell = getByPath(state, path) || { text:"", links:[] };
        if(Array.isArray(cell.links) && Number.isFinite(li)){
          cell.links.splice(li, 1);
          setByPath(state, path, cell);
          save(state);
          rerender();
        }
        return;
      }
    });
  }

  async function open(){
    const state = load();
    render(state);
  }

  return { open };
})();
