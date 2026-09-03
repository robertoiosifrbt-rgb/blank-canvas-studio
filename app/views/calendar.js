import { WEEK, dayDots, dayItems, isToday, monthGrid } from "../calendar.js";
import { MONTHS_L } from "../config.js";
import { ui } from "../state.js";
import { dLabel, esc, money, today, ym } from "../util.js";
import { head, sec } from "../ui.js";
import { svg } from "../config.js";

export function viewCalendar(m) {
  const k = ui.calMonth || ym();
  const sel = ui.calDay || today();
  const mi = parseInt(k.slice(5, 7), 10) - 1;
  const cells = monthGrid(k);

  let h = head(m.name, "Tot ce ai în aplicație, așezat pe zile.",
    '<button class="btn" data-a="ctask">' + svg("plus") + 'Task nou</button>');

  h += '<div class="cal-bar"><button class="btn ghost sm" data-a="cprev" aria-label="Luna anterioară">‹</button>' +
    '<b>' + MONTHS_L[mi] + " " + k.slice(0, 4) + '</b>' +
    '<button class="btn ghost sm" data-a="cnext" aria-label="Luna următoare">›</button>' +
    (k !== ym() ? '<button class="btn ghost sm cal-now" data-a="cnow">Azi</button>' : '') + '</div>';

  h += '<div class="cal card"><div class="cal-week">' +
    WEEK.map(d => '<span>' + d + '</span>').join("") + '</div><div class="cal-grid">' +
    cells.map(c => {
      const dots = dayDots(c.date);
      return '<button class="cal-day' + (c.inMonth ? "" : " out") +
        (c.date === sel ? " sel" : "") + (isToday(c.date) ? " azi" : "") +
        '" data-a="cday" data-i="' + c.date + '">' +
        '<em>' + c.day + '</em><span class="dots">' +
        dots.map(d => '<i class="' + d + '"></i>').join("") + '</span></button>';
    }).join("") + '</div></div>';

  const items = dayItems(sel);
  h += sec(dLabel(sel) === "azi" ? "Azi" : dLabel(sel));
  if (!items.length) {
    h += '<div class="card pad" style="color:var(--ink-2);font-size:14px">' +
      'Nimic în ziua asta. Adaugă un task, sau treci pe altă zi.</div>';
  } else {
    h += '<div class="rows">' + items.map(i =>
      '<div class="row"><span class="stripe ' + i.cls + '"></span>' +
      '<div class="main"><span class="ttl">' + esc(i.title) + '</span>' +
      '<span class="sub">' + esc(i.sub) + '</span></div>' +
      (i.amount !== undefined
        ? '<span class="amt"' + (i.inflow ? ' style="color:var(--good)"' : '') + '>' +
          (i.inflow ? "+" : "") + money(i.amount).replace("−", "") + '</span>'
        : '') + '</div>').join("") + '</div>';
  }
  return h;
}
