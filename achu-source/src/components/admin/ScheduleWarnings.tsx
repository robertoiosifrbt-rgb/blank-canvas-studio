import { AlertTriangle, UserX, CalendarOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatDuration } from '@/lib/duration';
import { dayLabel } from '@/lib/scheduleLabels';

/**
 * Ce se vede DEASUPRA orarului — extras din `SchedulePage.tsx` la ACHU-797 (Sesiunea 158).
 *
 * ─── De ce sus, și nu jos ───────────────────────────────────────────────────
 * ⚠️ Un avertisment pe care trebuie să derulezi ca să-l vezi e un avertisment despre care afli de la
 * client. ⛔ „Timp liber" a rămas dinadins **sub** calendar: capacitatea nefolosită merită știută, dar
 * nu e urgentă ca o dublură, iar amândouă sus n-ar mai lăsat niciuna să iasă în față.
 *
 * ─── 🔴 De ce e un fișier separat ───────────────────────────────────────────
 * `SchedulePage.tsx` e la clichetul lui de mărime (373 de rânduri de cod), iar regula spune ce se
 * face atunci: **iese cod, cifra nu urcă** (`AGENT_RULES` §7). ⚠️ Felia asta adăuga un al treilea
 * card, deci a plătit locul extrăgând primele două.
 *
 * ⚠️ **Tipurile sunt structurale**, nu importate din pagină: componenta citește exact câmpurile pe
 * care le desenează, deci nu se rupe când răspunsul rutei mai câștigă unul.
 */
type Conflict = { cleanerName: string; date: string; overlapMinutes: number; travelOnly: boolean };
type Unassigned = { id: string; date: string; customerName: string; service: string };
/** 🆕 ACHU-797 — un curățător plecat în perioada privită. `summary` vine scris de pe server. */
type Away = { cleanerId: string; reason: 'leave' | 'sickness'; summary: string };

/** Cel mult atâtea rânduri pe card; restul se numără. Un card care crește cu munca ascunde grila. */
const MAX_ROWS = 5;

function More({ total }: { total: number }) {
  if (total <= MAX_ROWS) return null;
  return <li className="text-xs opacity-70">and {total - MAX_ROWS} more</li>;
}

export default function ScheduleWarnings({ conflicts, unassigned, away, awayAssignedCount, onOpenJob }: {
  conflicts: Conflict[];
  unassigned: Unassigned[];
  away: Away[];
  /**
   * 🔴 **Vizite, nu oameni** — atâtea trebuie mutate. Numărat pe server, ca să nu existe două
   * răspunsuri la aceeași întrebare (`backend/src/lib/scheduleAggregation.ts` — `buildAwayPanel`).
   */
  awayAssignedCount: number;
  onOpenJob: (id: string) => void;
}) {
  const nothing = conflicts.length === 0 && unassigned.length === 0 && away.length === 0;
  if (nothing) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {conflicts.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {conflicts.length} double-booking{conflicts.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1.5 space-y-1 text-red-700/90 dark:text-red-300/90">
            {conflicts.slice(0, MAX_ROWS).map((c, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{c.cleanerName}</span> on {dayLabel(c.date)} —{' '}
                {c.travelOnly ? 'no time to travel between two jobs' : `${formatDuration(c.overlapMinutes)} overlap`}
              </li>
            ))}
            <More total={conflicts.length} />
          </ul>
        </Card>
      )}

      {unassigned.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <UserX className="h-4 w-4 shrink-0" />
            {unassigned.length} job{unassigned.length === 1 ? '' : 's'} with no cleaner
          </p>
          <ul className="mt-1.5 space-y-1">
            {unassigned.slice(0, MAX_ROWS).map(u => (
              <li key={u.id}>
                <button onClick={() => onOpenJob(u.id)} className="text-left text-xs text-amber-700/90 dark:text-amber-300/90 hover:underline">
                  {dayLabel(u.date)} — {u.customerName} ({u.service})
                </button>
              </li>
            ))}
            <More total={unassigned.length} />
          </ul>
        </Card>
      )}

      {/*
        ─── 🔴 ACHU-797 — CINE NU VINE, ȘI CÂTE VIZITE STAU PE EL ──────────────────────

        ⛔ **Jumătatea care lipsea.** Concediul aprobat și boala erau spuse numai la asignarea în
        masă, deci biroul era prevenit când muta mai multe vizite, dar nu când privea săptămâna.
        🔴 Iar cazul invers nu era acoperit nicăieri: concediul se aprobă și **după** ce vizita a
        fost programată — atunci vizita rămânea în orar arătând ca oricare alta.

        ⚠️ **Cifra de sus e a vizitelor, nu a oamenilor:** „6 jobs" e munca de mutat; „1 person"
        ar fi ascuns-o. ⛔ Iar cuvântul e „job", nu „visit" (Roberto, 25/08/2026) — un test îl apără,
        și chiar el a prins rândurile de mai jos scrise „visit". ⛔ Iar cei plecați FĂRĂ vizite rămân în listă: „săptămâna viitoare nu-l am
        pe Ion" se folosește înainte de a accepta lucrări, nu după.
      */}
      {away.length > 0 && (
        <Card className="border-violet-500/40 bg-violet-500/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
            <CalendarOff className="h-4 w-4 shrink-0" />
            {away.length} away this period
            {awayAssignedCount > 0 && (
              <span className="font-normal">
                · {awayAssignedCount} job{awayAssignedCount === 1 ? '' : 's'} still on them
              </span>
            )}
          </p>
          <ul className="mt-1.5 space-y-1 text-violet-700/90 dark:text-violet-300/90">
            {away.slice(0, MAX_ROWS).map((a, i) => (
              <li key={`${a.cleanerId}-${a.reason}-${i}`} className="text-xs">{a.summary}</li>
            ))}
            <More total={away.length} />
          </ul>
          {/* ⛔ Aceeași hotărâre ca la asignare (ACHU-554/797): se AVERTIZEAZĂ, nu se refuză. */}
          <p className="mt-1.5 text-[11px] text-violet-700/70 dark:text-violet-300/70">
            A job outlined in violet has somebody away on it. Nothing is blocked — the office decides.
          </p>
        </Card>
      )}
    </div>
  );
}

