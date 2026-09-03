import { ask, modal } from "../modal.js";
import { itemsOf } from "../modules.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { render } from "../ui.js";
import { ui } from "../state.js";
import { toast, uid } from "../util.js";

export const tasksActions = {
  /* task-uri */
  tadd(el){
    const mid = el.dataset.m;
    modal({title:"Task nou",
      fields:[
        {k:"title", label:"Ce ai de făcut", ph:"ex: trimis factura pe septembrie"},
        {k:"due", label:"Până când (opțional)", type:"date"},
        {k:"proj", label:"Proiect (opțional)", ph:"ex: casă, sănătate, personal"}
      ],
      onOk(v){
        if(!v.title) return "Scrie ce ai de făcut.";
        Store.put("tasks", "t" + uid(), {mod:mid, title:v.title, due:v.due||"", proj:v.proj||"", done:false, createdAt:new Date().toISOString()});
      }});
  },
  tdone(el){
    const id = el.dataset.i, t = state.tasks[id]; if(!t) return;
    Store.put("tasks", id, Object.assign({}, t, {done: !t.done, doneAt: !t.done ? new Date().toISOString() : ""}));
  },
  tdel(el){ Store.drop("tasks", el.dataset.i); },
  tfilter(el){ ui.taskFilter = el.dataset.i; render(); },
  tclear(el){
    const mid = el.dataset.m, done = itemsOf("tasks", mid).filter(t => t.done);
    ask("Ștergi cele " + done.length + " task-uri bifate?", "Dispar definitiv din listă. Nu se poate anula.", "Șterge tot",
      () => { done.forEach(t => Store.drop("tasks", t.id)); toast(done.length + " task-uri șterse."); });
  }
};
