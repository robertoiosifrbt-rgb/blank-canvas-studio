import { MONTHS, svg } from "./config.js";
import { state } from "./state.js";
import { dLabel, esc, iso, money, num, zile } from "./util.js";
import { monthItems, monthTotals } from "./views/finance.js";

/* ══════════ Obiective: calcule ══════════ */
/* Două feluri de obiectiv, măsurate diferit:
   sum    — se adună contribuții spre o țintă (bani). Ritmul vine din Finanțe.
   metric — o măsurătoare se mută de la un punct de plecare spre o țintă
            (kg, %, cm). Ritmul vine din propriile citiri.               */
export const goalsAll = () => Object.keys(state.goals).map(id => Object.assign({id}, state.goals[id]));
export const gKind = g => g.kind === "metric" ? "metric" : "sum";
export const gUnit = g => g.unit || "";
export const gFmt = (g, v) => {
  if(gKind(g) === "sum") return money(v);
  const u = gUnit(g), n = (Math.round(v*10)/10).toLocaleString("ro-RO");
  return u ? n + (u === "%" ? "" : " ") + u : n;
};
export const gReads = g => (g.reads||[]).slice().sort((x,y) => (x.date||"").localeCompare(y.date||""));
export const gHasTarget = g => g.target !== "" && g.target !== null && g.target !== undefined;
export function gCur(g){
  if(gKind(g) === "sum") return (g.contrib||[]).reduce((s,c) => s + num(c.amount), 0);
  const r = gReads(g);
  return r.length ? num(r[r.length-1].value) : num(g.start);
}
export function gPct(g){
  if(!gHasTarget(g)) return 0;
  if(gKind(g) === "sum") return num(g.target) ? Math.max(0, Math.min(100, gCur(g)/num(g.target)*100)) : 0;
  const st = num(g.start), tg = num(g.target), cur = gCur(g);
  if(tg === st) return cur === tg ? 100 : 0;
  return Math.max(0, Math.min(100, (cur - st)/(tg - st)*100));
}
export const gDone = g => gHasTarget(g) && gPct(g) >= 100;
export function anchors(){
  const all = goalsAll();
  const pinned = all.filter(g => g.main);
  if(pinned.length) return pinned.sort((a,b) => (a.createdAt||"").localeCompare(b.createdAt||""));
  return all.length ? [all.slice().sort((a,b) => num(b.target)-num(a.target))[0]] : [];
}
/* ritmul banilor: media ultimelor 3 luni cu mișcări în Finanțe */
export function paceRate(){
  const keys = []; const d = new Date();
  for(let i = 2; i >= 0; i--){ const x = new Date(d); x.setMonth(x.getMonth()-i); keys.push(iso(x).slice(0,7)); }
  const withData = keys.filter(k => monthItems(k).length);
  if(!withData.length) return null;
  return withData.reduce((s,k) => s + monthTotals(k).bal, 0) / withData.length;
}
/* ritmul unei măsurători: din prima și ultima citire */
export function metricRate(g){
  const r = gReads(g);
  if(r.length < 2) return null;
  const f = r[0], l = r[r.length-1];
  const months = (new Date(l.date+"T12:00:00") - new Date(f.date+"T12:00:00"))/(864e5*30.44);
  if(months < 0.2) return null;
  return (num(l.value) - num(f.value))/months;
}
export const monthsTo = due => {
  const a = new Date(), b2 = new Date(due+"T12:00:00");
  return (b2.getFullYear()-a.getFullYear())*12 + (b2.getMonth()-a.getMonth()) + (b2.getDate()-a.getDate())/30;
};
export function whenAt(months){
  const d = new Date(); d.setDate(d.getDate() + Math.round(months * 30.44));
  return MONTHS[d.getMonth()] + " " + d.getFullYear();
}
/* consecvența obiceiurilor legate de obiectiv, pe 30 de zile */
export function gStreakPct(g){
  const ids = (g.habits||[]).filter(id => state.habits[id]);
  if(!ids.length) return null;
  const days = []; const d = new Date();
  for(let i = 0; i < 30; i++){ const x = new Date(d); x.setDate(x.getDate()-i); days.push(iso(x)); }
  let hit = 0;
  ids.forEach(id => { const log = state.habits[id].log || {}; days.forEach(x => { if(log[x]) hit++; }); });
  return hit/(ids.length*30)*100;
}
export function goalFacts(g, isAnchor){
  if(!gHasTarget(g)) return [];
  const out = [], cur = gCur(g), tgt = num(g.target);
  if(gKind(g) === "sum"){
    const rem = Math.max(0, tgt - cur);
    out.push({k:"Rămas", v:money(rem)});
    if(g.due && rem > 0){
      const m = monthsTo(g.due);
      out.push({k:"Necesar pe lună", v: m > 0 ? money(rem/m) : "termen depășit"});
    }
    const rate = isAnchor ? paceRate() : null;
    if(rem > 0 && rate !== null){
      out.push({k:"Ritmul tău", v:money(rate) + "/lună"});
      if(rate > 0) out.push({k:"Ajungi în", v:whenAt(rem/rate)});
    }
  } else {
    const rem = tgt - cur;
    out.push({k:"Rămas", v: Math.abs(rem) < 0.05 ? "atins" : gFmt(g, Math.abs(rem))});
    const rate = metricRate(g);
    if(rate !== null && Math.abs(rate) > 0.01){
      out.push({k:"Ritm", v:(rate > 0 ? "+" : "−") + gFmt(g, Math.abs(rate)) + "/lună"});
      if(Math.abs(rem) >= 0.05 && Math.sign(rate) === Math.sign(rem)) out.push({k:"Ajungi în", v:whenAt(rem/rate)});
    }
  }
  const cons = gStreakPct(g);
  if(cons !== null) out.push({k:"Consecvență 30z", v:cons.toFixed(0) + "%"});
  return out;
}
export function goalStatus(g, isAnchor){
  if(!gHasTarget(g)) return {cls:"warn", txt:"de completat"};
  if(gDone(g)) return {cls:"good", txt:"atins"};
  if(gKind(g) === "sum"){
    const rate = isAnchor ? paceRate() : null;
    if(!g.due || rate === null) return null;
    const m = monthsTo(g.due), rem = Math.max(0, num(g.target) - gCur(g));
    if(m <= 0) return {cls:"bad", txt:"termen depășit"};
    return rate >= rem/m ? {cls:"good", txt:"în grafic"} : {cls:"warn", txt:"sub ritm"};
  }
  const rate = metricRate(g);
  if(rate === null) return null;
  const rem = num(g.target) - gCur(g);
  if(Math.sign(rate) !== Math.sign(rem)) return {cls:"bad", txt:"în direcția greșită"};
  if(!g.due) return {cls:"good", txt:"se mișcă"};
  const m = monthsTo(g.due);
  if(m <= 0) return {cls:"bad", txt:"termen depășit"};
  return Math.abs(rate) >= Math.abs(rem)/m ? {cls:"good", txt:"în grafic"} : {cls:"warn", txt:"sub ritm"};
}

