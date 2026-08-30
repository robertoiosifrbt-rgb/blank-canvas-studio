/**
 * ACHU-579 (`Backlog_Functionalitati_Viitoare` §5.2) — ISTORICUL ACESTEI CASE.
 *
 * ─── 🔴 GOLUL ─────────────────────────────────────────────────────────────────
 * Legătura vizită→casă există din ACHU-570, iar lista de case arată **câte** vizite are fiecare.
 * Lipsea ecranul care spune **care**: biroul întreabă „ce s-a lucrat la casa asta?" și primea o
 * cifră, nu o listă.
 *
 * ─── 🔴 PROPOZIȚIA CARE ȚINE ECRANUL ONEST ────────────────────────────────────
 * **Vizitele de dinainte de ACHU-570 nu sunt legate de nicio casă** — deliberat: nu se poate ști
 * la care au fost, iar o ghicire după textul adresei ar fi o afirmație inventată.
 *
 * ⛔ Deci o casă curățată săptămânal timp de doi ani poate arăta **zero vizite** aici. Fără
 * rândul care spune asta, biroul ar citi cifra ca pe un fapt despre casă, când e un fapt despre
 * **când am construit noi tabelul**. 🔴 Iar când casa n-are nicio vizită legată, ecranul **nu**
 * spune „nu s-a curățat niciodată aici": **necunoscut nu e „nu"** — aceeași regulă ca cele trei
 * stări de peste tot pe casă.
 *
 * ─── ⛔ CE NU E PE ECRAN, DELIBERAT ───────────────────────────────────────────
 * **Niciun TOTAL de bani.** Suma facturată la o casă e o întrebare de profitabilitate (§26), o
 * zonă nedecisă — iar un total ar fi citit ca „cât am câștigat aici", ceea ce e venit, nu profit.
 * Sumele **per vizită** rămân: acelea se văd deja pe fiecare fișă de vizită.
 */
import { useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, Loader2, Info, MapPin } from 'lucide-react';
import { StatusBadge, fmtDate } from '@/lib/format';
import { getPropertyHistory } from '@/lib/endpoints';
// ⚠️ Tipul din `propertyTypes`, unde stau toate tipurile caselor — `endpoints.ts` re-exportă
// funcțiile, nu tipurile, iar un import de acolo ar fi cerut încă un re-export de ținut la zi.
import type { PropertyHistory } from '@/lib/propertyTypes';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

export default function PropertyHistoryDialog({ propertyId, label, open, onClose }: {
  propertyId: string;
  label: string;
  open: boolean;
  onClose: () => void;
}) {
  const req = useTrackedRequest<PropertyHistory>({ timeoutMs: 20000 });

  const { fire } = req;
  const load = useCallback(() => {
    if (open && propertyId) fire(() => getPropertyHistory({ propertyId }));
  }, [fire, open, propertyId]);

  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const visits = data?.records ?? [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" aria-hidden="true" />
            What we have done at {label}
          </DialogTitle>
          <DialogDescription>
            Every job booked against this property, most recent first.
          </DialogDescription>
        </DialogHeader>

        {!data && !req.error && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading…
          </div>
        )}

        {req.error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Could not load the history for this property.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => req.retry()}>Try again</Button>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            {/*
              ⚠️ Rezumatul înaintea listei: întrebarea biroului e „de când și de câte ori",
              iar răspunsul nu trebuie numărat cu ochiul de pe cincizeci de rânduri.
            */}
            {data.summary.total > 0 && (
              <div className="rounded-md border p-2 text-sm">
                <p>
                  <strong>{data.summary.total}</strong> job{data.summary.total === 1 ? '' : 's'} here
                  {data.summary.firstVisit && data.summary.lastVisit && (
                    <> · {fmtDate(data.summary.firstVisit)} — {fmtDate(data.summary.lastVisit)}</>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {Object.entries(data.summary.byStatus).map(([status, n]) => (
                    <span key={status}>{status}: {n}</span>
                  ))}
                </div>
              </div>
            )}

            {/*
              🔴 RÂNDUL FĂRĂ DE CARE ECRANUL AR MINȚI. Vezi antetul fișierului: cifra de mai sus
              numără doar vizitele LEGATE de o casă, iar cele vechi nu sunt legate de niciuna.
              ⛔ Când casa n-are nicio vizită legată, textul e altul: nu afirmă nimic despre casă.
            */}
            {data.unlinked && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                {data.unlinked.hidesEverything ? (
                  <span>
                    <strong>This does not mean we have never cleaned here.</strong> This customer has{' '}
                    {data.unlinked.count} older job{data.unlinked.count === 1 ? '' : 's'} that{' '}
                    {data.unlinked.count === 1 ? 'is' : 'are'} not linked to any property — jobs
                    booked before properties existed do not say which house they were at, and we do
                    not guess. Link them on the job itself if you know.
                  </span>
                ) : (
                  <span>
                    This customer also has {data.unlinked.count} older job
                    {data.unlinked.count === 1 ? '' : 's'} not linked to any property, so{' '}
                    {data.unlinked.count === 1 ? 'it is' : 'they are'} not counted above.
                  </span>
                )}
              </p>
            )}

            {data.summary.total === 0 && !data.unlinked && (
              <p className="text-sm text-muted-foreground">No jobs booked against this property yet.</p>
            )}

            {visits.length > 0 && (
              <ul className="space-y-1.5">
                {visits.map(v => (
                  <li key={v.id} className="rounded-md border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {fmtDate(v.jobDate)} · {v.service}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          #{v.reference}
                          {v.cleaners.length > 0 && <> · {v.cleaners.join(', ')}</>}
                        </p>
                        {/*
                          🔴 Adresa apare DOAR când diferă de cea a casei de azi — `Job.address` e
                          un instantaneu, deci o vizită veche poate purta adresa de dinainte de
                          mutare. Repetată identic pe fiecare rând, ar fi fost zgomot care ascunde
                          exact cazul în care contează.
                        */}
                        {v.addressThen && (
                          <p className="text-xs text-muted-foreground flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
                            Booked to: {v.addressThen}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.amountCharged !== null && (
                          <span className="text-sm tabular-nums">£{v.amountCharged}</span>
                        )}
                        <StatusBadge status={v.status ?? undefined} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* ⚠️ Ce s-a tăiat SE SPUNE — un plafon tăcut prezintă o felie drept tot. */}
            {data.hasMore && (
              <p className="text-xs text-muted-foreground">
                Showing the {visits.length} most recent of {data.summary.total}. Older jobs are on
                the customer’s job list.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

