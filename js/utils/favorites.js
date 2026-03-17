window.ZRFavorites = (function(){
  const TYPES = ["articles", "templates", "checklists"];

  function getUserId(){
    try{
      const u = window.App && window.App.session ? window.App.session.user : null;
      if(!u) return "guest";

      if(typeof u === "string" && u.trim()) return u.trim();
      if(u.id) return String(u.id).trim();
      if(u.email) return String(u.email).trim().toLowerCase();
      if(u.phone) return String(u.phone).trim();

      return "guest";
    }catch(e){
      return "guest";
    }
  }

  function getStorageKey(){
    return "zr_fav_" + getUserId();
  }

  function normalizeShape(raw){
    const out = {
      articles: [],
      templates: [],
      checklists: []
    };

    try{
      const src = raw && typeof raw === "object" ? raw : {};
      TYPES.forEach((type) => {
        const arr = Array.isArray(src[type]) ? src[type] : [];
        out[type] = Array.from(new Set(
          arr
            .map(v => String(v || "").trim())
            .filter(Boolean)
        ));
      });
    }catch(e){}

    return out;
  }

  function readStore(){
    try{
      const raw = localStorage.getItem(getStorageKey());
      if(!raw) return normalizeShape(null);
      return normalizeShape(JSON.parse(raw));
    }catch(e){
      return normalizeShape(null);
    }
  }

  function writeStore(data){
    localStorage.setItem(getStorageKey(), JSON.stringify(normalizeShape(data)));
  }

  function getFavorites(){
    return readStore();
  }

  function isFavorite(type, id){
    const t = String(type || "").trim();
    const v = String(id || "").trim();
    if(!TYPES.includes(t) || !v) return false;

    const data = readStore();
    return data[t].includes(v);
  }

  function toggleFavorite(type, id){
    const t = String(type || "").trim();
    const v = String(id || "").trim();
    if(!TYPES.includes(t) || !v){
      return readStore();
    }

    const data = readStore();
    const set = new Set(data[t]);

    if(set.has(v)) set.delete(v);
    else set.add(v);

    data[t] = Array.from(set);
    writeStore(data);
    return normalizeShape(data);
  }

  return {
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite
  };
})();
