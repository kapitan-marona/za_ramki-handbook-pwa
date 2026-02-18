/**
 * XLSX exporter for BriefPro (true .xlsx with styles) using xlsx-js-style bundle.
 * Loads vendor lazily only on export.
 *
 * Public API:
 *   Utils.XLSXExport.downloadXLSX(state, filename)
 */
(function () {
  "use strict";

  window.Utils = window.Utils || {};

  const VENDOR_PATH = "./js/vendor/xlsx.bundle.js";

  function ensureXLSXLoaded() {
    if (window.XLSX && window.XLSX.utils) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = VENDOR_PATH;
      s.async = true;
      s.onload = () => (window.XLSX && window.XLSX.utils) ? resolve(window.XLSX) : reject(new Error("XLSX loaded but window.XLSX is missing"));
      s.onerror = () => reject(new Error("Failed to load XLSX vendor: " + VENDOR_PATH));
      document.head.appendChild(s);
    });
  }

  const FONT_BODY = "Calibri";
  const FONT_SIZE_BODY = 12;
  const FONT_SIZE_HEAD = 16;
  const FONT_SIZE_ROOM = 14; // first column (room names)

  function normStr(v) { return (v === null || v === undefined) ? "" : String(v); }

  function safeUrl(url) {
    const s = normStr(url).trim();
    if (!s) return "";
    if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(s)) return "https://" + s;
    return s;
  }

  function linkDisplay(url) {
    const raw = normStr(url).trim();
    if (!raw) return "";
    // remove scheme for display
    let d = raw.replace(/^(https?:\/\/)/i, "").replace(/\/$/, "");
    // keep it readable in narrow cells
    const MAX = 48;
    if (d.length > MAX) {
      d = d.slice(0, 30) + "…" + d.slice(-14);
    }
    return d;
  }

  function cellText(v, style) { return { t: "s", v: normStr(v), s: style || undefined }; }

  function cellLink(display, url, style) {
    const target = safeUrl(url);
    const c = { t: "s", v: normStr(display), s: style || undefined };
    if (target) c.l = { Target: target, Tooltip: target };
    return c;
  }

  function makeStyles() {
    const borderThin = {
      top: { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left: { style: "thin", color: { rgb: "D9D9D9" } },
      right: { style: "thin", color: { rgb: "D9D9D9" } }
    };

    const head = {
      font: { name: FONT_BODY, sz: FONT_SIZE_HEAD, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "1F2937" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const groupHead = {
      font: { name: FONT_BODY, sz: 14, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const body = {
      font: { name: FONT_BODY, sz: FONT_SIZE_BODY, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    const firstCol = (rgb) => ({
      font: { name: FONT_BODY, sz: FONT_SIZE_ROOM, bold: true, color: { rgb: "111827" } },
      fill: { patternType: "solid", fgColor: { rgb: rgb || "E5E7EB" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    });

    const link = {
      font: { name: FONT_BODY, sz: FONT_SIZE_BODY, color: { rgb: "1D4ED8" }, underline: true },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    return { head, groupHead, body, firstCol, link };
  }

  function hexToRGB(hex) {
    const h = normStr(hex).trim().replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(h)) return "";
    return h.toUpperCase();
  }

  function normalizeLabel(s) {
    return normStr(s).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function getBriefProModel(state) {
    const s = state || {};
    const bp =
      s.briefPro || s.brief_pro || s.brief || s.briefpro ||
      (s.data && (s.data.briefPro || s.data.brief_pro)) || {};

    const rooms = bp.rooms || bp.rows || bp.items || s.rooms || [];

    // Берём реальные колонки из состояния (как в UI). Если их нет — fallback.
    const columns =
      bp.columns || bp.fields || bp.headers || s.columns ||
      [
        { key: "walls",   label: "Стены" },
        { key: "floor",   label: "Пол" },
        { key: "ceiling", label: "Потолок" },
        { key: "doors",   label: "Двери" },
        { key: "plinth",  label: "Плинтус и карниз" },
        { key: "light",   label: "Свет" },
        { key: "furniture", label: "Мебель" },
        { key: "concept", label: "Концепт" },
        { key: "notes",   label: "Примечания" }
      ];

    return { rooms, columns, bp };
  }

  function extractCellValue(room, colKey) {
    const raw = room ? room[colKey] : "";
    if (raw === null || raw === undefined) return { text: "", links: [] };

    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      return { text: normStr(raw), links: [] };
    }

    const text = normStr(raw.text ?? raw.value ?? raw.note ?? raw.content ?? raw.main ?? "");
    let links = raw.links || raw.urls || raw.hrefs || [];
    if (typeof links === "string") links = [links];
    if (!Array.isArray(links)) links = [];
    return { text, links: links.filter(Boolean).map(normStr) };
  }

  function buildBriefSheet(XLSX, model) {
    const st = makeStyles();
    const cols = model.columns || [];

    // --- two-row header like UI ---
    const headerTop = [cellText("Наименование помещения", st.head)];
    const headerSub = [cellText("", st.head)];

    const geoSet = new Set([
      normalizeLabel("Стены"),
      normalizeLabel("Пол"),
      normalizeLabel("Потолок"),
      normalizeLabel("Двери"),
      normalizeLabel("Плинтус и карниз")
    ]);

    // find geometry span by labels (positions)
    const geoIdxs = [];
    cols.forEach((c, i) => {
      const lbl = normalizeLabel(c.label ?? c.title ?? c.key ?? "");
      if (geoSet.has(lbl)) geoIdxs.push(i);
    });

    const geoStart = geoIdxs.length ? Math.min(...geoIdxs) : -1;
    const geoEnd = geoIdxs.length ? Math.max(...geoIdxs) : -1;

    cols.forEach((c, i) => {
      const label = normStr(c.label ?? c.title ?? c.key ?? "");

      if (geoStart !== -1 && i >= geoStart && i <= geoEnd) {
        headerTop.push(cellText(i === geoStart ? "Геометрия помещения" : "", st.groupHead));
        headerSub.push(cellText(label, st.head));
      } else {
        headerTop.push(cellText(label, st.head));
        headerSub.push(cellText("", st.head));
      }
    });

    const aoa = [headerTop, headerSub];

    // row heights (Excel points)
    const rowHeights = [{ hpt: 28 }, { hpt: 24 }];

    // widths (stable)
    const colWidths = [{ wch: 26 }];
    cols.forEach((c) => {
      const label = normalizeLabel(c.label ?? c.title ?? c.key ?? "");
      let wch = 22;
      if (label.includes("примеч")) wch = 40;
      if (label.includes("концеп")) wch = 28;
      colWidths.push({ wch });
    });

    // data rows: for each room => 1 text row + N link rows (separate cells, clickable)
    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    rooms.forEach((room) => {
      const roomName = normStr(room?.title ?? room?.name ?? room?.room ?? "");
      const bg = hexToRGB(room?.__bg || room?.bg || room?.color || "");
      const roomStyle = st.firstCol(bg || "E5E7EB");

      // collect values once
      const values = cols.map((c) => extractCellValue(room, normStr(c.key ?? c.id ?? c.name ?? "")));

      // row 1: texts only
      const textRow = [cellText(roomName, roomStyle)];
      values.forEach((v) => textRow.push(cellText(v.text, st.body)));
      aoa.push(textRow);
      rowHeights.push({ hpt: 60 });

      // link rows: make links separate clickable cells (same column), under the room
      const maxLinks = Math.min(
        5,
        values.reduce((m, v) => Math.max(m, (v.links || []).length), 0)
      );

      for (let li = 0; li < maxLinks; li++) {
        const firstCell = (li === 0) ? cellText("↳ ссылки", st.body) : cellText("", st.body);
        const linkRow = [firstCell];

        values.forEach((v) => {
          const url = (v.links && v.links[li]) ? v.links[li] : "";
          linkRow.push(url ? cellLink(linkDisplay(url), url, st.link) : cellText("", st.body));
        });

        aoa.push(linkRow);
        rowHeights.push({ hpt: 18 });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = colWidths;
    ws["!rows"] = rowHeights;

    // merges:
    // A1:A2
    // Geometry: (B..?) in first header row
    // Non-geometry columns: vertical merge in their column (row 1..2)
    const merges = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });

    if (geoStart !== -1) {
      // +1 because A is room
      merges.push({ s: { r: 0, c: geoStart + 1 }, e: { r: 0, c: geoEnd + 1 } });
    }

    cols.forEach((c, i) => {
      const isGeo = (geoStart !== -1 && i >= geoStart && i <= geoEnd);
      if (!isGeo) {
        merges.push({ s: { r: 0, c: i + 1 }, e: { r: 1, c: i + 1 } });
      }
    });

    ws["!merges"] = merges;
    return ws;
  }

  function buildLinksSheet(XLSX, model) {
    const st = makeStyles();
    const cols = model.columns || [];

    const aoa = [[
      cellText("Помещение", st.head),
      cellText("Поле", st.head),
      cellText("Ссылка", st.head)
    ]];

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    rooms.forEach((room) => {
      const roomName = normStr(room?.title ?? room?.name ?? room?.room ?? "");
      cols.forEach((c) => {
        const key = normStr(c.key ?? c.id ?? c.name ?? "");
        const label = normStr(c.label ?? c.title ?? key);
        const { links } = extractCellValue(room, key);
        if (!links || !links.length) return;
        links.forEach((u) => {
          aoa.push([
            cellText(roomName, st.body),
            cellText(label, st.body),
            cellLink(linkDisplay(u), u, st.link)
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 60 }];
    ws["!rows"] = [{ hpt: 24 }]; // header
    // body rows use Excel default; keep file small
    return ws;
  }

  async function downloadXLSX(state, filename) {
    const XLSX = await ensureXLSXLoaded();
    const model = getBriefProModel(state);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildBriefSheet(XLSX, model), "BRIEF");
    XLSX.utils.book_append_sheet(wb, buildLinksSheet(XLSX, model), "LINKS");

    const name = (filename && String(filename).trim()) ? String(filename).trim() : "BriefPro";
    const out = name.toLowerCase().endsWith(".xlsx") ? name : (name + ".xlsx");
    XLSX.writeFile(wb, out, { bookType: "xlsx", compression: true });
  }

  window.Utils.XLSXExport = { downloadXLSX };
})();
