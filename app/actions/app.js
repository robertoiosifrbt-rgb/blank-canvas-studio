import { Cloud } from "../cloud.js";
import { modal } from "../modal.js";
import { COLLS, Store } from "../store.js";
import { state } from "../state.js";
import { paintMode, render } from "../ui.js";
import { $, toast, today } from "../util.js";

export const appActions = {
  /* forțează versiunea nouă: scoate service worker-ul rămas de la aplicația
     veche de pe același domeniu, golește cache-ul, apoi reîncarcă */
  async update(){
    toast("Se actualizează…");
    try{
      if(navigator.serviceWorker){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    }catch(e){}
    try{
      if(window.caches){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    }catch(e){}
    const u = new URL(location.href);
    u.searchParams.set("v", Date.now());
    location.replace(u.toString());
  },

  /* cod de sincronizare */
  async settok(){
    const el = $("#tok"); if(!el) return;
    const t = el.value.trim();
    if(t.length < 16) return toast("Codul pare prea scurt. Copiază-l întreg.");
    Cloud.setToken(t);
    try{
      const d = await Cloud.load();
      if(d){
        COLLS.forEach(c => { if(c !== "settings" && d[c]) state[c] = d[c]; });
        if(d.settings) state.settings = Object.assign({currency:"£"}, d.settings);
        Store.saveLocal(); toast("Conectat. Datele au fost aduse.");
      } else {
        await Cloud.save(Store.snapshot()); toast("Conectat. Sertarul era gol — am urcat ce ai aici.");
      }
      Store.mode = "state"; Store.err = "";
    }catch(e){ Store.err = (e && e.message) || "eroare"; toast("Nu s-a conectat: " + Store.err); }
    paintMode(); render();
  },

  /* export */
  async export(){
    const data = {app:"Roberto OS", exportat:new Date().toISOString(), moneda:state.settings.currency};
    COLLS.forEach(c => { if(c !== "settings") data[c] = state[c]; });
    const txt = JSON.stringify(data, null, 2);
    const name = "roberto-os-" + today() + ".json";
    let dl = null;
    try{ if(window.claude && window.claude.use) dl = await window.claude.use("downloads"); }catch(e){}
    if(dl){
      try{
        const r = await dl.save({filename:name, data:txt});
        toast(r && r.status === "saved" ? "Exportat. Verifică descărcările." : "Trimis.");
        return;
      }catch(e){ if(e && e.code === "cancelled") return; }
    }
    modal({title:"Copiază datele", ok:"Am copiat",
      note:"Descărcarea directă nu e permisă aici. Selectează tot textul de mai jos și salvează-l într-un fișier <b>" + name + "</b>.",
      fields:[{k:"d", label:"Datele tale", type:"textarea", value:txt}],
      onOk(){}});
  }
};
