window.Router = {
  parse(){
    // Routes:
    // #/articles/<id>
    // #/contacts
    // #/templates
    // #/templates/<templateId>
    const h = location.hash || "";
    const m = h.match(/^#\/([^\/]+)(?:\/(.+))?$/);
    const section = m ? decodeURIComponent(m[1]) : "articles";
    const param = m && m[2] ? decodeURIComponent(m[2]) : "";
    return { section, param };
  },
  go(section, param=""){
    location.hash = `#/${encodeURIComponent(section)}${param ? "/" + encodeURIComponent(param) : ""}`;
  }
};
