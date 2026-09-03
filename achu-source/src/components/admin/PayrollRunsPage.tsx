/**
 * Payroll runs — a pay period, everybody in it (ACHU-294, Sesiunea 74).
 *
 * ─── What this screen is for, and what it is not ──────────────────────────
 * It is the office's own record of what it decided to pay: draft, approved,
 * locked. NOTHING goes to HMRC. The stage notice comes from the server and is
 * rendered verbatim rather than reworded, because two versions of that sentence
 * eventually disagree and this is the screen most likely to be mistaken for a
 * payroll system.
 *
 * ─── The buttons come from the server ─────────────────────────────────────
 * `GET /:id` returns `can: { recalculate, approve, lock, reopen, delete }`,
 * decided by lib/payrollRunPolicy.ts. This screen does NOT re-implement the state
 * machine — a second copy of "may this be recalculated?" is how the two stop
 * agreeing, and the version that disagrees quietly is the one on screen.
 *
 * ─── Two lists that must never be hidden ──────────────────────────────────
 * `exceptions` — errors block approval at the server, so the screen has to say
 * why the button will not work rather than just disabling it.
 * `skipped` — the people who could NOT be calculated. That is a list of people
 * who will not be paid; hidden, it is a silent underpayment.
 */
import { useEffect, useState } from 'react';
import { getPayrollRuns, type PayrollRunsResponse } from '@/lib/endpoints';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Info } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { FREQUENCIES, money } from '@/lib/payrollRunsFormat';
import { StatusBadge } from './PayrollRunStatusBadge';
import { CreateDialog } from './PayrollRunCreateDialog';
import { RunDialog } from './PayrollRunDialog';
import { errMsg } from '@/lib/errorMessage';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';

export default function PayrollRunsPage() {
  const [data, setData] = useState<PayrollRunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setData(await getPayrollRuns());
      setError(null);
    } catch (e) {
      setError(errMsg(e) ?? 'Could not load payroll runs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Payroll runs"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />New payroll
          </Button>
        }
      />

      {/* The server's sentence, verbatim. This is the screen most likely to be
          taken for a payroll system, so it says what it is before any figure. */}
      {data?.stageNotice && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{data.stageNotice}</span>
          </p>
        </div>
      )}

      {/**
        * 🆕 §48 (Sesiunea 154) — schelet în locul unei linii de text, ca lista să nu sară la sosire.
        * ⚠️ Payroll e oprit; asta nu e o funcționalitate, e forma ecranului cât se încarcă.
        */}
      {loading && (
        <LoadingSkeleton heights={['h-14', 'h-14']} label="Loading…" />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && data?.runs?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No payroll has been run yet. Everyone needs pay details saved first — under
          <strong> Setup → Employee Pay Details</strong>.
        </p>
      )}

      <div className="space-y-2">
        {(data?.runs ?? []).map(r => (
          <Card key={r.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setOpenId(r.id)}>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {FREQUENCIES.find(f => f.value === r.frequency)?.label ?? r.frequency} — period {r.periodNumber}
                    </span>
                    <StatusBadge status={r.status} version={r.version} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.taxYear} · {r.periodStart} to {r.periodEnd} · paid {r.payDate} · {r.totals.people} people
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div>Net {money(r.totals.netPay)}</div>
                  {/* What actually leaves the company, not what lands in accounts.
                      The figure owners consistently underestimate. */}
                  <div className="text-xs text-muted-foreground">
                    Total cost {money(r.totals.totalEmployerCost)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {creating && (
        <CreateDialog
          frequencies={data?.frequencies ?? FREQUENCIES.map(f => f.value)}
          payCalendar={data?.payCalendar}
          onClose={() => setCreating(false)}
          onCreated={(id: string) => { setCreating(false); load(); setOpenId(id); }}
        />
      )}

      {openId && (
        <RunDialog
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => { setOpenId(null); load(); }}
        />
      )}
    </div>
  );
}

