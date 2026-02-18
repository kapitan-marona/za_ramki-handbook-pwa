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
    let d = raw.replace(/^(https?:\/\/)/i, "").replace(/\/$/, "");
    const MAX = 48;
    if (d.length > MAX) d = d.slice(0, 30) + "…" + d.slice(-14);
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

    const bodyBold = {
      font: { name: FONT_BODY, sz: FONT_SIZE_BODY, bold: true, color: { rgb: "111827" } },
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

    return { head, groupHead, body, bodyBold, firstCol, link };
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

    return { rooms, columns, bp, meta: s.meta || bp.meta || {} };
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

  function pushMetaRow(aoa, rowHeights, st, totalCols, label, value) {
    const v = normStr(value).trim();
    if (!v) return;

    const row = new Array(totalCols).fill(cellText("", st.body));
    row[0] = cellText(label, st.bodyBold);

    const isLink = /^(https?:\/\/|mailto:|tel:)/i.test(v) || /^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(v);
    row[1] = isLink ? cellLink(linkDisplay(v), v, st.link) : cellText(v, st.body);

    aoa.push(row);
    rowHeights.push({ hpt: 20 });
  }

  function pushMetaMultiField(aoa, rowHeights, st, totalCols, label, mfValue) {
    if (!mfValue || typeof mfValue !== "object") return;
    const text = normStr(mfValue.text).trim();
    const links = Array.isArray(mfValue.links) ? mfValue.links.map(normStr).filter(Boolean) : [];

    if (!text && links.length === 0) return;

    // label row (text)
    const row = new Array(totalCols).fill(cellText("", st.body));
    row[0] = cellText(label, st.bodyBold);
    row[1] = cellText(text, st.body);
    aoa.push(row);
    rowHeights.push({ hpt: 34 });

    // link rows
    links.slice(0, 8).forEach((u, idx) => {
      const r = new Array(totalCols).fill(cellText("", st.body));
      r[0] = cellText(idx === 0 ? "↳ ссылки" : "", st.body);
      r[1] = cellLink(linkDisplay(u), u, st.link);
      aoa.push(r);
      rowHeights.push({ hpt: 18 });
    });
  }

  function buildBriefSheet(XLSX, model) {
    const st = makeStyles();
    const cols = model.columns || [];

    const headerTop = [cellText("Наименование помещения", st.head)];
    const headerSub = [cellText("", st.head)];

    const geoSet = new Set([
      normalizeLabel("Стены"),
      normalizeLabel("Пол"),
      normalizeLabel("Потолок"),
      normalizeLabel("Двери"),
      normalizeLabel("Плинтус и карниз")
    ]);

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

    const rowHeights = [{ hpt: 28 }, { hpt: 24 }];

    const colWidths = [{ wch: 26 }];
    cols.forEach((c) => {
      const label = normalizeLabel(c.label ?? c.title ?? c.key ?? "");
      let wch = 22;
      if (label.includes("примеч")) wch = 40;
      if (label.includes("концеп")) wch = 28;
      colWidths.push({ wch });
    });

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    rooms.forEach((room) => {
      const roomName = normStr(room?.title ?? room?.name ?? room?.room ?? "");
      const bg = hexToRGB(room?.__bg || room?.bg || room?.color || "");
      const roomStyle = st.firstCol(bg || "E5E7EB");

      const values = cols.map((c) => extractCellValue(room, normStr(c.key ?? c.id ?? c.name ?? "")));

      const textRow = [cellText(roomName, roomStyle)];
      values.forEach((v) => textRow.push(cellText(v.text, st.body)));
      aoa.push(textRow);
      rowHeights.push({ hpt: 60 });

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

    // --- Meta section under the table: "Файлы и ссылки проекта"
    const totalCols = 1 + cols.length;
    const meta = model.meta || {};

    const hasAnyMeta =
      !!normStr(meta.surveyPhotosLink).trim() ||
      !!normStr(meta.lightDwg).trim() ||
      !!normStr(meta.furniturePlanDwg).trim() ||
      !!normStr(meta.drawingsPdf).trim() ||
      !!normStr(meta.conceptLink).trim() ||
      (meta.radiators && (normStr(meta.radiators.text).trim() || (Array.isArray(meta.radiators.links) && meta.radiators.links.filter(Boolean).length))) ||
      !!normStr(meta.ceilingsMm).trim() ||
      !!normStr(meta.doorsMm).trim() ||
      !!normStr(meta.otherMm).trim();

    if (hasAnyMeta) {
      aoa.push(new Array(totalCols).fill(cellText("", st.body)));
      rowHeights.push({ hpt: 10 });

      const titleRow = new Array(totalCols).fill(cellText("", st.groupHead));
      titleRow[0] = cellText("Файлы и ссылки проекта", st.groupHead);
      aoa.push(titleRow);
      rowHeights.push({ hpt: 24 });

      pushMetaRow(aoa, rowHeights, st, totalCols, "Фото на замере (Google Drive)", meta.surveyPhotosLink);
      pushMetaRow(aoa, rowHeights, st, totalCols, "Ссылка на свет (DWG)", meta.lightDwg);
      pushMetaRow(aoa, rowHeights, st, totalCols, "Ссылка на план мебели (DWG)", meta.furniturePlanDwg);
      pushMetaRow(aoa, rowHeights, st, totalCols, "Ссылка на чертежи (PDF)", meta.drawingsPdf);
      pushMetaRow(aoa, rowHeights, st, totalCols, "Ссылка на концепт", meta.conceptLink);

      pushMetaMultiField(aoa, rowHeights, st, totalCols, "Радиаторы", meta.radiators);

      // Heights row
      const otherTitle = (normStr(meta.otherLabel).trim() || "Прочее");
      if (normStr(meta.ceilingsMm).trim() || normStr(meta.doorsMm).trim() || normStr(meta.otherMm).trim()) {
        const r = new Array(totalCols).fill(cellText("", st.body));
        r[0] = cellText("Высоты (мм)", st.bodyBold);
        r[1] = cellText(
          "Потолки: " + normStr(meta.ceilingsMm).trim() +
          " | Двери: " + normStr(meta.doorsMm).trim() +
          " | " + otherTitle + ": " + normStr(meta.otherMm).trim(),
          st.body
        );
        aoa.push(r);
        rowHeights.push({ hpt: 22 });
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = colWidths;
    ws["!rows"] = rowHeights;

    const merges = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });

    if (geoStart !== -1) {
      merges.push({ s: { r: 0, c: geoStart + 1 }, e: { r: 0, c: geoEnd + 1 } });
    }

    cols.forEach((c, i) => {
      const isGeo = (geoStart !== -1 && i >= geoStart && i <= geoEnd);
      if (!isGeo) merges.push({ s: { r: 0, c: i + 1 }, e: { r: 1, c: i + 1 } });
    });

    // merge meta title row across all columns (if present)
    if (hasAnyMeta) {
      // title row index = total rows - (meta rows + ...). We find it by scanning aoa from bottom for that title.
      for (let rr = aoa.length - 1; rr >= 0; rr--) {
        const c0 = aoa[rr] && aoa[rr][0] && aoa[rr][0].v;
        if (c0 === "Файлы и ссылки проекта") {
          merges.push({ s: { r: rr, c: 0 }, e: { r: rr, c: totalCols - 1 } });
          break;
        }
      }
      // merge meta value column (B..end) for each meta row where A has label
      for (let rr = 0; rr < aoa.length; rr++) {
        const a = aoa[rr] && aoa[rr][0] && normStr(aoa[rr][0].v).trim();
        if (!a) continue;
        if (a === "Файлы и ссылки проекта") continue;
        if (a === "↳ ссылки") continue;
        if (a === "Высоты (мм)" || a === "Радиаторы" || a === "Фото на замере (Google Drive)" || a === "Ссылка на свет (DWG)" || a === "Ссылка на план мебели (DWG)" || a === "Ссылка на чертежи (PDF)" || a === "Ссылка на концепт") {
          merges.push({ s: { r: rr, c: 1 }, e: { r: rr, c: totalCols - 1 } });
        }
      }
      // merge radiators text row value
      for (let rr = 0; rr < aoa.length; rr++) {
        const a = aoa[rr] && aoa[rr][0] && normStr(aoa[rr][0].v).trim();
        if (a === "Радиаторы") merges.push({ s: { r: rr, c: 1 }, e: { r: rr, c: totalCols - 1 } });
      }
    }

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

    // also include meta links (project files)
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
        cellLink(linkDisplay(v), v, st.link)
      ]);
    });

    if (meta.radiators && Array.isArray(meta.radiators.links)) {
      meta.radiators.links.map(normStr).filter(Boolean).forEach((u) => {
        aoa.push([
          cellText("—", st.body),
          cellText("Радиаторы", st.body),
          cellLink(linkDisplay(u), u, st.link)
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 60 }];
    ws["!rows"] = [{ hpt: 24 }];
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