/* ── panourile mari, unul per ancoră ── */
/* Inel de progres — ocupă mult mai puțin decât o bară lată. */
export function ring(pct, ready){
  const C = 2 * Math.PI * 26;
  const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return '<div class="ringwrap"><svg class="ring" viewBox="0 0 62 62" aria-hidden="true">' +
    '<circle class="bg" cx="31" cy="31" r="26"></circle>' +
    '<circle class="fg" cx="31" cy="31" r="26" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"></circle>' +
    '</svg><b class="ringpct">'+(ready ? pct.toFixed(pct < 10 && pct > 0 ? 1 : 0) + "%" : "—")+'</b></div>';
}
export function goalHero(g, acts){
  const st = goalStatus(g, true), pct = gPct(g), ready = gHasTarget(g);
  let h = '<div class="hero"><div class="hero-main">' + ring(pct, ready) +
    '<div class="hero-txt"><span class="hero-name">'+esc(g.name)+
    (st?'<span class="pill '+st.cls+'">'+st.txt+'</span>':'')+'</span>';
  if(!ready){
    h += '<span class="of">Pune punctul de plecare și ținta, ca să-ți pot urmări progresul.</span></div></div>' +
      '<div><button class="btn sm" data-a="gedit" data-i="'+g.id+'">Completează</button></div></div>';
    return h;
  }
  h += '<span class="cur">'+gFmt(g, gCur(g))+'</span>' +
    '<span class="of">'+(gKind(g)==="sum"?"din ":"→ ")+gFmt(g, num(g.target))+(g.due?' · până în '+dLabel(g.due):'')+'</span>' +
    '</div></div>';
  /* pe „Azi" ținem doar esențialul; detaliile stau pe ecranul Goals */
  const facts = goalFacts(g, true).slice(0, acts ? 99 : 2);
  if(facts.length) h += '<div class="hero-facts">' +
    facts.map(f => '<div><b>'+f.v+'</b><span>'+esc(f.k)+'</span></div>').join("") + '</div>';
  if(acts) h += '<div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:11px">' +
    '<button class="btn sm" data-a="'+(gKind(g)==="sum"?"gcon":"gread")+'" data-i="'+g.id+'">'+svg("plus")+(gKind(g)==="sum"?"Contribuție":"Măsurătoare")+'</button>' +
    '<button class="btn ghost sm" data-a="gedit" data-i="'+g.id+'">Modifică</button>' +
    '<button class="icon-btn del" style="margin-left:auto" data-a="gdel" data-i="'+g.id+'" aria-label="Șterge">'+svg("trash")+'</button></div>';
  return h + '</div>';
}
export function goalHeroes(acts){
  const a = anchors();
  if(!a.length) return '<button class="strip" data-a="go" data-i="goals"><span class="lbl">Obiective</span>' +
    '<span style="flex:1;font-size:13.5px;color:var(--ink-2)">Niciunul stabilit — pune țintele în jurul cărora se învârte tot.</span>' +
    '<span class="v">Stabilește →</span></button>';
  return '<div class="heroes">' + a.map(g => goalHero(g, acts)).join("") + '</div>';
}
export function goalStrip(){
  const a = anchors();
  if(!a.length) return "";
  return '<div class="strips">' + a.map(g => {
    const pct = gPct(g), ready = gHasTarget(g);
    return '<button class="strip" data-a="go" data-i="goals" title="'+esc(g.name)+'">' +
      '<span class="lbl">'+esc(g.name)+'</span>' +
      '<span class="prog"><i style="width:'+Math.max(pct,0.8)+'%"></i></span>' +
      '<span class="v">'+(ready ? pct.toFixed(0)+'%' : 'de completat')+'</span></button>';
  }).join("") + '</div>';
}
