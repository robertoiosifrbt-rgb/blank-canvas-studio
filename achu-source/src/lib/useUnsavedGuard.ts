import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sesiunea 29 (backlog 46 — "Unsaved-changes warning", "Form recovery").
 *
 * Every dialog in this app closes on `onOpenChange={v => !v && onClose()}`,
 * which means a stray click on the backdrop or a tap of Escape throws away
 * whatever was typed, silently and instantly. On a long form (a Job, an Expense
 * with extracted receipt fields) that is real lost work.
 *
 * Design notes:
 *
 * - The baseline is captured EXPLICITLY, via `captureBaseline`, called by the
 *   dialog at the same place it initialises its form. An earlier approach tried
 *   to snapshot the values automatically when `open` flipped to true, but the
 *   dialogs populate their state in their own effect, so the hook would capture
 *   the PREVIOUS record's values and then report every freshly opened dialog as
 *   dirty. A false "you have unsaved changes" on every close is worse than no
 *   warning at all — people learn to click through it, and then it fails to
 *   protect them the one time it matters. One explicit call per dialog is worth
 *   more than a clever guess.
 *
 * - `beforeunload` is wired up too, so closing the tab or hitting reload with a
 *   half-filled form gets the browser's own warning. The text is not ours to
 *   choose — browsers show a generic message — but the prompt itself is what
 *   prevents the loss.
 *
 * ─── 🔴 §46 „Form recovery" (Sesiunea 150) — CE SE ÎNTÂMPLĂ DUPĂ CE S-A PIERDUT ──────────────
 *
 * Avertismentul de mai sus apără **înainte**. ⛔ Nu ajuta cu nimic **după**: cine apasă „Discard"
 * din greșeală, sau închide dialogul lângă butonul de salvare, pierdea tot ce scrisese. ⚠️ Iar
 * formularele care contează aici sunt exact cele lungi — o vizită, o cheltuială cu câmpuri extrase
 * dintr-un bon scanat.
 *
 * 🔴 **`sessionStorage`, NU `localStorage`, și decizia NU e a mea** — e cea din §22 „Recent searches"
 * (Sesiunea 148, `GlobalSearch.tsx`), aplicată la ceva care poartă **mult mai multe** date despre un
 * client: pe un calculator de birou folosit de mai mulți oameni, `localStorage` ar fi păstrat numele
 * și adresa unui client **după** ce cel care le-a scris a plecat de la masă. ✅ `sessionStorage`
 * trăiește cât ține fila — deci acoperă exact ce trebuie (un click greșit, Escape, un F5) și **nu**
 * ce nu trebuie (calculatorul lăsat altcuiva).
 *
 * ⚠️ **Se scrie numai cât timp e MURDAR**, iar la salvare, la renunțare și la revenirea la valorile
 * de start se **șterge**. ⛔ Altfel a doua deschidere a aceluiași dialog ar oferi „recuperează" pentru
 * un formular identic cu ce e deja în bază — o întrebare fără sens, pe care omul o învață să o
 * închidă fără să citească.
 *
 * ⚠️ **Fiecare citire și scriere în `try/catch`**, ca la căutare: într-o filă privată accesul
 * ARUNCĂ, iar un formular nu are voie să cadă pentru o comoditate.
 */

/**
 * 🆕 §1 (Sesiunea 158) — prefixul și citirea stau acum în `draftSeal.ts`, fiindcă citirea are o
 * condiție nouă: **sigiliul**. ⚠️ Vezi acolo de ce o sesiune expirată nu mai șterge ce s-a scris.
 */
import { DRAFT_PREFIX, readSealedDraft, hasSealedDrafts } from './draftSeal';

/** ⚠️ Nu aruncă niciodată: într-o filă privată `sessionStorage` refuză accesul. */
const readDraft = (key: string): unknown => readSealedDraft(key);
function writeDraft(key: string, json: string): void {
  try { window.sessionStorage.setItem(DRAFT_PREFIX + key, json); } catch { /* nimic de făcut */ }
}
function removeDraft(key: string): void {
  try { window.sessionStorage.removeItem(DRAFT_PREFIX + key); } catch { /* nimic de făcut */ }
}
/**
 * 🔴 §46 (Sesiunea 150) — **CIORNELE SE ȘTERG LA IEȘIREA DIN CONT.**
 *
 * ⛔ `sessionStorage` trăiește cât ține **fila**, nu cât ține sesiunea de lucru — deci pe un calculator
 * de birou, cine intră după cel care a apăsat Sign out ar fi găsit ciorna lui la deschiderea aceluiași
 * ecran (`job:new` e aceeași cheie pentru oricine). ⚠️ Nu e o scurgere în afară, dar e exact „de unde
 * știe asta despre clientul meu?" pe care §22 a refuzat deja o dată.
 *
 * ⚠️ Chemată din `lib/useAuth.ts`, pe drumul de ieșire, **înainte** de `signOut()`.
 */
