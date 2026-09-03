import { svg } from "../config.js";
import { itemsOf } from "../modules.js";
import { head } from "../ui.js";
import { dLabel, esc, isPhone, iso, today, zile } from "../util.js";
import { streak } from "./dashboard.js";

/* ══════════ Obiceiuri ══════════ */
export function viewHabits(m){
  const hs = itemsOf("habits", m.id).sort((a,b) => (a.createdAt||"").localeCompare(b.createdAt||""));
  const span = isPhone() ? 7 : 21;
  const days = []; const d = new Date();
  for(let i = span-1; i >= 0; i--){ const x = new Date(d); x.setDate(x.getDate()-i); days.push(iso(x)); }
  const tod = today();

  let h = head(m.name, "Bifele stau înăuntrul obiceiului — 10 ani de bifat zilnic ocupă tot o singură fișă.",
    '<button class="btn" data-a="hadd" data-m="'+m.id+'">'+svg("plus")+'Obicei nou</button>');

  if(!hs.length){
    return h + '<div class="empty"><h3>Niciun obicei urmărit</h3>' +
      '<p>Alege lucrurile pe care vrei să le faci zilnic. Bifezi un pătrat pe zi și vezi seria crescând.</p>' +
      '<button class="btn" data-a="hadd" data-m="'+m.id+'">'+svg("plus")+'Adaugă primul obicei</button>' +
      '<div class="demo"><span class="demo-tag">Exemplu — așa va arăta</span><div class="rows"><div class="row">' +
      '<div class="main"><span class="ttl">Mișcare 30 min</span></div><div class="hgrid">' +
      [1,1,0,1,1,1,1,0,1,1,1,1,1,0].map(v => '<span class="hcell '+(v?"on":"")+'"></span>').join("") +
      '</div><span class="streak">5 zile</span></div></div></div></div>';
  }

  h += '<div class="card pad" style="overflow-x:auto"><div style="display:flex;flex-direction:column;gap:18px;min-width:'+(isPhone()?0:520)+'px">' +
    hs.map(hb => {
      const log = hb.log || {}, s = streak(hb);
      const doneN = days.filter(x => log[x]).length;
      return '<div class="hrow">' +
        '<div class="hname"><b>'+esc(hb.name)+'</b>' +
        '<em>'+doneN+' din ultimele '+zile(span)+'</em></div>' +
        '<div><div class="hgrid">' + days.map(x =>
          '<button class="hcell '+(log[x]?"on":"")+(x===tod?" today":"")+'" data-a="tick" data-i="'+hb.id+'" data-d="'+x+'" title="'+dLabel(x)+'" aria-label="'+esc(hb.name)+' — '+dLabel(x)+'"></button>').join("") +
        '</div><div class="hlabels">' + days.map(x => {
          const dd = new Date(x+"T12:00:00");
          const show = span <= 10 || dd.getDate() === 1 || x === days[0];
          return '<em>'+(show ? dd.getDate() : "")+'</em>';
        }).join("") + '</div></div>' +
        '<span class="streak" style="min-width:56px;text-align:right">'+zile(s)+'</span>' +
        '<button class="icon-btn del" data-a="hdel" data-i="'+hb.id+'" aria-label="Șterge">'+svg("trash")+'</button></div>';
    }).join("") + '</div></div>';
  return h;
}
