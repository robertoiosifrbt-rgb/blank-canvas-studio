import { useState, useEffect, useCallback } from 'react';
import { Repeat, Plus, Play, Pause, Ban, CalendarPlus, AlertTriangle, Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  getRecurringSeriesList, generateRecurringVisits, setRecurringSeriesStatus,
} from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import RecurringSeriesDialog from './RecurringSeriesDialog';
import type { RecurringSeriesListRow } from '@/lib/recurringSeriesTypes';
import RefreshButton from '../shared/RefreshButton';
import { errMsg } from '@/lib/errorMessage';
import { showGenerationOutcome } from '@/lib/recurringGenerationFeedback';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';

/**
 * Sesiunea 32 (backlog 18 — Recurring services).
 *
 * ─── The number this page exists to show ─────────────────────────────────
 * "Booked for N more days". A recurring contract is not a thing you set up and
 * forget: visits only exist as far as they have been generated, so a perfectly
 * healthy-looking series can quietly have nothing in the diary next week. Every
 * other field on this list is secondary to that one, which is why it is a
 * coloured badge rather than a column of small text.
 *
 * Under 14 days is amber, under 7 is red. Those thresholds are a judgement about
 * this business, not a standard: a week is roughly the notice a customer expects
 * before a visit, so falling under it is the point at which a gap becomes
 * visible to them rather than just to the office.
 */

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  paused: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

function coverageTone(daysBooked: number, status: string): string {
  // A paused or cancelled series is not "running out" — it is stopped on purpose,
  // and colouring it red would train people to ignore the colour.
  if (status !== 'active') return 'bg-muted text-muted-foreground border-border';
  if (daysBooked <= 0) return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40';
  if (daysBooked < 7) return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30';
  if (daysBooked < 14) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
  return 'bg-muted/60 text-muted-foreground border-border';
}

/**
 * ACHU-401 (Sesiunea 115, rescris în felia 12). A contract row, as the LIST receives it.
 *
 * 🔴 **Nu se mai declară aici deloc** — forma vine de la funcția care o produce
 * (`RecurringSeriesListRow`, în `recurringSeriesTypes.ts`). Versiunea scrisă de mână a rămas o
 * dată în urmă cu nouă câmpuri; a doua oară, în `SubscriptionsPage.tsx`, o copie asemănătoare
 * numea un câmp care nu există și ecranul scria numărul contractului gol. Un fapt, un singur
 * loc (`AGENT_RULES` §11).
 */
type SeriesRow = RecurringSeriesListRow;

