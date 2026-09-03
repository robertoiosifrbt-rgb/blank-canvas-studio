import { svg } from "../config.js";
import { anchors, gCur, gFmt, gHasTarget, gKind, gPct, goalFacts, goalHeroes, goalStatus, goalsAll } from "../goals.js";
import { state } from "../state.js";
import { head, sec } from "../ui.js";
import { dLabel, esc, money, num } from "../util.js";

/* ══════════ Goals ══════════ */
export function viewGoals(m){
  const all = goalsAll().filter(g => (g.mod||"goals") === m.id)
    .sort((x,y) => (y.main?1:0)-(x.main?1:0) || (x.createdAt||"").localeCompare(y.createdAt||""));
  const anc = anchors(), ancIds = anc.map(g => g.id);

  let h = head(m.name, "Țintele în jurul cărora se învârte tot. Apar pe fiecare ecran.",
    '<button class="btn" data-a="gadd" data-m="'+m.id+'">'+svg("plus")+'Obiectiv nou</button>');

  if(!all.length){
    return h + '<div class="empty"><h3>Niciun obiectiv stabilit</h3>' +
      '<p>Un obiectiv e ori o sumă de strâns, ori o măsurătoare care trebuie să se miște. Alege tipul și aplicația calculează singură ritmul și în ce lună ajungi.</p>' +
      '<button class="btn" data-a="gadd" data-m="'+m.id+'">'+svg("plus")+'Stabilește primul obiectiv</button></div>';
  }

  h += goalHeroes(true);

  /* obiceiurile care alimentează fiecare ancoră */
  const habits = Object.keys(state.habits).map(id => Object.assign({id}, state.habits[id]));
  if(habits.length){
    anc.forEach(g => {
      h += sec("Obiceiuri care duc la „" + g.name + "”");
      h += '<div class="card pad" style="display:flex;gap:8px;flex-wrap:wrap">' + habits.map(hb => {
        const on = (g.habits||[]).includes(hb.id);
        return '<button class="chip'+(on?" on":"")+'" data-a="gtog" data-i="'+g.id+'" data-c="'+hb.id+'">'+esc(hb.name)+'</button>';
      }).join("") + '</div>';
    });
  }

  const rest = all.filter(g => !ancIds.includes(g.id));
  if(rest.length){
    h += sec("Celelalte obiective");
    h += rest.map(g => {
      const cur = gCur(g), pct = gPct(g), st = goalStatus(g, false), ready = gHasTarget(g);
      const last = (gKind(g)==="sum" ? (g.contrib||[]) : (g.reads||[])).slice()
        .sort((x,y) => (y.date||"").localeCompare(x.date||"")).slice(0,3);
      return '<div class="goal-card" style="margin-bottom:12px">' +
        '<div class="goal-head"><h4>'+esc(g.name)+'</h4>' +
        (st?'<span class="pill '+st.cls+'">'+st.txt+'</span>':'') +
        (g.due?'<span class="pill">'+dLabel(g.due)+'</span>':'') + '</div>' +
        (ready ? '<div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap">' +
          '<span class="num" style="font-size:21px;font-weight:600">'+gFmt(g, cur)+'</span>' +
          '<span style="font-size:13px;color:var(--ink-2)">'+(gKind(g)==="sum"?"din ":"→ ")+gFmt(g, num(g.target))+'</span>' +
          '<span class="num" style="margin-left:auto;font-weight:600;color:var(--accent-ink)">'+pct.toFixed(pct<10?1:0)+'%</span></div>' +
          '<div class="prog" style="height:7px"><i style="width:'+Math.max(pct,0.8)+'%"></i></div>' +
          '<div class="hero-facts">' + goalFacts(g, false).map(f => '<div><b>'+f.v+'</b><span>'+esc(f.k)+'</span></div>').join("") + '</div>'
          : '<p style="margin:0;font-size:13.5px;color:var(--ink-2)">Fără țintă stabilită încă.</p>') +
        (last.length ? '<div style="display:flex;flex-direction:column;gap:1px;border-top:1px solid var(--line);padding-top:9px">' +
          '<span style="font-family:var(--f-mono);font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">' +
          (gKind(g)==="sum" ? "Ultimele contribuții" : "Ultimele măsurători") + '</span>' +
          last.map(c => '<div style="display:flex;align-items:center;gap:10px;font-size:13.5px">' +
            '<span style="flex:1;min-width:0;overflow-wrap:anywhere">'+esc(c.note || (gKind(g)==="sum"?"Contribuție":"Măsurătoare"))+'</span>' +
            '<span style="color:var(--ink-3);font-size:12.5px;white-space:nowrap">'+dLabel(c.date)+'</span>' +
            '<span class="num" style="font-weight:600;white-space:nowrap">'+(gKind(g)==="sum" ? '+'+money(num(c.amount)) : gFmt(g, num(c.value)))+'</span>' +
            '<button class="icon-btn del" data-a="gundo" data-i="'+g.id+'" data-c="'+c.id+'" aria-label="Șterge">'+svg("trash")+'</button></div>').join("") +
          '</div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn sm" data-a="'+(gKind(g)==="sum"?"gcon":"gread")+'" data-i="'+g.id+'">'+svg("plus")+(gKind(g)==="sum"?"Contribuție":"Măsurătoare")+'</button>' +
        '<button class="btn ghost sm" data-a="gmain" data-i="'+g.id+'">Fă-l ancoră</button>' +
        '<button class="btn ghost sm" data-a="gedit" data-i="'+g.id+'">Modifică</button>' +
        '<button class="icon-btn del" style="margin-left:auto" data-a="gdel" data-i="'+g.id+'" aria-label="Șterge">'+svg("trash")+'</button>' +
        '</div></div>';
    }).join("");
  }
  return h;
}
