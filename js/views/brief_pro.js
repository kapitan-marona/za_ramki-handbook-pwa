window.Views = window.Views || {};
Views.BriefPro = (() => {
  const $ = (s) => document.querySelector(s);

  const KEY = "tpl:brief_visualizer_pro:v1";
  let _abort = null;

  // Undo (last deletion)
  let _undo = null;        // { idx, room }
  let _undoTimer = null;

  // Two-step delete confirm (B)
  let _pendingDeleteIdx = null;
  let _pendingTimer = null;

  // Approved palette (cycled)
  const PALETTE = [
    "#F8FAFC", "#F1F5F9", "#FAFAF9", "#FDF2F8", "#ECFDF5",
    "#EFF6FF", "#FFFBEB", "#F5F3FF", "#FFF1F2", "#F0FDFA"
  ];

  const defaultCell = () => ({ text: "", links: [] });

  const defaultRoom = (bg) => ({
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
    __bg: bg || "" // persisted row color
  });

  const defaultState = () => ({
    mode: "edit",
    rooms: [defaultRoom(PALETTE[0])],
    meta: {
      surveyPhotosLink: "",
      lightDwg: "",
      furniturePlanDwg: "",
      drawingsPdf: "",
      conceptLink: "",
      radiators: defaultCell(), // text + links
      ceilingsMm: "",
      doorsMm: "",
      otherMm: "",
      otherLabel: "Прочее"
    },
    __ui: {
      restoreScroll: null,
      focus: null
    }
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

  function ensureRoomColors(state){
    const rooms = Array.isArray(state.rooms) ? state.rooms : [];
    for(let i=0;i<rooms.length;i++){
      const r = rooms[i];
      if(r && !r.__bg){
        r.__bg = PALETTE[i % PALETTE.length];
      }
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      const base = defaultState();
      const merged = {
        ...base,
        ...s,
        meta: { ...base.meta, ...(s.meta || {}) },
        __ui: base.__ui
      };
      ensureRoomColors(merged);
      return merged;
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
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }

  function clearPendingDelete() {
    _pendingDeleteIdx = null;
    if (_pendingTimer) {
      clearTimeout(_pendingTimer);
      _pendingTimer = null;
    }
  }

  function requestPendingDelete(idx, rerender) {
    _pendingDeleteIdx = idx;
    if (_pendingTimer) clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
      _pendingDeleteIdx = null;
      _pendingTimer = null;
      rerender();
    }, 3000);
  }

  function renderMetaField(label, key, state, placeholder) {
    const val = (state.meta && state.meta[key] ? state.meta[key] : "").toString();
    const ph = (placeholder || "").toString();

    if (state.mode === "view") {
      if (!val.trim()) return "";
      const isLink = /^https?:\/\//i.test(val.trim());
      if (isLink) {
        return (
          '<div class="bp-meta">' +
            '<div class="bp-meta-label">' + esc(label) + '</div>' +
            '<a href="' + esc(val) + '" target="_blank" rel="noopener" class="bp-meta-link" title="' + esc(val) + '">🔗 ' + esc(val) + '</a>' +
          '</div>'
        );
      }
      return (
        '<div class="bp-meta">' +
          '<div class="bp-meta-label">' + esc(label) + '</div>' +
          '<div class="bp-meta-text">' + esc(val) + '</div>' +
        '</div>'
      );
    }

    return (
      '<div class="bp-meta">' +
        '<div class="bp-meta-label">' + esc(label) + '</div>' +
        '<input data-meta="' + esc(key) + '" value="' + esc(val) + '" class="bp-meta-input" placeholder="' + esc(ph) + '" />' +
      '</div>'
    );
  }

  function renderRadiatorsSection(state) {
    if (!state.meta.radiators || typeof state.meta.radiators !== "object") state.meta.radiators = { text:"", links:[] };
    if (!Array.isArray(state.meta.radiators.links)) state.meta.radiators.links = [];

    const mfHtml = Components.MultiField.render({
      value: state.meta.radiators,
      mode: state.mode,
      placeholderText: "Текст (модель/цвет/примечания)…",
      placeholderLink: "https://ссылка-на-радиатор",
      path: "meta.radiators"
    });

    return (
      '<div style="margin-bottom:14px">' +
        '<div style="font-weight:700; margin-bottom:8px">Радиаторы</div>' +
        mfHtml +
      '</div>'
    );
  }

  function renderHeightsRow(state) {
    const vC = (state.meta.ceilingsMm || "").toString();
    const vD = (state.meta.doorsMm || "").toString();
    const vO = (state.meta.otherMm || "").toString();
    const otherTitle = ((state.meta.otherLabel || "Прочее") + "").trim() || "Прочее";

    if (state.mode === "view") {
      if (!vC.trim() && !vD.trim() && !vO.trim()) return "";

      const box = (title, val) =>
        '<div class="bp-3col">' +
          '<div class="bp-3col-title">' + esc(title) + '</div>' +
          '<div class="bp-3col-val">' + esc(val || "—") + '</div>' +
        '</div>';

      return (
        '<div class="bp-3cols">' +
          box("Высота потолков", vC) +
          box("Высота дверей", vD) +
          box(otherTitle, vO) +
        '</div>'
      );
    }

    const inp = (title, key, ph, val) =>
      '<div class="bp-3col">' +
        '<div class="bp-3col-title">' + esc(title) + '</div>' +
        '<input data-meta="' + esc(key) + '" value="' + esc(val) + '" placeholder="' + esc(ph) + '" class="bp-3col-input" />' +
      '</div>';

    const otherCol =
      '<div class="bp-3col">' +
        '<input data-meta="otherLabel" value="' + esc(otherTitle === "Прочее" ? "" : otherTitle) + '" placeholder="Прочее" class="bp-3col-title-edit" />' +
        '<input data-meta="otherMm" value="' + esc(vO) + '" placeholder="" class="bp-3col-input" />' +
      '</div>';

    return (
      '<div class="bp-3cols">' +
        inp("Высота потолков", "ceilingsMm", "0000мм", vC) +
        inp("Высота дверей", "doorsMm", "0000мм", vD) +
        otherCol +
      '</div>'
    );
  }

  function render(state) {
    const viewer = $("#viewer");
    if (!viewer) return;

    const canExport = window.Utils && Utils.Exporters;

    const addRoomBtn = (state.mode === "edit")
      ? '<button class="btn btn-sm" id="bp_add_room">Добавить помещение</button>'
      : '';

    const modeBtn = (state.mode === "edit")
      ? '<button class="btn btn-sm" id="bp_to_view">Просмотр</button>'
      : '<button class="btn btn-sm" id="bp_to_edit">Редактирование</button>';

    const csvBtn = canExport
      ? '<button class="btn btn-sm" id="bp_csv">Скачать CSV (.excel)</button>'
      : '';

    const xlsBtn = canExport
      ? '<button class="btn btn-sm" id="bp_xls">Скачать Excel (.xls)</button>'
      : '';

    const undoBtn = (_undo && state.mode === "edit")
      ? '<button class="btn btn-sm" id="bp_undo_del" title="Вернуть удалённую строку">Отменить удаление</button>'
      : '';

    const colsHead = ["Стены, цвет", "Пол", "Потолок", "Двери", "Плинтус, карниз"]
      .map((h) => '<th class="bp-th mid">' + esc(h) + '</th>')
      .join("");

    const rowsHtml = (state.rooms || [])
      .map((r, idx) => Components.RoomRow.render({
        room: r,
        idx,
        mode: state.mode,
        pendingDeleteIdx: _pendingDeleteIdx
      }))
      .join("");

    viewer.innerHTML =
      '<h1 class="article-title">ТЗ визуализатору — PRO</h1>' +
      '<p class="article-sub">Заполнение таблицы и экспорт в Excel.</p>' +

      '<div class="actions bp-top">' +
        addRoomBtn +
        modeBtn +
        csvBtn +
        xlsBtn +
        undoBtn +
      '</div>' +

      '<div class="hr"></div>' +

      '<div class="bp-tablewrap">' +
        '<table class="bp-table">' +
          '<thead>' +
            '<tr>' +
              '<th rowspan="2" class="bp-th sticky">Наименование помещения</th>' +
              '<th colspan="5" class="bp-th group">Геометрия помещения</th>' +
              '<th rowspan="2" class="bp-th mid">Свет</th>' +
              '<th rowspan="2" class="bp-th mid">Мебель / Декор</th>' +
              '<th rowspan="2" class="bp-th mid">Ссылка на концепт</th>' +
              '<th rowspan="2" class="bp-th last">Допы к черновикам или примечания</th>' +
            '</tr>' +
            '<tr>' + colsHead + '</tr>' +
          '</thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +

      '<div class="hr"></div>' +

      '<div class="markdown" style="opacity:.95">' +
        '<h2>Файлы и ссылки проекта</h2>' +
        renderMetaField("Фото на замере (Google Drive)", "surveyPhotosLink", state, "https://...") +
        renderMetaField("Ссылка на свет (DWG)", "lightDwg", state, "https://...") +
        renderMetaField("Ссылка на план мебели (DWG)", "furniturePlanDwg", state, "https://...") +
        renderMetaField("Ссылка на чертежи (PDF)", "drawingsPdf", state, "https://...") +
        renderMetaField("Ссылка на концепт", "conceptLink", state, "https://...") +
        renderRadiatorsSection(state) +
        renderHeightsRow(state) +
      '</div>';

    try {
      const ui = state.__ui || {};
      const wrap = viewer.querySelector(".bp-tablewrap");
      if (wrap && ui.restoreScroll) {
        const sl = ui.restoreScroll.scrollLeft || 0;
        const st = ui.restoreScroll.scrollTop || 0;
        requestAnimationFrame(() => {
          wrap.scrollLeft = sl;
          wrap.scrollTop = st;
        });
      }
      if (ui.focus && ui.focus.path) {
        const path = ui.focus.path;
        const idx = ui.focus.idx;
        const selector = 'input.mf-link[data-mf-path="' + path.replace(/"/g, '\\"') + '"][data-mf-link-idx="' + idx + '"]';
        requestAnimationFrame(() => {
          const el = viewer.querySelector(selector);
          if (el) {
            el.focus();
            if (el.select) el.select();
          }
        });
      }
      if (state.__ui) state.__ui.focus = null;
    } catch (e) {}

    bind(viewer, state);
    setStatus(String((state.rooms || []).length));
  }

  function bind(root, state) {
    if (_abort) _abort.abort();
    _abort = new AbortController();
    const signal = _abort.signal;

    const rerender = (opts) => {
      const wrap = root.querySelector(".bp-tablewrap");
      const scrollLeft = wrap ? wrap.scrollLeft : 0;
      const scrollTop = wrap ? wrap.scrollTop : 0;

      state.__ui = state.__ui || {};
      state.__ui.restoreScroll = { scrollLeft, scrollTop };
      state.__ui.focus = (opts && opts.focus) ? opts.focus : null;

      render(state);
    };

    root.addEventListener("input", (e) => {
      const t = e.target;

      if (t && t.dataset && t.dataset.meta) {
        const key = t.dataset.meta;
        if (key === "otherLabel") {
          state.meta.otherLabel = (t.value || "").toString();
        } else {
          state.meta[key] = t.value;
        }
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
    }, { signal });

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (!btn.classList.contains("rr-del") && !btn.classList.contains("rr-del-confirm")) {
        clearPendingDelete();
      }

      if (btn.id === "bp_to_view") {
        clearPendingDelete();
        state.mode = "view";
        save(state);
        rerender();
        return;
      }

      if (btn.id === "bp_to_edit") {
        clearPendingDelete();
        state.mode = "edit";
        save(state);
        rerender();
        return;
      }

      if (btn.id === "bp_add_room") {
        clearPendingDelete();
        const nextColor = PALETTE[(state.rooms.length || 0) % PALETTE.length];
        state.rooms.push(defaultRoom(nextColor));
        save(state);
        rerender();
        return;
      }

      if (btn.id === "bp_csv") {
        const csv = Utils.Exporters.briefToCSV(state);
        Utils.Exporters.download("TZ_vizualizatoru_PRO.csv", csv);
        return;
      }

      if (btn.id === "bp_xls") {
        // Prefer true XLSX export (styled). Fallback to legacy HTML-XLS if something fails.
        try {
          if (window.Utils && Utils.XLSXExport && typeof Utils.XLSXExport.downloadXLSX === "function") {
            Utils.XLSXExport.downloadXLSX(state, "TZ_vizualizatoru_PRO.xlsx");
            return;
          }
        } catch (e) {
          console.error(e);
        }

        // Fallback: legacy HTML-XLS (if present)
        if (window.Utils && Utils.Exporters && typeof Utils.Exporters.briefDownloadXLS === "function") {
          Utils.Exporters.briefDownloadXLS(state);
          return;
        }

        alert("Экспорт Excel недоступен. Проверь подключение скриптов (xlsx_exporter.js).");
        return;
      }

      if (btn.id === "bp_undo_del") {
        if (_undo && _undo.room) {
          const idx = Math.min(Math.max(_undo.idx, 0), state.rooms.length);
          state.rooms.splice(idx, 0, _undo.room);
          _undo = null;
          if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
          save(state);
          rerender();
        }
        return;
      }

      if (btn.classList.contains("rr-del")) {
        const idx = Number(btn.dataset.roomIdx);
        if (Number.isFinite(idx) && state.rooms[idx]) {
          requestPendingDelete(idx, rerender);
          rerender();
        }
        return;
      }

      if (btn.classList.contains("rr-del-confirm")) {
        const idx = Number(btn.dataset.roomIdx);
        if (Number.isFinite(idx) && state.rooms[idx]) {
          _undo = { idx: idx, room: state.rooms[idx] };
          if (_undoTimer) clearTimeout(_undoTimer);
          _undoTimer = setTimeout(() => {
            _undo = null;
            _undoTimer = null;
            rerender();
          }, 10000);

          state.rooms.splice(idx, 1);
          if (state.rooms.length === 0) state.rooms.push(defaultRoom(PALETTE[0]));
          save(state);

          clearPendingDelete();
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
        rerender({ focus: { path: path, idx: cell.links.length - 1 } });
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
    }, { signal });
  }

  async function open() {
    const state = load();
    render(state);
  }

  return { open };
})();

