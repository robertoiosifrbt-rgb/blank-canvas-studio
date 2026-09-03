import { modal } from "../modal.js";
import { Store } from "../store.js";
import { ui } from "../state.js";
import { iso, today, uid, ym } from "../util.js";
import { render } from "../ui.js";

const shiftMonth = n => {
  const d = new Date((ui.calMonth || ym()) + "-01T12:00:00");
  d.setMonth(d.getMonth() + n);
  ui.calMonth = iso(d).slice(0, 7);
  render();
};

export const calendarActions = {
  cprev(){ shiftMonth(-1); },
  cnext(){ shiftMonth(1); },
  cnow(){ ui.calMonth = ym(); ui.calDay = today(); render(); },
  cday(el){
    ui.calDay = el.dataset.i;
    if (ui.calDay.slice(0, 7) !== (ui.calMonth || ym())) ui.calMonth = ui.calDay.slice(0, 7);
    render();
  },
  ctask(){
    const day = ui.calDay || today();
    modal({title:"Task nou",
      note:"Se pune pe ziua selectată din calendar.",
      fields:[
        {k:"title", label:"Ce ai de făcut", ph:"ex: trimis factura"},
        {k:"due", label:"Până când", type:"date", value:day},
        {k:"proj", label:"Proiect (opțional)", ph:"ex: casă, sănătate"}
      ],
      onOk(v){
        if(!v.title) return "Scrie ce ai de făcut.";
        Store.put("tasks", "t" + uid(), {mod:"taskuri", title:v.title, due:v.due || day,
          proj:v.proj || "", done:false, createdAt:new Date().toISOString()});
      }});
  }
};
