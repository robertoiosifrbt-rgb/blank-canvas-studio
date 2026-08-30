import { Card, CardContent } from '@/components/ui/card';
import { Umbrella } from 'lucide-react';
import { fmt } from '@/lib/format';
/**
 * 🔴 §17 (Sesiunea 151) — **formatarea duratei, una singură în toată aplicația** (`lib/duration.ts`,
 * scoasă la §7). ⛔ `approvedByKind` vine în **MINUTE** deși stă lângă câmpuri în ORE — chiar
 * capcana scrisă în `timesheetEndpoints.ts`: un ecran care le adună greșește cu un factor de 60.
 * ⚠️ Trecute printr-o funcție care spune „4h 30m", eroarea aceea nu se mai poate scrie tăcut.
 */
import { formatDuration } from '@/lib/duration';
import { KIND_LABEL } from '@/lib/timesheetsFormat';

export default function TimesheetsSummaryCard({ summary }) {
  const s = summary?.summary;
  if (!s) return null;
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-2xl font-semibold">{s.approvedHours}h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Waiting to be approved</p>
            <p className={`text-2xl font-semibold ${s.draftHours > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              {s.draftHours}h
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disputed</p>
            <p className={`text-2xl font-semibold ${s.disputedHours > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {s.disputedHours}h
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gross for the period</p>
            <p className="text-2xl font-semibold">
              {summary.suggestedGross == null ? '—' : fmt(summary.suggestedGross)}
            </p>
          </div>
        </div>

        {/* Said in words whether or not there is a figure. A blank cell with no
            explanation is what sends somebody looking for a bug. */}
        <p className="text-xs text-muted-foreground">{summary.grossBasis}</p>

        {/*
          🔴 §17 (Sesiunea 151) — **CÂT A FOST DRUM ȘI CÂT A FOST ÎN CASĂ.**
          ⛔ Serverul desface orele aprobate pe fel (`approvedByKind`) de la ACHU-368 și **nimeni nu
          le vedea**: ecranul arăta un singur total, deci „unde s-au dus cele 38 de ore" nu avea
          răspuns fără să deschizi rând cu rând. ⚠️ Contează pentru salariul minim: deplasarea între
          două case E timp de lucru, iar dacă nimeni nu vede cât e, media arată mai bună decât e.
          ⚠️ Doar felurile care AU ore — o coloană „Training: 0h" pe toate ecranele se citește o dată.
        */}
        {/*
          ⚠️ Tipat aici, nu prin `any`: cardul primește `summary` fără tip (fișierul e vechi), iar
          `Object.entries` pe un obiect netipat dă `unknown` — adică exact factorul de 60 nu ar mai fi
          apărat de nimic.
        */}
        {s.approvedByKind && Object.values(s.approvedByKind as Record<string, number>).some(m => m > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {Object.entries(s.approvedByKind as Record<string, number>)
              .filter(([, minutes]) => minutes > 0)
              .map(([kind, minutes]) => (
                <span key={kind}>
                  <span className="text-muted-foreground">{KIND_LABEL[kind] ?? kind}: </span>
                  <span className="font-medium">{formatDuration(minutes)}</span>
                </span>
              ))}
          </div>
        )}

        {summary.holiday && (
          <div className="rounded-lg border p-3 flex gap-3">
            <Umbrella className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">
                Holiday accrued: {summary.holiday.hours}h
                {summary.holiday.value != null && <> — about {fmt(summary.holiday.value)}</>}
              </p>
              <p className="text-xs text-muted-foreground">{summary.holiday.note}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

