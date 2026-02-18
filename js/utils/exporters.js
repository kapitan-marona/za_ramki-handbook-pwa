window.Utils = window.Utils || {};

Utils.Exporters = (() => {

  // ---------------------------
  // CSV helpers (Excel-friendly)
  // ---------------------------
  function escCsv(v){
    const s = (v ?? "").toString();
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
    return [text, ...links].filter(Boolean).join("\r\n"); // CRLF inside cell
  }

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
      const order = ["walls","floor","ceiling","doors","plinth","light","furniture","concept","notes"];
      for(const key of order){
        row.push(cellToText(r?.[key]));
      }
      lines.push(row.map(escCsv).join(sep));
    }

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

    const rad = m.radiators && typeof m.radiators === "object" ? m.radiators : { text:"", links:[] };
    const radValue = cellToText(rad);
    if(radValue.trim()) metaPairs.push(["Радиаторы", radValue]);

    pushIf("Высота потолков (мм)", m.ceilingsMm);
    pushIf("Высота дверей (мм)", m.doorsMm);
    {
      const label = ((m.otherLabel || "Прочее") + "").trim() || "Прочее";
      pushIf(label, m.otherMm);
    }

    if(metaPairs.length){
      lines.push("");
      lines.push("");
      lines.push([escCsv("ФАЙЛЫ / ДОП. ИНФО")].join(sep));
      lines.push([escCsv("Параметр"), escCsv("Значение")].join(sep));
      for(const [k,v] of metaPairs){
        lines.push([k, v].map(escCsv).join(sep));
      }
    }

    return "\uFEFF" + lines.join("\r\n"); // UTF-8 BOM
  }

  // ---------------------------
  // XLS (HTML) export with styles + Links matrix
  // ---------------------------
  const PALETTE = [
    "#F8FAFC", "#F1F5F9", "#FAFAF9", "#FDF2F8", "#ECFDF5",
    "#EFF6FF", "#FFFBEB", "#F5F3FF", "#FFF1F2", "#F0FDFA"
  ];

  function escHtml(s){
    return (s ?? "").toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isUrlLine(line){
    return /^https?:\/\/\S+$/i.test((line||"").trim());
  }

  function lineToHtml(line){
    const l = (line||"").trim();
    if(!l) return "";
    if(isUrlLine(l)){
      const u = escHtml(l);
      return `<a href="${u}">${u}</a>`;
    }
    return escHtml(l);
  }

  // Main cell: text + links, URL lines inside text also clickable
  function cellToHtml(cell){
    const c = cell || { text:"", links:[] };
    const t = (c.text || "").toString();
    const links = Array.isArray(c.links) ? c.links.map(x => (x||"").toString().trim()).filter(Boolean) : [];

    const textLines = t.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const textHtml = textLines.length
      ? `<div class="txt">${textLines.map(lineToHtml).join("<br/>")}</div>`
      : "";

    const linksHtml = links.length
      ? `<div class="links">${links.map(u => {
          const uu = escHtml(u);
          return `<div><a href="${uu}">${uu}</a></div>`;
        }).join("")}</div>`
      : "";

    return textHtml + linksHtml;
  }

  function briefToXLS(state){
    const columns = [
      { key: "room", label: "Наименование помещения", w: 260 },
      { key: "walls", label: "Стены, цвет", w: 220 },
      { key: "floor", label: "Пол", w: 220 },
      { key: "ceiling", label: "Потолок", w: 220 },
      { key: "doors", label: "Двери", w: 220 },
      { key: "plinth", label: "Плинтус, карниз", w: 220 },
      { key: "light", label: "Свет", w: 220 },
      { key: "furniture", label: "Мебель / Декор", w: 220 },
      { key: "concept", label: "Ссылка на концепт", w: 220 },
      { key: "notes", label: "Допы / примечания", w: 260 }
    ];

    const rooms = Array.isArray(state.rooms) ? state.rooms : [];
    const m = state.meta || {};
    const otherLabel = ((m.otherLabel || "Прочее") + "").trim() || "Прочее";

    // Meta
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
    const radText = (rad.text || "").toString().trim();
    const radLinks = Array.isArray(rad.links) ? rad.links.map(x => (x||"").toString().trim()).filter(Boolean) : [];
    if(radText || radLinks.length){
      metaPairs.push(["Радиаторы", [radText, ...radLinks].filter(Boolean).join("\n")]);
    }

    pushIf("Высота потолков (мм)", m.ceilingsMm);
    pushIf("Высота дверей (мм)", m.doorsMm);
    pushIf(otherLabel, m.otherMm);

    // Links matrix
    const fields = [
      ["walls","Стены, цвет"],
      ["floor","Пол"],
      ["ceiling","Потолок"],
      ["doors","Двери"],
      ["plinth","Плинтус и карниз"],
      ["light","Свет"],
      ["furniture","Мебель / Декор"],
      ["concept","Ссылка на концепт"],
      ["notes","Допы / примечания"],
    ];

    const linkRows = [];
    let maxLinks = 0;

    rooms.forEach((r) => {
      fields.forEach(([key, label]) => {
        const cell = r?.[key] || { text:"", links:[] };
        const links = Array.isArray(cell.links) ? cell.links.map(x => (x||"").toString().trim()).filter(Boolean) : [];
        if(links.length){
          maxLinks = Math.max(maxLinks, links.length);
          linkRows.push({
            room: (r?.name || "").toString(),
            field: label,
            links,
            bg: (r && r.__bg) ? r.__bg : ""
          });
        }
      });
    });

    const colgroup = `<colgroup>${columns.map(c => `<col style="width:${c.w}px" />`).join("")}</colgroup>`;

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
    .grid { table-layout: fixed; }
    .grid td, .grid th { border: 1px solid #d9d9d9; padding: 10px 10px; vertical-align: top; }

    /* Headers: 14px bold */
    .grid th {
      font-weight: 800;
      font-size: 14px;
      background: #111827;
      color: #ffffff;
      text-align: left;
      white-space: nowrap;
    }

    /* Cells: 10px */
    .grid td {
      font-size: 10px;
      font-weight: 400;
      line-height: 1.5;
      white-space: normal;
      word-wrap: break-word;
    }

    /* First column: 14px bold */
    .room { font-weight: 800; font-size: 14px; }

    .txt { margin-bottom: 6px; }
    a { color: #0563C1; text-decoration: underline; }
    .links div { margin-top: 2px; }

    .sectionTitle { font-weight: 900; font-size: 14px; margin-top: 16px; margin-bottom: 8px; }

    /* Links matrix */
    .linksGrid { table-layout: fixed; }
    .linksGrid td, .linksGrid th { border: 1px solid #d9d9d9; padding: 10px 10px; vertical-align: top; }
    .linksGrid th { background: #111827; color: #fff; font-weight: 800; font-size: 16px; text-align:left; }
    .linksGrid td { font-size: 12px; line-height: 1.5; word-wrap: break-word; }
    .linksGrid .lgRoom { width: 240px; font-weight: 700; }
    .linksGrid .lgField { width: 240px; font-weight: 700; background: #f3f4f6; }
    .linksGrid .lgLink { width: 240px; }

    /* Meta */
    .meta { table-layout: fixed; }
    .meta td, .meta th { border: 1px solid #d9d9d9; padding: 10px 10px; vertical-align: top; }
    .meta th { background: #111827; color: #fff; font-weight: 800; font-size: 14px; text-align:left; }
    .meta td { font-size: 12px; line-height: 1.5; word-wrap: break-word; }
    .metaKey { width: 240px; font-weight: 700; background: #f3f4f6; }
    .metaVal { width: 1080px; }
  </style>
</head>
<body>

  <table class="grid">
    ${colgroup}
    <tr>
      ${columns.map(c => `<th>${escHtml(c.label)}</th>`).join("")}
    </tr>

    ${rooms.map((r, idx) => {
      const bg = (r && r.__bg) ? r.__bg : (PALETTE[idx % PALETTE.length]);
      return `
      <tr>
        ${columns.map(c => {
          if(c.key === "room"){
            return `<td class="room" style="background:${escHtml(bg)};">${escHtml(r?.name || "")}</td>`;
          }
          return `<td style="background:${escHtml(bg)};">${cellToHtml(r?.[c.key])}</td>`;
        }).join("")}
      </tr>`;
    }).join("")}
  </table>

  ${linkRows.length ? `
    <div class="sectionTitle">ССЫЛКИ (каждая ссылка в своей ячейке)</div>
    <table class="linksGrid">
      <tr>
        <th class="lgRoom">Помещение</th>
        <th class="lgField">Поле</th>
        ${Array.from({length: maxLinks}, (_,i) => `<th class="lgLink">Ссылка ${i+1}</th>`).join("")}
      </tr>
      ${linkRows.map((row, i) => {
        const bg = row.bg ? row.bg : (PALETTE[i % PALETTE.length]);
        return `
        <tr>
          <td class="lgRoom" style="background:${escHtml(bg)};">${escHtml(row.room)}</td>
          <td class="lgField" style="background:${escHtml(bg)};">${escHtml(row.field)}</td>
          ${Array.from({length: maxLinks}, (_,j) => {
            const v = row.links[j] || "";
            if(!v) return `<td class="lgLink" style="background:${escHtml(bg)};"></td>`;
            const u = escHtml(v);
            return `<td class="lgLink" style="background:${escHtml(bg)};"><a href="${u}">${u}</a></td>`;
          }).join("")}
        </tr>`;
      }).join("")}
    </table>
  ` : ""}

  ${metaPairs.length ? `
    <div class="sectionTitle">ФАЙЛЫ / ДОП. ИНФО</div>
    <table class="meta">
      <tr><th style="width:340px;">Параметр</th><th style="width:1080px;">Значение</th></tr>
      ${metaPairs.map(([k,v], i) => {
        const bg = PALETTE[i % PALETTE.length];
        const vv = (v ?? "").toString().trim();
        const safe = escHtml(vv).replace(/\r?\n/g, "<br/>");
        const isUrl = /^https?:\/\/\S+$/i.test(vv);
        const vHtml = isUrl ? `<a href="${escHtml(vv)}">${escHtml(vv)}</a>` : safe;
        return `<tr><td class="metaKey" style="background:${escHtml(bg)};">${escHtml(k)}</td><td class="metaVal" style="background:${escHtml(bg)};">${vHtml}</td></tr>`;
      }).join("")}
    </table>
  ` : ""}

</body>
</html>`.trim();

    return html;
  }

  function briefDownloadXLS(filename, state){
    const html = briefToXLS(state);
    const payload = "\uFEFF" + html; // BOM helps UTF-8
    download(filename, payload, "application/vnd.ms-excel;charset=utf-8");
  }

  return { download, briefToCSV };
})();

