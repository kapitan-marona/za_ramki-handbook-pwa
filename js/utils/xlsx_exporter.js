﻿/**
 * BriefPro XLSX exporter (xlsx-js-style).
 * Requirements:
 * 1) Geometry group spans 5 fields: walls, floor, ceiling, doors, plinth.
 * 2) Text and links must be written into separate cells based on user-created block order.
 *    (blocks: text/link/text/link...) => columns #1, #2, #3...
 * 3) Each room row has its own fill color; all cells in that room row share the same fill.
 *
 * Output sheets:
 * - BRIEF (main)
 * - LINKS (flattened links list)
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
  // Styles
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

    const subHead = {
      font: { name: FONT, sz: 13, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "334155" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const idxHead = {
      font: { name: FONT, sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "475569" } },
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

    return { head, groupHead, subHead, idxHead, body, bodyBold, link, borderThin };
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
  // MultiField normalization (compatible with UI)
  // blocks preserve user order: text/link/text/link...
  // link label supported: b.label
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

  // Convert a single block to a cell value + optional hyperlink
  function blockToCell(block){
    const t = block && block.t ? block.t : "";
    const v = normStr(block && block.v).trim();
    const lbl = normStr(block && block.label).trim();

    if (!v) return { text: "", url: "" };

    if (t === "link") {
      // Display includes label if exists
      return { text: lbl ? (lbl + ": " + v) : v, url: v };
    }

    // text
    return { text: v, url: "" };
  }

  // ---------------------------
  // Palette (distinct per room, no repeating same shades in a row)
  // ---------------------------
  const ROOM_FILLS = [
    "FFE4D6", // warm peach
    "DDEBFF", // soft blue
    "EFFFF2", // mint
    "FFF0F6", // pink
    "F3F0FF", // violet
    "FFF7CC", // light yellow
    "E7FAFE", // cyan tint
    "FDECC8", // sand
    "E9F7D9", // green tint
    "FCE7F3", // rose tint
    "E0E7FF", // indigo tint
    "DCFCE7"  // green tint 2
  ];

  function pickRoomFill(idx){
    return ROOM_FILLS[idx % ROOM_FILLS.length];
  }

  // ---------------------------
  // BRIEF layout (dynamic columns by max blocks per field)
  // ---------------------------
  function buildBriefSheet(XLSX, model){
    const st = makeStyles();

    // Fixed field order for XLSX (independent from PWA table styling)
    const GEOMETRY_FIELDS = [
      { key: "walls",   label: "Стены, цвет" },
      { key: "floor",   label: "Пол" },
      { key: "ceiling", label: "Потолок" },
      { key: "doors",   label: "Двери" },
      { key: "plinth",  label: "Плинтус, карниз" },
    ];

    const OTHER_FIELDS = [
      { key: "light",     label: "Свет" },
      { key: "furniture", label: "Мебель / Декор" },
      { key: "concept",   label: "Ссылка на концепт" },
      { key: "notes",     label: "Допы / примечания" },
    ];

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];

    // Find max number of blocks per field across all rooms (cap to avoid extreme width)
    const MAX_CAP = 12;
    const maxByKey = new Map();

    function countBlocksFor(room, key){
      const n = normalizeBlocks(room ? room[key] : null);
      // Count only non-empty blocks
      return (n.blocks || []).filter(b => normStr(b && b.v).trim()).length;
    }

    [...GEOMETRY_FIELDS, ...OTHER_FIELDS].forEach(f => {
      let m = 0;
      rooms.forEach(r => { m = Math.max(m, countBlocksFor(r, f.key)); });
      m = Math.min(Math.max(m, 1), MAX_CAP); // at least 1 column per field
      maxByKey.set(f.key, m);
    });

    // Build columns:
    // [RoomName] + for each field: N block-columns (#1..#N)
    // We'll create 3 header rows:
    // Row1: group headers (Geometry) + other field headers
    // Row2: field labels inside geometry; blanks for others
    // Row3: #1..#N indices
    const cols = [];
    cols.push({ kind: "room", label: "Наименование помещения", wch: 30 });

    function pushFieldCols(field, group){
      const n = maxByKey.get(field.key) || 1;
      for (let i = 1; i <= n; i++){
        cols.push({
          kind: "field",
          group,
          key: field.key,
          fieldLabel: field.label,
          idx: i,
          wch: (field.key === "notes" ? 30 : 26)
        });
      }
    }

    GEOMETRY_FIELDS.forEach(f => pushFieldCols(f, "geometry"));
    OTHER_FIELDS.forEach(f => pushFieldCols(f, "content"));

    // Header rows
    const row1 = [];
    const row2 = [];
    const row3 = [];

    // Room header (will be merged A1:A3)
    row1.push(cellText("Наименование помещения", st.head));
    row2.push(cellText("", st.head));
    row3.push(cellText("", st.head));

    // Determine geometry span in columns
    const geoStart = 1;
    const geoWidth = GEOMETRY_FIELDS.reduce((acc, f) => acc + (maxByKey.get(f.key) || 1), 0);
    const geoEnd = geoStart + geoWidth - 1;

    // Row1: Geometry group merged across all geometry subcolumns
    // For columns within geometry: write group header only at first cell, others empty
    for (let c = 1; c < cols.length; c++){
      const isGeo = (c >= geoStart && c <= geoEnd);
      if (isGeo) {
        row1.push(cellText(c === geoStart ? "Геометрия помещения" : "", st.groupHead));
      } else {
        // For content fields: we will set row1 as field label merged across its subcols (later merges),
        // but we still need the row1 cells present.
        // We'll write label at the first subcol of each field, and empty on the rest.
        const col = cols[c];
        const prev = cols[c-1];
        const isFirstOfField = !prev || prev.key !== col.key;
        row1.push(cellText(isFirstOfField ? col.fieldLabel : "", st.groupHead));
      }
    }

    // Row2: For geometry: field labels merged across its subcols. For content: blank (merged later).
    // Row3: For all fields: #1..#N
    // We'll fill row2/row3 by scanning cols.
    for (let c = 1; c < cols.length; c++){
      const col = cols[c];
      const isGeo = (c >= geoStart && c <= geoEnd);

      // Row2
      if (isGeo) {
        const prev = cols[c-1];
        const isFirstOfField = !prev || prev.key !== col.key;
        row2.push(cellText(isFirstOfField ? col.fieldLabel : "", st.subHead));
      } else {
        row2.push(cellText("", st.subHead));
      }

      // Row3
      row3.push(cellText("#" + col.idx, st.idxHead));
    }

    const aoa = [row1, row2, row3];

    // Data rows (ONLY for rooms, even if room name is empty)
    rooms.forEach((room, ri) => {
      const fill = pickRoomFill(ri);
      const r = [];

      // Room name cell
      const roomName = normStr(room?.name ?? room?.title ?? room?.room ?? "");
      r.push(cellText(roomName, withFill(st.bodyBold, fill)));

      // Field blocks laid into separate cells preserving order
      for (let c = 1; c < cols.length; c++){
        const col = cols[c];
        const n = normalizeBlocks(room ? room[col.key] : null);
        const blocks = (n.blocks || []).filter(b => normStr(b && b.v).trim());

        const b = blocks[col.idx - 1]; // idx is 1-based
        const bc = blockToCell(b);

        if (bc.url) {
          r.push(cellLink(bc.text, bc.url, withFill(st.link, fill)));
        } else {
          r.push(cellText(bc.text, withFill(st.body, fill)));
        }
      }

      aoa.push(r);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws["!cols"] = cols.map(c => ({ wch: c.wch || 26 }));

    // Row heights: 3 header rows + data rows
    const heights = [{ hpt: 28 }, { hpt: 22 }, { hpt: 18 }];
    for (let i = 0; i < rooms.length; i++) heights.push({ hpt: 60 });
    ws["!rows"] = heights;

    // Freeze: first column + 3 header rows
    ws["!freeze"] = { xSplit: 1, ySplit: 3 };

    // Merges
    const merges = [];

    // A1:A3 (room header)
    merges.push({ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } });

    // Geometry group merge (Row1, across geometry span)
    merges.push({ s: { r: 0, c: geoStart }, e: { r: 0, c: geoEnd } });

    // Geometry field label merges on Row2
    // Content field label merges on Row1+Row2 across subcols
    // Also merge Row1+Row2 for each content field span to keep it clean.
    function addFieldMerges(fieldList, startCol, rowForLabel, mergeRow1Row2){
      let colCursor = startCol;
      fieldList.forEach(f => {
        const span = maxByKey.get(f.key) || 1;
        const c1 = colCursor;
        const c2 = colCursor + span - 1;

        // If span > 1, merge the label row across that field span
        if (span > 1) {
          merges.push({ s: { r: rowForLabel, c: c1 }, e: { r: rowForLabel, c: c2 } });
        }

        // For content fields, we merge Row1..Row2 for the whole span (keeps Row2 blank)
        if (mergeRow1Row2) {
          merges.push({ s: { r: 0, c: c1 }, e: { r: 1, c: c2 } });
        }

        colCursor = c2 + 1;
      });
    }

    // Geometry labels are on Row2 (r=1), no Row1..Row2 merge (Row1 is group)
    addFieldMerges(GEOMETRY_FIELDS, geoStart, 1, false);

    // Content starts right after geometry
    const contentStart = geoEnd + 1;
    addFieldMerges(OTHER_FIELDS, contentStart, 0, true);

    ws["!merges"] = merges;

    return ws;
  }

  // ---------------------------
  // LINKS sheet (flatten all link blocks)
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
