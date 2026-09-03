import { ACT } from "./actions.js";
import { closeModal } from "./modal.js";
import { Store } from "./store.js";
import { state } from "./state.js";
import { render } from "./ui.js";
import { ui } from "./state.js";
import { $, isPhone, toast , ym } from "./util.js";

document.addEventListener("click", e => {
  const el = e.target.closest("[data-a]");
  if(!el) return;
  e.preventDefault();
  const fn = ACT[el.dataset.a];
  if(fn) fn(el);
});
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });
document.addEventListener("change", e => {
  if(e.target.id === "cur"){ Store.setSettings({currency:e.target.value}); toast("Moneda schimbată."); }
});
document.addEventListener("input", e => {
  if(e.target.id === "q"){
    const pos = e.target.selectionStart;
    ui.search = e.target.value; render();
    const nx = $("#q"); if(nx){ nx.focus(); try{ nx.setSelectionRange(pos,pos); }catch(err){} }
  }
});

/* Poarta de depanare: cu module, nimic nu mai e global. Din consola
   browserului poti citi starea sau forta o randare. */
window.RobertoOS = { state, ui, Store, render };

/* ══════════ Pornire ══════════ */
ui.month = ym();          /* luna curentă, la deschidere */
let wasPhone = isPhone(), rz;
window.addEventListener("resize", () => {
  clearTimeout(rz);
  rz = setTimeout(() => { if(isPhone() !== wasPhone){ wasPhone = isPhone(); render(); } }, 180);
});
render();
Store.init().then(() => { state.ready = true; render(); });
