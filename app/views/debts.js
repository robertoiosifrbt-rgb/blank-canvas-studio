import { svg } from "../config.js";
import { state } from "../state.js";
import { head, sec, tile } from "../ui.js";
import { daysTo, esc, money, num, zile } from "../util.js";
import { paidOf, remaining } from "./finance.js";

/* ══════════ Datorii ══════════ */
export function viewDebts(m){
  const all = Object.keys(state.debts).map(id => Object.assign({id}, state.debts[id]));
  const active = all.filter(d => remaining(d) > 0).sort((a,b) => (a.due||"9999").localeCompare(b.due||"9999"));
  const closed = all.filter(d => remaining(d) <= 0);
  const left = active.reduce((s,d) => s + remaining(d), 0);
  const total = all.reduce((s,d) => s + num(d.total), 0);
  const paid = all.reduce((s,d) => s + paidOf(d), 0);

  let h = head(m.name, "Fiecare plată se scade din rest. Vezi mereu cât mai ai de dat.",
    '<button class="btn" data-a="dadd">'+svg("plus")+'Datorie nouă</button>');

  if(all.length) h += '<div class="tiles">' +
    tile("Rest de plată", money(left), active.length + (active.length===1?" datorie activă":" datorii active"), left ? "bad" : "good", true) +
    tile("Achitat", money(paid), total ? Math.round(paid/total*100) + "% din total" : "") +
    tile("Total contractat", money(total), all.length + (all.length===1?" datorie":" datorii")) +
    '</div>';

  h += sec("Active");
  if(!active.length){
    h += '<div class="empty"><h3>'+(all.length ? "Nicio datorie activă — toate achitate" : "Nicio datorie înregistrată")+'</h3>' +
      '<p>'+(all.length ? "Felicitări. Când apare una nouă, o adaugi aici." : "Adaugă o datorie cu suma totală și scadența. Pe măsură ce plătești, înregistrezi plățile și vezi cât ți-a mai rămas.")+'</p>' +
      '<button class="btn" data-a="dadd">'+svg("plus")+'Adaugă o datorie</button>' +
      (all.length ? '' : '<div class="demo"><span class="demo-tag">Exemplu — așa va arăta</span><div class="rows">' +
      '<div class="row"><span class="stripe warn"></span><div class="main"><span class="ttl">Credit auto</span>' +
      '<span class="sub">achitat 4.500 din 12.000 · scadent în 34 zile</span>' +
      '<div class="prog" style="margin-top:6px;max-width:280px"><i class="warn" style="width:37%"></i></div></div>' +
      '<span class="amt">'+money(7500)+'</span></div></div></div>') + '</div>';
  } else {
    h += '<div class="rows">' + active.map(d => {
      const rem = remaining(d), pct = num(d.total) ? paidOf(d)/num(d.total)*100 : 0;
      const n = d.due ? daysTo(d.due) : null;
      const cls = n === null ? "" : n < 0 ? "bad" : n <= 14 ? "warn" : "good";
      const when = n === null ? "fără scadență" : n < 0 ? "restanță de " + zile(Math.abs(n)) : n === 0 ? "scadent azi" : "scadent în " + zile(n);
      return '<div class="row"><span class="stripe '+cls+'"></span>' +
        '<div class="main"><span class="ttl">'+esc(d.name)+'</span>' +
        '<span class="sub">achitat '+money(paidOf(d))+' din '+money(num(d.total))+' · '+when+'</span>' +
        '<div class="prog" style="margin-top:6px;max-width:280px"><i class="'+(cls||"")+'" style="width:'+pct+'%"></i></div></div>' +
        '<span class="amt">'+money(rem)+'</span>' +
        '<button class="btn ghost sm" data-a="dpay" data-i="'+d.id+'">Plată</button>' +
        '<button class="icon-btn del" data-a="ddel" data-i="'+d.id+'" aria-label="Șterge">'+svg("trash")+'</button></div>';
    }).join("") + '</div>';
  }

  if(closed.length){
    h += sec("Achitate");
    h += '<div class="rows">' + closed.map(d =>
      '<div class="row"><span class="stripe good"></span><div class="main"><span class="ttl">'+esc(d.name)+'</span>' +
      '<span class="sub">achitat integral · '+money(num(d.total))+'</span></div><span class="pill good">gata</span>' +
      '<button class="icon-btn del" data-a="ddel" data-i="'+d.id+'" aria-label="Șterge">'+svg("trash")+'</button></div>').join("") + '</div>';
  }
  return h;
}
