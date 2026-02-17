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

  // rooms: array from brief_pro state
  // columns: [{key,label}, ...] (except room name handled separately)
  function briefToCSV(state, columns){
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
        const cell = r?.[key] || { text:"", links:[] };
        const text = (cell.text || "").trim();
        const links = Array.isArray(cell.links) ? cell.links.map(x => (x||"").trim()).filter(Boolean) : [];
        // Put multiple links on new lines inside the same cell
        const cellValue = [text, ...links].filter(Boolean).join("\n");
        row.push(cellValue);
      }

      lines.push(row.map(escCsv).join(sep));
    }

    // Add meta block below as separate section (optional)
    const m = state.meta || {};
    const metaPairs = [
      ["Фото на замере (Google Drive)", m.surveyPhotosLink],
      ["Ссылка на свет (DWG)", m.lightDwg],
      ["Ссылка на план мебели (DWG)", m.furniturePlanDwg],
      ["Ссылка на чертежи (PDF)", m.drawingsPdf],
      ["Ссылка на концепт", m.conceptLink],
      ["Радиаторы", m.radiators],
      ["Потолки / двери / прочее", m.ceilingsDoorsEtc],
    ].filter(([,v]) => (v||"").toString().trim().length > 0);

    if(metaPairs.length){
      lines.push(""); // empty row
      lines.push(escCsv("ФАЙЛЫ / ДОП. ИНФО")); // section title
      for(const [k,v] of metaPairs){
        lines.push([k, v].map(escCsv).join(sep));
      }
    }

    return lines.join("\r\n");
  }

  return { download, briefToCSV };
})();
