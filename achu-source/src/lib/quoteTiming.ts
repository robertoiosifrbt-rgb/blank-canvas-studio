/**
 * 🔴 §6 „Urgency" + „Flexible date" (Sesiunea 159) — starea și regula, fără JSX.
 *
 * ⛔ **Separate de componentă dinadins:** un fișier de componentă care exportă și constante rupe
 * `react-refresh/only-export-components`, iar clichetul de avertismente al porții e EXACT — deci
 * regula nu e stil, e ceva ce oprește `npm run check`.
 *
 * 🔴 **Regula pe care o poartă `quoteTimingPayload`:** „data se poate muta" **nu se trimite fără o
 * dată preferată**. ⛔ Serverul o refuză (`backend/src/lib/quoteTimingPolicy.ts`, cu motivele
 * întregi), iar refuzul acela i-ar apărea omului ca un formular respins fără motiv vizibil. ⚠️ Deci
 * ecranul nu o duplică ca pază — o duce ca politețe de dinaintea porții.
 */

/** ⚠️ `''` = nu a răspuns. Nu `false`: un implicit ar pune în gura omului un răspuns. */
export type QuoteTimingState = { urgency: string; dateFlexible: '' | 'yes' | 'no' };

export const INITIAL_QUOTE_TIMING: QuoteTimingState = { urgency: '', dateFlexible: '' };

/** Ce se trimite serverului. ⛔ Steagul cade dacă data a fost ștearsă după ce s-a răspuns. */
export function quoteTimingPayload(timing: QuoteTimingState, preferredDate: string) {
  return {
    urgency: timing.urgency || undefined,
    dateFlexible: preferredDate && timing.dateFlexible ? timing.dateFlexible === 'yes' : undefined,
  };
}

