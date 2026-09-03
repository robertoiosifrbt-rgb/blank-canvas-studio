/**
 * §6 „Optional extras" (Sesiunea 160) — TABELUL OFERTEI, cu bifa „de ales".
 *
 * 🔴 **Ce rezolvă rândul:** biroul care voia să spună „curățenia de bază e £180, iar cuptorul, dacă
 * vrei, încă £45" avea două ieșiri: ori punea cuptorul înăuntru și clientul vedea £225 fără să știe
 * de ce, ori făcea a doua ofertă. ⛔ Prima pierde comanda pe un preț care pare mare; a doua
 * înseamnă două numere de ofertă pentru aceeași casă.
 *
 * ⚠️ **Tabelul a plecat din pagină în fișierul ăsta** fiindcă `PriceCalculatorPage` e sub clichet de
 * mărime: ce se adaugă, se extrage (`AGENT_RULES` §7.3).
 *
 * ⛔ **Ce NU face bifa:** nu schimbă `Grand Total`. Totalul rămâne „tot, dacă le ia pe toate" — e
 * citit de facturi și de rapoarte, iar o cifră care ar însemna altceva de azi ar fi schimbat tăcut
 * numere vechi. 🔴 Ce se schimbă e ce **vede clientul**: de la cât pornește, și ce poate adăuga.
 */
import { Checkbox } from '@/components/ui/checkbox';
import EmptyTableRow from '@/components/shared/EmptyTableRow';
import type { PriceQuoteLineItem } from '@/lib/billingEndpoints';

export default function QuoteLineItemsTable({
  lineItems, optionalFields, onToggleOptional, disabled,
}: {
  lineItems: PriceQuoteLineItem[];
  optionalFields: string[];
  /** Lipsă = tabel doar de citit (o ofertă finalizată). */
  onToggleOptional?: (field: string, optional: boolean) => void;
  disabled?: boolean;
}) {
  const optional = new Set(optionalFields);
  const bifabil = !!onToggleOptional;

  return (
    <div className="space-y-2">
      <div tabIndex={0} className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th scope="col" className="text-left p-2 font-medium">Service</th>
            <th scope="col" className="text-right p-2 font-medium">Qty</th>
            <th scope="col" className="text-right p-2 font-medium">Minutes</th>
            <th scope="col" className="text-right p-2 font-medium">Price</th>
            {bifabil && <th scope="col" className="text-center p-2 font-medium">Optional</th>}
          </tr></thead>
          <tbody>
            {/* §48 — un cap de tabel peste nimic se citește ca „stricat", nu ca „nu e nimic încă". */}
            {lineItems.length === 0 && (
              <EmptyTableRow colSpan={bifabil ? 5 : 4}>Nothing priced yet.</EmptyTableRow>
            )}
            {lineItems.map((item, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{item.group} — {item.label}</td>
                <td className="p-2 text-right">{item.quantity}</td>
                <td className="p-2 text-right">{item.totalMinutes}</td>
                <td className="p-2 text-right">£{item.price.toFixed(2)}</td>
                {bifabil && (
                  <td className="p-2 text-center">
                    <Checkbox
                      aria-label={`Make ${item.label} optional`}
                      checked={optional.has(item.field)}
                      disabled={disabled}
                      onCheckedChange={v => onToggleOptional!(item.field, v === true)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/*
        🔴 Propoziția care spune ce se întâmplă cu bifa. ⚠️ Fără ea, „Optional" ar fi arătat ca o
        notă internă — iar biroul n-ar fi știut că schimbă ce vede clientul în portal.
      */}
      {bifabil && (
        <p className="text-xs text-muted-foreground">
          Anything ticked here becomes an <strong>extra the customer can take or leave</strong>. The
          quote then shows a starting price, with the extras priced separately, and they tick what
          they want when they accept. The Grand Total below stays the price with everything in.
        </p>
      )}
    </div>
  );
}

