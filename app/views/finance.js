import { MONTHS, MONTHS_L, svg } from "../config.js";
import { state } from "../state.js";
import { head, sec, tile } from "../ui.js";
import { ui } from "../state.js";
import { dLabel, esc, iso, money, num, ym } from "../util.js";

/* ══════════ Finanțe: calcule ══════════ */
export const monthItems = k => ((state.finance[k]||{}).items) || [];
export function monthTotals(k){
  let inc = 0, out = 0;
  monthItems(k).forEach(t => { if(t.type === "in") inc += num(t.amount); else out += num(t.amount); });
  return {inc, out, bal: inc - out};
}
export const remaining = d => Math.max(0, num(d.total) - (d.payments||[]).reduce((s,p) => s + num(p.amount), 0));
export const paidOf = d => (d.payments||[]).reduce((s,p) => s + num(p.amount), 0);

/* ══════════ Finanțe ══════════ */
export function viewFinance(m){
  const k = ui.month, t = monthTotals(k), items = monthItems(k).slice().sort((a,b) => (b.date||"").localeCompare(a.date||""));
  const mi = parseInt(k.slice(5,7),10) - 1, yr = k.slice(0,4);

  let h = head(m.name, "Cheltuielile sunt grupate pe luni — o singură fișă pe lună, oricâte mișcări.",
    '<button class="btn" data-a="fadd">'+svg("plus")+'Mișcare nouă</button>');

  h += '<div class="bar"><button class="btn ghost sm" data-a="fprev">‹</button>' +
       '<b style="min-width:150px;text-align:center;font-weight:600">'+MONTHS_L[mi]+" "+yr+'</b>' +
       '<button class="btn ghost sm" data-a="fnext">›</button>' +
       '<div class="grow"></div>' +
       (k !== ym() ? '<button class="btn ghost sm" data-a="fnow">Luna curentă</button>' : '') + '</div>';

  h += '<div class="tiles">' +
    tile("Venituri", money(t.inc), "", "good") +
    tile("Cheltuieli", money(t.out), "", "bad") +
    tile("Balanță", money(t.bal), t.bal >= 0 ? "ai rămas pe plus" : "ai ieșit pe minus", t.bal < 0 ? "bad" : "good", true) +
    '</div>';

  /* grafic ultimele 6 luni */
  const keys = []; const d0 = new Date(k + "-01T12:00:00");
  for(let i = 5; i >= 0; i--){ const d = new Date(d0); d.setMonth(d.getMonth() - i); keys.push(iso(d).slice(0,7)); }
  const tot = keys.map(monthTotals);
  const max = Math.max(1, ...tot.map(x => Math.max(x.inc, x.out)));
  if(tot.some(x => x.inc || x.out)){
    h += sec("Ultimele 6 luni", '<div class="legend"><b><s style="background:var(--good)"></s>venit</b><b><s style="background:var(--bad);opacity:.75"></s>cheltuit</b></div>');
    h += '<div class="card pad"><div class="bars">' + keys.map((kk,i) => {
      const a = tot[i];
      return '<div class="b" title="'+MONTHS_L[parseInt(kk.slice(5,7),10)-1]+': venit '+money(a.inc)+', cheltuit '+money(a.out)+'">' +
        '<div class="pair"><i class="in" style="height:'+(a.inc/max*100)+'%"></i><i class="out" style="height:'+(a.out/max*100)+'%"></i></div>' +
        '<em>'+MONTHS[parseInt(kk.slice(5,7),10)-1]+'</em></div>';
    }).join("") + '</div></div>';
  }

  /* categorii */
  const byCat = {};
  items.filter(x => x.type === "out").forEach(x => { byCat[x.cat||"Altele"] = (byCat[x.cat||"Altele"]||0) + num(x.amount); });
  const cats = Object.keys(byCat).sort((a,b) => byCat[b] - byCat[a]);
  if(cats.length){
    h += sec("Pe categorii");
    h += '<div class="rows">' + cats.map(c => {
      const v = byCat[c], pct = t.out ? v/t.out*100 : 0;
      return '<div class="row"><div class="main"><span class="ttl">'+esc(c)+'</span>' +
        '<div class="prog" style="margin-top:5px;max-width:260px"><i style="width:'+pct+'%"></i></div></div>' +
        '<span class="sub num" style="min-width:44px;text-align:right">'+pct.toFixed(0)+'%</span>' +
        '<span class="amt">'+money(v)+'</span></div>';
    }).join("") + '</div>';
  }

  h += sec("Mișcări în " + MONTHS_L[mi]);
  if(!items.length){
    h += '<div class="empty"><h3>Nicio mișcare în '+MONTHS_L[mi]+'</h3><p>Adaugă un venit sau o cheltuială și luna asta prinde viață. Totalurile și graficul se calculează singure.</p>' +
      '<button class="btn" data-a="fadd">'+svg("plus")+'Adaugă prima mișcare</button>' +
      '<div class="demo"><span class="demo-tag">Exemplu — așa va arăta</span><div class="rows">' +
      '<div class="row"><span class="stripe good"></span><div class="main"><span class="ttl">Factură client</span><span class="sub">Business · 3 '+MONTHS[mi]+'</span></div><span class="amt" style="color:var(--good)">+'+money(1200).replace("−","")+'</span></div>' +
      '<div class="row"><span class="stripe bad"></span><div class="main"><span class="ttl">Cumpărături</span><span class="sub">Mâncare · 5 '+MONTHS[mi]+'</span></div><span class="amt">−'+money(84.5).replace("−","")+'</span></div>' +
      '</div></div></div>';
  } else {
    h += '<div class="rows">' + items.map(x => {
      const inc = x.type === "in";
      return '<div class="row"><span class="stripe '+(inc?"good":"bad")+'"></span>' +
        '<div class="main"><span class="ttl">'+esc(x.note || (inc?"Venit":"Cheltuială"))+'</span>' +
        '<span class="sub">'+esc(x.cat||"Altele")+' · '+dLabel(x.date)+'</span></div>' +
        '<span class="amt" style="'+(inc?"color:var(--good)":"")+'">'+(inc?"+":"−")+money(num(x.amount)).replace("−","")+'</span>' +
        '<button class="icon-btn del" data-a="fdel" data-i="'+x.id+'" aria-label="Șterge">'+svg("trash")+'</button></div>';
    }).join("") + '</div>';
  }
  return h;
}
