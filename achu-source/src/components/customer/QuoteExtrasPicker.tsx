/**
 * §6 „Optional extras" (Sesiunea 160) — CE POATE LUA CLIENTUL, ȘI CÂT FACE CU CE A BIFAT.
 *
 * 🔴 **Cifra se mișcă sub ochii lui.** ⛔ O listă de bife fără un total care se schimbă l-ar fi
 * lăsat să apese „Accept" fără să știe la ce sumă spune „da" — adică exact ce repară rândul.
 *
 * ⚠️ **Prețul fiecărui extra e cel din ofertă, cu reducerea deja aplicată** (o face serverul, în
 * `lib/quoteOptionalExtras.ts`). ⛔ Pagina nu calculează niciun preț: dacă ar fi făcut-o, portalul,
 * PDF-ul și biroul ar fi ajuns la trei sume.
 *
 * ⚠️ **Nimic bifat nu e o greșeală** — se acceptă și numai baza; extrele rămase pe dinafară nu sunt
 * refuzate, doar necumpărate.
 */
import { Checkbox } from '@/components/ui/checkbox';

export type QuoteSplit = {
  baseTotal: number;
  extras: { field: string; label: string; price: number }[];
  fullTotal: number;
};

const money = (n: number) => `£${n.toFixed(2)}`;

export default function QuoteExtrasPicker({
  split, chosen, onChange, disabled,
}: {
  /** ⛔ Lipsă = pachet vechi, dinaintea coloanei: nu se arată nimic, ecranul rămâne cel de ieri. */
  split: QuoteSplit | undefined;
  chosen: string[];
  onChange: (fields: string[]) => void;
  disabled?: boolean;
}) {
  if (!split || split.extras.length === 0) return null;

  const bifate = new Set(chosen);
  const total = split.baseTotal + split.extras.reduce((s, e) => s + (bifate.has(e.field) ? e.price : 0), 0);

  return (
    <div className="mt-2 rounded-md border p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        This quote starts at <strong>{money(split.baseTotal)}</strong>. The rest is up to you — tick
        anything you would like added, or leave them all and take the basic clean.
      </p>
      <ul className="space-y-1.5">
        {split.extras.map(e => (
          <li key={e.field} className="flex items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 min-w-0">
              <Checkbox
                id={`extra-${e.field}`}
                checked={bifate.has(e.field)}
                disabled={disabled}
                onCheckedChange={v => onChange(
                  v === true ? [...chosen, e.field] : chosen.filter(f => f !== e.field),
                )}
              />
              <span className="break-words">{e.label}</span>
            </label>
            <span className="whitespace-nowrap">+{money(e.price)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
        <span>Your total</span>
        <span aria-live="polite">{money(total)}</span>
      </div>
    </div>
  );
}

