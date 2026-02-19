﻿window.Components = window.Components || {};

Components.RoomRow = (() => {
  const MF = () => Components.MultiField;

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // NOTE:
  // - Field keys + labels come from shared schema (window.BriefProSchema.COLUMNS).
  // - UI-only things (placeholders, widths) live here and must not leak into exporters.
  const FALLBACK_COLS = [
    { key: "walls",     label: "Стены, цвет" },
    { key: "floor",     label: "Пол" },
    { key: "ceiling",   label: "Потолок" },
    { key: "doors",     label: "Двери" },
    { key: "plinth",    label: "Плинтус, карниз" },
    { key: "light",     label: "Свет" },
    { key: "furniture", label: "Мебель / Декор" },
    { key: "concept",   label: "Ссылка на концепт" },
    { key: "notes",     label: "Допы к черновикам или примечания" }
  ];

  function getSchemaCols(){
    const s = window.BriefProSchema && Array.isArray(window.BriefProSchema.COLUMNS)
      ? window.BriefProSchema.COLUMNS
      : FALLBACK_COLS;
    // Defensive clone + normalize
    return s
      .map(c => ({
        key: c && c.key ? String(c.key) : "",
        label: c && (c.label || c.title || c.key) ? String(c.label || c.title || c.key) : ""
      }))
      .filter(c => c.key);
  }

  // UI-only config (safe to change without affecting exporters)
  const UI = {
    placeholders: {
      walls:     { text: "Описание стен/цвета…",            link: "https://ссылка-на-материал" },
      floor:     { text: "Описание пола…",                  link: "https://ссылка-на-пол" },
      ceiling:   { text: "Описание потолка…",               link: "https://ссылка-на-потолок" },
      doors:     { text: "Описание дверей…",                link: "https://ссылка-на-двери" },
      plinth:    { text: "Плинтус/карниз…",                 link: "https://ссылка-на-плинтус" },
      light:     { text: "Сценарии/типы света…",            link: "https://ссылка-на-свет" },
      furniture: { text: "Ключевая мебель/декор…",          link: "https://ссылка-на-мебель" },
      concept:   { text: "Что важно из концепта…",          link: "https://ссылка-на-концепт" },
      notes:     { text: "Любые допы сюда…",                link: "https://доп-ссылка" }
    },
    widths: {
      default: 170,
      notes: 260,
      name: 220
    }
  };

  function render({ room, idx, mode, pendingDeleteIdx }){
    const r = room || {};
    const name = (r.name || "").toString();
    const isPending = (mode === "edit" && pendingDeleteIdx === idx);

    const delBtn = mode === "edit"
      ? (
          isPending
            ? `<button type="button" class="btn btn-sm rr-del-confirm" data-room-idx="${idx}" title="Подтвердить удаление">Подтвердить удаление</button>`
            : `<button type="button" class="btn btn-sm rr-del" data-room-idx="${idx}" title="Удалит всю строку"><span class="rr-x">✖</span>Удалить всю строку</button>`
        )
      : "";

    const nameCell = mode === "edit"
      ? `
        <div class="rr-namebox">
          <input
            class="rr-name"
            data-room-idx="${idx}"
            value="${esc(name)}"
            placeholder="Напр. Гостиная"
          />
          ${delBtn}
        </div>
      `
      : `<div class="rr-nameview">${esc(name || "—")}</div>`;

    const COLS = getSchemaCols();

    const cells = COLS.map((c) => {
      const path = `rooms.${idx}.${c.key}`;
      const ph = UI.placeholders[c.key] || {};
      return MF().render({
        value: r[c.key],
        mode,
        placeholderText: ph.text || "",
        placeholderLink: ph.link || "",
        path
      });
    });

    // UI table has NO per-room background fill (Excel can still style independently)
    const rowStyle = "";

    const tdWidth = (key) => (key === "notes" ? UI.widths.notes : UI.widths.default);

    return `
      <tr data-room-row="${idx}" style="${rowStyle}">
        <td class="rr-sticky" style="min-width:${UI.widths.name}px; vertical-align:top">
          ${nameCell}
        </td>
        ${cells.map((h, i) => {
          const key = COLS[i].key;
          return `<td style="min-width:${tdWidth(key)}px; vertical-align:top">${h}</td>`;
        }).join("")}
      </tr>
    `;
  }

  // Legacy API (kept for UI only). Exporters must NOT use this.
  function getCols(){ return getSchemaCols(); }

  return { render, getCols };
})();
