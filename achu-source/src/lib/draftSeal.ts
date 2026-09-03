/**
 * §1 „Reautentificare fără pierderea formularului curent, unde este sigur" (Sesiunea 158).
 *
 * ─── 🔴 CE SE ÎNTÂMPLA, ȘI DE CE ERA MAI RĂU DECÂT O SIMPLĂ LIPSĂ ───────────
 *
 * Când tokenul murea în mâna omului, aplicația îl scotea din cont (§1, Sesiunea 155) — iar ieșirea
 * din cont **șterge ciornele de formular** (§46, Sesiunea 150), fiindcă ele trăiesc în
 * `sessionStorage` și pe un calculator de birou următorul om ar fi găsit ce scria cel dinainte.
 *
 * ⛔ Cele două decizii sunt fiecare corectă și **împreună mâncau munca**: cine scria o vizită de
 * douăzeci de câmpuri la ora la care i-a expirat sesiunea o pierdea întreagă. 🔴 Iar ecranul de
 * intrare îi scria, în același timp, *„nothing has been lost"* — deci aplicația nu doar pierdea, ci
 * și **spunea contrariul**. Asta e partea care face din felia asta o reparație, nu o comoditate.
 *
 * ─── ⚠️ DEOSEBIREA PE CARE SE SPRIJINĂ TOTUL ────────────────────────────────
 *
 * **„Sign out" și „ți-a expirat sesiunea" nu sunt același lucru**, deși duc în același ecran:
 *   · **Sign out** e o hotărâre — de obicei „plec de la masă". ⛔ Ciornele se șterg, ca până acum.
 *   · **Expirarea** nu e o hotărâre a nimănui: omul e tot acolo, cu formularul pe ecran.
 *
 * 🔴 Deci la expirare ciornele nu se șterg — se **sigilează**: rămân pe disc, dar **nu se pot citi**
 * până când cineva intră din nou. Iar sigiliul poartă emailul celui căruia i-a expirat sesiunea.
 *
 * ─── ⛔ „UNDE ESTE SIGUR" — cele trei margini, și de ce fiecare ─────────────
 *
 *   1. **Numai aceluiași om.** Intră alt email pe aceeași filă → ciornele se **șterg**, nu se arată.
 *      🔴 Fără regula asta, felia ar fi fost chiar scurgerea pe care §46 a refuzat-o: „de unde știe
 *      aplicata asta despre clientul meu?".
 *   2. **Numai în aceeași filă.** `sessionStorage`, ca peste tot în §22 și §46 — o filă închisă duce
 *      ciornele cu ea. ⛔ `localStorage` le-ar fi lăsat peste noapte, pe un calculator comun.
 *   3. **Numai cât ține sigiliul.** Cât timp e pus, `readSealedDraft` întoarce `null` **oricui** —
 *      inclusiv unui ecran deschis din greșeală înainte de intrare. ⚠️ Ordinea contează: ciorna nu e
 *      lizibilă *întâi* și verificată *după*.
 *
 * ⚠️ Emailul se compară **normalizat** (trim + litere mici), ca aceeași adresă scrisă cu majuscule
 * diferite să nu treacă drept alt om și să-și piardă munca degeaba.
 */

/** ⚠️ Aceeași cheie ca în `useUnsavedGuard.ts` — ciornele sunt ale lui, aici doar se sigilează. */
export const DRAFT_PREFIX = 'achu.draft.';

/** Sigiliul: emailul celui căruia i-a expirat sesiunea. ⛔ În afara prefixului de ciorne, ca golirea lor să nu-l ia cu ea. */
const SEAL_KEY = 'achu.draftSeal';

/** ⛔ Fiecare atingere e păzită: într-o filă privată accesul ARUNCĂ, iar un formular nu are voie să cadă din asta. */
function store(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

const normalise = (email: string | null | undefined): string => (email ?? '').trim().toLowerCase();

/** Cheile ciornelor, citite o singură dată: `sessionStorage.key(i)` se mută sub ștergere. */
function draftKeys(s: Storage): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
  } catch { /* nimic de făcut */ }
  return keys;
}

/**
 * 🔴 Chemată pe drumul expirării, **înaintea** ieșirii din cont.
 *
 * ⚠️ **Fără email nu se sigilează nimic** — se lasă ștergerea obișnuită să-și facă treaba. ⛔ Un
 * sigiliu gol s-ar fi potrivit cu oricine, adică exact regula pe care o apără fișierul.
 * ⚠️ Și nu se sigilează degeaba: dacă nu există nicio ciornă, nu are ce ține.
 */
export function sealFormDrafts(email: string | null | undefined): boolean {
  const s = store();
  const owner = normalise(email);
  if (!s || !owner || draftKeys(s).length === 0) return false;
  try { s.setItem(SEAL_KEY, owner); return true; } catch { return false; }
}

/** ⚠️ Un singur loc care citește sigiliul — cele trei funcții de mai jos îl întreabă pe el. */
function readSeal(): string | null {
  try { return store()?.getItem(SEAL_KEY) ?? null; } catch { return null; }
}

/** Există un sigiliu pus? ⚠️ Citit de `clearFormDrafts`, ca ieșirea de la expirare să nu șteargă ce tocmai s-a sigilat. */
export function hasSealedDrafts(): boolean {
  return readSeal() !== null;
}

/**
 * 🔴 Chemată la fiecare intrare reușită. **Hotărăște, nu întreabă:**
 *   · același om → sigiliul se ridică, ciornele redevin lizibile (`true`);
 *   · alt om → ciornele se **șterg** împreună cu sigiliul (`false`).
 *
 * ⛔ În ambele cazuri sigiliul dispare: lăsat pe loc, ar fi ascuns pentru totdeauna ciornele scrise
 * **după** intrare, iar §46 s-ar fi oprit tăcut din funcționat.
 */
export function resolveSealedDrafts(email: string | null | undefined): boolean {
  const s = store();
  const owner = readSeal();
  if (!s || !owner) return false;

  const same = owner === normalise(email);
  try {
    if (!same) for (const key of draftKeys(s)) s.removeItem(key);
    s.removeItem(SEAL_KEY);
  } catch { /* nimic de făcut */ }
  return same;
}

/**
 * Citirea unei ciorne, cu sigiliul respectat.
 *
 * 🔴 **Sigiliul se verifică ÎNAINTE de citire**, nu după: între expirare și intrarea următoare
 * ecranul poate fi încă montat, iar o ciornă întoarsă acolo ar fi ajuns pe ecran fără ca nimeni să
 * fi dovedit cine se uită la el.
 */
export function readSealedDraft(key: string): unknown {
  if (hasSealedDrafts()) return null;
  try {
    const raw = store()?.getItem(DRAFT_PREFIX + key) ?? null;
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}

