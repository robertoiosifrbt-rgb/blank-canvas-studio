import { ask, modal } from "../modal.js";
import { itemsOf, modById, modules } from "../modules.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { toast, uid } from "../util.js";

export const modulesActions = {
  /* module */
  newmod(){
    modal({title:"Modul nou", note:"Alege ce fel de modul vrei. Apare imediat în bara laterală.",
      fields:[
        {k:"name", label:"Nume", ph:"ex: Sănătate, Rețete, Clienți"},
        {k:"kind", label:"Tip", type:"select", value:"tasks", options:[
          {v:"tasks", l:"Listă de bifat — lucruri de făcut"},
          {v:"notes", l:"Notițe — text liber, cu căutare"},
          {v:"habits", l:"Tracker — bifezi zilnic, vezi seria"},
          {v:"goals",  l:"Obiective — ținte cu progres și termen"}]}
      ],
      onOk(v){
        if(!v.name) return "Dă-i un nume modulului.";
        const id = "m" + uid();
        Store.put("modules", id, {name:v.name, kind:v.kind, createdAt:new Date().toISOString()});
        state.view = id; toast("Modulul „" + v.name + "” a fost creat.");
      }});
  },
  mdel(el){
    const id = el.dataset.i, m = modById(id); if(!m) return;
    const n = itemsOf("tasks",id).length + itemsOf("notes",id).length + itemsOf("habits",id).length + itemsOf("goals",id).length;
    ask("Ștergi modulul „" + m.name + "”?",
      n ? "Se șterg și cele <b>" + n + "</b> lucruri dinăuntru. Nu se poate anula." : "Modulul e gol. Nu se poate anula.",
      "Șterge modulul", () => {
        ["tasks","notes","habits","goals"].forEach(c => itemsOf(c,id).forEach(x => Store.drop(c, x.id)));
        Store.drop("modules", id);
        if(state.view === id) state.view = "azi";
        toast("Modul șters.");
      });
  }
};
