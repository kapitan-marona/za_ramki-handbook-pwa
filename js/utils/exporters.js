window.Utils = window.Utils || {};

Utils.Exporters = (() => {

  // ---------------------------
  // CSV helpers
  // ---------------------------
  function escCsv(v){
    const s = (v ?? "").toString();
    // quote if contains ; or " or newline
    if(/[;"\n\r]/.test(s)){
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function download(filename, text, mime){
    const type = mime || "text/csv;charset=utf-8";
    const blob = new Blob([text], { type });
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
    // IMPORTANT: CRLF inside cell (Excel-friendly)
    return [text, ...links].filter(Boolean).join("\r\n");
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
      // a bit more "air" for Excel
      lines.push("");
      lines.push("");
      lines.push([escCsv("ФАЙЛЫ / ДОП. ИНФО")].join(sep));
      lines.push([escCsv("Параметр"), escCsv("Значение")].join(sep));
      for(const [k,v] of metaPairs){
        lines.push([k, v].map(escCsv).join(sep));
      }
    }

    // IMPORTANT: UTF-8 BOM for Excel Windows
    const body = lines.join("\r\n");
    return "\uFEFF" + body;
  }

  // ---------------------------
  // XLS (HTML) export with styles
  // ---------------------------
  function escHtml(s){
    return (s ?? "").toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textToHtmlWithLinks(cell){
    if(!cell) return "";
    const t = (cell.text || "").toString();
    const links = Array.isArray(cell.links) ? cell.links.map(x => (x||"").toString().trim()).filter(Boolean) : [];

    const textPart = t.trim()
      ? `<div class="txt">${escHtml(t).replace(/\r?\n/g, "<br/>")}</div>`
      : "";

    const linksPart = links.length
      ? `<div class="links">${links.map(u => {
          const uu = escHtml(u);
          return `<div><a href="${uu}">${uu}</a></div>`;
        }).join("")}</div>`
      : "";

    return textPart + linksPart;
  }

  function briefToXLS(state){
    const columns = [
      { key: "room", label: "Наименование помещения" },
      { key: "walls", label: "Стены, цвет" },
      { key: "floor", label: "Пол" },
      { key: "ceiling", label: "Потолок" },
      { key: "doors", label: "Двери" },
      { key: "plinth", label: "Плинтус, карниз" },
      { key: "light", label: "Свет" },
      { key: "furniture", label: "Мебель / Декор" },
      { key: "concept", label: "Ссылка на концепт" },
      { key: "notes", label: "Допы к черновикам или примечания" }
    ];

    const rooms = Array.isArray(state.rooms) ? state.rooms : [];
    const m = state.meta || {};
    const otherLabel = ((m.otherLabel || "Прочее") + "").trim() || "Прочее";

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

    const rad = m.radiators && typeof m.radiators === "object" ? m.radiators : { text:"", links:[] };
    const radVal = cellToText(rad);
    if(radVal.trim()) metaPairs.push(["Радиаторы", radVal]);

    pushIf("Высота потолков (мм)", m.ceilingsMm);
    pushIf("Высота дверей (мм)", m.doorsMm);
    pushIf(otherLabel, m.otherMm);

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>TZ</x:Name>
          <x:WorksheetOptions>
            <x:Print><x:ValidPrinterInfo/></x:Print>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->

  <style>
    body { font-family: Calibri, Arial, sans-serif; }
    table { border-collapse: collapse; }
    .grid td, .grid th { border: 1px solid #d9d9d9; padding: 6px 8px; vertical-align: top; }
    .grid th {
      font-weight: 700;
      font-size: 12.5pt;
      background: #1f2937;
      color: #ffffff;
      text-align: left;
      white-space: nowrap;
    }
    .grid td { font-size: 10.5pt; line-height: 1.25; }
    .room { font-weight: 700; white-space: nowrap; background: #f8fafc; }
    .txt { margin-bottom: 6px; }
    .links a { color: #0563C1; text-decoration: underline; }
    .metaTitle { font-weight: 800; font-size: 13pt; padding-top: 12px; }
    .meta td { border: 1px solid #d9d9d9; padding: 6px 8px; font-size: 10.5pt; vertical-align: top; }
    .metaKey { width: 320px; font-weight: 700; background: #f3f4f6; }
    .metaVal { width: 900px; }
  </style>
</head>
<body>
  <table class="grid">
    <tr>
      ${columns.map(c => `<th>${escHtml(c.label)}</th>`).join("")}
    </tr>
    ${rooms.map(r => `
      <tr>
        ${columns.map(c => {
          if (c.key === "room") return `<td class="room">${escHtml(r?.name || "")}</td>`;
          return `<td>${textToHtmlWithLinks(r?.[c.key])}</td>`;
        }).join("")}
      </tr>
    `).join("")}
  </table>

  ${metaPairs.length ? `
    <div class="metaTitle">ФАЙЛЫ / ДОП. ИНФО</div>
    <table class="meta" style="margin-top:10px;">
      <tr><td class="metaKey">Параметр</td><td class="metaVal"><b>Значение</b></td></tr>
      ${metaPairs.map(([k,v]) => {
        const vv = (v ?? "").toString().trim();
        const isUrl = /^https?:\/\/\S+$/i.test(vv);
        const safeVal = escHtml(vv).replace(/\r?\n/g, "<br/>");
        const vHtml = isUrl ? `<a href="${escHtml(vv)}">${escHtml(vv)}</a>` : safeVal;
        return `<tr><td class="metaKey">${escHtml(k)}</td><td class="metaVal">${vHtml}</td></tr>`;
      }).join("")}
    </table>
  ` : ""}
</body>
</html>`.trim();

    return html;
  }

  function briefDownloadXLS(filename, state){
    const html = briefToXLS(state);
    // BOM helps Excel detect UTF-8
    const payload = "\uFEFF" + html;
    download(filename, payload, "application/vnd.ms-excel;charset=utf-8");
  }

  return { download, briefToCSV, briefDownloadXLS };
})();
