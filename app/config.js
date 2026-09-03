/* ══════════ 1. Constante ══════════ */
export const KINDS = {
  dashboard:{label:"Panou"},
  finance:{label:"Finanțe"},
  debts:{label:"Datorii"},
  tasks:{label:"Listă"},
  habits:{label:"Tracker"},
  notes:{label:"Notițe"},
  goals:{label:"Obiective"}
};
export const BUILTIN = [
  {id:"azi",      name:"Azi",        kind:"dashboard", builtin:true},
  {id:"finante",  name:"Finanțe",    kind:"finance",   builtin:true},
  {id:"datorii",  name:"Datorii",    kind:"debts",     builtin:true},
  {id:"taskuri",  name:"Task-uri",   kind:"tasks",     builtin:true},
  {id:"obiceiuri",name:"Obiceiuri",  kind:"habits",    builtin:true},
  {id:"goals",    name:"Goals",      kind:"goals",     builtin:true},
  {id:"jurnal",   name:"Jurnal",     kind:"notes",     builtin:true}
];
export const ICON = {
  dashboard:'<circle cx="8" cy="8" r="6.2"/><path d="M8 4.4V8l2.4 1.6"/>',
  finance:'<path d="M2.4 12.6h11.2M5 12.6V6.2M8 12.6V3.4M11 12.6V8.2"/>',
  debts:'<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2a5.8 5.8 0 0 1 5.8 5.8"/>',
  tasks:'<path d="M3 8.4l2.6 2.6L13 3.8"/>',
  habits:'<rect x="2.4" y="2.4" width="4.6" height="4.6" rx="1"/><rect x="9" y="2.4" width="4.6" height="4.6" rx="1"/><rect x="2.4" y="9" width="4.6" height="4.6" rx="1"/><rect x="9" y="9" width="4.6" height="4.6" rx="1"/>',
  notes:'<path d="M4 2.6h8v10.8H4z"/><path d="M6.2 5.6h3.6M6.2 8h3.6M6.2 10.4h2.2"/>',
  goals:'<circle cx="8" cy="8" r="5.9"/><circle cx="8" cy="8" r="2.6"/><path d="M8 2.1V.8M8 15.2v-1.3M13.9 8h1.3M.8 8h1.3"/>',
  settings:'<circle cx="8" cy="8" r="2.2"/><path d="M8 1.6v1.9M8 12.5v1.9M14.4 8h-1.9M3.5 8H1.6M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3M12.5 12.5l-1.3-1.3M4.8 4.8L3.5 3.5"/>',
  plus:'<path d="M8 3.4v9.2M3.4 8h9.2"/>',
  trash:'<path d="M3.4 4.6h9.2M6.4 4.6V3.2h3.2v1.4M5 4.6l.6 8.2h4.8L11 4.6"/>',
  edit:'<path d="M11.2 2.6l2.2 2.2L5.6 12.6 2.6 13.4l.8-3z"/>',
  check:'<path d="M3.4 8.2l3 3L12.6 5"/>',
  down:'<path d="M8 2.8v8.4M4.6 7.8L8 11.2l3.4-3.4M2.8 13.4h10.4"/>',
  more:'<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
  warn:'<path d="M8 2.4L14.6 13.4H1.4z"/><path d="M8 6.6v3.1M8 11.6v.1"/>'
};
export function svg(n,s){return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICON[n]||"")+'</svg>';}

export const BUILD = "2026-09-03 · 20:31";
export const CURRENCIES = {"£":"Liră (£)","€":"Euro (€)","RON":"Leu (RON)","$":"Dolar ($)"};
export const CATS_OUT = ["Casă","Mâncare","Transport","Sănătate","Familie","Business","Abonamente","Distracție","Altele"];
export const CATS_IN  = ["Salariu","Business","Cadou","Vânzare","Altele"];
export const MONTHS = ["ian","feb","mar","apr","mai","iun","iul","aug","sep","oct","noi","dec"];
export const MONTHS_L = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"];
export const DAYS = ["D","L","Ma","Mi","J","V","S"];
