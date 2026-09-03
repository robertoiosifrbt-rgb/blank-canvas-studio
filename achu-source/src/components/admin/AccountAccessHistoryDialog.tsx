import { useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Info, Loader2, RefreshCw } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { getAccountAccessHistory, type AccessHistoryResponse } from '@/lib/endpoints';

/**
 * 🆕 §3 „Istoric al accesului" (Sesiunea 157) — DE CÂTE ORI ȘI CÂND A INTRAT CINEVA ÎN CONTUL LUI.
 *
 * ─── Ce se putea afla până azi, și ce nu ────────────────────────────────────
 *
 * Coloana „Last Sign-in" (Sesiunea 155) spune **un** moment. ⚠️ Întrebările reale despre un cont sunt
 * altele: *de când are omul ăsta acces?*, *îl folosește sau nu?*, *a mai intrat cineva pe adresa asta
 * după ce a plecat?* — și niciuna nu se poate răspunde dintr-un singur moment.
 *
 * ⛔ **Nimic nou în bază.** Rândurile există din §39 (Sesiunea 150), scrise de server la prima cerere
 * a fiecărei sesiuni noi. Ce lipsea era drumul de la un cont la rândurile lui.
 *
 * ─── 🔴 CE NU SPUNE ECRANUL, DINADINS ───────────────────────────────────────
 *
 * ⛔ **Nicio durată de sesiune și nicio „ultimă ieșire".** `user_logged_out` înseamnă „a apăsat Sign
 * out", iar un tab închis nu lasă rând — deci o coloană „până la" ar fi fost corectă pentru cei care
 * ies frumos și falsă pentru toți ceilalți.
 * ⛔ **Niciun „nu a intrat niciodată".** Jurnalul e mai tânăr decât conturile; propoziția de la server
 * (`note`) spune limita, sub listă, fiindcă pe baza acestui ecran se poate stinge un cont.
 * ⛔ **„How" nu e o dovadă** — antetele pe care se sprijină pot fi scrise de mână
 * (`backend/src/lib/auditSource.ts`); e un indiciu de triaj, și scrie așa în propoziția de sub listă.
 *
 * ─── ⚠️ Pagini, nu o listă care crește ──────────────────────────────────────
 *
 * 🔴 Ce pleacă spre browser e mărginit (hotărârea din ACHU-781): 50 de rânduri, iar **tăierea se
 * spune** cu numărul adevărat — „Showing 1–50 of 312". ⛔ Un cont folosit zilnic de un an are peste
 * 250 de intrări, și niciuna nu cere nimic de la nimeni.
 *
 * ⚠️ **Previous/Next, exact ca pe Audit History**, nu un „Show older" care adună paginile în memorie:
 * aceeași unealtă, aceleași cuvinte, iar starea paginii vine din **răspunsul serverului** (`offset`),
 * nu dintr-un contor ținut aici care s-ar putea despărți de el.
 */

/** Cât cere ecranul dintr-o dată. ⚠️ Serverul are același implicit; aici e scris ca să fie citit. */
const PAGE_SIZE = 50;

export default function AccountAccessHistoryDialog({ open, onClose, account }: {
  open: boolean;
  onClose: () => void;
  /** `null` = nu s-a ales niciun cont. Emailul e doar pentru titlu; ruta primește `id`. */
  account: { id: string; email: string } | null;
}) {
  const { data, loading, error, fire, setData } = useTrackedRequest<AccessHistoryResponse>({ timeoutMs: 30000 });

  /**
   * ⚠️ **Doar `id`-ul intră în dependențe**, nu obiectul: rândul din tabel e un obiect nou la fiecare
   * reîncărcare a listei de conturi, deci un `account` întreg ar fi recerut istoricul degeaba.
   */
  const accountId = account?.id ?? null;

  const load = useCallback((offset: number) => {
    if (!accountId) return;
    fire(() => getAccountAccessHistory({ id: accountId, offset, limit: PAGE_SIZE }));
  }, [accountId, fire]);

  useEffect(() => {
    if (!open || !accountId) return;
    /**
     * ⛔ Golit ÎNTÂI. `useTrackedRequest` păstrează dinadins datele vechi peste o cerere nouă (ca un
     * eșec să nu golească un ecran plin) — dar aici „vechi" înseamnă **istoricul altui om**, iar o
     * listă a altcuiva lăsată pe ecran cât vine răspunsul e chiar felul în care cineva ar putea
     * închide contul greșit.
     */
    setData(null);
    load(0);
  }, [open, accountId, load, setData]);

  const rows = data?.records ?? [];
  const total = data?.total ?? 0;
  const offset = data?.offset ?? 0;

  /**
   * Propoziția care numără. 🔴 Spune **„recorded"**: cifra e câte intrări s-au **scris**, nu de câte
   * ori a folosit cineva aplicația — diferența e chiar limita din `note`.
   */
  const countLine = total === 0
    ? 'No sign-ins recorded for this account'
    : `Showing ${offset + 1}–${offset + rows.length} of ${total} recorded sign-ins`;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access history</DialogTitle>
          {/* ⚠️ Emailul în subtitlu: dialogul se deschide dintr-un tabel de zeci de rânduri la fel. */}
          <DialogDescription>{account?.email ?? ''}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            {/* ⚠️ Mesajul hookului, nu unul inventat aici. */}
            <p className="text-sm text-destructive flex-1">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => load(offset)} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Retry
            </Button>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center gap-2 p-6 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />Loading…
          </div>
        ) : data ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{countLine}</p>

            {rows.length > 0 && (
              <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm" aria-label="Recorded sign-ins">
                  <thead><tr className="bg-muted/50">
                    <th scope="col" className="text-left p-3 font-medium">Signed in</th>
                    {/* ⛔ Aceleași cuvinte ca pe Audit History („How"), cu aceeași limită scrisă dedesubt. */}
                    <th scope="col" className="text-left p-3 font-medium">How</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-t border-border">
                        {/* ⛔ `fmtDateTime`, nu o formatare locală: ora UK, nu fusul calculatorului (ACHU-787). */}
                        <td className="p-3 text-xs whitespace-nowrap">{fmtDateTime(r.at)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{r.source ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 🔴 Tăierea nu e ascunsă: cine caută capătul vechi îl poate aduce. */}
            {(offset > 0 || data.hasMore) && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => load(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={!data.hasMore || loading} onClick={() => load(offset + PAGE_SIZE)}>Next</Button>
              </div>
            )}

            {/* 🔴 Limita, lângă listă: fără ea, „no sign-ins recorded" se citește ca o afirmație despre om. */}
            {data.note && (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{data.note}</span>
              </p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

