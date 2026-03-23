(function(){
  if(window.PlannerPresenters) return;

  function fmtDMY(iso){
    if(!iso) return "";
    const s = String(iso);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
  }

  function dueLabel(iso){
    return iso ? `до ${fmtDMY(iso)}` : "";
  }

  function startLabel(iso){
    return iso ? `с ${fmtDMY(iso)}` : "";
  }

  function urgencyLabel(u){
    if(u == null) return "";
    const s = String(u).trim().toLowerCase();
    if(!s) return "";
    if(s === "normal" || s === "low") return "";
    if(s === "high" || s === "urgent") return "Срочно";
    return "Срочно";
  }

  function statusLabel(code){
    if(code === "new") return "Новая задача";
    if(code === "taken") return "Принята в работу";
    if(code === "in_progress") return "В работе";
    if(code === "problem") return "Есть проблема";
    if(code === "done") return "Завершена";
    if(code === "canceled") return "Отменена";
    return code;
  }

  function shortId(value){
    const s = value == null ? "" : String(value).trim();
    if(!s) return "";
    return s.length > 8 ? s.slice(0,8) : s;
  }

  function prettifyPersonName(value){
    const s = value == null ? "" : String(value).trim();
    if(!s) return "";

    if(s.includes("@")){
      return s.split("@")[0].replace(/[._-]+/g, " ").trim();
    }

    if(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s)) return "";
    if(/^[0-9a-f]{32}$/i.test(s)) return "";

    return s;
  }

  function resolvePersonLabel(input, opts){
    const o = opts || {};
    const uid = o.uid ? String(o.uid) : "";
    const fallback = o.fallback || "Сотрудник";
    if(input == null || input === "") return fallback;

    if(typeof input === "object"){
      const id = input.id != null ? String(input.id) : "";
      if(uid && id && id === uid) return "Вы";

      const direct = [
        input.display_name,
        input.full_name,
        input.name,
        input.email,
        input.label,
        input.title,
        input.username
      ];

      for(const candidate of direct){
        const pretty = prettifyPersonName(candidate);
        if(pretty) return pretty;
      }

      if(id) return `${fallback} ${shortId(id)}`;
      return fallback;
    }

    const raw = String(input).trim();
    if(!raw) return fallback;
    if(uid && raw === uid) return "Вы";

    const pretty = prettifyPersonName(raw);
    if(pretty) return pretty;

    return `${fallback} ${shortId(raw)}`;
  }

  function plannerDocTypeLabel(section){
    const s = String(section || "").trim().toLowerCase();
    if(s === "articles") return "ИНСТРУКЦИЯ";
    if(s === "templates") return "ШАБЛОН";
    if(s === "checklists") return "ЧЕК-ЛИСТ";
    if(s === "external") return "ССЫЛКА";
    return "ДОКУМЕНТ";
  }

  window.PlannerPresenters = {
    fmtDMY,
    dueLabel,
    startLabel,
    urgencyLabel,
    statusLabel,
    prettifyPersonName,
    resolvePersonLabel,
    plannerDocTypeLabel
  };
})();