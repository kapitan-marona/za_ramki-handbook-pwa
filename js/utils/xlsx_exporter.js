﻿/**
 * XLSX exporter for BriefPro (true .xlsx with styles) using xlsx-js-style bundle.
 * Loads vendor lazily only on export.
 *
 * Public API:
 *   Utils.XLSXExport.downloadXLSX(state, filename)
 */
window.Utils = window.Utils || {};

Utils.XLSXExport = (() => {
  // ---------------------------
  // Helpers
  // ---------------------------
  function normStr(v){ return (v ?? "").toString(); }

  function cellText(v, style){
    return { v: normStr(v), t: "s", s: style || {} };
  }

  function ensureStyleBase(){
    const border = { style: "thin", color: { rgb: "D1D5DB" } };
    const base = {
      border: { top: border, bottom: border, left: border, right: border },
      alignment: { vertical: "top", wrapText: true }
    };
    return base;
  }

  function mkStyles(){
    const base = ensureStyleBase();
    const head = {
      ...base,
      font: { bold: true, color: { rgb: "0F172A" } },
      fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true }
    };
    const groupHead = {
      ...base,
      font: { bold: true, color: { rgb: "0F172A" } },
      fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true }
    };
    const stickyBold = { ...base, font: { bold: true } };
    const firstCol = { ...base, font: { bold: true } };
    const link = { ...base, font: { color: { rgb: "2563EB" }, underline: true } };
    return { base, head, groupHead, stickyBold, firstCol, link };
  }

  function hexToRGB(hex) {
    const h = normStr(hex).trim().replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(h)) return "";
    return h.toUpperCase();
  }

  function getBriefProModel(state) {
    const s = state || {};
    const bp =
      s.briefPro || s.brief_pro || s.brief || s.briefpro ||
      (s.data && (s.data.briefPro || s.data.brief_pro)) || {};

    const rooms = bp.rooms || bp.rows || bp.items || s.rooms || [];

    // Columns priority:
    // 1) explicit model in state (bp.columns / bp.fields / bp.headers / s.columns)
    // 2) shared schema (window.BriefProSchema.COLUMNS)
    // 3) hard fallback (legacy minimal)
    let columns = bp.columns || bp.fields || bp.headers || s.columns;

    const schemaCols =
      (window.BriefProSchema && Array.isArray(window.BriefProSchema.COLUMNS))
        ? window.BriefProSchema.COLUMNS
        : null;

    if (!Array.isArray(columns) || !columns.length) {
      columns = schemaCols || null;
    }

    // Legacy minimal fallback (keeps backward compatibility even if schema isn't loaded)
    if (!Array.isArray(columns) || !columns.length) {
      columns = [
        { key: "walls", label: "Стены, цвет", group: "geometry" },
        { key: "floor", label: "Пол", group: "geometry" },
        { key: "ceiling", label: "Потолок", group: "geometry" },
        { key: "doors", label: "Двери", group: "geometry" },
        { key: "plinth", label: "Плинтус, карниз", group: "geometry" },
        { key: "light", label: "Свет", group: "content" },
        { key: "furniture", label: "Мебель / Декор", group: "content" },
        { key: "concept", label: "Ссылка на концепт", group: "content" },
        { key: "notes", label: "Допы к черновикам или примечания", group: "content" }
      ];
    }

    // Normalize columns to a stable shape: { key, label, group }
    // If the explicit model has no "group", we inherit it from schema by matching keys.
    const schemaByKey = new Map(
      (schemaCols || []).map(c => [String(c.key || ""), c])
    );

    const normalizedCols = columns
      .map((c) => {
        const key = c && c.key ? String(c.key) : "";
        if (!key) return null;

        const sc = schemaByKey.get(key);
        const label = String(
          (c && (c.label || c.title || c.key)) ||
          (sc && (sc.label || sc.title || sc.key)) ||
          key
        );

        const group = String(
          (c && c.group) ||
          (sc && sc.group) ||
          ""
        );

        return { key, label, group };
      })
      .filter(Boolean);

    return { bp, rooms, columns: normalizedCols };
  }

  // ---------------------------
  // Vendor loader (xlsx-js-style)
  // ---------------------------
  async function loadXLSX(){
    if (window.XLSX && window.XLSX.utils) return window.XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "./js/vendor/xlsx.bundle.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load xlsx.bundle.js"));
      document.head.appendChild(s);
    });
    if (!window.XLSX || !window.XLSX.utils) throw new Error("XLSX bundle loaded, but XLSX not available");
    return window.XLSX;
  }

  // ---------------------------
  // Main sheet builder
  // ---------------------------
  function buildBriefSheet(XLSX, model){
    const st = mkStyles();
    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    const cols = Array.isArray(model.columns) ? model.columns : [];

    // Header (2 rows): group title for geometry + labels
    const headerTop = [cellText("Помещение", st.head)];
    const headerSub = [cellText("", st.head)];

    // Geometry range is defined by schema group, NOT by UI labels.
    const geoIdxs = [];
    cols.forEach((c, i) => {
      const g = normStr(c.group).trim().toLowerCase();
      if (g === "geometry") geoIdxs.push(i);
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
    const rowHeights = [{ hpt: 28 }, { hpt: 24 }];

    // Column widths
    const colWidths = [{ wch: 26 }];
    cols.forEach((c) => {
      const label = normStr(c.label ?? c.title ?? c.key ?? "").toLowerCase();
      let wch = 22;
      if (label.includes("примеч")) wch = 40;
      if (label.includes("концеп")) wch = 28;
      colWidths.push({ wch });
    });

    // Excel room palette (independent from PWA UI)
    const EXCEL_ROOM_PALETTE = [
      "F8FAFC","F1F5F9","FAFAF9","FDF2F8","ECFDF5",
      "EFF6FF","FFFBEB","F5F3FF","FFF1F2","F0FDFA"
    ];

    function pickExcelRgb(ri){
      return EXCEL_ROOM_PALETTE[ri % EXCEL_ROOM_PALETTE.length];
    }

    function normalizeCell(val){
      // BriefPro cell is usually: { text: "", links: [{ url, label? }, ...] }
      if (!val) return { text: "", links: [] };
      if (typeof val === "string") return { text: val, links: [] };
      if (typeof val === "object") {
        const text = normStr(val.text || val.value || "");
        const links = Array.isArray(val.links) ? val.links : [];
        return { text, links };
      }
      return { text: "", links: [] };
    }

    function cellToExcel(cell, baseStyle){
      const c = normalizeCell(cell);
      const text = c.text ? c.text.trim() : "";
      if (!c.links || !c.links.length) return cellText(text, baseStyle);

      const first = c.links[0];
      const url = normStr(first.url || first.href || first.link || "").trim();
      const lbl = normStr(first.label || "").trim();

      // If there is a URL, write it as hyperlink cell text.
      // (We keep it simple: first link only; the UI can have more.)
      const show = lbl || url || text;
      const out = cellText(show, url ? { ...baseStyle, font: { color: { rgb: "2563EB" }, underline: true } } : baseStyle);
      if (url) out.l = { Target: url, Tooltip: url };
      return out;
    }

    rooms.forEach((room, ri) => {
      const name = normStr(room && (room.name || room.title) || "");
      const fillRgb = pickExcelRgb(ri);

      const row = [];
      row.push({
        ...cellText(name || "—", st.firstCol),
        s: {
          ...st.firstCol,
          fill: { patternType: "solid", fgColor: { rgb: fillRgb } }
        }
      });

      cols.forEach((c) => {
        const v = room ? room[c.key] : null;
        row.push({
          ...cellToExcel(v, st.base),
          s: {
            ...(cellToExcel(v, st.base).s || st.base),
            fill: { patternType: "solid", fgColor: { rgb: fillRgb } }
          }
        });
      });

      aoa.push(row);
      rowHeights.push({ hpt: 72 });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply widths/heights
    ws["!cols"] = colWidths;
    ws["!rows"] = rowHeights;

    // Freeze header + first column
    ws["!freeze"] = { xSplit: 1, ySplit: 2 };

    // Merge group header cells
    if (geoStart !== -1) {
      ws["!merges"] = ws["!merges"] || [];
      // +1 because first column is room name
      ws["!merges"].push({
        s: { r: 0, c: 1 + geoStart },
        e: { r: 0, c: 1 + geoEnd }
      });
    }

    return ws;
  }

  async function downloadXLSX(state, filename){
    const XLSX = await loadXLSX();
    const model = getBriefProModel(state);

    const wb = XLSX.utils.book_new();
    const ws = buildBriefSheet(XLSX, model);

    XLSX.utils.book_append_sheet(wb, ws, "Brief PRO");
    const outName = filename || "BriefPro.xlsx";
    XLSX.writeFile(wb, outName);
  }

  return { downloadXLSX };
})();
