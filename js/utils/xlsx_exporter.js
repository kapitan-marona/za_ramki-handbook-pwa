﻿/**
 * BriefPro XLSX exporter (xlsx-js-style).
 *
 * BRIEF:
 * - grows DOWN: blocks go to new rows, not new columns.
 * - Geometry group spans 5 fields: walls, floor, ceiling, doors, plinth.
 * - Header vertically centered.
 * - Room name centered both horizontally and vertically.
 * - Column widths ~164px for room name, ~140px others (wch 23 and 19).
 * - Text wraps by words (wrapText:true).
 * - Link cells: no-wrap + truncated display, clickable full URL.
 * - Prevent Excel text overflow into next empty cell by using a single space instead of "".
 *
 * Adds a compact meta block under the table (A:D):
 * - Project files/links
 * - Radiators text + radiators links
 * - Heights from separate inputs (+ fallback)
 *
 * Sheets: BRIEF + LINKS.
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

  function truncate(s, maxLen){
    const t = normStr(s);
    if (!t) return "";
    if (t.length <= maxLen) return t;
    return t.slice(0, Math.max(0, maxLen - 1)) + "…";
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
      font: { name: FONT, sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "1F2937" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const groupHead = {
      font: { name: FONT, sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const body = {
      font: { name: FONT, sz: 11, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    const roomName = {
      font: { name: FONT, sz: 11, bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const link = {
      font: { name: FONT, sz: 11, color: { rgb: "1D4ED8" }, underline: true },
      alignment: { horizontal: "left", vertical: "center", wrapText: false, shrinkToFit: true },
      border: borderThin
    };

    // Meta block styles (compact, pleasant)
    const metaTitle = {
      font: { name: FONT, sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderThin
    };

    const metaKey = {
      font: { name: FONT, sz: 11, bold: true, color: { rgb: "0F172A" } },
      fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: borderThin
    };

    const metaVal = {
      font: { name: FONT, sz: 11, color: { rgb: "0F172A" } },
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    const metaLink = {
      font: { name: FONT, sz: 11, color: { rgb: "1D4ED8" }, underline: true },
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      alignment: { horizontal: "left", vertical: "center", wrapText: false, shrinkToFit: true },
      border: borderThin
    };

    const separator = {
      font: { name: FONT, sz: 11, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "left", vertical: "center", wrapText: false }
      // no border
    };

    return { head, groupHead, body, roomName, link, metaTitle, metaKey, metaVal, metaLink, separator };
  }

  function withFill(style, rgb){
    if (!rgb) return style;
    return Object.assign({}, style, { fill: { patternType: "solid", fgColor: { rgb } } });
  }

  // IMPORTANT: Excel overflows text into next EMPTY cell visually.
  // A single space makes the cell non-empty but visually blank, preventing overflow.
  function cellText(v, style){
    const s = normStr(v);
    const vv = (s === "") ? " " : s;
    return { v: vv, t: "s", s: style || {} };
  }

  function cellLink(display, url, style){
    const u = normStr(url).trim();
    const d = normStr(display);
    const out = { v: (d === "" ? " " : d), t: "s", s: style || {} };
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
  // MultiField normalization (preserve user order)
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

  function blockToCell(block){
    const t = block && block.t ? block.t : "";
    const v = normStr(block && block.v).trim();
    const lbl = normStr(block && block.label).trim();
    if (!v) return { text: "", url: "" };

    if (t === "link") return { text: lbl ? (lbl + ": " + v) : v, url: v };
    return { text: v, url: "" };
  }

  // ---------------------------
  // Palette (distinct per room, all rows of the room share it)
  // ---------------------------
  const ROOM_FILLS = [
    "FFE4D6", "DDEBFF", "EFFFF2", "FFF0F6", "F3F0FF", "FFF7CC",
    "E7FAFE", "FDECC8", "E9F7D9", "FCE7F3", "E0E7FF", "DCFCE7"
  ];
  function pickRoomFill(idx){ return ROOM_FILLS[idx % ROOM_FILLS.length]; }

  // ---------------------------
  // Meta mapping (improved structure + backwards compatibility)
  // ---------------------------
  function pickMeta(meta, pathCandidates){
    for (const p of pathCandidates) {
      const parts = p.split(".");
      let cur = meta;
      let ok = true;
      for (const k of parts){
        if (cur && typeof cur === "object" && k in cur) cur = cur[k];
        else { ok = false; break; }
      }
      if (!ok) continue;
      const s = normStr(cur).trim();
      if (s) return s;
    }
    return "";
  }

  // ---------------------------
  // BRIEF sheet (GROWS DOWN + META block)
  // ---------------------------
  function buildBriefSheet(XLSX, model){
    const st = makeStyles();

    // Fixed columns (164px / 140px approximations)
    const COLS = [
      { key: "__room", label: "Наименование помещения", wch: 23 },

      // Geometry (5)
      { key: "walls",   label: "Стены, цвет",     wch: 19 },
      { key: "floor",   label: "Пол",             wch: 19 },
      { key: "ceiling", label: "Потолок",         wch: 19 },
      { key: "doors",   label: "Двери",           wch: 19 },
      { key: "plinth",  label: "Плинтус, карниз", wch: 19 },

      // Other
      { key: "light",     label: "Свет",              wch: 19 },
      { key: "furniture", label: "Мебель / Декор",    wch: 19 },
      { key: "concept",   label: "Ссылка на концепт", wch: 19 },
      { key: "notes",     label: "Допы / примечания", wch: 19 },
    ];

    // Header rows (2)
    const r1 = [
      cellText(COLS[0].label, st.head),
      cellText("Геометрия помещения", st.groupHead),
      cellText("", st.groupHead),
      cellText("", st.groupHead),
      cellText("", st.groupHead),
      cellText("", st.groupHead),
      cellText(COLS[6].label, st.head),
      cellText(COLS[7].label, st.head),
      cellText(COLS[8].label, st.head),
      cellText(COLS[9].label, st.head),
    ];

    const r2 = [
      cellText("", st.head),
      cellText(COLS[1].label, st.head),
      cellText(COLS[2].label, st.head),
      cellText(COLS[3].label, st.head),
      cellText(COLS[4].label, st.head),
      cellText(COLS[5].label, st.head),
      cellText("", st.head),
      cellText("", st.head),
      cellText("", st.head),
      cellText("", st.head),
    ];

    const aoa = [r1, r2];
    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    const meta = model.meta || {};

    function countNonEmptyBlocks(room, key){
      const n = normalizeBlocks(room ? room[key] : null);
      return (n.blocks || []).filter(b => normStr(b && b.v).trim()).length;
    }

    let excelRowIndex = 2; // data starts at row 3 (0-based index 2)
    const merges = [];

    // --- Rooms block
    rooms.forEach((room, ri) => {
      const fill = pickRoomFill(ri);
      const roomName = normStr(room?.name ?? room?.title ?? room?.room ?? "");

      let span = 1;
      for (let ci = 1; ci < COLS.length; ci++){
        span = Math.max(span, countNonEmptyBlocks(room, COLS[ci].key));
      }

      const blocksByKey = {};
      for (let ci = 1; ci < COLS.length; ci++){
        const key = COLS[ci].key;
        const n = normalizeBlocks(room ? room[key] : null);
        blocksByKey[key] = (n.blocks || []).filter(b => normStr(b && b.v).trim());
      }

      for (let k = 0; k < span; k++){
        const row = [];

        if (k === 0) row.push(cellText(roomName, withFill(st.roomName, fill)));
        else row.push(cellText("", withFill(st.roomName, fill)));

        for (let ci = 1; ci < COLS.length; ci++){
          const key = COLS[ci].key;
          const b = (blocksByKey[key] && blocksByKey[key][k]) ? blocksByKey[key][k] : null;
          const bc = blockToCell(b);

          if (bc.url) {
            const short = truncate(linkDisplay(bc.url), 34);
            const shown = bc.text && bc.text.includes(":")
              ? truncate(bc.text.split(":")[0] + ": " + short, 40)
              : short;

            row.push(cellLink(shown || short || bc.url, bc.url, withFill(st.link, fill)));
          } else {
            row.push(cellText(bc.text, withFill(st.body, fill)));
          }
        }

        aoa.push(row);
      }

      if (span > 1) {
        merges.push({
          s: { r: excelRowIndex, c: 0 },
          e: { r: excelRowIndex + span - 1, c: 0 }
        });
      }

      excelRowIndex += span;
    });

    // --- Separator (one row) after rooms table
    aoa.push(new Array(10).fill(0).map(() => cellText(" ", st.separator)));
    const metaTitleRowIdx = aoa.length; // next push will be this row index (0-based)

    // --- Meta block (compact width A:D)
    aoa.push([
      cellText("Файлы и ссылки проекта", st.metaTitle),
      cellText("", st.metaTitle),
      cellText("", st.metaTitle),
      cellText("", st.metaTitle),
      cellText(" ", null), cellText(" ", null), cellText(" ", null), cellText(" ", null), cellText(" ", null), cellText(" ", null),
    ]);

    function addMetaRow(label, value, isLink){
      const v = normStr(value).trim();

      const keyCell = cellText(label, st.metaKey);
      let valCellA;

      if (isLink && v) {
        const shown = truncate(linkDisplay(v), 60);
        valCellA = cellLink(shown || v, v, st.metaLink);
      } else {
        valCellA = cellText(v, st.metaVal);
      }

      const valCellB = cellText("", st.metaVal);
      const valCellC = cellText("", st.metaVal);

      aoa.push([
        keyCell,
        valCellA, valCellB, valCellC,
        cellText(" ", null), cellText(" ", null), cellText(" ", null), cellText(" ", null), cellText(" ", null), cellText(" ", null),
      ]);
    }

    // Project file links (new structure + legacy keys)
    const surveyPhotos = pickMeta(meta, ["files.surveyPhotos", "files.surveyPhotosLink", "surveyPhotos", "surveyPhotosLink", "surveyPhotosUrl"]);
    const lightDwg     = pickMeta(meta, ["files.lightDwg", "lightDwg", "lightDWG"]);
    const furnDwg      = pickMeta(meta, ["files.furniturePlanDwg", "furniturePlanDwg", "furnitureDWG", "furniturePlanDWG"]);
    const drawingsPdf  = pickMeta(meta, ["files.drawingsPdf", "drawingsPdf", "drawingsPDF", "drawings", "drawingsLink"]);
    const concept      = pickMeta(meta, ["files.concept", "conceptLink", "concept", "conceptUrl"]);

    addMetaRow("Фото на замере (Google Drive)", surveyPhotos, true);
    addMetaRow("Ссылка на свет (DWG)", lightDwg, true);
    addMetaRow("Ссылка на план мебели (DWG)", furnDwg, true);
    addMetaRow("Ссылка на чертежи (PDF)", drawingsPdf, true);
    addMetaRow("Ссылка на концепт", concept, true);

    // Radiators: text + links (MultiField supported)
    const radRaw = meta.radiators ?? meta.radiator ?? meta.radiatorsLink ?? "";
    const radNorm = normalizeBlocks(radRaw);

    const radText = (radNorm.blocks || [])
      .filter(b => b && b.t === "text" && normStr(b.v).trim())
      .map(b => normStr(b.v).trim())
      .join("\n");
    addMetaRow("Радиаторы", radText, false);

    (radNorm.blocks || [])
      .filter(b => b && b.t === "link" && normStr(b.v).trim())
      .forEach((b) => {
        const u = normStr(b.v).trim();
        const lbl = normStr(b.label).trim();
        const rowLabel = lbl ? ("Радиаторы — " + lbl) : "Радиаторы — ссылка";
        addMetaRow(rowLabel, u, true);
      });

    // Heights: robust auto-collector (no guessing exact keys)
// - finds ceiling/doors/custom-like fields anywhere inside meta (deep search)
// - keeps backward compatible fallback
function walk(obj, cb, path = ""){
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, cb, path ? (path + "[" + i + "]") : ("[" + i + "]")));
    return;
  }
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    const p = path ? (path + "." + k) : k;
    cb(k, v, p);
    walk(v, cb, p);
  });
}

function isScalar(v){
  return (typeof v === "string" || typeof v === "number" || typeof v === "boolean");
}

function collectHeights(meta){
  const hits = []; // {kind, label, val}
  const seen = new Set();

  const rxCeil = /(ceiling|ceil|potol|потол|потолок)/i;
  const rxDoor = /(door|doors|двер|porta)/i;
  const rxWhite = /(white|бел)/i;
  const rxCustom = /(custom|extra|доп|кастом|свой)/i;
  const rxHeight = /(height|h_|mm|мм|высот)/i;

  function add(kind, label, val){
    const v = normStr(val).trim();
    if (!v) return;
    const key = kind + "|" + label + "|" + v;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ kind, label, val: v });
  }

  // 1) Try structured places first (if exist)
  const hFallback = pickMeta(meta, ["heightsMm", "heights", "heightNotes", "heightsText"]);
  // If heights is an object, take its scalar fields
  const heightsObj = (meta && meta.heights && typeof meta.heights === "object") ? meta.heights : null;
  if (heightsObj) {
    Object.keys(heightsObj).forEach((k) => {
      const v = heightsObj[k];
      if (!isScalar(v)) return;
      const kk = String(k);
      if (rxCeil.test(kk)) add("ceil", "Потолки", v);
      else if (rxDoor.test(kk) && rxWhite.test(kk)) add("doorWhite", "Дверь белая", v);
      else if (rxDoor.test(kk)) add("door", "Двери", v);
      else if (rxCustom.test(kk) || rxHeight.test(kk)) add("custom", kk, v);
    });
  }

  // 2) Deep scan meta for likely height fields (ceiling/doors/custom)
  walk(meta, (k, v, p) => {
    if (!isScalar(v)) return;

    const kk = String(k);
    const pp = String(p);

    // Only consider height-ish fields to avoid garbage
    const looksHeight = rxHeight.test(kk) || rxHeight.test(pp) || /\d/.test(String(v));
    if (!looksHeight) return;

    if (rxCeil.test(kk) || rxCeil.test(pp)) add("ceil", "Потолки", v);
    else if ((rxDoor.test(kk) || rxDoor.test(pp)) && (rxWhite.test(kk) || rxWhite.test(pp))) add("doorWhite", "Дверь белая", v);
    else if (rxDoor.test(kk) || rxDoor.test(pp)) add("door", "Двери", v);
    else if (rxCustom.test(kk) || rxCustom.test(pp)) {
      // Try to use neighbor label if present
      add("custom", kk, v);
    }
  });

  // 3) Custom "label + value" pairs (common patterns)
  const cLabel = pickMeta(meta, ["heights.customLabel","customHeightLabel","heightCustomLabel","customLabel","extraLabel","heightsExtraLabel"]);
  const cVal   = pickMeta(meta, ["heights.custom","customHeight","customHeightMm","customValue","extraValue","heightsExtra"]);
  if (cVal) add("customPair", (normStr(cLabel).trim() ? normStr(cLabel).trim() : "Прочее"), cVal);

  // Build final text in stable order
  const parts = [];
  const ceil = hits.filter(x => x.kind === "ceil").map(x => x.val);
  const door = hits.filter(x => x.kind === "door").map(x => x.val);
  const white = hits.filter(x => x.kind === "doorWhite").map(x => x.val);

  if (ceil.length) parts.push("Потолки: " + ceil[0]);
  if (door.length) parts.push("Двери: " + door[0]);
  if (white.length) parts.push("Дверь белая: " + white[0]);

  // customs: take up to 2 to keep it neat
  const customs = hits.filter(x => x.kind.startsWith("custom")).slice(0, 2);
  customs.forEach((x) => {
    const lab = x.label && x.label.length <= 24 ? x.label : "Дополнительно";
    parts.push(lab + ": " + x.val);
  });

  const out = parts.length ? parts.join(" | ") : hFallback;
  return out;
}

const heightsOut = collectHeights(meta);
addMetaRow("Высоты (мм)", heightsOut, false);// ---------------------------
    // Build sheet + merges
    // ---------------------------
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws["!cols"] = COLS.map(c => ({ wch: c.wch }));

    // only header heights; data left to Excel defaults (links won't expand due to no-wrap)
    ws["!rows"] = [{ hpt: 31.5 }, { hpt: 27.75 }];

    ws["!freeze"] = { xSplit: 1, ySplit: 2 };

    // Header merges: A1:A2, B1:F1, G1:G2, H1:H2, I1:I2, J1:J2
    merges.unshift(
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 0, c: 5 } },
      { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },
      { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } },
      { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } }
    );

    // Meta title merge A:D (metaTitleRowIdx is the index where title was pushed)
    merges.push({ s: { r: metaTitleRowIdx, c: 0 }, e: { r: metaTitleRowIdx, c: 3 } });

    // Merge meta value cells B:D for each row beneath title (until end)
    for (let rr = metaTitleRowIdx + 1; rr < aoa.length; rr++){
      merges.push({ s: { r: rr, c: 1 }, e: { r: rr, c: 3 } });
    }

    ws["!merges"] = merges;
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
    const meta = model.meta || {};

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
      const roomName = normStr(room?.name ?? room?.title ?? room?.room ?? "");

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
            cellLink(truncate(disp || u, 80), u, st.link)
          ]);
        });
      });
    });

    // Add meta links into LINKS too
    function pickMeta(meta, pathCandidates){
      for (const p of pathCandidates) {
        const parts = p.split(".");
        let cur = meta;
        let ok = true;
        for (const k of parts){
          if (cur && typeof cur === "object" && k in cur) cur = cur[k];
          else { ok = false; break; }
        }
        if (!ok) continue;
        const s = normStr(cur).trim();
        if (s) return s;
      }
      return "";
    }

    const surveyPhotos = pickMeta(meta, ["files.surveyPhotos", "files.surveyPhotosLink", "surveyPhotos", "surveyPhotosLink", "surveyPhotosUrl"]);
    const lightDwg     = pickMeta(meta, ["files.lightDwg", "lightDwg", "lightDWG"]);
    const furnDwg      = pickMeta(meta, ["files.furniturePlanDwg", "furniturePlanDwg", "furnitureDWG", "furniturePlanDWG"]);
    const drawingsPdf  = pickMeta(meta, ["files.drawingsPdf", "drawingsPdf", "drawingsPDF", "drawings", "drawingsLink"]);
    const concept      = pickMeta(meta, ["files.concept", "conceptLink", "concept", "conceptUrl"]);

    [
      ["—", "Фото на замере (Google Drive)", "", surveyPhotos],
      ["—", "Ссылка на свет (DWG)", "", lightDwg],
      ["—", "Ссылка на план мебели (DWG)", "", furnDwg],
      ["—", "Ссылка на чертежи (PDF)", "", drawingsPdf],
      ["—", "Ссылка на концепт", "", concept],
    ].forEach(([roomName, field, label, url]) => {
      const u = normStr(url).trim();
      if (!u) return;
      aoa.push([
        cellText(roomName, st.body),
        cellText(field, st.body),
        cellText(label, st.body),
        cellLink(truncate(linkDisplay(u), 80), u, st.link)
      ]);
    });

    // Radiators meta links too (if any)
    const radRaw = meta.radiators ?? meta.radiator ?? meta.radiatorsLink ?? "";
    const radNorm = normalizeBlocks(radRaw);
    (radNorm.blocks || [])
      .filter(b => b && b.t === "link" && normStr(b.v).trim())
      .forEach((b) => {
        const u = normStr(b.v).trim();
        const lbl = normStr(b.label).trim();
        aoa.push([
          cellText("—", st.body),
          cellText("Радиаторы", st.body),
          cellText(lbl, st.body),
          cellLink(truncate(linkDisplay(u), 80), u, st.link)
        ]);
      });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 26 }, { wch: 28 }, { wch: 16 }, { wch: 60 }];
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


