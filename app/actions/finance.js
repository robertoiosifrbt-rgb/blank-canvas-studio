import { CATS_IN, CATS_OUT } from "../config.js";
import { modal } from "../modal.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { render } from "../ui.js";
import { ui } from "../state.js";
import { iso, num, toast, today, uid, ym } from "../util.js";

export const financeActions = {
  /* finanțe */
  fprev(){ const d = new Date(ui.month+"-01T12:00:00"); d.setMonth(d.getMonth()-1); ui.month = iso(d).slice(0,7); render(); },
  fnext(){ const d = new Date(ui.month+"-01T12:00:00"); d.setMonth(d.getMonth()+1); ui.month = iso(d).slice(0,7); render(); },
  fnow(){ ui.month = ym(); render(); },
  fadd(){
    modal({title:"Mișcare nouă",
      fields:[
        {k:"type", label:"Fel", type:"select", value:"out", options:[{v:"out",l:"Cheltuială"},{v:"in",l:"Venit"}]},
        {k:"amount", label:"Sumă", type:"number", ph:"0.00"},
        {k:"cat", label:"Categorie", type:"select", value:"Altele", options:CATS_OUT.concat(CATS_IN.filter(c => !CATS_OUT.includes(c)))},
        {k:"date", label:"Data", type:"date", value:ui.month === ym() ? today() : ui.month + "-01"},
        {k:"note", label:"Descriere", ph:"ex: cumpărături, factură client"}
      ],
      onOk(v){
        const a = num(v.amount);
        if(a <= 0) return "Scrie o sumă mai mare ca zero.";
        if(!v.date) return "Alege data.";
        const k = ym(v.date);
        const cur = (state.finance[k] || {}).items || [];
        Store.put("finance", k, {items: cur.concat([{id:uid(), date:v.date, type:v.type, amount:a, cat:v.cat, note:v.note}])});
        ui.month = k;
        toast(v.type === "in" ? "Venit adăugat." : "Cheltuială adăugată.");
      }});
  },
  fdel(el){
    const k = ui.month, id = el.dataset.i;
    const cur = ((state.finance[k]||{}).items || []).filter(x => x.id !== id);
    Store.put("finance", k, {items:cur}); toast("Mișcare ștearsă.");
  }
};
