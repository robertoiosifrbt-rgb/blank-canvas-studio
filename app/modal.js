import { $, esc, toast } from "./util.js";

export let closeModal = () => {};
/* Importurile sunt doar-citire, deci schimbarea se face printr-un setter. */
export function setCloseModal(fn){ closeModal = fn; }
export function modal(o){
  const layer = $("#layer");
  const fields = (o.fields||[]).map(f => {
    const v = esc(f.value == null ? "" : f.value);
    let inp;
    if(f.type === "select") inp = '<select name="'+f.k+'">' + f.options.map(x => {
        const val = typeof x === "string" ? x : x.v, lab = typeof x === "string" ? x : x.l;
        return '<option value="'+esc(val)+'"'+(String(f.value)===String(val)?" selected":"")+'>'+esc(lab)+'</option>';
      }).join("") + '</select>';
    else if(f.type === "textarea") inp = '<textarea name="'+f.k+'" placeholder="'+esc(f.ph||"")+'">'+v+'</textarea>';
    else inp = '<input type="'+(f.type||"text")+'" name="'+f.k+'" value="'+v+'" placeholder="'+esc(f.ph||"")+'"'+(f.type==="number"?' step="0.01" inputmode="decimal"':"")+'>';
    return '<label class="fld"><span>'+esc(f.label)+'</span>'+inp+'</label>';
  }).join("");
  layer.innerHTML = '<div class="veil" data-veil><form class="modal" autocomplete="off">' +
    '<header><h3>'+esc(o.title)+'</h3></header>' +
    '<div class="body">'+(o.note?'<p style="margin:0;font-size:13.5px;color:var(--ink-2)">'+o.note+'</p>':"")+fields+'</div>' +
    '<footer><button type="button" class="btn ghost" data-cancel>Renunță</button>' +
    '<button type="submit" class="btn'+(o.danger?" danger":"")+'">'+esc(o.ok||"Salvează")+'</button></footer></form></div>';
  const form = layer.querySelector("form");
  const first = form.querySelector("input,select,textarea");
  if(first) setTimeout(() => { first.focus(); if(first.select) first.select(); }, 40);
  closeModal = () => { layer.innerHTML = ""; closeModal = () => {}; };
  layer.querySelector("[data-cancel]").onclick = closeModal;
  layer.querySelector("[data-veil]").onclick = e => { if(e.target.hasAttribute("data-veil")) closeModal(); };
  form.onsubmit = e => {
    e.preventDefault();
    const v = {};
    new FormData(form).forEach((val,k) => v[k] = typeof val === "string" ? val.trim() : val);
    const err = o.onOk(v);
    if(err) toast(err); else closeModal();
  };
}
export function ask(title, note, okLabel, fn){
  modal({title, note, ok:okLabel, danger:true, fields:[], onOk:() => { fn(); }});
}

/* ══════════ Acțiuni ══════════ */
