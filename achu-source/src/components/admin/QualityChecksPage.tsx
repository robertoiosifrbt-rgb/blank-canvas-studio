/**
 * §31 „Quality assurance" (Sesiunea 145) — VERIFICĂRILE DE CALITATE, pe ecranul biroului.
 *
 * ─── 🔴 CE E ECRANUL ĂSTA, ȘI CE NU E ───────────────────────────────────────
 * ✅ **O listă de lucru.** Ce a cerut cineva să fie privit, ce a fost privit, ce a picat. ⚠️ Asta
 * lipsea: nota biroului, nota clientului, pozele și checklistul existau deja, dar nimeni nu se uita
 * la o vizită decât **după** ce suna clientul.
 *
 * ⛔ **Nu e un raport.** Nu are medii și nu are tendințe: rândurile de backlog despre calitatea pe
 * curățător și pe serviciu cer o agregare, nu un ecran, și n-au fost construite în felia asta.
 *
 * ⛔ **Și nu e feedback pentru nimeni.** Propoziția de sus vine de pe server și spune exact asta.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { getQualityChecks, type QualityCheckRecord, type QualityCheckListResponse } from '@/lib/qualityCheckEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import QualityCheckRequest from './QualityCheckRequest';
import QualityCheckSample from './QualityCheckSample';
import QualityCheckVerdict from './QualityCheckVerdict';
import HistoryCapNote from '@/components/shared/HistoryCapNote';

const VIEWS = [
  { key: '', label: 'All' },
  { key: 'Required', label: 'Waiting to be looked at' },
  { key: 'Passed', label: 'Fine' },
  { key: 'Failed', label: 'Not good enough' },
] as const;

export default function QualityChecksPage() {
  const [status, setStatus] = useState<string>('');
  const req = useTrackedRequest<QualityCheckListResponse>({ timeoutMs: 20000 });

  const { fire } = req;
  const load = useCallback(() => { fire(() => getQualityChecks(status ? { status } : {})); }, [fire, status]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Quality checks
        </h2>
        <div className="flex flex-wrap gap-2">
          <QualityCheckSample onPicked={load} />
          <QualityCheckRequest onCreated={load} />
        </div>
      </div>

      {/* ⚠️ Amândouă propozițiile vin de pe SERVER, din politică — ecranul nu-și scrie propria
          versiune a regulii, care s-ar învechi separat de ea. */}
      {data && (
        <p className="text-xs text-muted-foreground">
          {data.audience} {data.evidenceNote}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which checks to show">
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
            {data && v.key === 'Required' && data.counts.waiting > 0 && ` · ${data.counts.waiting}`}
            {/* ⚠️ Ce a picat se numără lângă filtru, altfel se pierde într-o listă lungă. */}
            {data && v.key === 'Failed' && data.counts.failed > 0 && ` · ${data.counts.failed}`}
          </button>
        ))}
      </div>

      {req.loading && !data && <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
      {req.error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
          <p className="flex-1 text-sm text-destructive">Could not load the quality checks.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      )}

      {/* ⛔ Lista goală SPUNE ceva — și aici e o veste proastă, nu bună: nimeni nu s-a uitat la
          nimic. ⚠️ De asta propoziția trimite la tragerea la sorți, nu doar constată. */}
      {data && data.records.length === 0 && !req.loading && (
        <p className="text-sm text-muted-foreground">
          Nothing here yet — nobody has been asked to look at a job. Picking a random sample is the
          way to find out how the work is going when nobody has complained.
        </p>
      )}

      <div className="space-y-2">
        {data?.records.map(r => <Row key={r.id} record={r} onChanged={load} />)}
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

function Row({ record, onChanged }: { record: QualityCheckRecord; onChanged: () => void }) {
  const failed = record.status === 'Failed';
  return (
    <div className={`space-y-1.5 rounded-md border px-3 py-2 ${failed ? 'border-destructive/40' : ''}`}>
      <p className="text-sm">
        <span className="mr-1.5 text-[10px] text-muted-foreground">#{record.qualityCheckId}</span>
        {record.customerName ?? 'Unknown customer'}
        <span className="text-muted-foreground"> · job #{record.jobRef}, {record.jobDate} · {record.service}</span>
        {/* ⚠️ Se marchează ce cere ceva de la cineva, nu fiecare stare. */}
        {record.status === 'Required' && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700 align-middle">
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />Needs looking at
          </span>
        )}
        {failed && (
          <span className="ml-1.5 rounded bg-destructive/15 px-1 py-0.5 text-[10px] text-destructive align-middle">
            Not good enough
          </span>
        )}
        {record.status === 'Passed' && (
          <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-700 align-middle">Fine</span>
        )}
      </p>

      <p className="text-[11px] text-muted-foreground">
        {record.source === 'Sampling'
          ? `Picked at random by ${record.requestedBy}`
          : `Asked for by ${record.requestedBy}`}
        {record.cleaners.length > 0 && ` · ${record.cleaners.join(', ')}`}
        {/* 🔴 Cât era de privit — se vede și după, nu doar în formular. */}
        {` · ${record.photoCount} photo(s), ${record.checklistCount} checklist point(s)`}
        {record.customerScore !== null && ` · customer said ${record.customerScore}/5`}
        {record.officeScore !== null && ` · office ${record.officeScore}/5`}
      </p>

      {record.requestedNote && (
        <p className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{record.requestedNote}</p>
      )}

      {/* ⚠️ Verdictul și ce s-a făcut stau împreună: „failed" fără ce s-a făcut e o jumătate de răspuns. */}
      {record.checkedBy && (
        <p className="text-[11px] text-muted-foreground">
          {`Looked at by ${record.checkedBy}`}
          {record.photosReviewed && ' · photos'}
          {record.checklistReviewed && ' · checklist'}
          {record.findings && ` — ${record.findings}`}
        </p>
      )}
      {record.correctiveAction && (
        <p className="text-[11px]"><span className="text-muted-foreground">Done about it: </span>{record.correctiveAction}</p>
      )}

      {/* 🔴 O propoziție, nu o stare: „Failed" nu spune nimănui ce să facă. */}
      {record.nextStep && <p className="text-[11px] font-medium">{record.nextStep}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <QualityCheckVerdict record={record} onDone={onChanged} />
      </div>
    </div>
  );
}

