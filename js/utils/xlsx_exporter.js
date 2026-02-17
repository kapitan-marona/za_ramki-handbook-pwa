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
    // Accept http(s) + mailto + tel + bare domain (we'll try to normalize)
    if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(s)) return "https://" + s;
    return s; // fallback (still try as target)
  }

  function cellText(v, style) {
    return { t: "s", v: normStr(v), s: style || undefined };
  }

  function cellLink(display, url, style) {
    const target = safeUrl(url);
    const c = { t: "s", v: normStr(display), s: style || undefined };
    if (target) {
      // SheetJS hyperlink
      c.l = { Target: target, Tooltip: target };
    }
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
      fill: { patternType: "solid", fgColor: { rgb: "1F2937" } }, // dark
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

    return { head, body, firstCol, link, metaHead };
  }

  function hexToRGB(hex) {
    const h = normStr(hex).trim().replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(h)) return "";
    return h.toUpperCase();
  }

  // Try to extract BriefPro table data from state in a defensive way.
  // We support a few common shapes without breaking if something differs.
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
    const columns =
      bp.columns ||
      bp.fields ||
      bp.headers ||
      s.columns ||
      [
        { key: "walls", label: "Стены" },
        { key: "floor", label: "Пол" },
        { key: "ceiling", label: "Потолок" },
        { key: "doors", label: "Двери" },
        { key: "plinth", label: "Плинтус" },
        { key: "light", label: "Свет" },
        { key: "furniture", label: "Мебель" },
        { key: "concept", label: "Концепт" },
        { key: "notes", label: "Примечания" }
      ];

    // Meta / links blocks (optional)
    const meta = bp.meta || s.meta || {};
    const radiators = bp.radiators || s.radiators || [];
    const ceilings = bp.ceilings || s.ceilings || {};
    const doors = bp.doors || s.doors || {};
    const other = bp.other || s.other || {};
    const otherLabel = bp.otherLabel || s.otherLabel || "Другое";

    return { rooms, columns, meta, radiators, ceilings, doors, other, otherLabel };
  }

  function extractCellValue(room, colKey) {
    // Try typical shapes:
    // room[colKey] could be string OR { text, links } OR { value, links } OR { items: [...] } etc.
    const raw = room ? room[colKey] : "";
    if (raw === null || raw === undefined) return { text: "", links: [] };

    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      return { text: normStr(raw), links: [] };
    }

    // common MultiField shape
    const text =
      normStr(raw.text ?? raw.value ?? raw.note ?? raw.content ?? raw.main ?? "");

    let links = raw.links || raw.urls || raw.hrefs || [];
    if (typeof links === "string") links = [links];
    if (!Array.isArray(links)) links = [];

    // also support items array like [{text, links}]
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
    const headRow = [
      cellText("Помещение", st.head),
      ...columns.map((c) => cellText(normStr(c.label ?? c.title ?? c.key ?? ""), st.head))
    ];

    const aoa = [headRow];

    // widths: stable + “designer friendly”
    const colWidths = [];
    colWidths.push({ wch: 26 }); // room column
    columns.forEach((c) => {
      const key = normStr(c.key ?? c.id ?? c.name ?? "");
      // heuristic widths
      let wch = 22;
      if (/notes|comment|remark|примеч/i.test(key)) wch = 40;
      if (/concept|концеп/i.test(key)) wch = 28;
      if (/light|свет/i.test(key)) wch = 18;
      if (/furniture|мебель/i.test(key)) wch = 22;
      if (/walls|стены/i.test(key)) wch = 24;
      if (/ceiling|потол/i.test(key)) wch = 20;
      if (/floor|пол/i.test(key)) wch = 20;
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

        // If exactly one link and no other link noise → make it clickable in BRIEF
        if (links && links.length === 1) {
          const display = text ? text : links[0];
          row.push(cellLink(display, links[0], st.link));
        } else {
          // Keep text; links are detailed in LINKS sheet
          let v = text || "";
          if (links && links.length > 0) {
            // Add plain text refs to hint designer
            v = (v ? v + "\n" : "") + links.map((u) => normStr(u)).join("\n");
          }
          row.push(cellText(v, st.body));
        }
      });

      aoa.push(row);
    });

    // meta block below (optional but kept as you had)
    aoa.push([cellText("", null)]);
    aoa.push([cellText("Файлы и ссылки проекта", st.metaHead)]);
    const metaPairs = [];

    // Try to flatten meta
    if (model.meta && typeof model.meta === "object") {
      Object.keys(model.meta).forEach((k) => {
        const v = model.meta[k];
        if (v === null || v === undefined) return;
        metaPairs.push([k, normStr(v)]);
      });
    }

    // Radiators & heights (best-effort)
    if (Array.isArray(model.radiators) && model.radiators.length) {
      metaPairs.push(["Радиаторы", model.radiators.map(normStr).join(" | ")]);
    }

    if (model.ceilings && Object.keys(model.ceilings).length) {
      metaPairs.push(["Высоты (ceiling)", JSON.stringify(model.ceilings)]);
    }
    if (model.doors && Object.keys(model.doors).length) {
      metaPairs.push(["Высоты (doors)", JSON.stringify(model.doors)]);
    }
    if (model.other && Object.keys(model.other).length) {
      metaPairs.push([model.otherLabel || "Другое", JSON.stringify(model.other)]);
    }

    metaPairs.forEach(([k, v]) => {
      aoa.push([cellText(normStr(k), st.body), cellText(normStr(v), st.body)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply column widths
    ws["!cols"] = colWidths;

    // Slightly taller header row for readability
    ws["!rows"] = [{ hpt: 26 }];

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
            // IMPORTANT: hyperlink lives in .l.Target
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
    ws["!rows"] = [{ hpt: 26 }];
    return ws;
  }

  async function downloadXLSX(state, filename) {
    const XLSX = await ensureXLSXLoaded();

    const model = getBriefProModel(state);

    const wb = XLSX.utils.book_new();
    const wsBrief = buildBriefSheet(XLSX, model);
    const wsLinks = buildLinksSheet(XLSX, model);

    XLSX.utils.book_append_sheet(wb, wsBrief, "BRIEF");
    XLSX.utils.book_append_sheet(wb, wsLinks, "LINKS");

    const name = (filename && String(filename).trim()) ? String(filename).trim() : "BriefPro";
    const out = name.toLowerCase().endsWith(".xlsx") ? name : (name + ".xlsx");

    // writeFile from SheetJS
    XLSX.writeFile(wb, out, { bookType: "xlsx", compression: true });
  }

  window.Utils.XLSXExport = {
    downloadXLSX
  };
})();
