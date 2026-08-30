/**
 * §30 „Re-clean workflow" (Sesiunea 144) — RE-CURĂȚENIILE, pe ecranul biroului.
 *
 * ─── 🔴 CELE TREI DECIZII ALE OWNER-ULUI, 20/08/2026, VIZIBILE PE ECRAN ─────
 * *„Clientul primește recurățenie gratis… **DISCRETIONARY**"*, *„Curățătorul e plătit tot timpul"*,
 * *„Doar eu aprob momentan"*.
 *
 * ⚠️ **Propoziția de sus le spune pe toate trei, și nu e decorativă:** cine se uită la ecranul ăsta
 * ia o hotărâre despre banii firmei. ⛔ Un ecran care nu spune „gratis pentru client, plătit pentru
 * curățător" lasă pe cineva să creadă că e o vizită ca oricare alta.
 *
 * ⛔ **Nu există buton „creează re-curățenie" automat de nicăieri altundeva.** Cererea se scrie aici,
 * de un om, pornind de la o vizită anume — „discreționar" nu se poate declanșa.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCw, AlertTriangle } from 'lucide-react';
import { getReCleans, type ReCleanRecord, type ReCleanListResponse } from '@/lib/reCleanEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import ReCleanDecision from './ReCleanDecision';
import ReCleanRequest from './ReCleanRequest';
import HistoryCapNote from '@/components/shared/HistoryCapNote';

const VIEWS = [
  { key: '', label: 'All' },
  { key: 'Requested', label: 'Waiting for a decision' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Declined', label: 'Turned down' },
] as const;

export default function ReCleansPage() {
  const [status, setStatus] = useState<string>('');
  const req = useTrackedRequest<ReCleanListResponse>({ timeoutMs: 20000 });

  const { fire } = req;
  const load = useCallback(() => { fire(() => getReCleans(status ? { status } : {})); }, [fire, status]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  /**
   * ⚠️ **Vine de pe server, din rol** — ecranul nu mai compară adrese. 🔴 Regula adevărată e
   * `requireSuperAdmin()` pe rută, deci un ecran greșit nu poate aproba nimic.
   */
  const canDecide = data?.canDecide ?? false;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <RotateCw className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Re-cleans
        </h2>
        <ReCleanRequest onCreated={load} />
      </div>

      {/* 🔴 Cele trei decizii, în cuvintele lor. ⚠️ „Not a promise" e partea care ține politica
          discreționară de a deveni un drept pe care cineva îl citește pe ecran. */}
      <p className="text-xs text-muted-foreground">
        Going back to redo a clean is <strong>free for the customer and paid for the cleaner</strong> — the
        job is booked at no charge, and the hours go through the timesheet as normal. It is a decision
        we make case by case, <strong>not a promise the app makes to anybody</strong>.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which re-cleans to show">
        {VIEWS.map(v => (
          <button
            key={v.key || 'all'}
            type="button"
            aria-pressed={status === v.key}
            onClick={() => setStatus(v.key)}
            className={`min-h-[36px] rounded-full border px-3 text-xs ${
              status === v.key ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'
            }`}
          >
            {v.label}
            {data && v.key === 'Requested' && data.counts.waiting > 0 && ` · ${data.counts.waiting}`}
          </button>
        ))}
      </div>

      {req.loading && !data && <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
      {req.error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
          <p className="flex-1 text-sm text-destructive">Could not load the re-cleans.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      )}

      {/* ⛔ Lista goală SPUNE ceva. ⚠️ Și e o propoziție bună de citit: nimic de refăcut e o veste bună. */}
      {data && data.records.length === 0 && !req.loading && (
        <p className="text-sm text-muted-foreground">Nothing here — no cleans have needed redoing.</p>
      )}

      <div className="space-y-2">
        {data?.records.map(r => (
          <Row key={r.id} record={r} canDecide={canDecide} onChanged={load} />
        ))}
      </div>
      {/*
        🔴 ACHU-786 — **lista tăiată SPUNE că e tăiată.** ⚠️ Sub listă, nu deasupra: e o notă despre
        coadă, iar deasupra ar fi împins munca de azi mai jos pe telefon. ⛔ Propoziția vine de pe
        server, ca toate cele patru ecrane să spună la fel.
      */}
      <HistoryCapNote note={data?.historyNote} />

    </div>
  );
}

function Row({ record, canDecide, onChanged }: {
  record: ReCleanRecord;
  canDecide: boolean;
  onChanged: () => void;
}) {
  const declined = record.status === 'Declined';
  return (
    <div className={`space-y-1.5 rounded-md border px-3 py-2 ${declined ? 'opacity-70' : ''}`}>
      <p className="text-sm">
        <span className="mr-1.5 text-[10px] text-muted-foreground">#{record.reCleanId}</span>
        {record.customerName ?? 'Unknown customer'}
        <span className="text-muted-foreground"> · job #{record.originalJobRef}, {record.originalJobDate}</span>
        {/* ⚠️ Se marchează ce cere ceva de la cineva, nu fiecare stare. */}
        {record.outcome === 'Requested' && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700 align-middle">
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />Needs a decision
          </span>
        )}
        {record.outcome === 'Done' && (
          <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-700 align-middle">Done</span>
        )}
        {declined && (
          <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground align-middle">Turned down</span>
        )}
      </p>

      <p className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{record.reason}</p>

      <p className="text-[11px] text-muted-foreground">
        {`Raised by ${record.requestedBy ?? 'somebody'} (${record.source === 'QualityCheck' ? 'quality check' : record.source.toLowerCase()})`}
        {record.dueDate && ` · wanted by ${record.dueDate}`}
        {record.cleanerPreference !== 'NoPreference' && ` · ${record.cleanerPreference === 'Same' ? 'same cleaner' : 'a different cleaner'}`}
        {record.complaintRef && ` · complaint #${record.complaintRef}`}
        {record.reCleanJobRef && ` · booked as job #${record.reCleanJobRef} on ${record.reCleanJobDate}`}
      </p>

      {/* ⚠️ Hotărârea și motivul ei stau împreună: „turned down" fără motiv e o jumătate de răspuns. */}
      {record.decidedBy && (
        <p className="text-[11px] text-muted-foreground">
          {`${record.status === 'Approved' ? 'Approved' : 'Turned down'} by ${record.decidedBy}`}
          {record.decisionNote && ` — ${record.decisionNote}`}
        </p>
      )}

      {/* 🔴 O propoziție, nu o stare: „Approved" nu spune nimănui ce să facă. */}
      {record.nextStep && <p className="text-[11px] font-medium">{record.nextStep}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <ReCleanDecision record={record} canDecide={canDecide} onDone={onChanged} />
      </div>
    </div>
  );
}

