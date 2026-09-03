import { svg } from "../config.js";
import { itemsOf } from "../modules.js";
import { head } from "../ui.js";
import { ui } from "../state.js";
import { dLabel, esc, zile } from "../util.js";

/* ══════════ Notițe / Jurnal ══════════ */
export function viewNotes(m){
  const q = (ui.search||"").toLowerCase();
  const all = itemsOf("notes", m.id).sort((a,b) => (b.updatedAt||b.createdAt||"").localeCompare(a.updatedAt||a.createdAt||""));
  const list = q ? all.filter(n => ((n.title||"") + " " + (n.body||"")).toLowerCase().includes(q)) : all;

  let h = head(m.name, all.length ? all.length + (all.length===1?" însemnare":" însemnări") : "Gânduri, idei, jurnal.",
    '<button class="btn" data-a="nadd" data-m="'+m.id+'">'+svg("plus")+'Însemnare nouă</button>');

  if(all.length) h += '<div class="bar"><div class="grow"><input type="text" id="q" placeholder="Caută în însemnări…" value="'+esc(ui.search)+'"></div>' +
    (q ? '<span class="pill">'+list.length+' rezultate</span>' : '') + '</div>';

  if(!list.length){
    h += '<div class="empty"><h3>'+(q?"Niciun rezultat pentru „"+esc(ui.search)+"”":"Nicio însemnare")+'</h3>' +
      '<p>'+(q?"Încearcă alt cuvânt.":"Scrie ce ai în cap. Se caută după titlu și conținut, oricât de multe aduni.")+'</p>' +
      (q?'':'<button class="btn" data-a="nadd" data-m="'+m.id+'">'+svg("plus")+'Scrie prima însemnare</button>' +
      '<div class="demo"><span class="demo-tag">Exemplu — așa va arăta</span><div class="notes"><div class="note">' +
      '<time>3 septembrie</time><h4>Idei pentru trimestrul următor</h4>' +
      '<p>Trei direcții de testat: pachet lunar pentru clienții vechi, o pagină de prezentare mai scurtă, și un follow-up automat la 7 zile.</p>' +
      '</div></div></div>') + '</div>';
  } else {
    h += '<div class="notes">' + list.map(n =>
      '<button class="note" data-a="nopen" data-i="'+n.id+'">' +
      '<time>'+dLabel((n.updatedAt||n.createdAt||"").slice(0,10))+'</time>' +
      '<h4>'+esc(n.title || "Fără titlu")+'</h4>' +
      (n.body ? '<p>'+esc(n.body)+'</p>' : '') + '</button>').join("") + '</div>';
  }
  return h;
}
