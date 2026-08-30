import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getSchedule, getCleaners, getJob, getTeams, exportSchedule } from '@/lib/endpoints';
import { ukToday, addDays, monthStart, monthEnd } from '@/lib/ukDate';
// ⚠️ §7 (Sesiunea 150) — formatarea duratei a plecat în `lib/duration.ts`, ca să nu existe a doua
// copie: aceeași durată nu are voie să se scrie diferit pe două ecrane.
import { formatDuration } from '@/lib/duration';
import { fmtTime } from '@/lib/ukClock';
/**
 * ⚠️ Cele trei etichete de dată au plecat în `lib/scheduleLabels.ts` (ACHU-797): le citește și cardul
 * de avertismente, iar o a doua copie ar fi rupt exact ce a reparat ACHU-787.
 */
import { dayLabel, longDayLabel, monthLabel } from '@/lib/scheduleLabels';
import JobDialog from './JobDialog';
// §43 „Calendar display" (Sesiunea 150) — cardul sarcinii și gruparea pe zile.
import { ScheduleDayTasks } from './ScheduleTaskChip';
// ⚠️ `ScheduleTask` nu se mai importă aici: forma sarcinii vine cu răspunsul rutei (ACHU-797).
import { groupEntriesByDay, groupTasksByDay } from '@/lib/scheduleGrouping';
import type { JobRecord } from '@/lib/adminRecordTypes';
import RefreshButton from '../shared/RefreshButton';
import { errMsg } from '@/lib/errorMessage';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
/**
 * 🆕 ACHU-797 — cardurile de deasupra calendarului, inclusiv cel nou („cine nu vine"). ⛔ Extrase
 * fiindcă pagina e la clichetul ei: al treilea card se plătește cu primele două (`AGENT_RULES` §7).
 */
import ScheduleWarnings from './ScheduleWarnings';
/** 🆕 Sesiunea 158 — bara de controale, plus culorile și căutarea, ca funcții pure. */
import ScheduleControls from './ScheduleControls';
import { classesForEntry, legendFor, type ColourMode } from '@/lib/scheduleColour';
import { filterBySearch } from '@/lib/scheduleSearch';
import { scheduleParams } from '@/lib/scheduleQuery';

/**
 * Sesiunea 31 (backlog 11 — Scheduling și calendar).
 *
 * The Jobs page answers "what jobs exist". It cannot answer the questions that
 * actually cost money: is anybody double-booked, is there work with no cleaner
 * on it, and where are the holes in the day. Those are only visible when the
 * jobs are laid out against time, which is what this screen is for.
 *
 * ─── Deliberate choices ──────────────────────────────────────────────────
 *
 * **No drag-and-drop.** Not a shortcut. Moving a job is a WRITE, and it has to
 * go through the same validation, revision check and audit trail as editing it
 * in the Job dialog — otherwise there are two ways to change a booking and one
 * of them is weaker. It is also the wrong gesture on the owner's tablet, where a
 * scroll is one misread touch away from silently moving someone's appointment.
 * Clicking a job opens the real Job dialog instead, so there is exactly one path
 * for changing a booking.
 *
 * **The warnings come from the server.** Conflicts, gaps and colour tones are all
 * computed in `schedulePolicy.ts` and returned. Recomputing them here would give
 * two answers to the same question, and the day view would eventually disagree
 * with the week view about whether Tuesday is a clash.
 *
 * **The week starts Monday** — see the note in `schedulePolicy.startOfWeekIso`.
 * The Dashboard's "this week" is Sunday-start because it is a financial period;
 * that divergence is intentional and documented rather than accidental.
 */

type View = 'day' | 'week' | 'month';

/**
 * 📜 **`TONE_CLASSES` era aici** — a plecat în `lib/scheduleColour.ts` la Sesiunea 158, împreună cu
 * cele două moduri noi de colorare. ⛔ Trei tabele de culori într-un ecran ar fi însemnat că nimic
 * din alegerea culorii nu se poate verifica fără să randezi pagina.
 */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Monday-start week. Mirrors `startOfWeekIso` on the server; kept as string
 * arithmetic through UTC for the same reason — local-date maths can repeat or
 * skip a day on a clock-change night, which would duplicate a column here.
 */
