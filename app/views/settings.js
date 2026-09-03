import { Cloud } from "../cloud.js";
import { BUILD, CURRENCIES, KINDS, svg } from "../config.js";
import { limits } from "../limits.js";
import { modules } from "../modules.js";
import { Store } from "../store.js";
import { state } from "../state.js";
import { head, sec } from "../ui.js";
import { esc, num } from "../util.js";

/* ══════════ Setări ══════════ */
export function viewSettings(){
  const n = Store.count(), pct = n/5000*100;
  const cloud = Store.mode === "cloud";
  let h = head("Setări", "Moneda, spațiul ocupat și exportul datelor tale.");

  h += '<div class="card pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px">' +
    '<div style="flex:1;min-width:200px"><b style="display:block;margin-bottom:3px">Versiunea aplicației</b>' +
    '<span class="num" style="font-size:12.5px;color:var(--ink-3)">'+BUILD+'</span>' +
    '<span style="display:block;font-size:13px;color:var(--ink-2);margin-top:5px">' +
    'Dacă nu vezi ultimele modificări, apasă aici: șterge tot ce a rămas în memoria browserului și încarcă versiunea nouă.</span></div>' +
    '<button class="btn" data-a="update">Actualizează</button></div>';

  h += '<div class="grid2">';
  h += '<div class="card pad"><label class="fld"><span>Monedă</span><select id="cur">' +
    Object.keys(CURRENCIES).map(c => '<option value="'+c+'"'+(state.settings.currency===c?" selected":"")+'>'+CURRENCIES[c]+'</option>').join("") +
    '</select></label><p style="margin:9px 0 0;font-size:13px;color:var(--ink-3)">Se schimbă peste tot instant. Sumele deja scrise rămân aceleași cifre.</p></div>';

  const ls = limits(), worst = ls.slice().sort((a,c) => c.pct - a.pct)[0];
  h += '<div class="card pad"><div style="font-size:13.5px;color:var(--ink-2)">'+
    (worst.pct < 60 ? "Toate limitele sunt departe. La ritmul obișnuit, ai loc pentru ani buni."
     : worst.pct < 75 ? "Cea mai apăsată limită e la " + worst.pct.toFixed(0) + "%. Încă e bine, dar ține un ochi pe ea."
     : worst.pct < 90 ? "Te apropii de o limită. Exportă și curăță ce nu-ți mai trebuie."
     : "Aproape plin. Exportă acum, apoi șterge — altfel salvările încep să eșueze.")+
    '</div></div>';
  h += '</div>';

  h += sec("Limite");
  h += '<div class="card pad">' + ls.map(l =>
    '<div class="lim"><div class="lim-t"><b>'+esc(l.label)+(l.detail?' <span style="font-weight:400;color:var(--ink-3)">· '+esc(l.detail)+'</span>':'')+'</b>' +
    '<span'+(l.pct>=90?' style="color:var(--bad)"':l.pct>=75?' style="color:var(--warn)"':'')+'>'+esc(l.show)+' · '+l.pct.toFixed(l.pct<1?1:0)+'%</span></div>' +
    '<div class="gauge-bar"><i style="width:'+Math.max(1.5,l.pct)+'%;background:'+(l.pct>=90?'var(--bad)':l.pct>=75?'var(--warn)':'var(--accent)')+'"></i></div>' +
    '<p>'+esc(l.why)+' <b style="font-weight:600;color:var(--ink-2)">'+esc(l.fix)+'</b></p></div>').join("") +
    '<p style="margin:14px 0 0;padding-top:13px;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink-3);line-height:1.5">' +
    (cloud
      ? 'Aici datele stau pe serverul Claude, deci contează numărul de fișe și mărimea fiecăreia. Spațiul din browser nu te privește.'
      : Store.mode === "state"
      ? 'Aici datele stau în baza ta de date, iar browserul le ține doar ca oglindă. Nu există limită de număr de fișe — mărimea totală o hotărăște funcția ta, și n-o pot citi de aici.'
      : 'Aici datele stau doar în browser. Nu există limită de număr de fișe, doar spațiul de mai sus.') +
    '</p></div>';

  h += sec("Datele tale");
  h += '<div class="card pad" style="display:flex;flex-direction:column;gap:14px">' +
    '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:220px"><b style="display:block;margin-bottom:3px">Unde stau acum</b>' +
    '<span style="font-size:13.5px;color:var(--ink-2)">'+(Store.mode === "state"
      ? "În baza ta de date, prin state-api. Sertar propriu — nu atinge datele celeilalte aplicații."
      : cloud ? "În cloud, legate de contul tău. Le vezi de pe telefon și de pe laptop, aceleași."
      : (Store.err ? "Cloud-ul n-a răspuns ("+esc(Store.err)+"). " : "") +
        "Doar în acest browser, pe acest aparat — exportă des.")+'</span></div>' +
    '<span class="pill '+(Store.mode==="state"||cloud?"good":"warn")+'">'+
      (Store.mode==="state"?"cloud propriu":cloud?"sincronizat":"local")+'</span></div>' +
    (Store.mode === "state" || Store.err ? '<div style="height:1px;background:var(--line)"></div>' +
      '<div><b style="display:block;margin-bottom:3px">Cod de sincronizare</b>' +
      '<span style="display:block;font-size:13.5px;color:var(--ink-2);margin-bottom:9px">' +
      'Pune același cod pe telefon și pe laptop ca să vezi aceleași date. Îl copiezi de pe aparatul pe care ai datele.</span>' +
      '<input type="text" id="tok" value="'+esc(Cloud.token)+'" spellcheck="false" autocomplete="off">' +
      '<div style="margin-top:9px"><button class="btn sm" data-a="settok">Salvează codul</button></div></div>' : '') +
    '<div style="height:1px;background:var(--line)"></div>' +
    '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:220px"><b style="display:block;margin-bottom:3px">Export</b>' +
    '<span style="font-size:13.5px;color:var(--ink-2)">Descarci tot — finanțe, datorii, task-uri, obiceiuri, notițe — într-un fișier pe care îl păstrezi tu. Fă-o din când în când.</span></div>' +
    '<button class="btn" data-a="export">'+svg("down")+'Exportă tot</button></div></div>';

  h += sec("Module");
  const custom = modules().filter(m => !m.builtin);
  h += '<div class="rows">' + modules().map(m =>
    '<div class="row">'+svg(m.kind)+'<div class="main"><span class="ttl">'+esc(m.name)+'</span>' +
    '<span class="sub">'+KINDS[m.kind].label+(m.builtin?" · inclus":"")+'</span></div>' +
    (m.builtin ? '<span class="pill">inclus</span>'
      : '<button class="icon-btn del" data-a="mdel" data-i="'+m.id+'" aria-label="Șterge modulul">'+svg("trash")+'</button>')+'</div>').join("") + '</div>';
  h += '<div style="margin-top:12px"><button class="btn ghost" data-a="newmod">'+svg("plus")+'Modul nou</button>' +
    (custom.length ? '' : '<span style="margin-left:12px;font-size:13px;color:var(--ink-3)">Poți adăuga oricâte module vrei: liste, notițe sau trackere.</span>')+'</div>';
  return h;
}


/* ══════════ Ferestre ══════════ */
