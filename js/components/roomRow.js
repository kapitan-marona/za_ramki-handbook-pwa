window.Components = window.Components || {};

Components.RoomRow = (() => {
  const MF = () => Components.MultiField;

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  const COLS = [
    { key: "walls",     label: "Стены, цвет", placeholderText: "Описание стен/цвета…", placeholderLink: "https://ссылка-на-материал" },
    { key: "floor",     label: "Пол",         placeholderText: "Описание пола…",       placeholderLink: "https://ссылка-на-пол" },
    { key: "ceiling",   label: "Потолок",     placeholderText: "Описание потолка…",   placeholderLink: "https://ссылка-на-потолок" },
    { key: "doors",     label: "Двери",       placeholderText: "Описание дверей…",    placeholderLink: "https://ссылка-на-двери" },
    { key: "plinth",    label: "Плинтус, карниз", placeholderText: "Плинтус/карниз…", placeholderLink: "https://ссылка-на-плинтус" },
    { key: "light",     label: "Свет",        placeholderText: "Сценарии/типы света…", placeholderLink: "https://ссылка-на-свет" },
    { key: "furniture", label: "Мебель / Декор", placeholderText: "Ключевая мебель/декор…", placeholderLink: "https://ссылка-на-мебель" },
    { key: "concept",   label: "Ссылка на концепт", placeholderText: "Что важно из концепта…", placeholderLink: "https://ссылка-на-концепт" },
    { key: "notes",     label: "Допы к черновикам или примечания", placeholderText: "Любые допы сюда…", placeholderLink: "https://доп-ссылка" }
  ];

  function render({ room, idx, mode }){
    const r = room || {};
    const name = (r.name || "").toString();

    const delBtn = mode === "edit"
      ? '<button type="button" class="btn btn-sm rr-del" data-room-idx="' + idx + '" title="Удалит всю строку">' +
          '<span class="dot"></span>Удалить всю строку' +
        '</button>'
      : "";

    const nameCell = mode === "edit"
      ? (
          '<div style="display:flex; flex-direction:column; gap:8px;">' +
            '<input class="rr-name" data-room-idx="' + idx + '" value="' + esc(name) + '" placeholder="Напр. Гостиная"' +
              ' style="width:100%; padding:10px; border-radius:12px;" />' +
            delBtn +
          '</div>'
        )
      : '<div style="white-space:pre-wrap; font-weight:600; color: var(--brand-headings)">' + esc(name || "—") + '</div>';

    const cells = COLS.map((c) => {
      const path = 'rooms.' + idx + '.' + c.key;
      return MF().render({
        value: r[c.key],
        mode,
        placeholderText: c.placeholderText,
        placeholderLink: c.placeholderLink,
        path
      });
    });

    const tdWidth = (key) => (key === "notes" ? 240 : 140);

    return (
      '<tr data-room-row="' + idx + '">' +
        '<td style="min-width:220px; vertical-align:top">' + nameCell + '</td>' +
        cells.map((h, i) => {
          const key = COLS[i].key;
          return '<td style="min-width:' + tdWidth(key) + 'px; vertical-align:top">' + h + '</td>';
        }).join("") +
      '</tr>'
    );
  }

  function getCols(){ return COLS; }

  return { render, getCols };
})();
