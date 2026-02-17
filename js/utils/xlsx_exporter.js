window.Utils = window.Utils || {};
Utils.Exporters = Utils.Exporters || {};

Utils.XLSXExport = (() => {
  const VENDOR_SRC = "./js/vendor/xlsx.bundle.js";

  function hexToRgbNoHash(hex){
    const h = (hex || "").toString().trim().replace("#","");
    if(h.length === 3){
      const r = h[0]+h[0], g = h[1]+h[1], b = h[2]+h[2];
      return (r+g+b).toUpperCase();
    }
    if(h.length === 6) return h.toUpperCase();
    return null;
  }

  function asText(v){ return (v ?? "").toString(); }

  function cellToText(cell){
    const c = cell || { text:"", links:[] };
    const text = asText(c.text).trim();
    const links = Array.isArray(c.links) ? c.links.map(x => asText(x).trim()).filter(Boolean) : [];
    return [text, ...links].filter(Boolean).join("\n");
  }

  function flattenLinks(state){
    const rows = [];
    const rooms = Array.isArray(state.rooms) ? state.rooms : [];
    const order = [
      ["walls","Стены, цвет"],
      ["floor","Пол"],
      ["ceiling","Потолок"],
      ["doors","Двери"],
      ["plinth","Плинтус, карниз"],
      ["light","Свет"],
      ["furniture","Мебель / Декор"],
      ["concept","Ссылка на концепт"],
      ["notes","Допы / примечания"]
    ];

    for(let i=0;i<rooms.length;i++){
      const r = rooms[i] || {};
      const roomName = asText(r.name).trim() || `Помещение ${i+1}`;
      for(const [key,label] of order){
        const cell = r[key] || {text:"",links:[]};
        const links = Array.isArray(cell.links) ? cell.links.map(x => asText(x).trim()).filter(Boolean) : [];
        for(const url of links){
          rows.push({ room: roomName, field: label, url });
        }
      }
    }

    // meta links тоже добавим
    const m = state.meta || {};
    const metaLinks = [
      ["Фото на замере (Google Drive)", m.surveyPhotosLink],
      ["Ссылка на свет (DWG)", m.lightDwg],
      ["Ссылка на план мебели (DWG)", m.furniturePlanDwg],
      ["Ссылка на чертежи (PDF)", m.drawingsPdf],
      ["Ссылка на концепт", m.conceptLink],
    ];
    for(const [label,val] of metaLinks){
      const url = asText(val).trim();
      if(/^https?:\/\//i.test(url)) rows.push({ room: "ФАЙЛЫ / ДОП. ИНФО", field: label, url });
    }

    // radiators multi
    const rad = (m.radiators && typeof m.radiators === "object") ? m.radiators : {text:"",links:[]};
    const radLinks = Array.isArray(rad.links) ? rad.links.map(x=>asText(x).trim()).filter(Boolean) : [];
    for(const url of radLinks){
      rows.push({ room: "ФАЙЛЫ / ДОП. ИНФО", field: "Радиаторы", url });
    }

    return rows;
  }

  function ensureXLSX(){
    if(window.XLSX) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = VENDOR_SRC;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error("Failed to load XLSX vendor: " + VENDOR_SRC));
      document.head.appendChild(s);
    });
  }

  function downloadBlob(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function buildWorkbook(state){
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    // -------------------------
    // Sheet 1: BRIEF (main)
    // -------------------------
    const headers = [
      "Наименование помещения",
      "Стены, цвет","Пол","Потолок","Двери","Плинтус, карниз",
      "Свет","Мебель / Декор","Ссылка на концепт","Допы к черновикам или примечания"
    ];

    const rooms = Array.isArray(state.rooms) ? state.rooms : [];
    const order = ["walls","floor","ceiling","doors","plinth","light","furniture","concept","notes"];

    const aoa = [];
    aoa.push(headers);

    for(const r of rooms){
      const row = [];
      row.push(asText(r?.name || ""));
      for(const key of order){
        row.push(cellToText(r?.[key]));
      }
      aoa.push(row);
    }

    // meta block (как “таблица параметр/значение” ниже)
    aoa.push([]);
    aoa.push(["ФАЙЛЫ / ДОП. ИНФО",""]);
    aoa.push(["Параметр","Значение"]);

    const m = state.meta || {};
    const pushIf = (k,v) => {
      const s = asText(v).trim();
      if(s) aoa.push([k, s]);
    };

    pushIf("Фото на замере (Google Drive)", m.surveyPhotosLink);
    pushIf("Ссылка на свет (DWG)", m.lightDwg);
    pushIf("Ссылка на план мебели (DWG)", m.furniturePlanDwg);
    pushIf("Ссылка на чертежи (PDF)", m.drawingsPdf);
    pushIf("Ссылка на концепт", m.conceptLink);

    // Радиаторы (text+links)
    const rad = (m.radiators && typeof m.radiators === "object") ? m.radiators : {text:"",links:[]};
    const radVal = cellToText(rad).trim();
    if(radVal) aoa.push(["Радиаторы", radVal]);

    pushIf("Высота потолков (мм)", m.ceilingsMm);
    pushIf("Высота дверей (мм)", m.doorsMm);
    {
      const label = (asText(m.otherLabel || "Прочее").trim() || "Прочее");
      pushIf(label, m.otherMm);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // widths (wch ~ characters)
    ws["!cols"] = [
      { wch: 28 }, // room
      { wch: 26 },{ wch: 22 },{ wch: 22 },{ wch: 22 },{ wch: 24 },
      { wch: 22 },{ wch: 24 },{ wch: 26 },{ wch: 28 }
    ];

    // header style
    const headerStyle = {
      font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "111827" } },
      alignment: { vertical: "top", horizontal: "left", wrapText: true }
    };

    // body style
    const bodyStyle = {
      font: { sz: 12, color: { rgb: "111827" } },
      alignment: { vertical: "top", horizontal: "left", wrapText: true }
    };

    // first col style (room name)
    const roomStyle = {
      font: { bold: true, sz: 12, color: { rgb: "111827" } },
      alignment: { vertical: "top", horizontal: "left", wrapText: true }
    };

    // Apply styles (xlsx-js-style supports cell.s)
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for(let R = range.s.r; R <= range.e.r; ++R){
      for(let C = range.s.c; C <= range.e.c; ++C){
        const addr = XLSX.utils.encode_cell({r:R,c:C});
        const cell = ws[addr];
        if(!cell) continue;

        if(R === 0){
          cell.s = headerStyle;
        } else {
          cell.s = (C === 0) ? roomStyle : bodyStyle;
        }
      }
    }

    // Row accent fills in first column for rooms only (using __bg or palette)
    const palette = ["#FDE68A","#BFDBFE","#FBCFE8","#BBF7D0","#DDD6FE","#FED7AA","#A7F3D0"];
    for(let i=0;i<rooms.length;i++){
      const r = rooms[i] || {};
      const colorHex = (r.__bg || palette[i % palette.length] || "").toString();
      const rgb = hexToRgbNoHash(colorHex);
      if(!rgb) continue;

      const R = 1 + i; // data rows start at row 1
      const addr = XLSX.utils.encode_cell({r:R,c:0});
      if(ws[addr]){
        ws[addr].s = ws[addr].s || roomStyle;
        ws[addr].s = {
          ...ws[addr].s,
          fill: { patternType: "solid", fgColor: { rgb } }
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "BRIEF");

    // -------------------------
    // Sheet 2: LINKS (each link in its own row, clickable)
    // -------------------------
    const links = flattenLinks(state);
    const linksAoa = [["Помещение","Поле","Ссылка"]];
    for(const x of links){
      linksAoa.push([x.room, x.field, x.url]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(linksAoa);
    ws2["!cols"] = [{wch:30},{wch:26},{wch:60}];

    const linkHeader = headerStyle;
    const linkBody = bodyStyle;
    const linkStyle = {
      font: { sz: 12, color: { rgb: "1D4ED8" }, underline: true },
      alignment: { vertical: "top", horizontal: "left", wrapText: true }
    };

    const r2 = XLSX.utils.decode_range(ws2["!ref"]);
    for(let R = r2.s.r; R <= r2.e.r; ++R){
      for(let C = r2.s.c; C <= r2.e.c; ++C){
        const addr = XLSX.utils.encode_cell({r:R,c:C});
        const cell = ws2[addr];
        if(!cell) continue;
        if(R === 0){
          cell.s = linkHeader;
        } else {
          cell.s = (C === 2) ? linkStyle : linkBody;
          if(C === 2){
            const url = asText(cell.v).trim();
            if(/^https?:\/\//i.test(url)){
              cell.l = { Target: url, Tooltip: url };
            }
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws2, "LINKS");

    return wb;
  }

  async function downloadXLSX(state, filename){
    await ensureXLSX();
    const wb = buildWorkbook(state);

    // array -> Blob
    const out = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    downloadBlob(filename || "TZ_vizualizatoru_PRO.xlsx", blob);
  }

  return { downloadXLSX, ensureXLSX };
})();

// Convenience hook for existing UI (if BriefPro calls briefDownloadXLS)
// We'll keep the old HTML-xls as fallback in Utils.Exporters.briefDownloadXLS_legacy (if exists)
(function(){
  const legacy = Utils.Exporters.briefDownloadXLS;
  if(legacy) Utils.Exporters.briefDownloadXLS_legacy = legacy;

  // override: now "Скачать Excel" делает XLSX
  Utils.Exporters.briefDownloadXLS = function(state){
    // fire-and-forget
    Utils.XLSXExport.downloadXLSX(state, "TZ_vizualizatoru_PRO.xlsx").catch((e) => {
      console.error(e);
      // fallback to legacy if possible
      if(Utils.Exporters.briefDownloadXLS_legacy){
        Utils.Exporters.briefDownloadXLS_legacy(state);
      } else {
        alert("Не удалось скачать XLSX. Открой консоль (F12) и пришли ошибку.");
      }
    });
  };
})();
