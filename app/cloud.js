import { state } from "./state.js";

/* ══════════ 3. Cloud, prin state-api ══════════ */
/* Aceeași funcție Edge pe care o folosește Life OS. Fără cheie Supabase:
   autentificarea se face cu x-device-token, exact ca în src/cloudState.ts. */
export const STATE_API = "https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/state-api";
export const TOKEN_KEY = "pushDeviceToken";  /* aceeași cheie ca aplicația existentă */
export const SLOT = "roberto-os-v1";         /* sertar propriu, separat de restul */

export const Cloud = {
  token:"",
  init(){
    try{
      let t = localStorage.getItem(TOKEN_KEY);
      if(!t){
        t = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
        localStorage.setItem(TOKEN_KEY, t);
      }
      this.token = t;
    }catch(e){ this.token = ""; }
    return !!this.token;
  },
  setToken(t){
    this.token = (t || "").trim();
    try{ localStorage.setItem(TOKEN_KEY, this.token); }catch(e){}
  },
  async call(body){
    const r = await fetch(STATE_API, {
      method:"POST",
      headers:{"Content-Type":"application/json", "x-device-token":this.token},
      body:JSON.stringify(body)
    });
    const d = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(d.error || ("eroare " + r.status));
    return d;
  },
  payloadOf(d){ return (d && d.state && d.state.payload) || {}; },
  /* Citește doar sertarul nostru din payload-ul comun. */
  async load(){
    const raw = this.payloadOf(await this.call({action:"load"}))[SLOT];
    return raw ? JSON.parse(raw) : null;
  },
  /* Rescrie payload-ul întreg, cu sertarul nostru înlocuit — ca să nu
     ștergem cheile aplicației existente (tasks, calendarEvents, ...). */
  async save(data){
    const payload = Object.assign({}, this.payloadOf(await this.call({action:"load"})));
    payload[SLOT] = JSON.stringify(data);
    await this.call({action:"save", payload});
  }
};
