/**
 * §1 „Expirarea sesiunii" · „Redirect după expirarea sesiunii" · „Mesaj clar pentru sesiune expirată"
 * (Sesiunea 155) — CE SE ÎNTÂMPLĂ CÂND TOKENUL A MURIT ÎN MÂNA OMULUI.
 *
 * ─── 🔴 Ce se întâmpla până azi ─────────────────────────────────────────────
 *
 * Nimic. Cererea pica, iar ecranul arăta propoziția serverului — *„Invalid or expired session"* —
 * într-o bandă roșie, pe ecranul pe care omul tocmai lucra. ⛔ Butoanele rămâneau acolo, apăsabile,
 * și fiecare apăsare pica la fel. ⚠️ Aplicația **știa** că sesiunea nu mai e bună și nu făcea nimic
 * cu informația, iar omul nu avea de unde ghici că trebuie doar să intre din nou.
 *
 * ─── ⛔ DE CE NU SE POATE CITI DIN STATUS ───────────────────────────────────
 *
 * Serverul răspunde **403** și la „nu ești autentificat", și la „nu ai voie" — statusul nu s-a
 * schimbat (32 de teste de rută îl afirmă, iar maparea vine din convertirea Zite). 🔴 Ce s-a adăugat
 * e **codul** `UNAUTHENTICATED`, pe cele două locuri care chiar înseamnă *nu am cine ești*: token
 * lipsă, și token refuzat de Supabase. ⚠️ Un refuz de **rol** rămâne `FORBIDDEN` — și e o distincție
 * care contează: pe primul se iese din cont, pe al doilea **nu**, fiindcă omul e chiar cine spune că
 * e și doar nu are voie acolo.
 *
 * ⛔ **Nicio deconectare pe un 403 obișnuit.** Un ecran greșit păzit ar fi scos oamenii din aplicație
 * la fiecare apăsare, iar simptomul („mă dă afară singur") e mult mai scump decât cel reparat aici.
 */

/** Ce știe clientul despre o eroare de rețea/API. ⚠️ Formă minimă, nu clasa `ApiError`, ca testele să nu ceară un import. */
export type ApiErrorLike = { status?: number; code?: string };

/** Codul scris de `backend/src/errors.ts` pentru „nu ești autentificat". */
export const UNAUTHENTICATED_CODE = 'UNAUTHENTICATED';

/**
 * 🔴 **Doar pe cod, niciodată pe status.** Vezi antetul: 403 înseamnă amândouă lucrurile.
 */
export function isSessionGone(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as ApiErrorLike).code === UNAUTHENTICATED_CODE;
}

/**
 * Propoziția arătată pe ecranul de intrare.
 *
 * ⚠️ **Spune ce s-a întâmplat ȘI ce e de făcut**, în cuvinte de om: „sesiunea a expirat" singur e o
 * constatare, nu o instrucțiune. ⛔ Și nu spune „ai fost deconectat" — ar suna ca o pedeapsă.
 */
export const SESSION_EXPIRED_MESSAGE = 'Your sign-in has expired. Please sign in again — nothing has been lost.';

/**
 * ⚠️ **`sessionStorage`, nu `localStorage`** — aceeași alegere ca la ciornele de căutare (§22): pe un
 * calculator de birou folosit de mai mulți oameni, un mesaj rămas de la sesiunea altcuiva ar apărea
 * la următoarea deschidere. 🔴 Iar aici mesajul trebuie să supraviețuiască exact unui lucru: ieșirea
 * din cont și re-randarea ecranului de intrare, în același tab.
 */
const FLAG_KEY = 'achu.sessionExpired';

/** ⛔ Fiecare atingere de `sessionStorage` e păzită: în fereastră privată aruncă, iar ecranul nu are voie să cadă din asta. */
function safeSession(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markSessionExpired(): void {
  try { safeSession()?.setItem(FLAG_KEY, '1'); } catch { /* fereastră privată — mesajul se pierde, atât */ }
}

/**
 * Citește **și șterge** marcajul: mesajul se arată o dată, la intrarea de după expirare.
 *
 * ⛔ Lăsat pe loc, ar apărea și a doua zi, la o intrare obișnuită — iar un avertisment care apare
 * degeaba e unul pe care omul învață să-l sară.
 */
export function takeSessionExpired(): boolean {
  const store = safeSession();
  if (!store) return false;
  try {
    const had = store.getItem(FLAG_KEY) === '1';
    if (had) store.removeItem(FLAG_KEY);
    return had;
  } catch {
    return false;
  }
}

/**
 * 🔴 **Cine reacționează, se înregistrează** — `apiClient` nu are voie să știe despre ecrane.
 *
 * ⚠️ Un singur ascultător, nu o listă: reacția e una singură („ieși din cont și arată mesajul"), iar
 * o listă ar fi invitat două ecrane să se deconecteze pe rând.
 */
type Handler = () => void;
let handler: Handler | null = null;

export function onSessionGone(fn: Handler | null): void {
  handler = fn;
}

/**
 * Chemată de `apiClient` la fiecare eroare. ⛔ Nu aruncă niciodată: o reacție picată nu are voie să
 * schimbe eroarea pe care ecranul o primește oricum.
 */
export function reportApiError(err: unknown): void {
  if (!isSessionGone(err)) return;
  markSessionExpired();
  try { handler?.(); } catch { /* reacția e best-effort, ca notificările */ }
}