export default function RecurringSeriesPage() {
  const [records, setRecords] = useState<SeriesRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogItem, setDialogItem] = useState<SeriesRow | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecurringSeriesList(statusFilter === 'all' ? {} : { status: statusFilter });
      setRecords(res.records ?? []);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not load the recurring contracts.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const generate = async (series: SeriesRow) => {
    setBusyId(series.id);
    try {
      // ⚠️ Mesajele stau în `recurringGenerationFeedback`, împreună cu cele ale dialogului: de la
      // ACHU-700 încoace există ceva ce trebuie spus în AMÂNDOUĂ (curățători reținuți).
      showGenerationOutcome(await generateRecurringVisits({ id: series.id }));
      await load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not generate the jobs.');
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (series: SeriesRow, status: 'active' | 'paused' | 'cancelled') => {
    if (status === 'cancelled') {
      // Two questions, not one, because they have different consequences and
      // bundling them means someone cancels a contract and accidentally wipes
      // four bookings the customer is expecting.
      if (!window.confirm(`Cancel the recurring contract for ${series.customerName}?\n\nThe contract stops. Jobs already in the diary are NOT touched unless you say so next.`)) return;
    }
    const cancelFutureVisits = status === 'cancelled'
      ? window.confirm('Also cancel the future jobs already in the diary?\n\nOK = cancel them too.\nCancel = keep them (they still need doing).')
      : undefined;

    setBusyId(series.id);
    try {
      const res = await setRecurringSeriesStatus({ id: series.id, status, cancelFutureVisits });
      toast.success(
        status === 'paused' ? 'Contract paused — no new jobs will be created'
        : status === 'active' ? 'Contract resumed'
        : `Contract cancelled${res.cancelledVisits ? `, ${res.cancelledVisits} future visit(s) cancelled` : ', future jobs kept'}`,
      );
      await load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not change the contract.');
    } finally {
      setBusyId(null);
    }
  };

  const needsAttention = records.filter(r => r.status === 'active' && r.daysBooked < 7);
  const reviewDue = records.filter(r => r.priceReviewDue);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Repeat className="h-5 w-5 text-muted-foreground shrink-0" />
          <h1 className="text-xl font-semibold truncate">Recurring contracts</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[130px] text-xs" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <RefreshButton onRefresh={load} />
          <Button onClick={() => setDialogItem(null)}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        A contract creates the jobs for you. Jobs only exist as far ahead as they have been created —
        the badge on each row says how far that is.
      </p>

      {/* Running-out warning, above the list. */}
      {needsAttention.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {needsAttention.length} contract{needsAttention.length === 1 ? '' : 's'} running out of booked jobs
          </p>
          <p className="mt-0.5 text-xs text-red-700/90 dark:text-red-300/90">
            {needsAttention.map(r => r.customerName).join(', ')} — press <strong>Book ahead</strong> on the row.
          </p>
        </Card>
      )}

      {reviewDue.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <TrendingUp className="h-4 w-4 shrink-0" />
            {reviewDue.length} price review{reviewDue.length === 1 ? '' : 's'} due
          </p>
          <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-300/90">
            {/* A recurring contract at a three-year-old rate is the quietest way
                to lose money in this business. */}
            {reviewDue.map(r => r.customerName).join(', ')}
          </p>
        </Card>
      )}

      {loading && records.length === 0 ? (
        <LoadingSkeleton heights={['h-16', 'h-16', 'h-16']} label="Loading…" />
      ) : records.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">No recurring contracts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Set one up for any customer you clean on a regular pattern — weekly, fortnightly or monthly —
            and the jobs get created for you instead of being typed in one at a time.
          </p>
          <Button className="mt-3" size="sm" onClick={() => setDialogItem(null)}><Plus className="h-4 w-4 mr-1" />Add the first one</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map(r => (
            <Card key={r.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button className="min-w-0 text-left" onClick={() => setDialogItem(r)}>
                  <p className="font-medium truncate">{r.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.service}
                    {r.startTime && ` · ${r.startTime}${r.finishTime ? `–${r.finishTime}` : ''}`}
                    {r.amountCharged != null && ` · ${fmt(r.amountCharged)}`}
                  </p>
                  {/* The sentence comes from the server, so this page, the dialog
                      and anything added later cannot word it differently. */}
                  <p className="mt-0.5 text-xs">{r.description}</p>
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={`text-[11px] ${STATUS_STYLES[r.status] ?? ''}`}>{r.status}</Badge>
                  <Badge variant="outline" className={`text-[11px] ${coverageTone(r.daysBooked, r.status)}`}>
                    {r.daysBooked <= 0 ? 'nothing booked' : `booked ${r.daysBooked}d`}
                  </Badge>

                  {r.status === 'active' && (
                    <>
                      <Button variant="outline" size="sm" className="h-8" disabled={busyId === r.id} onClick={() => generate(r)}>
                        {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CalendarPlus className="h-3.5 w-3.5 mr-1" />Book ahead</>}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" disabled={busyId === r.id} onClick={() => changeStatus(r, 'paused')} aria-label={`Pause contract for ${r.customerName}`} title={`Pause contract for ${r.customerName}`}>
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {r.status === 'paused' && (
                    <Button variant="outline" size="sm" className="h-8" disabled={busyId === r.id} onClick={() => changeStatus(r, 'active')}>
                      <Play className="h-3.5 w-3.5 mr-1" />Resume
                    </Button>
                  )}
                  {r.status !== 'cancelled' && (
                    <Button variant="outline" size="sm" className="h-8" disabled={busyId === r.id} onClick={() => changeStatus(r, 'cancelled')} aria-label={`Cancel contract for ${r.customerName}`} title={`Cancel contract for ${r.customerName}`}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {dialogItem !== undefined && (
        <RecurringSeriesDialog
          open
          item={dialogItem}
          onClose={() => setDialogItem(undefined)}
          onSaved={() => { setDialogItem(undefined); load(); }}
        />
      )}
    </div>
  );
}

