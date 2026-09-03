import { Badge } from '@/components/ui/badge';
import { fmtDate } from '@/lib/format';
import type { PriceQuoteRecord } from '@/lib/billingEndpoints';

/**
 * INSIGNELE DE PE RÂNDUL UNEI OFERTE — toate răspund la aceeași întrebare: *mai e ceva de făcut
 * cu oferta asta?*
 *
 * ⛔ **De ce un fișier propriu (Sesiunea 160).** `PriceCalculatorPage.tsx` e la plafonul lui de
 * mărime, iar §6 „Viewed" atinge exact grupul ăsta: `AGENT_RULES` §7.4 — responsabilitatea atinsă
 * se extrage, iar pagina iese mai mică decât era. ⚠️ Nimic nu s-a rescris la mutare: valabilitatea
 * arată la fel ca înainte.
 */
export default function QuoteRowBadges({ quote }: { quote: PriceQuoteRecord }) {
  /**
   * §6 „Viewed" (Sesiunea 160) — a deschis clientul oferta?
   *
   * 🔴 **Tăcerea are două înțelesuri, și biroul le tratează diferit:** „a văzut-o și se gândește"
   * cere răbdare, „nu i-a ajuns sub ochi" cere un telefon. Fără insigna asta arătau identic.
   *
   * ⛔ **`null` NU se citește ca „nu a deschis-o" pe o ciornă și nici pe o ofertă la care omul a
   * răspuns deja:** o ciornă nu ajunge niciodată la client, iar un răspuns e o dovadă mai tare
   * decât o deschidere — o etichetă „Not opened" lângă un „Accepted" ar fi doar derutantă.
   * ⚠️ Rămâne cazul ofertelor emise înainte ca aplicația să știe să scrie momentul: acolo insigna
   * spune tot „Not opened yet", și e limita pe care o poartă coloana din prima zi (vezi schema).
   */
  const seen = quote.customerViewedAt;
  /** ⚠️ Doar când suma acceptată e ALTA decât totalul — altfel insigna ar repeta cifra de alături. */
  const acceptedLess = quote.customerResponse === 'Accepted' && quote.acceptedTotal != null
    && Number(quote.acceptedTotal) !== Number(quote.grandTotal);
  const showSeen = quote.status === 'Final' && !quote.customerResponse;

  return (
    <>
      <Badge variant={quote.status === 'Final' ? 'default' : 'outline'}>{quote.status}</Badge>
      {showSeen && seen && (
        <Badge variant="outline" className="ml-1 border-sky-500 text-sky-700 dark:text-sky-400" title={`The customer opened this quote on ${fmtDate(seen)}`}>
          Seen
        </Badge>
      )}
      {showSeen && !seen && (
        <Badge variant="outline" className="ml-1 text-muted-foreground" title="Nothing in the portal shows this quote has been opened yet">
          Not opened yet
        </Badge>
      )}
      {/*
        ACHU-562 — lângă status, fiindcă e aceeași întrebare: mai e ceva de făcut cu oferta asta?

        ⛔ Nu se arată pentru `answered` (clientul a răspuns) și nici pentru `valid` (nu e nimic de
        anticipat) — un marcaj pe fiecare rând nu mai distinge niciun rând.
      */}
      {quote.expiry?.status === 'expiring' && (
        <Badge variant="outline" className="ml-1 border-amber-500 text-amber-700 dark:text-amber-400" title={`Held until ${quote.expiry.expiresOn}`}>
          {quote.expiry.daysLeft === 0 ? 'Last day' : `${quote.expiry.daysLeft}d left`}
        </Badge>
      )}
      {/*
        🔴 §6 „Optional extras" (Sesiunea 160) — CÂT A ACCEPTAT, când nu e tot.
        ⛔ Fără insigna asta, biroul ar fi citit `grandTotal` de pe rând și ar fi facturat extre pe
        care omul nu le-a luat. ⚠️ Se arată **doar când diferă** de total: un marcaj pe fiecare
        rând nu mai distinge niciun rând (aceeași regulă ca la valabilitate, mai jos).
      */}
      {acceptedLess && (
        <Badge variant="outline" className="ml-1 border-emerald-500 text-emerald-700 dark:text-emerald-400" title={`They took the £${Number(quote.acceptedTotal).toFixed(2)} version, not the full £${Number(quote.grandTotal).toFixed(2)}`}>
          Accepted £{Number(quote.acceptedTotal).toFixed(2)}
        </Badge>
      )}
      {quote.expiry?.status === 'expired' && (
        <Badge variant="outline" className="ml-1 text-muted-foreground" title={`Price was held until ${quote.expiry.expiresOn}`}>
          Past validity
        </Badge>
      )}
    </>
  );
}

