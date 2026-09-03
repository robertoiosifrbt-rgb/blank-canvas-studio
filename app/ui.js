import { BUILTIN, MONTHS_L, svg } from "./config.js";
import { anchors, gCur, gFmt, gHasTarget, gPct, goalStrip } from "./goals.js";
import { limitBanner, worstLimit } from "./limits.js";
import { childrenOf, itemsOf, modById, moduleTree, pathOf } from "./modules.js";
import { Store } from "./store.js";
import { state } from "./state.js";
import { $, daysTo, esc, num, today, ym } from "./util.js";
import { viewCalendar } from "./views/calendar.js";
import { viewDash } from "./views/dashboard.js";
import { viewDebts } from "./views/debts.js";
import { remaining, viewFinance } from "./views/finance.js";
import { viewGoals } from "./views/goals.js";
import { viewHabits } from "./views/habits.js";
import { viewNotes } from "./views/notes.js";
import { viewSettings } from "./views/settings.js";
import { viewTasks } from "./views/tasks.js";


export function paintMode(){
  const m = Store.mode, ok = m === "cloud" || m === "state";
  $("#modeDot").className = "dot" + (ok ? "" : " local");
  $("#modeTxt").textContent = m === "state" ? "sincronizat · cloud propriu"
    : m === "cloud" ? "sincronizat"
    : Store.err ? "cloud indisponibil" : "doar pe acest aparat";
  $("#modeTxt").title = m === "state"
    ? "Datele se salvează prin state-api, în baza ta de date."
    : ok ? "Datele se salvează în cloud și le vezi de pe orice aparat."
    : (Store.err ? "Nu s-a putut conecta: " + Store.err + ". " : "") +
      "Datele stau doar în acest browser. Exportă-le regulat din Setări.";
}
export function paintRailGoal(){
  const box = $("#railGoal"), a = anchors();
  box.innerHTML = a.map(g => {
    const pct = gPct(g), ready = gHasTarget(g);
    return '<div class="rail-one"><div class="gauge-t"><span>'+esc(g.name)+'</span><span>'+(ready?pct.toFixed(0)+'%':'—')+'</span></div>' +
      '<div class="gauge-bar"><i style="width:'+Math.max(pct,1.5)+'%"></i></div>' +
      '<div class="gauge-t"><span class="num" style="letter-spacing:0;text-transform:none">'+
        (ready ? gFmt(g, gCur(g)) + ' / ' + gFmt(g, num(g.target)) : 'de completat') + '</span></div></div>';
  }).join("");
}
export function paintGauge(){
  const w = worstLimit();
  if(!w) return;
  $("#gaugeN").textContent = w.show;
  $("#gaugeBar").style.width = Math.max(1.5, w.pct) + "%";
  $("#gaugeBar").style.background = w.pct >= 90 ? "var(--bad)" : w.pct >= 75 ? "var(--warn)" : "var(--accent)";
  const t = $("#gaugeLbl");
  if(t) t.textContent = w.label;
  $("#gaugeN").title = w.why + " " + w.fix;
}
export const PIN = ["azi","goals","calendar","finante"];
export function renderNav(){
  const ms = moduleTree();
  let h = '<div class="nav-h">Module</div>';
  ms.forEach(m => {
    /* Bulină doar pentru ce cere o acțiune. Câte obiective sau notițe ai
       nu e o sarcină, deci n-are ce sta aprins permanent. */
    let c = "";
    if(m.kind === "tasks")  c = itemsOf("tasks", m.id).filter(t => !t.done).length || "";
    if(m.kind === "habits") c = itemsOf("habits", m.id).filter(h => !(h.log||{})[today()]).length || "";
    if(m.kind === "debts")  c = Object.keys(state.debts).filter(id => {
      const d = state.debts[id];
      return remaining(d) > 0 && d.due && daysTo(d.due) <= 7;
    }).length || "";
    h += '<a href="#" data-a="go" data-i="'+m.id+'" class="'+(state.view===m.id?"on ":"")+(PIN.includes(m.id)?"mob":"")+'" style="--d:'+(m.depth||0)+'">'+svg(m.kind)+
         '<span>'+esc(m.name)+'</span>'+(c?'<span class="cnt num">'+c+'</span>':'')+'</a>';
  });
  h += '<div class="nav-h">Aplicație</div>' +
       '<a href="#" data-a="newmod">'+svg("plus")+'<span>Modul nou</span></a>' +
       '<a href="#" data-a="go" data-i="__set" class="'+(state.view==="__set"?"on":"")+'">'+svg("settings")+'<span>Setări</span></a>' +
       '<a href="#" data-a="more" class="only-mob '+(PIN.includes(state.view)?"":"on")+'">'+svg("more")+'<span>Mai mult</span></a>';
  $("#nav").innerHTML = h;
}
export function render(){
  if(!state.ready){ $("#view").innerHTML = '<p style="color:var(--ink-3);font-family:var(--f-mono);font-size:12px">Se încarcă…</p>'; return; }
  renderNav(); paintGauge(); paintRailGoal();
  const d = new Date();
  $("#brandDate").textContent = d.getDate() + " " + MONTHS_L[d.getMonth()];
  const m = state.view === "__set" ? {kind:"settings"} : (modById(state.view) || BUILTIN[0]);
  const fns = {dashboard:viewDash, finance:viewFinance, debts:viewDebts, tasks:viewTasks, habits:viewHabits, notes:viewNotes, goals:viewGoals, calendar:viewCalendar, settings:viewSettings};
  const body = (fns[m.kind] || viewDash)(m);
  const kids = m.id ? childrenOf(m.id) : [];
  const trail = m.id ? pathOf(m.id) : [];
  const crumb = trail.length > 1
    ? '<nav class="crumb">' + trail.map((p, i) => i === trail.length - 1
        ? '<span>' + esc(p.name) + '</span>'
        : '<button data-a="go" data-i="' + p.id + '">' + esc(p.name) + '</button><i>›</i>').join("") + '</nav>'
    : "";
  const subs = kids.length
    ? '<div class="subs">' + kids.map(c =>
        '<button class="sub-chip" data-a="go" data-i="' + c.id + '">' + svg(c.kind) +
        '<span>' + esc(c.name) + '</span></button>').join("") + '</div>'
    : "";
  $("#view").innerHTML = limitBanner() + (m.kind === "dashboard" || m.kind === "goals" ? "" : goalStrip()) + crumb + subs + body;
}
export function head(title, sub, actions){
  return '<div class="head"><div><h1>'+esc(title)+'</h1>'+(sub?'<p>'+sub+'</p>':'')+'</div><div class="sp"></div>'+(actions||"")+'</div>';
}
export function sec(t, extra){ return '<div class="sec-h"><h2>'+esc(t)+'</h2><div class="ln"></div>'+(extra||"")+'</div>'; }
export function tile(k, v, s, cls, lead){
  return '<div class="tile'+(lead?" lead":"")+'"><span class="k">'+esc(k)+'</span><span class="v '+(cls||"")+'">'+v+'</span>'+(s?'<span class="s">'+s+'</span>':'')+'</div>';
}
