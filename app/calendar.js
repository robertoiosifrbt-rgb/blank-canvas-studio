import { state } from "./state.js";
import { num, iso, today } from "./util.js";
import { monthItems, remaining } from "./views/finance.js";

/* Calendarul nu ține date proprii. Le citește pe ale celorlalte module,
   ca o zi să arate tot ce se întâmplă în ea. */

export const WEEK = ["L", "Ma", "Mi", "J", "V", "S", "D"];

/* Zilele lunii, în casete de câte 7, cu luni prima. */
export function monthGrid(ym) {
  const first = new Date(ym + "-01T12:00:00");
  const shift = (first.getDay() + 6) % 7;          /* luni = 0 */
  const start = new Date(first);
  start.setDate(1 - shift);
  const out = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({ date: iso(d), inMonth: iso(d).slice(0, 7) === ym, day: d.getDate() });
    if (i >= 34 && iso(d).slice(0, 7) !== ym) break;   /* fără rând gol la final */
  }
  return out;
}

/* Tot ce cade într-o zi, din toate modulele. */
export function dayItems(date) {
  const out = [];

  Object.keys(state.tasks).forEach(id => {
    const t = state.tasks[id];
    if (t.due === date) out.push({ kind: "task", cls: t.done ? "good" : "acc",
      title: t.title, sub: t.done ? "bifat" : (t.proj || "task"), id });
  });

  Object.keys(state.debts).forEach(id => {
    const d = state.debts[id];
    if (d.due === date && remaining(d) > 0)
      out.push({ kind: "debt", cls: "warn", title: d.name, sub: "scadență", amount: remaining(d) });
  });

  monthItems(date.slice(0, 7)).forEach(x => {
    if (x.date === date) out.push({ kind: "money", cls: x.type === "in" ? "good" : "bad",
      title: x.note || (x.type === "in" ? "Venit" : "Cheltuială"),
      sub: x.cat || "Altele", amount: num(x.amount), inflow: x.type === "in" });
  });

  Object.keys(state.habits).forEach(id => {
    const h = state.habits[id];
    if ((h.log || {})[date]) out.push({ kind: "habit", cls: "good", title: h.name, sub: "bifat" });
  });

  Object.keys(state.goals).forEach(id => {
    const g = state.goals[id];
    if (g.due === date) out.push({ kind: "goal", cls: "ochre", title: g.name, sub: "termen" });
    (g.contrib || []).forEach(c => { if (c.date === date)
      out.push({ kind: "goal", cls: "ochre", title: g.name, sub: c.note || "contribuție", amount: num(c.amount) }); });
    (g.reads || []).forEach(r => { if (r.date === date)
      out.push({ kind: "goal", cls: "ochre", title: g.name, sub: "măsurătoare" }); });
  });

  return out;
}

/* Punctele colorate de sub numărul zilei — cel mult patru feluri. */
export function dayDots(date) {
  const seen = [];
  dayItems(date).forEach(i => { if (!seen.includes(i.cls)) seen.push(i.cls); });
  return seen.slice(0, 4);
}

export const isToday = d => d === today();
