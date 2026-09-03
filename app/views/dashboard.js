import { DAYS, MONTHS_L, svg } from "../config.js";
import { goalHeroes } from "../goals.js";
import { state } from "../state.js";
import { head, sec, tile } from "../ui.js";
import { dLabel, daysTo, esc, iso, money, today, ym, zile } from "../util.js";
import { monthItems, monthTotals, remaining } from "./finance.js";
import { taskRow } from "./tasks.js";

/* ══════════ Panoul „Azi" ══════════ */
export function viewDash(){
  const k = ym(), t = monthTotals(k), tod = today();
  const habits = Object.keys(state.habits).map(id => Object.assign({id}, state.habits[id]));
  const doneToday = habits.filter(h => (h.log||{})[tod]).length;
  const debts = Object.keys(state.debts).map(id => Object.assign({id}, state.debts[id])).filter(d => remaining(d) > 0);
  const debtLeft = debts.reduce((s,d) => s + remaining(d), 0);
  const tasks = Object.keys(state.tasks).map(id => Object.assign({id}, state.tasks[id]))
    .filter(x => !x.done && x.due && x.due <= tod)
    .sort((a,b) => (a.due||"").localeCompare(b.due||""));
  const soon = debts.filter(d => d.due).sort((a,b) => a.due.localeCompare(b.due)).slice(0,3);
  const dt = new Date();

  let h = head("Azi", esc(DAYS[dt.getDay()]==="D"?"duminică":["duminică","luni","marți","miercuri","joi","vineri","sâmbătă"][dt.getDay()]) + ", " + dt.getDate() + " " + MONTHS_L[dt.getMonth()] + " " + dt.getFullYear());

  h += goalHeroes(false);
  h += '<div class="tiles">' +
    tile("Balanța lunii", money(t.bal), MONTHS_L[parseInt(k.slice(5,7),10)-1], t.bal < 0 ? "bad" : "good", true) +
    tile("Cheltuit luna asta", money(t.out), monthItems(k).length + " mișcări") +
    tile("Datorii rămase", money(debtLeft), debts.length ? debts.length + (debts.length===1?" datorie activă":" datorii active") : "nicio datorie") +
    tile("Obiceiuri azi", habits.length ? doneToday + "/" + habits.length : "—", habits.length ? (doneToday === habits.length ? "toate bifate" : (habits.length - doneToday) + (habits.length - doneToday === 1 ? " rămas" : " rămase")) : "niciunul definit", doneToday === habits.length && habits.length ? "good" : "") +
    '</div>';

  if(habits.length){
    h += sec("Obiceiuri de bifat");
    h += '<div class="rows">' + habits.map(hb => {
      const on = !!(hb.log||{})[tod];
      return '<div class="row"><button class="chk '+(on?"on":"")+'" data-a="tick" data-i="'+hb.id+'" data-d="'+tod+'" aria-label="Bifează '+esc(hb.name)+'">'+svg("check")+'</button>' +
        '<div class="main"><span class="ttl">'+esc(hb.name)+'</span></div>' +
        '<span class="streak">'+zile(streak(hb))+'</span></div>';
    }).join("") + '</div>';
  }

  h += sec("De făcut " + (tasks.length ? "" : "— nimic restant"));
  h += tasks.length ? '<div class="rows">' + tasks.map(taskRow).join("") + '</div>'
     : '<div class="card pad" style="color:var(--ink-2);font-size:14px">Niciun task scadent azi sau restant. '+(Object.keys(state.tasks).length?'':'Adaugă primul în modulul <b>Task-uri</b>.')+'</div>';

  if(soon.length){
    h += sec("Scadențe apropiate");
    h += '<div class="rows">' + soon.map(d => {
      const n = daysTo(d.due), cls = n < 0 ? "bad" : n <= 7 ? "warn" : "good";
      return '<div class="row"><span class="stripe '+cls+'"></span><div class="main"><span class="ttl">'+esc(d.name)+'</span>' +
        '<span class="sub">'+(n < 0 ? "restanță de " + zile(Math.abs(n)) : n === 0 ? "scadent azi" : "în " + zile(n))+' · '+dLabel(d.due)+'</span></div>' +
        '<span class="amt">'+money(remaining(d))+'</span></div>';
    }).join("") + '</div>';
  }
  return h;
}
export function streak(hb){
  const log = hb.log || {}; let n = 0; const d = new Date();
  if(!log[iso(d)]) d.setDate(d.getDate()-1);
  while(log[iso(d)]){ n++; d.setDate(d.getDate()-1); }
  return n;
}
