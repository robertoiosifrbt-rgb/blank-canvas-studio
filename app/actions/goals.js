import { gCur, gFmt, gHasTarget, gKind, gUnit } from "../goals.js";
import { ask, modal } from "../modal.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { money, num, toast, today, uid } from "../util.js";

export const goalsActions = {
  /* obiective */
  gadd(el){
    const mid = el.dataset.m;
    modal({title:"Obiectiv nou",
      note:"O <b>sumă</b> se adună spre o țintă. O <b>măsurătoare</b> se mută de la o valoare la alta.",
      fields:[
        {k:"name", label:"Numele obiectivului", ph:"ex: 100k, six pack"},
        {k:"kind", label:"Fel", type:"select", value:"sum", options:[
          {v:"sum",    l:"Sumă de strâns — bani, contribuții"},
          {v:"metric", l:"Măsurătoare — kg, %, cm"}]},
        {k:"unit", label:"Unitate (doar la măsurătoare)", ph:"kg, %, cm"},
        {k:"start", label:"De la ce valoare pornești", type:"number", ph:"0"},
        {k:"target", label:"Ținta", type:"number", ph:"0"},
        {k:"due", label:"Până când (opțional)", type:"date"}
      ],
      onOk(v){
        if(!v.name) return "Dă-i un nume obiectivului.";
        if(v.target === "") return "Scrie ținta.";
        const st = num(v.start), tg = num(v.target);
        const g = {mod:mid, name:v.name, kind:v.kind, target:tg, due:v.due||"", main:true,
          habits:[], createdAt:new Date().toISOString()};
        if(v.kind === "metric"){
          if(st === tg) return "Ținta trebuie să fie diferită de valoarea de start.";
          g.unit = v.unit || ""; g.start = st;
          g.reads = [{id:uid(), date:today(), value:st, note:"Punct de pornire"}];
        } else {
          if(tg <= 0) return "Ținta trebuie să fie mai mare ca zero.";
          g.contrib = st > 0 ? [{id:uid(), date:today(), amount:st, note:"Punct de pornire"}] : [];
        }
        Store.put("goals", "g" + uid(), g);
        toast("Obiectiv stabilit. Îl vezi acum pe fiecare ecran.");
      }});
  },
  gcon(el){
    const id = el.dataset.i, g = state.goals[id]; if(!g) return;
    const rem = Math.max(0, num(g.target) - gCur(g));
    modal({title:"Contribuție la „" + g.name + "”",
      note:"Mai ai de strâns <b>" + money(rem) + "</b>.",
      fields:[{k:"amount", label:"Cât adaugi", type:"number", ph:"0.00"},
              {k:"date", label:"Data", type:"date", value:today()},
              {k:"note", label:"Din ce (opțional)", ph:"ex: economii septembrie"}],
      onOk(v){
        const a = num(v.amount);
        if(a <= 0) return "Scrie o sumă mai mare ca zero.";
        Store.put("goals", id, Object.assign({}, g, {contrib:(g.contrib||[]).concat([{id:uid(), date:v.date||today(), amount:a, note:v.note||""}])}));
        toast(a >= rem ? "Obiectiv atins. Felicitări." : "Adăugat. Mai ai " + money(rem - a) + ".");
      }});
  },
  gread(el){
    const id = el.dataset.i, g = state.goals[id]; if(!g) return;
    modal({title:"Măsurătoare — " + g.name,
      note: gHasTarget(g) ? "Acum: <b>" + gFmt(g, gCur(g)) + "</b> · ținta: <b>" + gFmt(g, num(g.target)) + "</b>" : "",
      fields:[{k:"value", label:"Valoarea de azi" + (gUnit(g) ? " (" + gUnit(g) + ")" : ""), type:"number", ph:"0"},
              {k:"date", label:"Data", type:"date", value:today()},
              {k:"note", label:"Observație (opțional)", ph:"ex: dimineața, pe nemâncate"}],
      onOk(v){
        if(v.value === "") return "Scrie valoarea măsurată.";
        const val = num(v.value);
        const reads = (g.reads||[]).filter(r => r.date !== (v.date||today()));
        Store.put("goals", id, Object.assign({}, g, {reads:reads.concat([{id:uid(), date:v.date||today(), value:val, note:v.note||""}])}));
        const rem = num(g.target) - val;
        toast(Math.abs(rem) < 0.05 ? "Ținta atinsă. Bravo." : "Notat. Mai ai " + gFmt(g, Math.abs(rem)) + ".");
      }});
  },
  gundo(el){
    const id = el.dataset.i, g = state.goals[id], cid = el.dataset.c; if(!g) return;
    const patch = gKind(g) === "sum"
      ? {contrib:(g.contrib||[]).filter(c => c.id !== cid)}
      : {reads:(g.reads||[]).filter(c => c.id !== cid)};
    Store.put("goals", id, Object.assign({}, g, patch));
    toast("Șters.");
  },
  gedit(el){
    const id = el.dataset.i, g = state.goals[id]; if(!g) return;
    const metric = gKind(g) === "metric";
    const f = [{k:"name", label:"Nume", value:g.name}];
    if(metric) f.push({k:"unit", label:"Unitate", value:gUnit(g), ph:"kg, %, cm"},
                      {k:"start", label:"Valoarea de plecare", type:"number", value:g.start === undefined ? "" : num(g.start)});
    f.push({k:"target", label:"Ținta", type:"number", value: gHasTarget(g) ? num(g.target) : ""},
           {k:"due", label:"Până când (opțional)", type:"date", value:g.due||""});
    modal({title:"Modifică „" + g.name + "”", fields:f,
      onOk(v){
        if(!v.name) return "Dă-i un nume.";
        if(v.target === "") return "Scrie ținta.";
        const patch = {name:v.name, target:num(v.target), due:v.due||""};
        if(metric){
          patch.unit = v.unit || "";
          patch.start = num(v.start);
          if(patch.start === patch.target) return "Ținta trebuie să fie diferită de valoarea de plecare.";
          if(!(g.reads||[]).length) patch.reads = [{id:uid(), date:today(), value:patch.start, note:"Punct de pornire"}];
        } else if(num(v.target) <= 0) return "Ținta trebuie să fie mai mare ca zero.";
        Store.put("goals", id, Object.assign({}, g, patch));
      }});
  },
  gtog(el){
    const id = el.dataset.i, g = state.goals[id], hid = el.dataset.c; if(!g) return;
    const cur = g.habits || [];
    Store.put("goals", id, Object.assign({}, g, {habits: cur.includes(hid) ? cur.filter(x => x !== hid) : cur.concat([hid])}));
  },
  gmain(el){
    const id = el.dataset.i, g = state.goals[id]; if(!g) return;
    Store.put("goals", id, Object.assign({}, g, {main: !g.main}));
    toast(g.main ? "Scos dintre ancore." : "Devine ancoră — apare pe toate ecranele.");
  },
  gdel(el){
    const id = el.dataset.i, g = state.goals[id]; if(!g) return;
    ask("Ștergi „" + g.name + "”?", "Se pierde și tot istoricul. Nu se poate anula.", "Șterge",
      () => { Store.drop("goals", id); toast("Obiectiv șters."); });
  }
};
