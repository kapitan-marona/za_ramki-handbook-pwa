/*
  KBNewMarks — safe NEW markers for handbook

  Supported:
  - Multiline blocks: [[new]] ... [[/new]]
  - Works without breaking HTML structure (token pipeline)

  Note:
  - Legacy one-line >text< stays handled in markdown (articles.js), not here.
*/

window.KBNewMarks = (() => {
  const OPEN  = "@@KB_NEW_OPEN@@";
  const CLOSE = "@@KB_NEW_CLOSE@@";

  function mdToTokens(md, active){
    md = (md ?? "").toString();

    // Replace [[new]] markers with tokens always (so we can "eat" them later)
    md = md.replace(/\[\[new\]\]/g, OPEN);
    md = md.replace(/\[\[\/new\]\]/g, CLOSE);

    // If highlight is disabled, we still keep tokens so htmlFromTokens() can remove them.
    // (No further action needed here.)

    return md;
  }

  function htmlFromTokens(html, active){
    html = (html ?? "").toString();

    if(active){
      html = html.replaceAll(OPEN,  '<mark class="kb-newmark">');
      html = html.replaceAll(CLOSE, '</mark>');
    }else{
      // "Eat" tokens completely after 7 days (no мусор)
      html = html.replaceAll(OPEN,  "");
      html = html.replaceAll(CLOSE, "");
    }

    return html;
  }

  return { mdToTokens, htmlFromTokens };
})();
