window.Utils = window.Utils || {};

Utils.Exporters = (() => {

  function escCsv(v){
    const s = (v ?? "").toString();
    // CSV with semicolon for RU locales (Excel-friendly)
    // quote if contains ; or " or newline
    if(/[;"\n\r]/.test(s)){
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function download(filename, text){
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function cellToText(cell){
    const c = cell || { text:"", links:[] };
    const text = (c.text || "").toString().trim();
    const links = Array.isArray(c.links) ? c.links.map(x => (x||"").toString().trim()).filter(Boolean) : [];
    return [text, ...links].filter(Boolean).join("\n");
  }

  // rooms: array from brief_pro state
  function briefToCSV(state){
    const sep = ";";
    const headers = [
      "Наименование помещения",
      "Стены, цвет",
      "Пол",
      "Потолок",
      "Двери",
      "Плинтус, карниз",
      "Свет",
      "Мебель / Декор",
      "Ссылка на концепт",
      "Допы к черновикам или примечания"
    ];

    const lines = [];
    lines.push(headers.map(escCsv).join(sep));

    const rooms = Array.isArray(state.rooms) ? state.rooms : [];
    for(const r of rooms){
      const row = [];
      row.push(r?.name || "");

      // order must match headers above
      const order = ["walls","floor","ceiling","doors","plinth","light","furniture","concept","notes"];
      for(const key of order){
        const cellValue = cellToText(r?.[key]);
        row.push(cellValue);
      }

      lines.push(row.map(escCsv).join(sep));
    }

    // --- Meta block below (same CSV file) ---
    const m = state.meta || {};

    const metaPairs = [];

    const pushIf = (k,v) => {
      const s = (v ?? "").toString().trim();
      if(s) metaPairs.push([k, s]);
    };

    pushIf("Фото на замере (Google Drive)", m.surveyPhotosLink);
    pushIf("Ссылка на свет (DWG)", m.lightDwg);
    pushIf("Ссылка на план мебели (DWG)", m.furniturePlanDwg);
    pushIf("Ссылка на чертежи (PDF)", m.drawingsPdf);
    pushIf("Ссылка на концепт", m.conceptLink);

    // Радиаторы: text + links (multi)
    const rad = m.radiators && typeof m.radiators === "object" ? m.radiators : { text:"", links:[] };
    const radValue = cellToText(rad);
    if(radValue.trim()) metaPairs.push(["Радиаторы", radValue]);

    // Высоты / прочее
    pushIf("Высота потолков (мм)", m.ceilingsMm);
    pushIf("Высота дверей (мм)", m.doorsMm);
    {
      const label = ((m.otherLabel || "Прочее") + "").trim() || "Прочее";
      pushIf(label, m.otherMm);
    }

    if(metaPairs.length){
      lines.push(""); // empty row
      lines.push(escCsv("ФАЙЛЫ / ДОП. ИНФО")); // section title (single cell)
      for(const [k,v] of metaPairs){
        lines.push([k, v].map(escCsv).join(sep));
      }
    }

    return lines.join("\r\n");
  }

  return { download, briefToCSV };
})();

