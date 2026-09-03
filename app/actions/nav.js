import { svg } from "../config.js";
import { modules } from "../modules.js";
import { state, ui } from "../state.js";
import { esc, $ } from "../util.js";
import { closeModal, setCloseModal } from "../modal.js";
import { render } from "../ui.js";

export const navActions = {
  go(el){ closeModal(); state.view = el.dataset.i; ui.search = ""; render(); window.scrollTo(0,0); },
  more(){
    const layer = $("#layer"), ms = modules();
    layer.innerHTML = '<div class="veil" data-veil><div class="modal">' +
      '<header><h3>Toate modulele</h3></header><div class="body" style="gap:3px">' +
      ms.map(m => '<button class="sheet-i '+(state.view===m.id?"on":"")+'" data-a="go" data-i="'+m.id+'">'+svg(m.kind)+'<span>'+esc(m.name)+'</span></button>').join("") +
      '<div style="height:1px;background:var(--line);margin:7px 0"></div>' +
      '<button class="sheet-i" data-a="newmod">'+svg("plus")+'<span>Modul nou</span></button>' +
      '<button class="sheet-i '+(state.view==="__set"?"on":"")+'" data-a="go" data-i="__set">'+svg("settings")+'<span>Setări</span></button>' +
      '</div><footer><button type="button" class="btn ghost" data-cancel>Închide</button></footer></div></div>';
    const close = () => { layer.innerHTML = ""; setCloseModal(() => {}); };
    setCloseModal(close);
    layer.querySelector("[data-cancel]").onclick = close;
    layer.querySelector("[data-veil]").onclick = e => { if(e.target.hasAttribute("data-veil")) close(); };
  }
};
