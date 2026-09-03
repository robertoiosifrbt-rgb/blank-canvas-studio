import { BUILTIN } from "./config.js";
import { state } from "./state.js";

/* ══════════ 4. Module ══════════ */
export function modules(){
  const custom = Object.keys(state.modules).map(id => Object.assign({id}, state.modules[id]))
    .sort((a,b) => (a.createdAt||"").localeCompare(b.createdAt||""));
  return BUILTIN.concat(custom);
}
export const modById = id => modules().find(m => m.id === id);
export function itemsOf(coll, modId){
  return Object.keys(state[coll]||{})
    .map(id => Object.assign({id}, state[coll][id]))
    .filter(x => (x.mod || "") === modId);
}
