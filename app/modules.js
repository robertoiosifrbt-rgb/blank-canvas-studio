import { state } from "./state.js";
import { BUILTIN } from "./config.js";

/* Modulele formeaza un arbore: orice modul poate avea parinte, pe oricate
   niveluri. Cele incluse stau mereu la radacina. */

export function modules(){
  const custom = Object.keys(state.modules).map(id => Object.assign({id}, state.modules[id]))
    .sort((a,b) => (a.createdAt||"").localeCompare(b.createdAt||""));
  return BUILTIN.concat(custom);
}

export const modById = id => modules().find(m => m.id === id);
export const childrenOf = id => modules().filter(m => (m.parent || "") === id);

/* Lista aplatizata in ordinea arborelui, fiecare cu adancimea lui.
   `seen` opreste o eventuala bucla din date stricate. */
export function moduleTree(parent = "", depth = 0, out = [], seen = new Set()){
  childrenOf(parent).forEach(m => {
    if(seen.has(m.id)) return;
    seen.add(m.id);
    out.push(Object.assign({}, m, {depth}));
    moduleTree(m.id, depth + 1, out, seen);
  });
  return out;
}

/* Tot ce atarna sub un modul, la orice adancime. */
export function descendants(id){
  const out = [], seen = new Set();
  (function walk(p){
    childrenOf(p).forEach(m => {
      if(seen.has(m.id)) return;
      seen.add(m.id); out.push(m); walk(m.id);
    });
  })(id);
  return out;
}

/* Drumul de la radacina pana la modul, pentru firul de navigare. */
export function pathOf(id){
  const out = []; let cur = modById(id), guard = 0;
  while(cur && guard++ < 32){
    out.unshift(cur);
    cur = cur.parent ? modById(cur.parent) : null;
  }
  return out;
}

export function itemsOf(coll, modId){
  return Object.keys(state[coll]||{})
    .map(id => Object.assign({id}, state[coll][id]))
    .filter(x => (x.mod || "") === modId);
}
