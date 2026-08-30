/**
 * 🔴 §6 „Urgency" + „Flexible date" (Sesiunea 159) — CELE DOUĂ ÎNTREBĂRI DESPRE TIMP, o dată.
 *
 * ─── ⛔ DE CE UN FIȘIER COMUN, NU DE DOUĂ ORI ──────────────────────────────
 *
 * Aceleași două întrebări stau pe **amândouă** formularele de ofertă: cel public
 * (`PublicQuoteRequestPage`) și cel al clientului logat (`QuoteFormDialog`). ⚠️ Scrise de două ori,
 * s-ar despărți la prima schimbare de formulare — iar atunci vizitatorul de pe site și clientul din
 * portal ar răspunde la întrebări diferite, în timp ce biroul citește o singură coloană.
 *
 * ─── 🔴 REGULA CARE E CODIFICATĂ AICI, NU DOAR PE SERVER ───────────────────
 *
 * ⛔ „Data se poate muta" **nu se trimite fără o dată preferată** — serverul o refuză
 * (`lib/quoteTimingPolicy.ts`), iar refuzul acela ar apărea omului ca un formular respins fără
 * motiv vizibil. ⚠️ Deci întrebarea **apare** doar când există o dată, iar `quoteTimingPayload`
 * scoate steagul dacă data e ștearsă după ce s-a răspuns. 🔴 Serverul rămâne poarta; asta e
 * politețea de dinaintea porții.
 *
 * ⚠️ **Nicio valoare nu e o promisiune a noastră.** „As soon as possible" nu declanșează nimic:
 * nimic nu sortează, nu prioritizează și nu răspunde automat după ea. Un termen de răspuns e ce
 * promitem în scris, deci o hotărâre a owner-ului.
 */
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { VALID_QUOTE_URGENCIES } from '@/lib/validation';
// ⛔ Starea, tipul și regula de trimitere stau în `lib/quoteTiming.ts`: un fișier de componentă care
// exportă și constante rupe `react-refresh/only-export-components`, iar clichetul porții e exact.
import { QuoteTimingState } from '@/lib/quoteTiming';

type Props = {
  /** Prefixul de `id`, ca cele două formulare să nu aibă câmpuri cu același id pe aceeași pagină. */
  idPrefix: string;
  value: QuoteTimingState;
  onChange: (next: QuoteTimingState) => void;
  /** ⚠️ Întrebarea despre mutarea datei apare numai când există o dată preferată. */
  hasPreferredDate: boolean;
};

export default function QuoteTimingFields({ idPrefix, value, onChange, hasPreferredDate }: Props) {
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-urgency`}>How soon do you need this?</Label>
        <Select value={value.urgency} onValueChange={v => onChange({ ...value, urgency: v })}>
          <SelectTrigger id={`${idPrefix}-urgency`}><SelectValue placeholder="Select how soon" /></SelectTrigger>
          <SelectContent>
            {VALID_QUOTE_URGENCIES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {hasPreferredDate && (
        <div>
          <Label htmlFor={`${idPrefix}-date-flexible`}>Can that date move?</Label>
          <Select
            value={value.dateFlexible}
            onValueChange={v => onChange({ ...value, dateFlexible: v as 'yes' | 'no' })}
          >
            <SelectTrigger id={`${idPrefix}-date-flexible`}><SelectValue placeholder="Select an answer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes — other dates work too</SelectItem>
              <SelectItem value="no">No — that date is the only one that works</SelectItem>
            </SelectContent>
          </Select>
          {/* ⚠️ Spus de ce contează: altfel „da" e răspunsul comod, iar biroul l-ar citi ca pe o dată mutabilă. */}
          <p className="mt-1 text-xs text-muted-foreground">
            If the date cannot move — an end of tenancy, a move-in day — tell us here and we will
            work around it.
          </p>
        </div>
      )}
    </>
  );
}

