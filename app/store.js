import { state } from "./state.js";
import { Cloud } from "./cloud.js";
import { modules } from "./modules.js";
import { paintMode, render } from "./ui.js";
import { toast } from "./util.js";

/* ══════════ 3. Depozit (cloud, state-api sau local) ══════════ */
export const COLLS = ["modules","tasks","notes","habits","debts","finance","goals","settings"];
export const LS_KEY = "roberto_os_v1";
export const LS_OLD = "achu_life_os_v1";


export const Store = {
  db:null, mode:"local",
  async init(){
    /* 1. baza de date a Artifact-ului, când rulează acolo */
    try{
      if(window.claude && typeof window.claude.use === "function"){
        const db = await window.claude.use("db");
        if(db){ this.db = db; this.mode = "cloud"; }
      }
    }catch(e){}
    /* 2. altfel state-api — aceeași funcție Edge ca Life OS */
    if(this.mode !== "cloud" && Cloud.init()){
      this.loadLocal();          /* arată imediat ce e pe aparat */
      paintMode();
      let fromCloud = false;
      try{
        const d = await Cloud.load();
        if(d){
          COLLS.forEach(c => { if(c !== "settings" && d[c]) state[c] = d[c]; });
          if(d.settings) state.settings = Object.assign({currency:"£"}, d.settings);
          fromCloud = true;
        }
        this.mode = "state";
      }catch(e){
        this.err = (e && e.message) || "conectare eșuată";
      }
      /* abia acum, ca datele din cloud să nu șteargă ce tocmai am creat */
      const made = this.seed();
      if(made || !fromCloud){ this.saveLocal(); if(this.mode === "state") this.pushCloud(); }
      state.ready = true; paintMode(); render();
      return;
    }
    if(this.mode === "cloud"){ this.watch(); }
    else { this.loadLocal(); if(this.seed()) this.saveLocal(); }
    paintMode();
  },
  snapshot(){
    const d = {settings:state.settings};
    COLLS.forEach(c => { if(c !== "settings") d[c] = state[c]; });
    return d;
  },
  pushCloud(){
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      Cloud.save(this.snapshot()).catch(e => toast("Nu s-a salvat în cloud: " + ((e && e.message) || "eroare")));
    }, 700);
  },
  watch(){
    COLLS.forEach(c => {
      try{
        this.db.collection(c).onSnapshot(snap => {
          const bag = {};
          snap.docs.forEach(d => { if(d.exists) bag[d.id] = d.data(); });
          if(c === "settings"){ state.settings = Object.assign({currency:"£"}, bag.app || {}); }
          else state[c] = bag;
          state.ready = true; render();
        }, err => {
          if(err && err.code === "revoked"){ this.mode="local"; paintMode(); }
          state.ready = true; render();
        });
      }catch(e){}
    });
    setTimeout(()=>{ if(!state.ready){ state.ready = true; render(); } }, 2500);
  },
  loadLocal(){
    try{
      let raw = localStorage.getItem(LS_KEY);
      if(!raw){
        const old = localStorage.getItem(LS_OLD);
        if(old){ localStorage.setItem(LS_KEY, old); localStorage.removeItem(LS_OLD); raw = old; }
      }
      if(raw){
        const d = JSON.parse(raw);
        COLLS.forEach(c => { if(c!=="settings" && d[c]) state[c] = d[c]; });
        if(d.settings) state.settings = Object.assign({currency:"£"}, d.settings);
      }
    }catch(e){}
    state.ready = true;
  },
  /* Cele două ancore, puse o singură dată. Dacă le ștergi, nu revin.
     Se cheamă DUPĂ ce s-au încărcat datele din cloud — altfel un sertar
     gol venit din cloud le-ar suprascrie imediat. */
  seed(){
    if(state.settings.seedV2) return false;
    const now = new Date().toISOString();
    if(!Object.keys(state.goals).length){
      state.goals = {
        g100k: {mod:"goals", name:"100k", kind:"sum", target:100000, due:"", main:true,
                habits:[], contrib:[], createdAt:now},
        gshape: {mod:"goals", name:"My best shape", kind:"metric", unit:"%", due:"", main:true,
                habits:[], reads:[], createdAt:now}
      };
    }
    state.settings = Object.assign({}, state.settings, {seedV2:true});
    return true;
  },
  saveLocal(){
    try{
      const d = {settings:state.settings};
      COLLS.forEach(c => { if(c!=="settings") d[c] = state[c]; });
      localStorage.setItem(LS_KEY, JSON.stringify(d));
    }catch(e){ toast("Nu am putut salva local — memoria browserului e plină sau blocată."); }
  },
  async put(coll, id, obj){
    if(coll === "settings"){ state.settings = obj; } else { state[coll] = Object.assign({}, state[coll]); state[coll][id] = obj; }
    render();
    if(this.mode === "cloud"){
      try{ await this.db.collection(coll).doc(id).set(obj); }
      catch(e){
        const c = e && e.code;
        toast(c === "quota_exceeded" ? "Nu mai încap fișe noi. Exportă și șterge din Setări → Limite."
            : c === "invalid_argument" ? "Fișa a depășit 256 KB. Vezi Setări → Limite ca să afli care e."
            : c === "resource_exhausted" ? "Prea multe salvări deodată. Așteaptă câteva secunde."
            : "Nu s-a salvat. Verifică internetul.");
      }
    } else if(this.mode === "state"){ this.saveLocal(); this.pushCloud(); }
    else this.saveLocal();
  },
  async drop(coll, id){
    if(state[coll]){ state[coll] = Object.assign({}, state[coll]); delete state[coll][id]; }
    render();
    if(this.mode === "cloud"){ try{ await this.db.collection(coll).doc(id).delete(); }catch(e){ toast("Nu s-a șters. Verifică internetul."); } }
    else if(this.mode === "state"){ this.saveLocal(); this.pushCloud(); }
    else this.saveLocal();
  },
  setSettings(patch){ return this.put("settings","app", Object.assign({}, state.settings, patch)); },
  count(){
    let n = 0;
    COLLS.forEach(c => { if(c!=="settings") n += Object.keys(state[c]||{}).length; });
    return n + 1;
  }
};
