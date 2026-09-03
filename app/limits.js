import { MONTHS_L, svg } from "./config.js";
import { COLLS, LS_KEY, Store } from "./store.js";
import { state } from "./state.js";
import { esc } from "./util.js";

/* ══════════ 3b. Limite ══════════ */
export const DOCS_MAX = 5000;          /* fișe în baza de date a aplicației */
export const DOC_MAX  = 262144;        /* 256 KiB per fișă */
export const LS_MAX   = 5000000;       /* spațiul din browser, aproximativ */
export const bytes = str => { try{ return new TextEncoder().encode(str).length; }catch(e){ return str.length; } };
export const kb = n => (n/1024).toFixed(n < 10240 ? 1 : 0) + " KB";

export function docLabel(coll, doc, id){
  if(coll === "finance"){ const m = parseInt(id.slice(5,7),10)-1; return "luna " + (MONTHS_L[m]||id) + " " + id.slice(0,4); }
  return doc.name || doc.title || (coll === "tasks" ? doc.title : "") || id;
}
export function biggestDoc(){
  let best = null;
  COLLS.forEach(c => {
    if(c === "settings") return;
    Object.keys(state[c] || {}).forEach(id => {
      const size = bytes(JSON.stringify(state[c][id]));
      if(!best || size > best.size) best = {size, coll:c, id, label:docLabel(c, state[c][id], id)};
    });
  });
  return best;
}
/* Limitele diferă după locul în care rulează aplicația. Arătăm doar
   pe cele care chiar se aplică aici. */
export function limits(){
  const out = [];
  if(Store.mode === "cloud"){
    const docs = Store.count();
    out.push({key:"docs", label:"Fișe în bază", used:docs, max:DOCS_MAX,
      show:docs.toLocaleString("ro-RO") + " / " + DOCS_MAX.toLocaleString("ro-RO"),
      why:"Fiecare task, notiță, obicei, datorie sau lună de finanțe e o fișă.",
      fix:"Exportă și șterge ce nu-ți mai trebuie."});
    const big = biggestDoc();
    if(big) out.push({key:"doc", label:"Cea mai mare fișă", used:big.size, max:DOC_MAX,
      show:kb(big.size) + " / 256 KB", detail:big.label,
      why:"O singură fișă nu poate depăși 256 KB. „" + big.label + "” e cea mai plină.",
      fix: big.coll === "finance" ? "Șterge mișcări vechi din luna aceea."
         : big.coll === "habits"  ? "Bifele de zeci de ani se adună — șterge obiceiul vechi și fă-l din nou."
         : "Scurtează conținutul sau împarte-l în două."});
  } else {
    let used = 0;
    try{ used = bytes(localStorage.getItem(LS_KEY) || ""); }catch(e){}
    out.push({key:"ls", label:"Spațiu folosit", used, max:LS_MAX, show:kb(used),
      why: Store.mode === "state"
        ? "Datele stau oglindite aici, ca aplicația să meargă și fără internet."
        : "Tot ce salvezi stă în browserul acestui aparat, nicăieri altundeva.",
      fix:"Exportă din când în când. Dacă se umple, browserul refuză să mai salveze."});
  }
  out.forEach(l => l.pct = Math.min(100, l.used/l.max*100));
  return out;
}
export const worstLimit = () => limits().sort((a,b) => b.pct - a.pct)[0];
export function limitBanner(){
  const w = worstLimit();
  if(!w || w.pct < 75) return "";
  const bad = w.pct >= 90;
  return '<div class="alert '+(bad?"bad":"warn")+'">'+svg("warn")+
    '<span class="txt"><b>'+(bad ? "Aproape plin: " : "Te apropii de o limită: ")+esc(w.label.toLowerCase())+' — '+w.pct.toFixed(0)+'%</b>'+
    esc(w.why)+' '+esc(w.fix)+'</span>' +
    '<button class="btn ghost sm go" data-a="go" data-i="__set">Vezi limitele</button></div>';
}
