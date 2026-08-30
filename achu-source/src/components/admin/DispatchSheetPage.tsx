import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { getDispatchList, type DispatchResponse, type DispatchJob } from '@/lib/endpoints';
import { ukToday, addDays } from '@/lib/ukDate';
import RefreshButton from '../shared/RefreshButton';
import { errMsg } from '@/lib/errorMessage';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import EmptyTableRow from '../shared/EmptyTableRow';

/**
 * Sesiunea 31 (backlog 11 — "Printable daily schedule" / "Daily dispatch list").
 *
 * The one screen in the app designed to leave the screen. A cleaner in a van has
 * no reliable signal and no time to navigate an app between houses; a sheet of
 * paper works in a doorway in the rain.
 *
 * ─── Why it is styled the way it is ──────────────────────────────────────
 * Print CSS, not a PDF. The app already generates PDFs (invoices, quotes) via
 * jsPDF, and that was the obvious route — rejected because a PDF has to
 * re-implement layout in absolute coordinates, and this document's job is simply
 * to be legible. `window.print()` on plain HTML gets the browser's own pagination,
 * page numbers and "save as PDF" for free, and the owner's tablet already knows
 * how to print.
 *
 * The `print:` utilities strip the app furniture (nav, buttons, colours) so the
 * sheet is black text on white — a coloured status pill costs ink and tells the
 * person at the door nothing they cannot read in the word next to it.
 *
 * ─── What is deliberately NOT on the sheet ───────────────────────────────
 * `adminNotes`. It is internal office commentary — chasing payment, complaints,
 * opinions about the customer — and a printed sheet gets left on kitchen worktops
 * and van seats. The server does not send it (see routes/schedule.ts), so this is
 * enforced rather than merely omitted here.
 */

function longDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function DispatchSheetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') || ukToday();

  const [data, setData] = useState<DispatchResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getDispatchList({ date }));
    } catch (e) {
      toast.error(errMsg(e) || 'Could not load the day sheet.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const setDate = (iso: string) => setSearchParams({ date: iso }, { replace: true });

  const jobRow = (j: DispatchJob) => (
    <tr key={j.id} className="border-b border-border/60 print:border-black/30">
      <td className="py-1.5 pr-3 align-top text-sm tabular-nums whitespace-nowrap">
        {j.startTime ?? '—'}{j.finishTime ? `–${j.finishTime}` : ''}
      </td>
      <td className="py-1.5 pr-3 align-top text-sm">
        <p className="font-medium">{j.customerName}</p>
        {j.address && <p className="text-xs text-muted-foreground print:text-black/70">{j.address}</p>}
      </td>
      <td className="py-1.5 pr-3 align-top text-sm">{j.service}</td>
      <td className="py-1.5 pr-3 align-top text-sm tabular-nums whitespace-nowrap">{j.customerPhone ?? '—'}</td>
      <td className="py-1.5 align-top text-sm">
        {j.status !== 'Confirmed' && j.status !== 'Booked' && <span className="text-xs font-medium">{j.status}</span>}
        {j.customerInstructions && (
          <p className="text-xs italic text-muted-foreground print:text-black/70">{j.customerInstructions}</p>
        )}
      </td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-4xl p-4 print:p-0">
      {/* Controls, hidden when printed. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day" title="Previous day">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setDate(ukToday())}>Today</Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(addDays(date, 1))} aria-label="Next day" title="Next day">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <RefreshButton onRefresh={load} className="ml-auto h-8 w-8" />
        <Button size="sm" className="h-8" onClick={() => window.print()} disabled={loading}>
          <Printer className="h-3.5 w-3.5 mr-1.5" />Print
        </Button>
      </div>

      <header className="mb-4 border-b-2 border-foreground/80 pb-2 print:border-black">
        <h1 className="text-lg font-bold">ACHU — Day sheet</h1>
        <p className="text-sm">{longDayLabel(date)}</p>
      </header>

      {loading ? (
        <LoadingSkeleton heights={['h-10', 'h-24', 'h-24']} label="Loading…" className="space-y-2 print:hidden" />
      ) : (data?.cleaners?.length ?? 0) === 0 && (data?.unassigned?.length ?? 0) === 0 ? (
        <p className="py-8 text-center text-sm">Nothing booked for this day.</p>
      ) : (
        <div className="space-y-6">
          {data.cleaners.map(group => (
            // break-inside-avoid so a cleaner's round is not split across two
            // pages — half a round is how a house gets missed.
            <section key={group.cleanerId} className="break-inside-avoid">
              <h2 className="mb-1 text-base font-semibold">
                {group.cleanerName}
                <span className="ml-2 text-xs font-normal text-muted-foreground print:text-black/70">
                  {group.jobs.length} job{group.jobs.length === 1 ? '' : 's'}
                </span>
              </h2>
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-foreground/40 print:border-black/60">
                      <th scope="col" className="py-1 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide">Time</th>
                      <th scope="col" className="py-1 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide">Customer</th>
                      <th scope="col" className="py-1 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide">Service</th>
                      <th scope="col" className="py-1 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide">Phone</th>
                      <th scope="col" className="py-1 text-left text-[11px] font-semibold uppercase tracking-wide">Notes</th>
                    </tr>
                  </thead>
                  <tbody>{group.jobs.length === 0 ? <EmptyTableRow colSpan={5}>Nothing booked for {group.cleanerName} on this day.</EmptyTableRow> : group.jobs.map(jobRow)}</tbody>
                </table>
              </div>
            </section>
          ))}

          {data.unassigned.length > 0 && (
            // Kept ON the sheet rather than quietly dropped: work with nobody
            // going to it is the most important thing on a dispatch list.
            <section className="break-inside-avoid">
              <h2 className="mb-1 text-base font-semibold text-red-700 print:text-black">
                No cleaner assigned
                <span className="ml-2 text-xs font-normal">{data.unassigned.length} job{data.unassigned.length === 1 ? '' : 's'}</span>
              </h2>
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>{data.unassigned.map(jobRow)}</tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

