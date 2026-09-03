import { ask, modal } from "../modal.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { money, num, toast, today, uid } from "../util.js";
import { remaining } from "../views/finance.js";

export const debtsActions = {
  /* datorii */
  dadd(){
    modal({title:"Datorie nouă",
      fields:[
        {k:"name", label:"Către cine / pentru ce", ph:"ex: Credit auto, împrumut Maria"},
        {k:"total", label:"Suma totală", type:"number", ph:"0.00"},
        {k:"paid", label:"Deja achitat (opțional)", type:"number", ph:"0.00"},
        {k:"due", label:"Scadență (opțional)", type:"date"}
      ],
      onOk(v){
        if(!v.name) return "Scrie pentru ce e datoria.";
        if(num(v.total) <= 0) return "Scrie suma totală.";
        const p = num(v.paid);
        Store.put("debts", "d" + uid(), {name:v.name, total:num(v.total), due:v.due||"",
          payments: p > 0 ? [{id:uid(), date:today(), amount:p}] : [], createdAt:new Date().toISOString()});
        toast("Datorie adăugată.");
      }});
  },
  dpay(el){
    const id = el.dataset.i, d = state.debts[id]; if(!d) return;
    const rem = remaining(d);
    modal({title:"Plată către „" + d.name + "”",
      note:"Rest de plată acum: <b>" + money(rem) + "</b>",
      fields:[{k:"amount", label:"Cât plătești", type:"number", value:rem.toFixed(2)}, {k:"date", label:"Data", type:"date", value:today()}],
      onOk(v){
        const a = num(v.amount);
        if(a <= 0) return "Scrie o sumă mai mare ca zero.";
        Store.put("debts", id, Object.assign({}, d, {payments:(d.payments||[]).concat([{id:uid(), date:v.date||today(), amount:a}])}));
        toast(a >= rem ? "Achitată integral. Bravo." : "Plată înregistrată. Mai ai " + money(rem - a) + ".");
      }});
  },
  ddel(el){
    const id = el.dataset.i, d = state.debts[id]; if(!d) return;
    ask("Ștergi „" + d.name + "”?", "Se pierde și istoricul plăților. Nu se poate anula.", "Șterge", () => { Store.drop("debts", id); toast("Datorie ștearsă."); });
  }
};
