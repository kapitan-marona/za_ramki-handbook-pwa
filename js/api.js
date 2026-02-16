window.API = {
  async json(path){
    const r = await fetch(path, { cache: "no-store" });
    if(!r.ok) throw new Error(`Fetch failed: ${path}`);
    return r.json();
  },
  async text(path){
    const r = await fetch(path, { cache: "no-store" });
    if(!r.ok) throw new Error(`Fetch failed: ${path}`);
    return r.text();
  }
};
