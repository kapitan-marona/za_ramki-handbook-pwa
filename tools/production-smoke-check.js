const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(rel){
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function existsRel(rel){
  return fs.existsSync(path.join(root, rel));
}

function cleanLocalUrl(raw){
  if(!raw) return "";
  let url = raw.trim().replace(/^['"]|['"]$/g, "");
  if(!url || url.startsWith("data:") || url.startsWith("http:") || url.startsWith("https:")) return "";
  url = url.split("#")[0].split("?")[0];
  if(url.startsWith("/")) url = "." + url;
  return url.replace(/^\.\//, "");
}

function collectIndexAssets(){
  const html = read("index.html");
  const assets = [];
  const attrRe = /\b(?:href|src)=["']([^"']+)["']/g;
  let match;
  while((match = attrRe.exec(html))){
    const rel = cleanLocalUrl(match[1]);
    if(rel) assets.push({ rel, source: "index.html" });
  }
  return assets;
}

function collectCssUrls(){
  const files = ["styles.rebuild.css", "styles.editorial.css", "colors.css", "theme.css"];
  const assets = [];
  for(const file of files){
    const text = read(file);
    const urlRe = /url\(([^)]+)\)/g;
    let match;
    while((match = urlRe.exec(text))){
      const rel = cleanLocalUrl(match[1]);
      if(rel) assets.push({ rel, source: file });
    }
  }
  return assets;
}

function collectServiceWorkerAssets(){
  const sw = read("sw.js");
  const arrayMatch = sw.match(/const\s+ZR_STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if(!arrayMatch) return [{ error: "ZR_STATIC_ASSETS not found in sw.js" }];

  const assets = [];
  const strRe = /["']([^"']+)["']/g;
  let match;
  while((match = strRe.exec(arrayMatch[1]))){
    const rel = cleanLocalUrl(match[1]);
    if(rel) assets.push({ rel: rel || "index.html", source: "sw.js" });
  }
  return assets;
}

function checkMissingAssets(items){
  const missing = [];
  for(const item of items){
    if(item.error){
      missing.push(item);
      continue;
    }

    const rel = item.rel === "" ? "index.html" : item.rel;
    const normalized = rel === "." ? "index.html" : rel;
    if(!existsRel(normalized)){
      missing.push({ rel: normalized, source: item.source });
    }
  }
  return missing;
}

function checkCssVariables(){
  const files = ["colors.css", "styles.rebuild.css", "styles.editorial.css", "theme.css"];
  const text = files.map(read).join("\n");
  const defined = new Set(Array.from(text.matchAll(/--([A-Za-z0-9_-]+)\s*:/g)).map((m) => m[1]));
  const used = new Set(Array.from(text.matchAll(/var\(--([A-Za-z0-9_-]+)/g)).map((m) => m[1]));
  return Array.from(used).filter((name) => !defined.has(name)).sort();
}

function fileSize(rel){
  return fs.statSync(path.join(root, rel)).size;
}

function sumFiles(files){
  return files.reduce((sum, rel) => sum + fileSize(rel), 0);
}

function formatKb(bytes){
  return (bytes / 1024).toFixed(1) + " KB";
}

function main(){
  const indexAssets = collectIndexAssets();
  const cssAssets = collectCssUrls();
  const swAssets = collectServiceWorkerAssets();
  const missing = [
    ...checkMissingAssets(indexAssets),
    ...checkMissingAssets(cssAssets),
    ...checkMissingAssets(swAssets)
  ];
  const missingVars = checkCssVariables();

  const cssFiles = ["styles.rebuild.css", "styles.editorial.css", "colors.css", "theme.css"];
  const baseJsFiles = [
    "js/vendor/supabase-js-2.js",
    "js/utils/supabase_client.js",
    "js/services/zr_backend.js",
    "js/api.js",
    "js/router.js",
    "js/utils/viewer_nav.js",
    "js/utils/favorites.js",
    "js/utils/push.js",
    "js/utils/planner_push_sender.js",
    "js/utils/update_checker.js",
    "js/app.js"
  ];

  console.log("Production smoke-check");
  console.log("CSS total:", formatKb(sumFiles(cssFiles)));
  console.log("Base JS total:", formatKb(sumFiles(baseJsFiles.filter(existsRel))));
  console.log("Index assets checked:", indexAssets.length);
  console.log("CSS url() assets checked:", cssAssets.length);
  console.log("Service worker assets checked:", swAssets.length);

  if(missing.length){
    console.log("\nMissing assets:");
    for(const item of missing){
      console.log("-", item.source + " -> " + (item.rel || item.error));
    }
  }

  if(missingVars.length){
    console.log("\nMissing CSS variables:");
    for(const name of missingVars) console.log("-", "--" + name);
  }

  if(missing.length || missingVars.length){
    process.exitCode = 1;
    return;
  }

  console.log("OK: no missing local assets or CSS variables.");
}

main();
