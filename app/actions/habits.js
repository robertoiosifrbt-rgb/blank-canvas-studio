import { ask, modal } from "../modal.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { uid } from "../util.js";

export const habitsActions = {
  /* obiceiuri */
  hadd(el){
    const mid = el.dataset.m;
    modal({title:"Obicei nou", note:"Ceva ce vrei să faci în fiecare zi.",
      fields:[{k:"name", label:"Numele obiceiului", ph:"ex: mișcare 30 min, citit, 2L apă"}],
      onOk(v){
        if(!v.name) return "Dă-i un nume.";
        Store.put("habits", "h" + uid(), {mod:mid, name:v.name, log:{}, createdAt:new Date().toISOString()});
      }});
  },
  tick(el){
    const id = el.dataset.i, d = el.dataset.d, hb = state.habits[id]; if(!hb) return;
    const log = Object.assign({}, hb.log || {});
    if(log[d]) delete log[d]; else log[d] = 1;
    Store.put("habits", id, Object.assign({}, hb, {log}));
  },
  hdel(el){
    const id = el.dataset.i, hb = state.habits[id]; if(!hb) return;
    ask("Ștergi „" + hb.name + "”?", "Se pierde tot istoricul de bife. Nu se poate anula.", "Șterge", () => Store.drop("habits", id));
  }
};
