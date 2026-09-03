import { svg } from "../config.js";
import { itemsOf } from "../modules.js";
import { head } from "../ui.js";
import { ui } from "../state.js";
import { dLabel, esc, today } from "../util.js";

/* ══════════ Task-uri ══════════ */
export function taskRow(t){
  const late = !t.done && t.due && t.due < today();
  const soon = !t.done && t.due === today();
  return '<div class="row '+(t.done?"done":"")+'">' +
    '<button class="chk '+(t.done?"on":"")+'" data-a="tdone" data-i="'+t.id+'" aria-label="Bifează">'+svg("check")+'</button>' +
    '<div class="main"><span class="ttl">'+esc(t.title)+'</span>' +
    (t.due||t.proj ? '<span class="sub">'+(t.proj?'<span class="pill">'+esc(t.proj)+'</span>':'') +
      (t.due?'<span class="'+(late?"pill bad":soon?"pill warn":"")+'">'+(late?"restant ":"")+dLabel(t.due)+'</span>':'')+'</span>' : '') +
    '</div>' +
    '<button class="icon-btn del" data-a="tdel" data-i="'+t.id+'" aria-label="Șterge">'+svg("trash")+'</button></div>';
}
export function viewTasks(m){
  const all = itemsOf("tasks", m.id);
  const open = all.filter(t => !t.done), done = all.filter(t => t.done);
  const f = ui.taskFilter;
  let list = f === "open" ? open : f === "done" ? done : all;
  list = list.slice().sort((a,b) => {
    if(!!a.done !== !!b.done) return a.done ? 1 : -1;
    const ad = a.due || "9999-99-99", bd = b.due || "9999-99-99";
    return ad === bd ? (b.createdAt||"").localeCompare(a.createdAt||"") : ad.localeCompare(bd);
  });

  let h = head(m.name, open.length ? open.length + (open.length===1?" lucru de făcut":" lucruri de făcut") : "Totul bifat.",
    '<button class="btn" data-a="tadd" data-m="'+m.id+'">'+svg("plus")+'Task nou</button>');

  h += '<div class="bar"><div class="seg">' +
    ['open','all','done'].map(x => '<button data-a="tfilter" data-i="'+x+'" class="'+(f===x?"on":"")+'">'+
      (x==="open"?"De făcut":x==="all"?"Toate":"Gata")+' '+(x==="open"?open.length:x==="all"?all.length:done.length)+'</button>').join("") +
    '</div><div class="grow"></div>' +
    (done.length ? '<button class="btn ghost sm" data-a="tclear" data-m="'+m.id+'">Curăță bifate ('+done.length+')</button>' : '') + '</div>';

  if(!list.length){
    h += '<div class="empty"><h3>'+(f==="done"?"Niciun task bifat încă":all.length?"Nimic aici":"Listă goală")+'</h3>' +
      '<p>'+(all.length?"Schimbă filtrul de mai sus ca să vezi restul.":"Scrie primul task. Poți să-i pui o scadență și un proiect, ca să știi ce e urgent.")+'</p>' +
      (all.length?'':'<button class="btn" data-a="tadd" data-m="'+m.id+'">'+svg("plus")+'Adaugă primul task</button>' +
      '<div class="demo"><span class="demo-tag">Exemplu — așa va arăta</span><div class="rows">' +
      '<div class="row"><span class="chk"></span><div class="main"><span class="ttl">Trimis factura pe septembrie</span><span class="sub"><span class="pill">personal</span><span class="pill warn">azi</span></span></div></div>' +
      '<div class="row done"><span class="chk on">'+svg("check")+'</span><div class="main"><span class="ttl">Programare la dentist</span></div></div>' +
      '</div></div>') + '</div>';
  } else h += '<div class="rows">' + list.map(taskRow).join("") + '</div>';
  return h;
}
