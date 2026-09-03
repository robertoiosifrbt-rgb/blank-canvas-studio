/**
 * §31 (Sesiunea 145, felia a doua) — RAPORTUL DE CALITATE, pe ecranul biroului.
 *
 * Rândurile de backlog „Quality trends", „Quality by service", „Quality by customer".
 *
 * ─── 🔴 CE FACE ECRANUL ĂSTA CA SĂ NU MINTĂ ─────────────────────────────────
 * 1. **Propoziția despre acoperire e SUS, înaintea oricărei cifre.** „100% trec" din două vizite
 *    privite din patru sute nu e un fapt despre firmă — iar cine deschide un raport citește primul
 *    rând, nu notele de subsol.
 * 2. **Fiecare procent își cară numitorul** („din 12"). Un procent fără el e o părere.
 * 3. **Rândurile prea subțiri sunt marcate**, cu pragul venit de pe server.
 * 4. ⛔ **Nu există nicio coloană „pe curățător"**, iar ecranul spune de ce — o cifră despre un om
 *    e o afirmație despre el.
 *
 * ⛔ **Niciun calcul aici.** Tot ce se vede vine calculat de pe server (`lib/qualityReports.ts`).
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Info } from 'lucide-react';
import { getQualityReport, type QualityGroupRow, type QualityReportResponse } from '@/lib/qualityReportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

export default function QualityReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const req = useTrackedRequest<QualityReportResponse>({ timeoutMs: 20000 });

  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getQualityReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;

  return (
    <div className="space-y-4 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        Quality report
      </h2>

      {/* 🔴 SUS, înaintea oricărei cifre. Vine ca propoziție de pe server, nu se rescrie aici. */}
      {data && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">{data.coverage.sentence}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="qr-from" className="text-xs">From</Label>
          <Input id="qr-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="qr-to" className="text-xs">To</Label>
          <Input id="qr-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {/* ⚠️ Implicitul e ultimele 12 luni, aceeași fereastră ca la notele clienților. */}
        {(from || to) && (
          <Button type="button" size="sm" variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>
            Last 12 months
          </Button>
        )}
      </div>

      {req.loading && !data && <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
      {req.error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
          <p className="flex-1 text-sm text-destructive">Could not load the quality report.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      )}

      {data && (
        <>
          <Section
            title="By month"
            hint="Grouped by when the job happened, not by when somebody got round to looking at it."
            rows={data.byMonth}
            minSample={data.minSample}
          />
          <Section
            title="By service"
            hint="Most failures first — this list is read to find where the problem is."
            rows={data.byService}
            minSample={data.minSample}
          />
          <Section
            title="By customer"
            hint="Same order: whoever has had the most failed checks comes first."
            rows={data.byCustomer}
            minSample={data.minSample}
          />

          {/* ⛔ Ce NU e în raport, spus pe ecran, nu doar în cod. */}
          <p className="text-[11px] text-muted-foreground">{data.notIncluded}</p>
        </>
      )}
    </div>
  );
}

function Section({ title, hint, rows, minSample }: {
  title: string;
  hint: string;
  rows: QualityGroupRow[];
  minSample: number;
}) {
  /** ⚠️ Lunile goale rămân în tendință; la serviciu și client, lista goală e o propoziție. */
  const anything = rows.some(r => r.checked > 0 || r.waiting > 0);
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-[11px] text-muted-foreground">{hint}</p>

      {!anything && <p className="text-sm text-muted-foreground">Nothing looked at yet in these dates.</p>}

      {anything && (
        <div tabIndex={0} className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-2 font-medium">&nbsp;</th>
                <th scope="col" className="py-1 pr-2 font-medium">Passed</th>
                <th scope="col" className="py-1 pr-2 font-medium">Office</th>
                <th scope="col" className="py-1 pr-2 font-medium">Customer</th>
                <th scope="col" className="py-1 font-medium">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.label} className="border-t">
                  <td className="py-1 pr-2">{r.label}</td>
                  <td className="py-1 pr-2">
                    {/* 🔴 Procentul își cară numitorul. Fără el, e o părere. */}
                    {r.passRate === null ? <span className="text-muted-foreground">—</span> : `${r.passRate}% of ${r.checked}`}
                    {r.tooFewToMean && r.checked > 0 && (
                      <span
                        className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700"
                        title={`Fewer than ${minSample} checks — the figure is shown, but it is too thin to mean much.`}
                      >
                        too few
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-2">{r.officeAverage ?? '—'}</td>
                  <td className="py-1 pr-2">
                    {r.customerAverage ?? '—'}
                    {/* ⚠️ Doar când clientul a fost mai nemulțumit decât biroul: acolo firma nu vede
                        o problemă pe care clientul o vede. Semnul are înțeles, deci se marchează. */}
                    {r.strictnessGap !== null && r.strictnessGap < 0 && (
                      <span className="ml-1 rounded bg-destructive/15 px-1 py-0.5 text-[10px] text-destructive">
                        {`${r.strictnessGap} vs us`}
                      </span>
                    )}
                  </td>
                  <td className="py-1">{r.waiting > 0 ? r.waiting : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

