import { ask, closeModal, modal } from "../modal.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { $, toast, uid } from "../util.js";

export const notesActions = {
  /* notițe */
  nadd(el){
    const mid = el.dataset.m;
    modal({title:"Însemnare nouă",
      fields:[{k:"title", label:"Titlu", ph:"despre ce e"}, {k:"body", label:"Conținut", type:"textarea", ph:"scrie liber…"}],
      onOk(v){
        if(!v.title && !v.body) return "Scrie măcar ceva.";
        const now = new Date().toISOString();
        Store.put("notes", "n" + uid(), {mod:mid, title:v.title, body:v.body, createdAt:now, updatedAt:now});
      }});
  },
  nopen(el){
    const id = el.dataset.i, n = state.notes[id]; if(!n) return;
    modal({title:"Însemnare", ok:"Salvează",
      fields:[{k:"title", label:"Titlu", value:n.title}, {k:"body", label:"Conținut", type:"textarea", value:n.body}],
      onOk(v){
        if(!v.title && !v.body){
          Store.drop("notes", id); toast("Însemnare goală — ștearsă."); return;
        }
        Store.put("notes", id, Object.assign({}, n, {title:v.title, body:v.body, updatedAt:new Date().toISOString()}));
      }});
    const f = $("#layer form");
    const del = document.createElement("button");
    del.type = "button"; del.className = "btn ghost"; del.style.marginRight = "auto"; del.textContent = "Șterge";
    del.onclick = () => { closeModal(); ask("Ștergi însemnarea?", "Nu se poate anula.", "Șterge", () => { Store.drop("notes", id); toast("Ștearsă."); }); };
    f.querySelector("footer").prepend(del);
  }
};
