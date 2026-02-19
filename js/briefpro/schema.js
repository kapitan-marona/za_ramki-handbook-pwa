﻿// BriefPro shared schema (data keys + labels + groups).
// IMPORTANT: This file must NOT contain any UI styles (widths, sticky, colors)
// and must NOT contain any exporter-specific styles. It is a shared "field map".
window.BriefProSchema = window.BriefProSchema || {};

BriefProSchema.COLUMNS = [
  // Geometry group (used by XLSX exporter to build the grouped header)
  { key: "walls",     label: "Стены, цвет", group: "geometry" },
  { key: "floor",     label: "Пол",         group: "geometry" },
  { key: "ceiling",   label: "Потолок",     group: "geometry" },
  { key: "doors",     label: "Двери",       group: "geometry" },
  { key: "plinth",    label: "Плинтус, карниз", group: "geometry" },

  // Other content
  { key: "light",     label: "Свет",        group: "content" },
  { key: "furniture", label: "Мебель / Декор", group: "content" },
  { key: "concept",   label: "Ссылка на концепт", group: "content" },
  { key: "notes",     label: "Допы к черновикам или примечания", group: "content" }
];

// Optional meta fields list (kept empty for now; fill if needed later)
BriefProSchema.META_FIELDS = BriefProSchema.META_FIELDS || [];