function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * 📜 **Formele erau declarate AICI până la ACHU-797 (Sesiunea 158)**, de la ACHU-401 (Sesiunea 115),
 * unde au înlocuit un `any`. ⛔ Erau însă o **a doua** definiție a aceluiași răspuns: `ScheduleEntry`
 * și `ScheduleResponse` existau deja în `lib/scheduleEndpoints.ts`, lângă apelul care le produce.
 *
 * 🔴 Și a doua definiție a costat exact ce costă totdeauna: sarcinile de birou (§43) fuseseră
 * adăugate în copia de aici și nu în cea comună, iar câmpurile de azi (`away`) ar fi ajuns la fel.
 * ⚠️ Copia locală era și un **subset** — fără `customerPhone`, `finishTime`, `amountCharged` — deci
 * arăta ca răspunsul rutei fără să fie el.
 */
import type { ScheduleEntry, ScheduleResponse } from '@/lib/endpoints';

type CleanerOption = { id: string; cleanerName: string; active?: boolean };

export default function SchedulePage() {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(ukToday());
  const [cleanerId, setCleanerId] = useState('all');
  const [showCancelled, setShowCancelled] = useState(false);
  /**
   * 🆕 §11 „Draft jobs optional" — **aprins din start**: ofertele se vedeau în orar de la început, iar
   * a le ascunde implicit ar fi schimbat tăcut ce vede biroul. ⚠️ „Optional" = se pot stinge.
   */
  const [showEnquiries, setShowEnquiries] = useState(true);
  /** 🆕 §11 „Team view" — al doilea filtru care pleacă la server, alături de cel pe curățător. */
  const [teamId, setTeamId] = useState('all');
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  /** 🆕 §11 „Colour coding" + „Calendar search" — amândouă pe rândurile DEJA aduse, fără cerere. */
  const [colourMode, setColourMode] = useState<ColourMode>('status');
  const [search, setSearch] = useState('');

  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [cleaners, setCleaners] = useState<CleanerOption[]>([]);
  const [loading, setLoading] = useState(true);
  // Vizita întreagă, luată la click și dată mai departe lui `JobDialog`. ACHU-401 (felia 19):
  // era un `Record<string, unknown>` opac — opac nu înseamnă neverificat, iar forma o
  // publică acum `adminRecordTypes.ts`, fără ca ecranul ăsta s-o repete.
  const [editingJob, setEditingJob] = useState<JobRecord>(null);
  const [openingJob, setOpeningJob] = useState<string | null>(null);

  /**
   * The calendar entry is NOT enough to open the Job dialog. The dialog needs
   * the full record and, critically, the server-computed `_revision` — without
   * it every save comes back as a CONFLICT (the bug fixed in Sesiunea 28).
   * Fetched on click rather than embedded in every calendar entry, because a
   * month view would then be carrying a revision string per job that goes stale
   * the moment anything changes.
   */
  const openJob = useCallback(async (id: string) => {
    setOpeningJob(id);
    try {
      const res = await getJob({ id });
      setEditingJob(res.record);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not open that job.');
    } finally {
      setOpeningJob(null);
    }
  }, []);

  // The range is derived from the view, not stored — two sources for "which days
  // am I looking at" would drift the moment either changes.
  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor };
    if (view === 'week') {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 6) };
    }
    return { from: monthStart(anchor), to: monthEnd(anchor) };
  }, [view, anchor]);

  /** Ce e cerut de la server, într-un singur loc: îl citesc și încărcarea și exportul. */
  const filters = useMemo(
    () => ({ from: range.from, to: range.to, cleanerId, teamId, showCancelled, showEnquiries }),
    [range.from, range.to, cleanerId, teamId, showCancelled, showEnquiries],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ⚠️ Filtrele se compun într-un singur loc (`lib/scheduleQuery.ts`) — le cere și exportul,
      // iar două liste scrise separat s-ar despărți la primul filtru nou.
      const res = await getSchedule(scheduleParams(filters));
      setData(res);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not load the schedule.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  /**
   * 🆕 §11 „Calendar export" (Sesiunea 158).
   *
   * ⚠️ **Aceleași filtre pe care le-a cerut ecranul**, trimise iar: fișierul trebuie să fie tabelul
   * de pe ecran, nu „tot". ⛔ Căutarea NU pleacă — ea e locală și nu poate fi aplicată de bază, deci
   * fișierul poate avea mai multe rânduri decât se văd; propoziția de sub buton o spune.
   */
  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    try {
      await exportSchedule(scheduleParams(filters));
    } catch (e) {
      toast.error(errMsg(e) || 'Could not export the schedule.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    getCleaners({}).then(res => setCleaners(res.records ?? [])).catch(() => {
      // A failed cleaner list must not take the calendar down with it — the
      // filter simply stays on "All", which is the useful default anyway.
    });
    /**
     * 🆕 §11 „Team view". ⚠️ Numai echipele ACTIVE: una dezactivată nu mai e o vedere de lucru, iar
     * rapoartele vechi care se citesc pe ea au ecranul lor (§26). ⛔ Aceeași iertare la eșec ca la
     * curățători — filtrul lipsește, calendarul nu.
     */
    getTeams({}).then(res => setTeams((res.records ?? []).filter(t => t.active !== false).map(t => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, []);

  const step = (direction: 1 | -1) => {
    if (view === 'day') setAnchor(addDays(anchor, direction));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * direction));
    else setAnchor(direction === 1 ? addDays(monthEnd(anchor), 1) : addDays(monthStart(anchor), -1));
  };

  /**
   * ⚠️ **Gruparea pe zile a plecat în `lib/scheduleGrouping.ts`** (Sesiunea 150), împreună cu cea a
   * sarcinilor: nu e randare, iar pagina e la clichetul ei de mărime. ⛔ Ordinea nu s-a schimbat —
   * vizitele cu oră primele, cele fără oră la finalul zilei; motivul e scris acolo.
   */
  /**
   * 🆕 §11 „Calendar search" (Sesiunea 158) — filtrat **înainte** de grupare, ca ziua, săptămâna și
   * luna să arate același lucru. ⛔ Regula de potrivire e în `lib/scheduleSearch.ts`, pură: „ionescu"
   * găsește „Ionescu", iar `#412` și `412` se caută la fel.
   *
   * 🔴 **Numărătorile de sus NU se refiltrează**, dinadins: „3 dubluri" e despre perioadă, nu despre
   * ce a rămas după o căutare. ⚠️ De asta căutarea are propria propoziție sub calendar când ascunde
   * ceva — altfel un calendar aproape gol ar arăta ca o săptămână liberă.
   */
  const searched = useMemo(() => filterBySearch(data?.entries ?? [], search), [data, search]);
  const entriesByDay = useMemo(() => groupEntriesByDay(searched), [searched]);
  const tasksByDay = useMemo(() => groupTasksByDay(data?.tasks), [data]);

  /** Job ids in a conflict, so the affected cards can be marked in place. */
  const conflictedJobIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of data?.conflicts ?? []) { s.add(c.jobIdA); s.add(c.jobIdB); }
    return s;
  }, [data]);

  /**
   * 🆕 ACHU-797 — vizitele care au pe cineva **plecat în ziua lor** pus pe ele.
   *
   * ⚠️ **Marcată vizita, nu doar numărată în card.** Un card care spune „6 vizite" trimite omul să
   * le caute; cel care le și încercuiește îi arată unde sunt. ⛔ Chenar violet, nu roșu: roșul e al
   * dublurilor, iar două lucruri diferite cu aceeași culoare devin unul singur pe ecran.
   *
   * 🔴 Propoziția întreagă intră în `title`-ul cardului — vezi `jobCard`.
   */
  const awayByJob = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data?.awayAssignments ?? []) {
      const existing = m.get(a.jobId);
      /** ⚠️ La doi curățători plecați pe aceeași vizită se spun amândoi: „unul lipsește" nu ajută. */
      m.set(a.jobId, existing ? `${existing} ${a.message}` : a.message);
    }
    return m;
  }, [data]);

  /** 🆕 §11 — legenda, doar din valorile de pe ecran (vezi `legendFor`). */
  const legend = useMemo(() => legendFor(searched, colourMode), [searched, colourMode]);

  const title = view === 'day' ? longDayLabel(anchor)
    : view === 'week' ? `${dayLabel(range.from)} – ${dayLabel(range.to)}`
    : monthLabel(anchor);

  const jobCard = (e: ScheduleEntry, compact = false) => (
    <button
      key={e.id}
      onClick={() => openJob(e.id)}
      disabled={openingJob === e.id}
      /**
       * 🆕 §11 „Colour coding by cleaner / by service" (Sesiunea 158).
       *
       * ⛔ **Chenarele stau PESTE orice mod de culoare** — roșu pentru dublură, violet pentru „cineva
       * e plecat": sunt avertismente, nu decor, iar un comutator de culoare n-are voie să le stingă.
       * 🔴 Iar starea vizitei, care pe modurile noi nu se mai vede în culoare, rămâne în `title`.
       */
      className={`w-full text-left rounded-md border px-2 py-1.5 transition-shadow hover:shadow-sm ${classesForEntry(e, colourMode)} ${
        conflictedJobIds.has(e.id) ? 'ring-2 ring-red-500/60'
          : awayByJob.has(e.id) ? 'ring-2 ring-violet-500/60' : ''
      }`}
      // The reference number is here rather than on the face of the card: the
      // card has to stay readable in a narrow month cell, but the number is what
      // you quote on the phone, so it must be reachable.
      title={`Job #${e.reference} — ${e.status}${e.address ? ` — ${e.address}` : ''}${
        awayByJob.has(e.id) ? ` — ${awayByJob.get(e.id)}` : ''
      }`}
    >
      <div className="flex items-baseline gap-1.5 min-w-0">
        {e.startTime && <span className="text-[11px] font-semibold tabular-nums shrink-0">{e.startTime}</span>}
        <span className={`truncate font-medium ${compact ? 'text-[11px]' : 'text-xs'}`}>{e.customerName}</span>
      </div>
      {!compact && (
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] opacity-80 min-w-0">
          <span className="truncate">{e.service}</span>
          {e.durationMinutes != null && <span className="shrink-0">· {formatDuration(e.durationMinutes)}</span>}
        </div>
      )}
      {!compact && e.cleaners.length > 0 && (
        <p className="mt-0.5 truncate text-[10px] opacity-70">{e.cleaners.map(c => c.name).join(', ')}</p>
      )}
      {/*
        ACHU-565 — cine a plecat spre client, și la ce oră.

        🔴 **Aici, în ziua biroului, fiindcă aici se răspunde la telefon.** Clientul sună și
        întreabă „unde e omul?"; până acum nimeni din birou n-avea de unde ști. ⚠️ Se numesc
        curățătorii, fiindcă la o vizită cu doi „unul a plecat" fără să spui care nu ajută.

        ⛔ Nimic nu se desenează în absența unui moment — a anunța e voluntar, deci „nu a
        anunțat" e starea obișnuită, iar un marcaj pe fiecare vizită n-ar mai distinge nimic.
        Aceeași regulă ca la `accessConfirmedAt` (ACHU-513).

        🔴 ACHU-787 — ora trece prin `fmtTime`, nu prin `toLocaleTimeString`: acela folosea fusul
        CALCULATORULUI, deci pe un laptop pus pe alt fus biroul citea altă oră decât cea pe care
        curățătorul o vede în portalul lui, pentru aceeași apăsare.
      */}
      {!compact && e.cleaners.some(c => c.onTheWayAt) && (
        <p className="mt-0.5 truncate text-[10px] font-medium text-blue-700 dark:text-blue-400">
          On the way: {e.cleaners.filter(c => c.onTheWayAt).map(c => `${c.name} ${fmtTime(c.onTheWayAt)}`).join(', ')}
        </p>
      )}
      {!compact && e.cleaners.length === 0 && e.status !== 'Cancelled' && (
        <p className="mt-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">No cleaner assigned</p>
      )}
      {/* ACHU-513: the customer said they have arranged access for this visit.
          ⛔ Only the positive case, and only in the non-compact card. Nothing is drawn when
          it is absent: confirming is voluntary, so "not confirmed" is the normal state and
          marking it would put a warning on nearly every visit in the calendar. */}
      {!compact && e.accessConfirmedAt && (
        <p className="mt-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">Access confirmed</p>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-5 w-5 text-muted-foreground shrink-0" />
          <h1 className="text-xl font-semibold truncate">Schedule</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/admin/dispatch?date=${view === 'day' ? anchor : ukToday()}`, '_blank')}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />Day sheet
          </Button>
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      {/* ─── Controls ─────────────────────────────────────────────────── */}
      {/* ⚠️ Bara stă în `ScheduleControls.tsx` (Sesiunea 158) — vezi acolo ce filtru pleacă la
          server și ce se aplică pe rândurile deja aduse. */}
      <ScheduleControls
        view={view} onView={setView} title={title}
        onStep={step} onToday={() => setAnchor(ukToday())}
        cleanerId={cleanerId} onCleaner={setCleanerId} cleaners={cleaners}
        teamId={teamId} onTeam={setTeamId} teams={teams}
        showCancelled={showCancelled} onShowCancelled={setShowCancelled}
        showEnquiries={showEnquiries} onShowEnquiries={setShowEnquiries}
        colourMode={colourMode} onColourMode={setColourMode}
        search={search} onSearch={setSearch}
        onExport={runExport} exporting={exporting}
      />

      {/*
        🆕 §11 — legenda culorilor, doar pe modurile care o cer.
        ⛔ Nu e decor: paleta are opt culori, deci la mai mult de opt nume ele se repetă, iar legenda
        e locul în care repetarea se VEDE. ⚠️ Numai valorile din perioada privită (vezi `legendFor`).
      */}
      {/*
        🔴 **CE ASCUNDE CĂUTAREA, SPUS PE ECRAN.** ⛔ Fără rândul ăsta, o căutare fără potriviri lasă
        „Nothing booked for this day" — adică ecranul minte: ziua are vizite, doar nu pe cele căutate.
        ⚠️ Numărătorile de sus rămân despre PERIOADĂ, nu despre rezultat: „3 dubluri" nu se schimbă
        fiindcă cineva a tastat un nume.
      */}
      {search.trim() && data && (
        <p className="text-xs text-muted-foreground" data-testid="schedule-search-note">
          {searched.length} of {data.entries.length} job{data.entries.length === 1 ? '' : 's'} in this period match
          {' '}“{search.trim()}”. The warnings above, and Export, still cover the whole period.
        </p>
      )}

      {legend.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="schedule-legend">
          {legend.map(l => (
            <span key={l.label} className={`rounded border px-1.5 py-0.5 text-[11px] ${l.classes}`}>{l.label}</span>
          ))}
        </div>
      )}

      {/* ─── Warnings, above the calendar ─────────────────────────────── */}
      {/* ⚠️ Cardurile stau în `ScheduleWarnings.tsx` — vezi acolo de ce sus și nu jos. */}
      {data && (
        <ScheduleWarnings
          conflicts={data.conflicts ?? []}
          unassigned={data.unassigned ?? []}
          away={data.away ?? []}
          awayAssignedCount={data.summary?.awayAssignedCount ?? 0}
          onOpenJob={openJob}
        />
      )}

      {/* ─── The calendar ─────────────────────────────────────────────── */}
      {loading && !data ? (
        <LoadingSkeleton heights={['h-10', 'h-64']} label="Loading the schedule…" />
      ) : view === 'day' ? (
        <Card className="p-3">
          {(entriesByDay.get(anchor)?.length ?? 0) === 0 && (tasksByDay.get(anchor)?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing booked for this day.</p>
          ) : (
            <div className="space-y-2">
              {(entriesByDay.get(anchor) ?? []).map(e => (
                <div key={e.id} className="flex gap-3">
                  <div className="w-14 shrink-0 pt-1.5 text-right text-xs tabular-nums text-muted-foreground">
                    {e.startTime ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">{jobCard(e)}</div>
                </div>
              ))}
              {/* ⚠️ Sarcinile la FINALUL zilei, nu amestecate între orele vizitelor: n-au oră, iar
                  puse la miezul nopții ar sta deasupra muncii care are un început real. ⛔ Și fără
                  coloană de oră: un „—" în dreptul fiecăreia ar fi o coloană care nu spune nimic. */}
              <ScheduleDayTasks tasks={tasksByDay.get(anchor) ?? []} />
            </div>
          )}
        </Card>
      ) : view === 'week' ? (
        // Seven columns on a wide screen; on a phone they stack, because seven
        // columns squeezed onto 360px is unreadable and a squeeze is not a design.
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {(data?.range?.days ?? []).map((day: string) => {
            const dayEntries = entriesByDay.get(day) ?? [];
            const isToday = day === ukToday();
            return (
              <Card key={day} className={`p-2 ${isToday ? 'ring-2 ring-primary/40' : ''}`}>
                <p className={`pb-1.5 text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {dayLabel(day)}
                </p>
                <div className="space-y-1.5">
                  {/* ⚠️ „—" doar când nu e NIMIC: o zi fără vizite dar cu o sarcină nu e o zi goală. */}
                  {dayEntries.length === 0 && (tasksByDay.get(day)?.length ?? 0) === 0
                    ? <p className="py-2 text-center text-[11px] text-muted-foreground/60">—</p>
                    : dayEntries.map(e => jobCard(e))}
                  <ScheduleDayTasks tasks={tasksByDay.get(day) ?? []} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-2 overflow-x-auto">
          {/* min-width so the grid scrolls inside its own container rather than
              making the whole page scroll sideways on a phone. */}
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {WEEKDAYS.map(d => (
                <p key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Leading blanks so the 1st lands under the right weekday. */}
              {Array.from({ length: (new Date(`${monthStart(anchor)}T00:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {(data?.range?.days ?? []).map((day: string) => {
                const dayEntries = entriesByDay.get(day) ?? [];
                const isToday = day === ukToday();
                return (
                  <div key={day} className={`min-h-[76px] rounded-md border p-1 ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                    <p className={`pb-0.5 text-[10px] font-semibold tabular-nums ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {Number(day.slice(8, 10))}
                    </p>
                    <div className="space-y-0.5">
                      {dayEntries.slice(0, 3).map(e => jobCard(e, true))}
                      {/* ⚠️ Cel mult DOUĂ pe grila lunii; plafonul și „+N" sunt în componentă. */}
                      <ScheduleDayTasks tasks={tasksByDay.get(day) ?? []} limit={2} compact />
                      {dayEntries.length > 3 && (
                        <button
                          onClick={() => { setAnchor(day); setView('day'); }}
                          className="w-full text-left text-[10px] text-muted-foreground hover:underline"
                        >
                          +{dayEntries.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ─── Gaps, below ──────────────────────────────────────────────── */}
      {/* Below the calendar on purpose: unused capacity is worth knowing about,
          but it is not urgent the way a clash is, and putting both at the top
          would make neither stand out. */}
      {data?.gaps?.length > 0 && (
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            Idle time ({data.gaps.length})
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stretches of an hour or more between jobs — capacity that could take another booking.
          </p>
          <ul className="mt-1.5 space-y-1">
            {data.gaps.slice(0, 8).map((g, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{g.cleanerName}</span> — {dayLabel(g.date)}, {g.from}–{g.to} ({formatDuration(g.gapMinutes)})
              </li>
            ))}
            {data.gaps.length > 8 && <li className="text-xs text-muted-foreground/70">and {data.gaps.length - 8} more</li>}
          </ul>
        </Card>
      )}

      {editingJob && (
        <JobDialog
          open
          item={editingJob}
          /**
           * ACHU-519 — clicking a booking on the calendar OPENS it, it does not start editing
           * it. Archana: „ca să văd detaliile la un job trebuie să îl editez?" The calendar is
           * the most-clicked way into a job and the one where a stray tap is likeliest, so it
           * lands on a locked record with a „Switch to editing" button.
           */
          readOnly
          onClose={() => setEditingJob(null)}
          // Reload after a save so a rescheduled job moves on the calendar
          // immediately — otherwise the screen shows a booking that no longer
          // exists at that time, which is worse than showing nothing.
          onSaved={() => { setEditingJob(null); load(); }}
        />
      )}
    </div>
  );
}

