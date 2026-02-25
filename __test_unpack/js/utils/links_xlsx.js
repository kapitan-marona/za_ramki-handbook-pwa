window.Utils = window.Utils || {};

Utils.LinksXLSX = (() => {
  async function ensureXLSXLoaded(){
    if(window.XLSX && window.XLSX.utils) return window.XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "./js/vendor/xlsx.bundle.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("xlsx.bundle.js not loaded"));
      document.head.appendChild(s);
    });
    if(!window.XLSX || !window.XLSX.utils) throw new Error("XLSX not available after load");
    return window.XLSX;
  }

  function isLikelyUrl(v){
    const s = (v || "").toString().trim();
    if(!s) return false;
    return /^https?:\/\/\S+/i.test(s);
  }

  // rows: [{label, value}], filename: "BaseName" (without .xlsx), address: string
  async function downloadLinksXLSX(rows, filename, address){
    const XLSX = await ensureXLSXLoaded();
    const wb = XLSX.utils.book_new();

    const addr = (address || "").toString().trim();

    // Build AOA:
    // Row1: Address (optional)
    // Row2: empty
    // Row3: headers
    // Row4..: data
    const aoa = [];
    if(addr){
      aoa.push(["Адрес объекта", addr]);
      aoa.push(["", ""]);
    }
    aoa.push(["Поле", "Ссылка"]);

    (rows || []).forEach(r => {
      const label = (r.label || "").toString();
      const value = (r.value || "").toString();
      if(label === "Адрес объекта") return; // address already above
      aoa.push([label, value]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws["!cols"] = [{ wch: 34 }, { wch: 90 }];

    // Styles (works if your xlsx bundle supports cell styles; if not, links still work)
    const headerRowIdx = (addr ? 3 : 1); // 1-based
    const headerA = XLSX.utils.encode_cell({ r: headerRowIdx - 1, c: 0 });
    const headerB = XLSX.utils.encode_cell({ r: headerRowIdx - 1, c: 1 });

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "C03A14" } },
      alignment: { vertical: "center", horizontal: "left", wrapText: true }
    };

    if(ws[headerA]) ws[headerA].s = headerStyle;
    if(ws[headerB]) ws[headerB].s = headerStyle;

    // Address label bold (if address exists)
    if(addr){
      const a1 = XLSX.utils.encode_cell({ r: 0, c: 0 });
      const b1 = XLSX.utils.encode_cell({ r: 0, c: 1 });
      if(ws[a1]) ws[a1].s = { font: { bold: true }, alignment: { vertical: "center" } };
      if(ws[b1]) ws[b1].s = { alignment: { vertical: "center", wrapText: true } };
    }

    // Make hyperlinks clickable in column B below header
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for(let r = headerRowIdx; r <= range.e.r + 1; r++){
      // r is 1-based row number; convert to 0-based for encode_cell
      const cellAddr = XLSX.utils.encode_cell({ r: r - 1, c: 1 });
      const cell = ws[cellAddr];
      if(!cell) continue;

      const val = (cell.v || "").toString().trim();
      if(isLikelyUrl(val)){
        cell.l = { Target: val };
        // Let Excel apply default hyperlink appearance (blue/underlined)
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "LINKS");

    const base = (filename && String(filename).trim()) ? String(filename).trim() : "Project_Links";
    const out = base.toLowerCase().endsWith(".xlsx") ? base : (base + ".xlsx");
    XLSX.writeFile(wb, out, { bookType: "xlsx", compression: true });
  }

  return { downloadLinksXLSX };
})();
