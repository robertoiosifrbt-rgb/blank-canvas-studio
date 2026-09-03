import { ask, modal } from "../modal.js";
import { descendants, itemsOf, modById, moduleTree } from "../modules.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { toast, uid } from "../util.js";

export const modulesActions = {
  /* module */
  newmod(){
    modal({title:"Modul nou", note:"Alege ce fel de modul vrei. Apare imediat în bara laterală.",
      fields:[
        {k:"name", label:"Nume", ph:"ex: Sănătate, Rețete, Clienți"},
        {k:"parent", label:"Sub ce modul", type:"select", value:"", options:
          [{v:"", l:"Niciunul — stă la rădăcină"}].concat(
            moduleTree().map(m => ({v:m.id, l:"— ".repeat(m.depth) + m.name})))},
        {k:"kind", label:"Tip", type:"select", value:"tasks", options:[
          {v:"tasks", l:"Listă de bifat — lucruri de făcut"},
          {v:"notes", l:"Notițe — text liber, cu căutare"},
          {v:"habits", l:"Tracker — bifezi zilnic, vezi seria"},
          {v:"goals",  l:"Obiective — ținte cu progres și termen"}]}
      ],
      onOk(v){
        if(!v.name) return "Dă-i un nume modulului.";
        const id = "m" + uid();
        Store.put("modules", id, {name:v.name, kind:v.kind, parent:v.parent || "", createdAt:new Date().toISOString()});
        state.view = id; toast("Modulul „" + v.name + "” a fost creat.");
      }});
  },
  mdel(el){
    const id = el.dataset.i, m = modById(id); if(!m) return;
    const kids = descendants(id);
    const all = [id].concat(kids.map(k => k.id));
    const n = all.reduce((s, mid) => s + ["tasks","notes","habits","goals"]
      .reduce((t, c) => t + itemsOf(c, mid).length, 0), 0);
    ask("Ștergi modulul „" + m.name + "”?",
      (kids.length ? "Se șterg și cele <b>" + kids.length + "</b> submodule. " : "") +
      (n ? "Se pierd <b>" + n + "</b> lucruri dinăuntru. Nu se poate anula." : "Nu se poate anula."),
      "Șterge modulul", () => {
        all.forEach(mid => ["tasks","notes","habits","goals"]
          .forEach(c => itemsOf(c, mid).forEach(x => Store.drop(c, x.id))));
        all.forEach(mid => Store.drop("modules", mid));
        if(state.view === id) state.view = "azi";
        toast("Modul șters.");
      });
  }
};
