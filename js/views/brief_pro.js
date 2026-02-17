window.Views = window.Views || {};
Views.BriefPro = (() => {
  const $ = (s) => document.querySelector(s);

  const KEY = "tpl:brief_visualizer_pro:v1";
  let _abort = null;

  const defaultCell = () => ({ text: "", links: [] });

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
    notes: defaultCell(),
  });

  const defaultState = () => ({
    mode: "edit",
    rooms: [defaultRoom()],
    meta: {
      surveyPhotosLink: "",
      lightDwg: "",
      furniturePlanDwg: "",
      drawingsPdf: "",
      conceptLink: "",
      radiators: "",
      radiatorsLink: "",
      ceilingsMm: "",
      doorsMm: "",
      otherMm: "",
    },
  });

  function esc(str) {
    return (str ?? "")
      .toString()
      .replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base,
        ...s,
        meta: { ...base.meta, ...(s.meta || {}) },
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function setStatus(t) {
    const el = $("#status");
    if (el) el.textContent = t;
  }

  function getByPath(state, path) {
    const parts = (path || "").split(".");
    let cur = state;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function setByPath(state, path, value) {
    const parts = (path || "").split(".");
    let cur = state;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function downloadText(filename, text) {
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

  function buildExportText(state) {
    const cols = Components.RoomRow.getCols();
    const lines = [];
    lines.push("ТЗ ДЛЯ ВИЗУАЛИЗАТОРА — ZA RAMKI");
    lines.push("================================");
    lines.push("");

    (state.rooms || []).forEach((r) => {
      lines.push("Помещение: " + (r.name || "(не указано)"));
      lines.push("--------------------------------");

      cols.forEach((c) => {
        const cell = r[c.key] || { text: "", links: [] };
        const txt = (cell.text || "").trim();
        const links = Array.isArray(cell.links) ? cell.links.filter(Boolean) : [];
        if (!txt && links.length === 0) return;

        lines.push(c.label + ":");
        if (txt) lines.push("- " + txt);
        links.forEach((u) => lines.push("- " + u));
        lines.push("");
      });

      lines.push("");
    });

    const m = state.meta || {};
    const metaLines = [];
    const addMeta = (label, val) => {
      const v = (val || "").toString().trim();
      if (v) metaLines.push(label + ": " + v);
    };

    addMeta("Фото на замере (Google Drive)", m.surveyPhotosLink);
    addMeta("Ссылка на свет (DWG)", m.lightDwg);
    addMeta("Ссылка на план мебели (DWG)", m.furniturePlanDwg);
    addMeta("Ссылка на чертежи (PDF)", m.drawingsPdf);
    addMeta("Ссылка на концепт", m.conceptLink);
    addMeta("Радиаторы", m.radiators);
    addMeta("Радиаторы — ссылка", m.radiatorsLink);
    addMeta("Potolki (mm)", m.ceilingsMm);
    addMeta("Двери (mm)", m.doorsMm);
    addMeta("Prochee (mm)", m.otherMm);

    if (metaLines.length) {
      lines.push("ФАЙЛЫ / ДОП. ИНФО");
      lines.push("------------");
      lines.push(...metaLines);
      lines.push("");
    }

    return lines.join("\n");
  }

  function renderMetaField(label, key, state, isTextArea) {
    const val = (state.meta && state.meta[key] ? state.meta[key] : "").toString();

    if (state.mode === "view") {
      if (!val.trim()) return "";
      const isLink = /^https?:\/\//i.test(val.trim());
      if (isLink) {
        return (
          '<div style="margin-bottom:14px">' +
          '<div style="font-weight:600; margin-bottom:4px">' + esc(label) + "</div>" +
          '<a href="' + esc(val) + '" target="_blank" rel="noopener" style="color:var(--brand-headings)" title="' + esc(val) + '">🔗 ' + esc(val) + "</a>" +
          "</div>"
        );
      }
      return (
        '<div style="margin-bottom:14px">' +
        '<div style="font-weight:600; margin-bottom:4px">' + esc(label) + "</div>" +
        '<div style="white-space:pre-wrap">' + esc(val) + "</div>" +
        "</div>"
      );
    }

    if (isTextArea) {
      return (
        '<div style="margin-bottom:14px">' +
        '<div style="font-weight:600; margin-bottom:4px">' + esc(label) + "</div>" +
        '<textarea data-meta="' + esc(key) + '" rows="3" style="width:100%; padding:10px; border-radius:12px;">' + esc(val) + "</textarea>" +
        "</div>"
      );
    }

    return (
      '<div style="margin-bottom:14px">' +
      '<div style="font-weight:600; margin-bottom:4px">' + esc(label) + "</div>" +
      '<input data-meta="' + esc(key) + '" value="' + esc(val) + '" style="width:100%; padding:10px; border-radius:12px;" placeholder="https://..." />' +
      "</div>"
    );
  }

  function render(state) {
    const viewer = $("#viewer");
    if (!viewer) return;

    const modeLabel = state.mode === "edit" ? "Редактирование" : "Просмотр";
    const modeBtn =
      state.mode === "edit"
        ? '<button class="btn" id="bp_to_view"><span class="dot"></span>Перейти в просмотр</button>'
        : '<button class="btn" id="bp_to_edit"><span class="dot"></span>Редактировать</button>';

    const addRoomBtn =
      state.mode === "edit"
        ? '<button class="btn" id="bp_add_room"><span class="dot"></span>Добавить помещение</button>'
        : "";

    const canCsv = window.Utils && Utils.Exporters;
    const csvBtn = canCsv
      ? '<button class="btn" id="bp_csv"><span class="dot"></span>Скачать CSV (Excel)</button>'
      : "";

    const colsHead = ["Стены, цвет", "Пол", "Потолок", "Двери", "Плинтус, карниз"]
      .map((h) => '<th style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">' + esc(h) + "</th>")
      .join("");

    const rowsHtml = (state.rooms || [])
      .map((r, idx) => Components.RoomRow.render({ room: r, idx: idx, mode: state.mode }))
      .join("");

    const html =
      '<div class="bp-pro">' +
      '<h1 class="article-title">ТЗ визуализатору — PRO</h1>' +
      '<p class="article-sub">Режим: <b>' + esc(modeLabel) + "</b>. Автосохранение включено.</p>" +

      '<div class="actions">' +
      modeBtn +
      addRoomBtn +
      '<button class="btn" id="bp_copy"><span class="dot"></span>Скопировать</button>' +
      '<button class="btn" id="bp_download"><span class="dot"></span>Скачать .txt</button>' +
      csvBtn +
      "</div>" +

      '<div class="hr"></div>' +

      '<div style="overflow:auto; border:1px solid var(--border); border-radius:14px; background: rgba(26,23,20,.55);">' +
      '<table style="border-collapse:separate; border-spacing:0; min-width:1700px; width:100%;">' +
      "<thead>" +
      "<tr>" +
      '<th rowspan="2" style="position:sticky; left:0; background: rgba(26,23,20,.92); z-index:2; text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:220px;">Наименование помещения</th>' +
      '<th colspan="5" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); color:var(--brand-headings);">Геометрия помещения</th>' +
      '<th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Свет</th>' +
      '<th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Мебель / Декор</th>' +
      '<th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Ссылка на концепт</th>' +
      '<th rowspan="2" style="text-align:left; padding:10px; border-bottom:1px solid var(--border); min-width:240px;">Допы к черновикам или примечания</th>' +
      "</tr>" +
      "<tr>" + colsHead + "</tr>" +
      "</thead>" +
      "<tbody>" + rowsHtml + "</tbody>" +
      "</table>" +
      "</div>" +

      '<div class="hr"></div>' +

      '<div class="markdown" style="opacity:.95">' +
      "<h2>Файлы и ссылки проекта</h2>" +
      renderMetaField("Фото на замере (Google Drive)", "surveyPhotosLink", state) +
      renderMetaField("Ссылка на свет (DWG)", "lightDwg", state) +
      renderMetaField("Ссылка на план мебели (DWG)", "furniturePlanDwg", state) +
      renderMetaField("Ссылка на чертежи (PDF)", "drawingsPdf", state) +
      renderMetaField("Ссылка на концепт", "conceptLink", state) +
      renderMetaField("Радиаторы", "radiators", state, true) +
      renderMetaField("Радиаторы — ссылка", "radiatorsLink", state) +
      renderMetaField("Потолки (0000мм)", "ceilingsMm", state) +
      renderMetaField("Двери (0000mm)", "doorsMm", state) +
      renderMetaField("Прочее (0000мм)", "otherMm", state) +
      "</div>" +
      "</div>";

    viewer.innerHTML = html;

    bind(viewer, state);
    setStatus(String((state.rooms || []).length));
  }

  function bind(root, state) {
    if (_abort) _abort.abort();
    _abort = new AbortController();
    const signal = _abort.signal;

    const rerender = () => render(state);

    root.addEventListener(
      "input",
      (e) => {
        const t = e.target;

        if (t && t.dataset && t.dataset.meta) {
          const key = t.dataset.meta;
          state.meta[key] = t.value;
          save(state);
          return;
        }

        if (t && t.classList && t.classList.contains("rr-name")) {
          const idx = Number(t.dataset.roomIdx);
          if (Number.isFinite(idx) && state.rooms[idx]) {
            state.rooms[idx].name = t.value;
            save(state);
          }
          return;
        }

        if (t && t.classList && t.classList.contains("mf-text")) {
          const path = t.dataset.mfPath;
          const cell = getByPath(state, path) || { text: "", links: [] };
          cell.text = t.value;
          setByPath(state, path, cell);
          save(state);
          return;
        }

        if (t && t.classList && t.classList.contains("mf-link")) {
          const path = t.dataset.mfPath;
          const li = Number(t.dataset.mfLinkIdx);
          const cell = getByPath(state, path) || { text: "", links: [] };
          if (!Array.isArray(cell.links)) cell.links = [];
          if (Number.isFinite(li)) {
            cell.links[li] = t.value;
            setByPath(state, path, cell);
            save(state);
          }
        }
      },
      { signal: signal }
    );

    root.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        if (btn.id === "bp_to_view") {
          state.mode = "view";
          save(state);
          rerender();
          return;
        }

        if (btn.id === "bp_to_edit") {
          state.mode = "edit";
          save(state);
          rerender();
          return;
        }

        if (btn.id === "bp_add_room") {
          state.rooms.push(defaultRoom());
          save(state);
          rerender();
          return;
        }

        if (btn.id === "bp_copy") {
          navigator.clipboard.writeText(buildExportText(state));
          alert("Скопировано ✅");
          return;
        }

        if (btn.id === "bp_download") {
          downloadText("TZ_vizualizatoru_PRO.txt", buildExportText(state));
          return;
        }

        if (btn.id === "bp_csv") {
          const csv = Utils.Exporters.briefToCSV(state);
          Utils.Exporters.download("TZ_vizualizatoru_PRO.csv", csv);
          return;
        }

        if (btn.classList.contains("rr-del")) {
          const idx = Number(btn.dataset.roomIdx);
          if (Number.isFinite(idx)) {
            state.rooms.splice(idx, 1);
            if (state.rooms.length === 0) state.rooms.push(defaultRoom());
            save(state);
            rerender();
          }
          return;
        }

        if (btn.classList.contains("mf-add-link")) {
          const path = btn.dataset.mfPath;
          const cell = getByPath(state, path) || { text: "", links: [] };
          if (!Array.isArray(cell.links)) cell.links = [];
          cell.links.push("");
          setByPath(state, path, cell);
          save(state);
          rerender();
          return;
        }

        if (btn.classList.contains("mf-del-link")) {
          const path = btn.dataset.mfPath;
          const li = Number(btn.dataset.mfLinkIdx);
          const cell = getByPath(state, path) || { text: "", links: [] };
          if (Array.isArray(cell.links) && Number.isFinite(li)) {
            cell.links.splice(li, 1);
            setByPath(state, path, cell);
            save(state);
            rerender();
          }
        }
      },
      { signal: signal }
    );
  }

  async function open() {
    const state = load();
    render(state);
  }

  return { open };
})();


