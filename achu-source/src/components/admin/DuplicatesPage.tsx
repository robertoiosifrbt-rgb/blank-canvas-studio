import { useEffect, useCallback } from 'react';
import { getDuplicateReport, getIntegrityReport, type DuplicateReport, type IntegrityReport } from '@/lib/reportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';

/**
 * §40 „Duplicate detection" (Sesiunea 154) — ECRANUL CARE ÎNTREABĂ, NU CARE REPARĂ.
 *
 * ⛔ **Nu are niciun buton care schimbă ceva.** Nici „unește", nici „șterge", nici „ignoră". Un
 * duplicat găsit e o **întrebare pentru un om**, iar unirea a două fișe atinge date și nu se poate
 * desface — e alt rând din §40, cu altă discuție.
 *
 * ─── 🔴 De ce „sigur" și „probabil" stau în două locuri, nu într-un scor ────
 * Un „78% duplicat" nu-i spune biroului **ce să verifice**. „Au același telefon" îi spune, și îi
 * spune și cât să se grăbească. ⚠️ Cele două liste arată diferit dinadins: prima cere o hotărâre,
 * a doua cere o privire.
 *
 * ─── ⚠️ De ce se scrie CÂT s-a scanat ───────────────────────────────────────
 * „Nicio problemă găsită" pe o bază goală și pe una cu patru mii de fișe sunt **două vești complet
 * diferite**, iar ecranul nu are voie să le arate la fel. Pe o bază goală, propoziția care liniștește
 * ar fi o minciună.
 */
/** Ce fel de problemă e — cuvântul pe care îl citește biroul, nu codul intern. */
const KIND_LABEL: Record<IntegrityReport['findings'][number]['kind'], string> = {
  status: 'Unknown status',
  link: 'Missing link',
  date: 'Impossible date',
};

/**
 * ⚠️ Câte rânduri se arată pe finding. Restul se **numără pe ecran** — o listă scurtată în tăcere se
 * citește ca lista întreagă, iar cine o închide crede că a văzut tot.
 */
const SHOWN_PER_FINDING = 20;

export default function DuplicatesPage() {
  const req = useTrackedRequest<DuplicateReport>({ timeoutMs: 45000 });
  const integrityReq = useTrackedRequest<IntegrityReport>({ timeoutMs: 45000 });
  const { fire } = req;
  const { fire: fireIntegrity } = integrityReq;
  const load = useCallback(() => {
    fire(() => getDuplicateReport());
    fireIntegrity(() => getIntegrityReport());
  }, [fire, fireIntegrity]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const integrity = integrityReq.data;
  const scanned = data ? data.counts.customers + data.counts.cleaners + data.counts.jobs : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Duplicates"
        description="Records that look like the same thing twice — to check, not to fix automatically."
        actions={<RefreshButton onRefresh={load} />}
      />

      {req.loading && !data && <LoadingSkeleton heights={['h-20', 'h-32', 'h-32']} label="Looking for duplicates…" />}

      {req.error && (
        <Card><CardContent className="p-4 flex items-start gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" aria-hidden="true" />
          <span>Could not read the report. <button className="underline" onClick={load}>Try again</button></span>
        </CardContent></Card>
      )}

      {data && (
        <>
          <Card>
            <CardContent className="p-4 flex items-start gap-2 text-sm">
              {data.totalAffected === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
                  <span>
                    {/* ⚠️ Cifra scanată e în aceeași frază: fără ea, „nimic de făcut" pe o bază goală
                        sună la fel ca „nimic de făcut" pe patru mii de fișe. */}
                    Nothing to check. <strong>{scanned}</strong> records compared.
                  </span>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                  <span>
                    <strong>{data.totalAffected}</strong> {data.totalAffected === 1 ? 'record' : 'records'} to check,
                    out of <strong>{scanned}</strong> compared. Nothing has changed — the screen only looks.
                  </span>
                </>
              )}
            </CardContent>
          </Card>

          {data.sections.map(s => (
            <Card key={s.entity}>
              <CardContent className="p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  {s.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {s.affected === 0 ? 'nothing' : `${s.affected} to check`}
                  </span>
                </h2>

                {s.groups.length === 0 && (
                  <p className="text-xs text-muted-foreground">No matches in {s.label.toLowerCase()}.</p>
                )}

                {s.groups.map((g, i) => (
                  <div key={`${g.kind}-${i}`} className="rounded-md border border-border p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">{g.reason}</p>
                      {/* 🔴 Eticheta spune ce fel de certitudine, nu un procent. */}
                      <Badge variant={g.certainty === 'certain' ? 'destructive' : 'outline'} className="text-xs shrink-0">
                        {g.certainty === 'certain' ? 'certain' : 'likely'}
                      </Badge>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {g.rows.map(r => (
                        <li key={r.id}>
                          <span className="font-mono">{r.ref}</span> — {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {/**
            * §40 — a doua familie: rânduri care EXISTĂ și nu se văd. ⚠️ Sub duplicate, nu într-un
            * ecran propriu: e aceeași treabă (curățenia datelor), iar cine o deschide vrea toată
            * lista, nu două locuri de vizitat.
            */}
          {integrity && integrity.findings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  Broken records
                  <span className="text-xs font-normal text-muted-foreground">
                    {integrity.totalAffected} to check
                  </span>
                </h2>
                {integrity.findings.map((f, i) => (
                  <div key={`${f.kind}-${i}`} className="rounded-md border border-border p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">{f.reason}</p>
                      <Badge variant="outline" className="text-xs shrink-0">{KIND_LABEL[f.kind]}</Badge>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {f.rows.slice(0, SHOWN_PER_FINDING).map(r => (
                        <li key={r.id}><span className="font-mono">{r.ref}</span></li>
                      ))}
                    </ul>
                    {f.rows.length > SHOWN_PER_FINDING && (
                      <p className="text-xs text-muted-foreground">
                        and {f.rows.length - SHOWN_PER_FINDING} more.
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ⛔ Ce NU s-a verificat, pe ecran. O listă goală care ascunde o verificare nefăcută pare o veste bună. */}
          {integrity && integrity.notChecked.length > 0 && (
            <Card><CardContent className="p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Not checked</p>
              {integrity.notChecked.map(n => <p key={n}>{n}</p>)}
            </CardContent></Card>
          )}

          <p className="text-xs text-muted-foreground">
            {/* ⛔ Propoziția care spune ce NU face ecranul. Fără ea, lipsa unui buton „unește" arată
                ca o funcție care lipsește, nu ca o hotărâre. */}
            Merging two records is not done from here: it touches data and cannot be undone. Open the
            records and decide.
          </p>
        </>
      )}
    </div>
  );
}

