﻿/**
 * BriefPro XLSX exporter (xlsx-js-style).
 * Goals:
 * - XLSX rendering is independent from PWA UI look.
 * - Rows are created only for existing rooms (even if room.name is empty).
 * - MultiField blocks (text/link/text/link...) are preserved in order in cell text.
 * - Sheets: BRIEF + LINKS (as in older working format).
 */
window.Utils = window.Utils || {};

Utils.XLSXExport = (() => {

  // ---------------------------
  // Vendor loader
  // ---------------------------
  async function ensureXLSXLoaded(){
    if (window.XLSX && window.XLSX.utils) return window.XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "./js/vendor/xlsx.bundle.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load ./js/vendor/xlsx.bundle.js"));
      document.head.appendChild(s);
    });
    if (!window.XLSX || !window.XLSX.utils) throw new Error("XLSX bundle loaded, but XLSX not available");
    return window.XLSX;
  }

  // ---------------------------
  // Utils
  // ---------------------------
  function normStr(v){ return (v ?? "").toString(); }

  function linkDisplay(url){
    const s = normStr(url).trim();
    if (!s) return "";
    return s.replace(/^https?:\/\//i, "");
  }

  // ---------------------------
  // Styles (v36-like)
  // ---------------------------
  function makeStyles(){
    const FONT = "Calibri";
    const borderThin = {
      top:    { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left:   { style: "thin", color: { rgb: "D9D9D9" } },
      right:  { style: "thin", color: { rgb: "D9D9D9" } },
    };

    const head = {
      font: { name: FONT, sz: 16, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "1F2937" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const groupHead = {
      font: { name: FONT, sz: 16, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const body = {
      font: { name: FONT, sz: 12, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    const bodyBold = {
      font: { name: FONT, sz: 12, bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    const link = {
      font: { name: FONT, sz: 12, color: { rgb: "1D4ED8" }, underline: true },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    return { head, groupHead, body, bodyBold, link, borderThin };
  }

  function withFill(style, rgb){
    if (!rgb) return style;
    return Object.assign({}, style, { fill: { patternType: "solid", fgColor: { rgb } } });
  }

  function cellText(v, style){
    return { v: normStr(v), t: "s", s: style || {} };
  }

  function cellLink(display, url, style){
    const u = normStr(url).trim();
    const out = { v: normStr(display), t: "s", s: style || {} };
    if (u) out.l = { Target: u, Tooltip: u };
    return out;
  }

  // ---------------------------
  // Data model
  // ---------------------------
  function getBriefProModel(state){
    const s = state || {};
    const bp =
      s.briefPro || s.brief_pro || s.brief || s.briefpro ||
      (s.data && (s.data.briefPro || s.data.brief_pro)) || {};

    const rooms = bp.rooms || bp.rows || bp.items || s.rooms || [];
    const meta = s.meta || bp.meta || {};

    return { rooms, meta };
  }

  // ---------------------------
  // MultiField normalization (compatible with your UI)
  // Supports link label: b.label
  // ---------------------------
  function normalizeBlocks(raw){
    if (raw === null || raw === undefined) return { blocks: [], links: [] };
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      const t = normStr(raw);
      return { blocks: t.trim() ? [{ t: "text", v: t }] : [], links: [] };
    }

    const obj = (raw && typeof raw === "object") ? raw : {};
    let blocks = Array.isArray(obj.blocks) ? obj.blocks : null;

    let textItems = Array.isArray(obj.textItems) ? obj.textItems.map(normStr) : [];
    const legacyText = normStr(obj.text ?? obj.value ?? obj.note ?? obj.content ?? obj.main ?? "");
    if (!textItems.length && legacyText.trim()) textItems = [legacyText];

    let links = obj.links || obj.urls || obj.hrefs || [];
    if (typeof links === "string") links = [links];
    if (!Array.isArray(links)) links = [];
    links = links.map(normStr).filter(Boolean);

    if (!blocks) {
      blocks = [];
      textItems.forEach((t) => blocks.push({ t: "text", v: normStr(t) }));
      links.forEach((u) => blocks.push({ t: "link", v: normStr(u), label: "" }));
    } else {
      blocks = blocks
        .filter(b => b && (b.t === "text" || b.t === "link"))
        .map(b => ({
          t: b.t,
          v: normStr(b.v),
          label: b.t === "link" ? normStr(b.label) : ""
        }));
    }

    const flatLinks = blocks
      .filter(b => b.t === "link" && normStr(b.v).trim())
      .map(b => normStr(b.v).trim());

    return { blocks, links: flatLinks };
  }

  // Turn blocks into cell text, preserving order.
  // Link rows become "Лейбл: url" or "url".
  // First link is also used as the cell hyperlink target (Excel limitation).
  function blocksToCell(blocks){
    const lines = [];
    let firstUrl = "";
    blocks.forEach((b) => {
      if (!b) return;
      if (b.t === "text") {
        const t = normStr(b.v).trim();
        if (t) lines.push(t);
      } else if (b.t === "link") {
        const u = normStr(b.v).trim();
        if (!u) return;
        if (!firstUrl) firstUrl = u;
        const lbl = normStr(b.label).trim();
        lines.push(lbl ? (lbl + ": " + u) : u);
      }
    });
    return { text: lines.join("\n"), firstUrl };
  }

  // ---------------------------
  // BRIEF sheet (v36-like layout)
  // ---------------------------
  function buildBriefSheet(XLSX, model){
    const st = makeStyles();

    // Column order is fixed for XLSX (independent from UI visuals)
    const COLS = [
      { key: "__room",  label: "Наименование помещения", wch: 30 },
      { key: "walls",   label: "Стены, цвет",            wch: 26 },
      { key: "floor",   label: "Пол",                    wch: 26 },
      { key: "ceiling", label: "Потолок",                wch: 26 },
      { key: "doors",   label: "Двери",                  wch: 26 },
      { key: "plinth",  label: "Плинтус, карниз",        wch: 26 },
      { key: "light",   label: "Свет",                   wch: 26 },
      { key: "furniture", label: "Мебель / Декор",       wch: 26 },
      { key: "concept", label: "Ссылка на концепт",      wch: 26 },
      { key: "notes",   label: "Допы / примечания",      wch: 30 },
    ];

    // Header rows (2-row header with merges)
    const r1 = [
      cellText(COLS[0].label, st.head),
      cellText(COLS[1].label, st.head),
      cellText("Геометрия помещения", st.groupHead),
      cellText("", st.groupHead),
      cellText("", st.groupHead),
      cellText(COLS[5].label, st.head),
      cellText(COLS[6].label, st.head),
      cellText(COLS[7].label, st.head),
      cellText(COLS[8].label, st.head),
      cellText(COLS[9].label, st.head),
    ];
    const r2 = [
      cellText("", st.head),
      cellText("", st.head),
      cellText(COLS[2].label, st.head),
      cellText(COLS[3].label, st.head),
      cellText(COLS[4].label, st.head),
      cellText("", st.head),
      cellText("", st.head),
      cellText("", st.head),
      cellText("", st.head),
      cellText("", st.head),
    ];

    const aoa = [r1, r2];

    // Row fills (reuse your older palette vibe)
    const ROW_FILLS = [
      "FFE4D6","FFE4D6","FFE4D6","FFE4D6","FFE4D6",
      "DDEBFF","EFFFF2","FFF0F6","F3F0FF","FFF7CC"
    ];

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    rooms.forEach((room, ri) => {
      const fill = ROW_FILLS[ri % ROW_FILLS.length];
      const row = [];

      // Room name (may be empty; row still created)
      row.push(cellText(normStr(room?.name ?? room?.title ?? room?.room ?? ""), withFill(st.bodyBold, fill)));

      // Other cells
      const keys = ["walls","floor","ceiling","doors","plinth","light","furniture","concept","notes"];
      keys.forEach((k) => {
        const n = normalizeBlocks(room ? room[k] : null);
        const b = blocksToCell(n.blocks || []);
        // Put all blocks into cell text; first URL becomes clickable
        if (b.firstUrl) {
          row.push(cellLink(b.text || b.firstUrl, b.firstUrl, withFill(st.link, fill)));
        } else {
          row.push(cellText(b.text, withFill(st.body, fill)));
        }
      });

      aoa.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws["!cols"] = COLS.map(c => ({ wch: c.wch }));

    // Row heights: header + data (no extra blank rows)
    const rowsHeights = [];
    rowsHeights.push({ hpt: 28 });
    rowsHeights.push({ hpt: 24 });
    for (let i = 0; i < rooms.length; i++) rowsHeights.push({ hpt: 60 });
    ws["!rows"] = rowsHeights;

    // Freeze first column + header rows
    ws["!freeze"] = { xSplit: 1, ySplit: 2 };

    // Merges to match v36 style:
    // A1:A2, B1:B2, C1:E1, F1:F2, G1:G2, H1:H2, I1:I2, J1:J2
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },
      { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },
      { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } },
      { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } },
    ];

    return ws;
  }

  // ---------------------------
  // LINKS sheet
  // ---------------------------
  function buildLinksSheet(XLSX, model){
    const st = makeStyles();
    const aoa = [[
      cellText("Помещение", st.head),
      cellText("Поле", st.head),
      cellText("Лейбл", st.head),
      cellText("Ссылка", st.head)
    ]];

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];

    const FIELDS = [
      ["walls","Стены, цвет"],
      ["floor","Пол"],
      ["ceiling","Потолок"],
      ["doors","Двери"],
      ["plinth","Плинтус, карниз"],
      ["light","Свет"],
      ["furniture","Мебель / Декор"],
      ["concept","Ссылка на концепт"],
      ["notes","Допы / примечания"],
    ];

    rooms.forEach((room) => {
      const roomName = normStr(room?.name ?? room?.title ?? room?.room ?? ""); // may be empty, ok

      FIELDS.forEach(([key, label]) => {
        const n = normalizeBlocks(room ? room[key] : null);
        const blocks = Array.isArray(n.blocks) ? n.blocks : [];
        const links = blocks.filter(b => b && b.t === "link" && normStr(b.v).trim());

        if (!links.length) return;

        links.forEach((b) => {
          const u = normStr(b.v).trim();
          const lbl = normStr(b.label).trim();
          const disp = (lbl ? (lbl + ": ") : "") + linkDisplay(u);

          aoa.push([
            cellText(roomName, st.body),
            cellText(label, st.body),
            cellText(lbl, st.body),
            cellLink(disp || u, u, st.link)
          ]);
        });
      });
    });

    // Meta links (if present)
    const meta = model.meta || {};
    const metaPairs = [
      ["Фото на замере (Google Drive)", meta.surveyPhotosLink],
      ["Ссылка на свет (DWG)", meta.lightDwg],
      ["Ссылка на план мебели (DWG)", meta.furniturePlanDwg],
      ["Ссылка на чертежи (PDF)", meta.drawingsPdf],
      ["Ссылка на концепт", meta.conceptLink],
    ];

    metaPairs.forEach(([label, val]) => {
      const v = normStr(val).trim();
      if (!v) return;
      aoa.push([
        cellText("—", st.body),
        cellText(label, st.body),
        cellText("", st.body),
        cellLink(linkDisplay(v), v, st.link)
      ]);
    });

    // Radiators (multi-field)
    const rad = normalizeBlocks(meta.radiators);
    if (rad.blocks && rad.blocks.length) {
      rad.blocks
        .filter(b => b && b.t === "link" && normStr(b.v).trim())
        .forEach((b) => {
          const u = normStr(b.v).trim();
          const lbl = normStr(b.label).trim();
          const disp = (lbl ? (lbl + ": ") : "") + linkDisplay(u);

          aoa.push([
            cellText("—", st.body),
            cellText("Радиаторы", st.body),
            cellText(lbl, st.body),
            cellLink(disp || u, u, st.link)
          ]);
        });
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 16 }, { wch: 60 }];
    ws["!rows"] = [{ hpt: 24 }];
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    return ws;
  }

  // ---------------------------
  // Public API
  // ---------------------------
  async function downloadXLSX(state, filename){
    const XLSX = await ensureXLSXLoaded();
    const model = getBriefProModel(state);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildBriefSheet(XLSX, model), "BRIEF");
    XLSX.utils.book_append_sheet(wb, buildLinksSheet(XLSX, model), "LINKS");

    const name = (filename && String(filename).trim()) ? String(filename).trim() : "TZ_vizualizatoru_PRO";
    const out = name.toLowerCase().endsWith(".xlsx") ? name : (name + ".xlsx");
    XLSX.writeFile(wb, out, { bookType: "xlsx", compression: true });
  }

  window.Utils.XLSXExport = { downloadXLSX };
  return window.Utils.XLSXExport;
})();