export function clearFormDrafts(): void {
  /**
   * 🆕 §1 (Sesiunea 158) — **ciornele SIGILATE nu se șterg aici.**
   *
   * ⚠️ Drumul e același (expirarea cheamă tot ieșirea din cont), deci deosebirea nu se poate citi
   * din locul de unde vine apelul — o citește din sigiliu. 🔴 Fără rândul ăsta, felia n-ar fi
   * existat: sigiliul s-ar fi pus, iar ștergerea de o linie mai jos l-ar fi golit imediat.
   * ⛔ Un „Sign out" apăsat de om nu sigilează nimic, deci acolo se șterge, ca până acum.
   */
  if (hasSealedDrafts()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch { /* o filă privată refuză accesul; nu e nimic de făcut și nimic de raportat */ }
}

export function useUnsavedGuard({ onClose, draftKey }: {
  onClose: () => void;
  /**
   * §46 „Form recovery" (Sesiunea 150) — cheia sub care se ține ciorna, dacă dialogul o vrea.
   *
   * ⚠️ **Include identitatea înregistrării** (`expense:<id>` / `expense:new`): fără ea, ciorna unei
   * cheltuieli ar fi fost oferită la deschiderea alteia. ⛔ Absentă = nu se scrie nimic, deci
   * dialogurile care nu o cer se comportă exact ca înainte.
   */
  draftKey?: string;
}) {
  const baselineRef = useRef<string | null>(null);
  const currentRef = useRef<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Ciorna găsită la deschidere, dacă spune altceva decât înregistrarea. */
  const [recoveredDraft, setRecoveredDraft] = useState<unknown>(null);

  /** Call where the dialog initialises its form, with the same values. */
  const captureBaseline = useCallback((values: unknown) => {
    const json = JSON.stringify(values ?? null);
    baselineRef.current = json;
    currentRef.current = json;
    if (!draftKey) return;
    /**
     * 🔴 **Aici e singurul moment în care se poate întreba**, fiindcă abia acum dialogul știe ce
     * înregistrare deschide. ⚠️ Iar comparația cu linia de start e ce face întrebarea utilă: o ciornă
     * identică cu ce e în bază nu e o recuperare, e zgomot.
     */
    const draft = readDraft(draftKey);
    setRecoveredDraft(draft !== null && JSON.stringify(draft) !== json ? draft : null);
  }, [draftKey]);

  /** Call on every render with the live form values. */
  const track = useCallback((values: unknown) => {
    const json = JSON.stringify(values ?? null);
    currentRef.current = json;
    if (!draftKey || baselineRef.current === null) return;
    /**
     * ⚠️ Scris doar cât timp e MURDAR; la revenirea la valorile de start se șterge. ⛔ Altfel
     * închiderea unui formular neatins ar lăsa o ciornă care s-ar oferi la următoarea deschidere.
     */
    if (json === baselineRef.current) removeDraft(draftKey);
    else writeDraft(draftKey, json);
  }, [draftKey]);

  /** Ciorna a fost folosită (sau refuzată): se șterge, iar bara dispare. */
  const dismissDraft = useCallback(() => {
    setRecoveredDraft(null);
    if (draftKey) removeDraft(draftKey);
  }, [draftKey]);

  const isDirty = useCallback(
    () => baselineRef.current !== null && currentRef.current !== baselineRef.current,
    [],
  );

  /**
   * Use in place of `onClose` on the dialog's close paths. Returns immediately
   * when there is nothing to lose, so the common case stays a single click.
   */
  const requestClose = useCallback(() => {
    if (isDirty()) { setConfirmOpen(true); return; }
    onClose();
  }, [isDirty, onClose]);

  const discard = useCallback(() => {
    setConfirmOpen(false);
    baselineRef.current = null;
    /**
     * ⚠️ **„Discard" înseamnă discard**, inclusiv ciorna. ⛔ Păstrată, ar fi reapărut la următoarea
     * deschidere ca „vrei să recuperezi?" — adică aplicația ar fi contrazis exact butonul apăsat.
     */
    if (draftKey) removeDraft(draftKey);
    setRecoveredDraft(null);
    onClose();
  }, [onClose, draftKey]);

  const keepEditing = useCallback(() => setConfirmOpen(false), []);

  /**
   * Call after a successful save: the saved values become the new baseline, so
   * closing afterwards does not claim there are unsaved changes.
   */
  const markSaved = useCallback(() => {
    baselineRef.current = currentRef.current;
    // ⚠️ Salvat = nu mai e nimic de recuperat.
    if (draftKey) removeDraft(draftKey);
    setRecoveredDraft(null);
  }, [draftKey]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      // Assigning returnValue is what actually triggers the prompt in Chrome.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return {
    captureBaseline, track, requestClose, discard, keepEditing, markSaved, confirmOpen, isDirty,
    // §46 „Form recovery" (Sesiunea 150).
    recoveredDraft, dismissDraft,
  };
}

