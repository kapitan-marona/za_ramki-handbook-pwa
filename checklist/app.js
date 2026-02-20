/* ZA RAMKI — offline checklist (localStorage) */
(() => {
  const KEY = "zr_measurements_checklist_v1";

  const ITEMS = [
    "Общие габариты всех стен",
    "Высота дверей",
    "Высота потолков",
    "Высота ступеней",
    "Высота коммуникаций",
    "Высота подоконников",
    "Привязки по стенам всех окон и дверей",
    "Все привязки и замеры нанесены на шаблон",
    "Фотофиксация объекта",
    "Видеофиксация объекта",
  ];

  const $ = (id) => document.getElementById(id);

  const state = {
    jobDate: "",
    jobAddress: "",
    jobEmployee: "",
    checks: Array(ITEMS.length).fill(false),
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      if (data && typeof data === "object") {
        if (typeof data.jobDate === "string") state.jobDate = data.jobDate;
        if (typeof data.jobAddress === "string") state.jobAddress = data.jobAddress;
        if (typeof data.jobEmployee === "string") state.jobEmployee = data.jobEmployee;

        if (Array.isArray(data.checks)) {
          state.checks = ITEMS.map((_, i) => !!data.checks[i]);
        }
      }
    } catch (_) {}
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function render() {
    $("jobDate").value = state.jobDate || "";
    $("jobAddress").value = state.jobAddress || "";
    $("jobEmployee").value = state.jobEmployee || "";

    const list = $("list");
    list.innerHTML = "";

    ITEMS.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "item";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!state.checks[i];
      cb.id = `cb_${i}`;

      const label = document.createElement("label");
      label.htmlFor = cb.id;
      label.textContent = text;

      cb.addEventListener("change", () => {
        state.checks[i] = cb.checked;
        save();
      });

      row.appendChild(cb);
      row.appendChild(label);
      list.appendChild(row);
    });
  }

  function bind() {
    $("jobDate").addEventListener("change", (e) => {
      state.jobDate = e.target.value || "";
      save();
    });
    $("jobAddress").addEventListener("input", (e) => {
      state.jobAddress = e.target.value || "";
      save();
    });
    $("jobEmployee").addEventListener("input", (e) => {
      state.jobEmployee = e.target.value || "";
      save();
    });

    $("resetBtn").addEventListener("click", () => {
      state.jobDate = "";
      state.jobAddress = "";
      state.jobEmployee = "";
      state.checks = Array(ITEMS.length).fill(false);
      save();
      render();
    });

    $("exportBtn").addEventListener("click", () => {
      const lines = [];
      lines.push("ZA RAMKI — Чек-лист обмера");
      lines.push(`Дата: ${state.jobDate || "-"}`);
      lines.push(`Адрес: ${state.jobAddress || "-"}`);
      lines.push(`Сотрудник: ${state.jobEmployee || "-"}`);
      lines.push("");
      ITEMS.forEach((t, i) => {
        lines.push(`${state.checks[i] ? "[x]" : "[ ]"} ${t}`);
      });

      const text = lines.join("\n");
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `checklist_obmer_${(state.jobDate || "date").replaceAll("-", "")}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    });
  }

  // SW register (kept minimal)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  load();
  window.addEventListener("DOMContentLoaded", () => {
    bind();
    render();
  });
})();
