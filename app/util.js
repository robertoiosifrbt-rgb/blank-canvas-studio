import { MONTHS } from "./config.js";
import { state } from "./state.js";

/* ══════════ 2. Utilitare ══════════ */
export const $ = s => document.querySelector(s);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
export const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const iso = d => { const x = d?new Date(d):new Date(); return new Date(x.getTime()-x.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
export const today = () => iso();
export const ym = s => (s||today()).slice(0,7);
export const num = v => { const n = parseFloat(String(v).replace(",",".")); return isNaN(n)?0:n; };
export function money(n){
  const c = state.settings.currency || "£";
  const v = Math.abs(n).toLocaleString("ro-RO",{minimumFractionDigits:2,maximumFractionDigits:2});
  const s = n<0 ? "−" : "";
  return c==="RON" ? s+v+" RON" : s+c+v;
}
export function dLabel(d){
  if(!d) return "";
  const t = today();
  if(d===t) return "azi";
  const y = new Date(); y.setDate(y.getDate()+1);
  if(d===iso(y)) return "mâine";
  const p = new Date(); p.setDate(p.getDate()-1);
  if(d===iso(p)) return "ieri";
  const dt = new Date(d+"T12:00:00");
  return dt.getDate()+" "+MONTHS[dt.getMonth()]+(dt.getFullYear()!==new Date().getFullYear()?" "+dt.getFullYear():"");
}
export const daysTo = d => Math.round((new Date(d+"T12:00:00") - new Date(today()+"T12:00:00"))/864e5);
export const isPhone = () => window.matchMedia("(max-width:860px)").matches;
export function zile(n){ return n === 1 ? "1 zi" : n + ((n % 100 >= 20 || n === 0) ? " de zile" : " zile"); }
export function toast(msg){
  const old = document.querySelector(".toast"); if(old) old.remove();
  const t = document.createElement("div"); t.className="toast"; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(), 2600);
}
