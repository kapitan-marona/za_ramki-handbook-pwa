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
      s.onload = () => {
        if (window.XLSX && window.XLSX.utils) resolve(window.XLSX);
        else reject(new Error("XLSX bundle loaded but window.XLSX is missing"));
      };
      s.onerror = () => reject(new Error("Failed to load XLSX vendor: " + VENDOR_PATH));
      document.head.appendChild(s);
    });
  }

  // ---------- helpers ----------
  const FONT_BODY = "Calibri";
  const FONT_SIZE_BODY = 12;
  const FONT_SIZE_HEAD = 16;

  function normStr(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function safeUrl(url) {
    const s = normStr(url).trim();
    if (!s) return "";
    if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(s)) return "https://" + s;
    return s;
  }

  function cellText(v, style) {
    return { t: "s", v: normStr(v), s: style || undefined };
  }

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
      font: { name: FONT_BODY, sz: FONT_SIZE_BODY, bold: false, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    const firstCol = (rgb) => ({
      font: { name: FONT_BODY, sz: FONT_SIZE_BODY, bold: true, color: { rgb: "111827" } },
      fill: { patternType: "solid", fgColor: { rgb: rgb || "E5E7EB" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    });

    const link = {
      font: { name: FONT_BODY, sz: FONT_SIZE_BODY, color: { rgb: "1D4ED8" }, underline: true },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: borderThin
    };

    const metaHead = {
      font: { name: FONT_BODY, sz: 14, bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true }
    };

    return { head, groupHead, body, firstCol, link, metaHead };
  }

  function hexToRGB(hex) {
    const h = normStr(hex).trim().replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(h)) return "";
    return h.toUpperCase();
  }

  function getBriefProModel(state) {
    const s = state || {};
    const bp =
      s.briefPro ||
      s.brief_pro ||
      s.brief ||
      s.briefpro ||
      (s.data && (s.data.briefPro || s.data.brief_pro)) ||
      {};

    const rooms = bp.rooms || bp.rows || bp.items || s.rooms || [];

    // ВАЖНО: дефолтные заголовки — кириллица
    const columns =
      bp.columns ||
      bp.fields ||
      bp.headers ||
      s.columns ||
      [
        { key: "g_depth",  label: "Глубина" },
        { key: "g_width",  label: "Ширина" },
        { key: "g_height", label: "Высота" },
        { key: "g_area",   label: "Площадь" },
        { key: "g_notes",  label: "Примечания к геометрии" },
        { key: "walls",    label: "Стены" },
        { key: "floor",    label: "Пол" },
        { key: "ceiling",  label: "Потолок" },
        { key: "doors",    label: "Двери" },
        { key: "plinth",   label: "Плинтус" },
        { key: "light",    label: "Свет" },
        { key: "furniture",label: "Мебель" },
        { key: "concept",  label: "Концепт" },
        { key: "notes",    label: "Примечания" }
      ];

    const meta = bp.meta || s.meta || {};
    const radiators = bp.radiators || s.radiators || [];
    const ceilings = bp.ceilings || s.ceilings || {};
    const doors = bp.doors || s.doors || {};
    const other = bp.other || s.other || {};
    const otherLabel = bp.otherLabel || s.otherLabel || "Прочее";

    return { rooms, columns, meta, radiators, ceilings, doors, other, otherLabel };
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

    if ((!text || text === "") && Array.isArray(raw.items) && raw.items.length) {
      const parts = [];
      const allLinks = [];
      raw.items.forEach((it) => {
        if (!it) return;
        const t = normStr(it.text ?? it.value ?? "");
        if (t) parts.push(t);
        const l = it.links || it.urls || [];
        if (Array.isArray(l)) allLinks.push(...l);
      });
      return { text: parts.join("\n"), links: allLinks.filter(Boolean) };
    }

    return { text, links: links.filter(Boolean) };
  }

  function buildBriefSheet(XLSX, model) {
    const st = makeStyles();
    const columns = model.columns || [];

    // --- Header with group merge: columns 2..6 => "Геометрия помещения"
    // Excel columns: A=Помещение, B..F=2..6 (5 cols)
    const headerRow1 = [cellText("Помещение", st.head)];
    const headerRow2 = [cellText("", st.head)];

    columns.forEach((c, idx) => {
      const label = normStr(c.label ?? c.title ?? c.key ?? "");
      const colIndex1Based = idx + 1; // B is 1 here (since A already added)
      // idx 0..4 => B..F group
      if (idx >= 0 && idx <= 4) {
        headerRow1.push(cellText(idx === 0 ? "Геометрия помещения" : "", st.groupHead));
        headerRow2.push(cellText(label, st.head));
      } else {
        headerRow1.push(cellText(label, st.head));
        headerRow2.push(cellText("", st.head));
      }
    });

    const aoa = [headerRow1, headerRow2];

    // widths: stable
    const colWidths = [];
    colWidths.push({ wch: 26 }); // помещение

    columns.forEach((c, idx) => {
      const key = normStr(c.key ?? c.id ?? c.name ?? "");
      let wch = 22;

      // geometry a bit narrower
      if (idx >= 0 && idx <= 4) wch = 16;

      if (/notes|comment|remark|примеч/i.test(key)) wch = 40;
      if (/concept|концеп/i.test(key)) wch = 28;

      colWidths.push({ wch });
    });

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    rooms.forEach((room) => {
      const roomName = normStr(room?.title ?? room?.name ?? room?.room ?? "");
      const bg = hexToRGB(room?.__bg || room?.bg || room?.color || "");
      const roomStyle = st.firstCol(bg || "E5E7EB");

      const row = [cellText(roomName, roomStyle)];

      columns.forEach((c) => {
        const key = normStr(c.key ?? c.id ?? c.name ?? "");
        const { text, links } = extractCellValue(room, key);

        // ✅ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
        // 1) если есть текст — он ВСЕГДА остаётся обычным текстом (НЕ hyperlink)
        // 2) hyperlink делаем ТОЛЬКО если текста нет, но есть 1 ссылка (то есть пользователь ввёл именно ссылку)
        if (!text && links && links.length === 1) {
          row.push(cellLink(links[0], links[0], st.link));
        } else {
          let v = text || "";
          if (links && links.length > 0) {
            v = (v ? v + "\n" : "") + links.map((u) => normStr(u)).join("\n");
          }
          row.push(cellText(v, st.body));
        }
      });

      aoa.push(row);
    });

    // meta block below
    aoa.push([cellText("", null)]);
    aoa.push([cellText("Файлы и ссылки проекта", st.metaHead)]);

    const metaPairs = [];
    if (model.meta && typeof model.meta === "object") {
      Object.keys(model.meta).forEach((k) => {
        const v = model.meta[k];
        if (v === null || v === undefined) return;
        metaPairs.push([k, normStr(v)]);
      });
    }

    if (Array.isArray(model.radiators) && model.radiators.length) {
      metaPairs.push(["Радиаторы", model.radiators.map(normStr).join(" | ")]);
    }

    if (model.ceilings && Object.keys(model.ceilings).length) {
      metaPairs.push(["Высоты (потолки)", JSON.stringify(model.ceilings)]);
    }
    if (model.doors && Object.keys(model.doors).length) {
      metaPairs.push(["Высоты (двери)", JSON.stringify(model.doors)]);
    }
    if (model.other && Object.keys(model.other).length) {
      metaPairs.push([model.otherLabel || "Прочее", JSON.stringify(model.other)]);
    }

    metaPairs.forEach(([k, v]) => {
      aoa.push([cellText(normStr(k), st.body), cellText(normStr(v), st.body)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws["!cols"] = colWidths;
    ws["!rows"] = [{ hpt: 24 }, { hpt: 22 }]; // two header rows

    // merges:
    // A1:A2 (Помещение)
    // B1:F1 (Геометрия помещения)
    // G1:G2, H1:H2, ... for all columns after geometry group
    const merges = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }); // A1:A2
    merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 5 } }); // B1:F1

    const totalCols = 1 + columns.length; // A + columns
    for (let c = 6; c < totalCols; c++) { // from G (0-based: 6) to end
      merges.push({ s: { r: 0, c }, e: { r: 1, c } });
    }
    ws["!merges"] = merges;

    return ws;
  }

  function buildLinksSheet(XLSX, model) {
    const st = makeStyles();
    const columns = model.columns || [];

    const aoa = [
      [
        cellText("Помещение", st.head),
        cellText("Поле", st.head),
        cellText("Текст", st.head),
        cellText("Ссылка", st.head)
      ]
    ];

    const rooms = Array.isArray(model.rooms) ? model.rooms : [];
    rooms.forEach((room) => {
      const roomName = normStr(room?.title ?? room?.name ?? room?.room ?? "");
      columns.forEach((c) => {
        const key = normStr(c.key ?? c.id ?? c.name ?? "");
        const label = normStr(c.label ?? c.title ?? key);
        const { text, links } = extractCellValue(room, key);
        if (!links || !links.length) return;

        links.forEach((u) => {
          const url = normStr(u);
          aoa.push([
            cellText(roomName, st.body),
            cellText(label, st.body),
            cellText(text, st.body),
            // hyperlink
            cellLink(url, url, st.link)
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 26 },
      { wch: 22 },
      { wch: 40 },
      { wch: 60 }
    ];
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
