import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import {
  Wallet, CalendarCheck, Thermometer, Baby, Info, AlertCircle, RefreshCw, Lock,
} from 'lucide-react';
import { getMyPayroll, type MyPayrollResponse } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fmt, fmtDate } from '@/lib/format';
import { PayslipsSection } from './PayslipsSection';
import { StatutoryFormsSection } from './StatutoryFormsSection';
import { BankDetailsSection } from './BankDetailsSection';
/**
 * ⚠️ **Leneș, ca dialogul de raportare:** paza de mărime a prins-o — importată static, secțiunea a
 * împins bucata curățătorului peste prag. ⛔ Ecranul ăsta se deschide de pe telefon, uneori pe date
 * mobile. Se descarcă abia când omul intră în „Pay".
 */
const MyDetailsSection = lazy(() => import('./MyDetailsSection'));
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 80 — Employee Self-Service, the screen (ACHU-314, backlog payroll §22).
 *
 * The backend went in as ACHU-309 in Sesiunea 78v: `GET /api/me/payroll`, 30 tests,
 * live since 78z. This is the half a cleaner can actually see.
 *
 * ─── The rule this file follows, and the reason for it ──────────────────────
 * **Nothing here is calculated.** Every figure — the holiday balance, the accrual,
 * the SSP total — arrives already computed, from the SAME policy functions the
 * office reads under Team. A second implementation in the browser would drift, and
 * the one that drifted would be the one telling a person about their own time off.
 * So this component formats and lays out. It does not add up.
 *
 * The one exception is `penceToPounds`-style display via `fmt()`, which converts a
 * unit for reading and changes no value.
 *
 * ─── Why the "not available" block is rendered at all ───────────────────────
 * The server sends four sentences saying what this page cannot do. They are shown
 * rather than dropped: a portal that silently lacks a feature reads as broken, one
 * that says why reads as unfinished — which is the truth. Requesting leave from the
 * portal is not built because its business rules are undecided (ACHU-268), not
 * because somebody forgot.
 *
 * ─── Order ─────────────────────────────────────────────────────────────────
 * Holiday first, then sickness and family leave, then the pay setup. That is the
 * order it matters to a cleaner, not the order the API returns it — "how much
 * holiday do I have left" is the question this page exists to answer, and a tax
 * code is the thing you check once a year.
 */

const REQUEST_TIMEOUT_MS = 15_000;

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: MyPayrollResponse };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Hours, as the server counted them. `undefined` shows as a dash, never as 0. */
const hrs = (h?: number | null) => (h == null ? '—' : `${h}h`);

/**
 * ⚠️ `null` and `0` are different answers and stay different.
 *
 * On company sick pay, `null` means the office has not decided; `0` means it decided
 * nothing is due. Collapsing them would tell somebody their claim was refused when
 * nobody has looked at it yet.
 */
const money = (pence?: number | null) => (pence == null ? 'Not decided' : fmt(pence / 100));

export default function PayTab({ onRefreshed }: { onRefreshed?: (fn: () => void) => void } = {}) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await withTimeout(getMyPayroll({}), REQUEST_TIMEOUT_MS);
      setState({ kind: 'ready', data: res });
    } catch (e) {
      // The server's own refusal text is shown when there is one. It distinguishes
      // three separate cases on purpose — no cleaner record, record deactivated,
      // wrong role — and a generic "access denied" would leave the person unable to
      // tell a mistake from a decision, and the office unable to tell them.
      setState({ kind: 'error', message: errMsg(e) || 'Could not load your pay details.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Hands the reload up so the header's Refresh button drives THIS screen while it
  // is the one on show, instead of silently reloading the job list behind it.
  useEffect(() => { onRefreshed?.(load); }, [onRefreshed, load]);

  if (state.kind === 'loading') {
    return (
      <div className="space-y-3" aria-busy="true">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4" role="alert">
        <AlertCircle className="h-10 w-10 text-destructive/70" />
        <h2 className="text-lg font-semibold mt-4">Unable to load your pay details</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">{state.message}</p>
        <Button className="min-h-[44px] mt-6" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />Retry
        </Button>
      </div>
    );
  }

  const d = state.data;
  // ⚠️ ACHU-401 (felia 33): era `?? {}`, o apărare care sub `any` nu proteja nimic — un obiect
  // gol ar fi randat `undefined` la fiecare din cele unsprezece cifre de dedesubt. Ruta trimite
  // întotdeauna soldul; dacă vreodată n-o va face, ⛔ compilatorul e cel care o spune, nu ecranul.
  const balance = d.holiday.balance;

  return (
    <div className="space-y-4">
      {/* ── Holiday ───────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-4" aria-labelledby="pay-holiday">
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck className="h-5 w-5 text-primary shrink-0" />
          <h2 id="pay-holiday" className="font-semibold">Holiday</h2>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{hrs(balance.remainingHours)}</span>
          <span className="text-sm text-muted-foreground">left</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-sm">
          {balance.carriedInMinutes !== 0 && (
            <>
              <dt className="text-muted-foreground">Carried in</dt>
              <dd className="text-right tabular-nums">{hrs(balance.carriedInHours)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Accrued this year</dt>
          <dd className="text-right tabular-nums">{hrs(balance.accruedHours)}</dd>
          <dt className="text-muted-foreground">Taken</dt>
          <dd className="text-right tabular-nums">{hrs(balance.takenHours)}</dd>
          {balance.bookedMinutes > 0 && (
            <>
              {/* Approved but not yet reached. Deducted from `remaining`, and named
                  separately because "12 hours left" means something different when
                  8 of them are already promised. */}
              <dt className="text-muted-foreground">Approved for later</dt>
              <dd className="text-right tabular-nums">{hrs(balance.bookedHours)}</dd>
            </>
          )}
          {balance.requestedMinutes > 0 && (
            <>
              {/* NOT deducted — asking is not being granted. */}
              <dt className="text-muted-foreground">Requested, waiting</dt>
              <dd className="text-right tabular-nums">{hrs(balance.requestedHours)}</dd>
            </>
          )}
          {balance.unpaidMinutes > 0 && (
            <>
              <dt className="text-muted-foreground">Unpaid leave</dt>
              <dd className="text-right tabular-nums">{hrs(balance.unpaidHours)}</dd>
            </>
          )}
        </dl>

        <p className="text-xs text-muted-foreground mt-3">
          Leave year {d.holiday?.leaveYear?.label} ({fmtDate(d.holiday?.leaveYear?.from)} – {fmtDate(d.holiday?.leaveYear?.to)})
        </p>

        {/* ⚠️ The caveat is NOT decoration. It says what the number is and, more
            importantly, what it is not — including the negative-balance case, which
            is normal for leave taken early in a year and must not read as an error. */}
        {d.holiday?.caveat && (
          <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line border-t border-border pt-2">
            {d.holiday.caveat}
          </p>
        )}

        {d.holiday?.requests?.length > 0 && (
          <ul className="mt-3 border-t border-border pt-3 space-y-1.5">
            {d.holiday.requests.map((r, i) => (
              <li key={`${r.startDate}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {fmtDate(r.startDate)}
                  {r.endDate && r.endDate !== r.startDate ? ` – ${fmtDate(r.endDate)}` : ''}
                  <span className="text-muted-foreground"> · {r.kind}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Sickness ──────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-4" aria-labelledby="pay-sickness">
        <div className="flex items-center gap-2 mb-3">
          <Thermometer className="h-5 w-5 text-primary shrink-0" />
          <h2 id="pay-sickness" className="font-semibold">Sickness</h2>
        </div>
        {d.sickness?.length ? (
          <ul className="space-y-3">
            {d.sickness.map(s => (
              <li key={s.reference} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {fmtDate(s.startDate)}{s.endDate ? ` – ${fmtDate(s.endDate)}` : ' – ongoing'}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{s.status}</span>
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  SSP: {s.sspDaysPaid ?? 0} day{s.sspDaysPaid === 1 ? '' : 's'}, {money(s.sspTotalPence)}
                  {' · '}Company sick pay: {money(s.companySickPayPence)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sickness absences recorded.</p>
        )}
      </section>

      {/* ── Family leave ──────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-4" aria-labelledby="pay-family">
        <div className="flex items-center gap-2 mb-3">
          <Baby className="h-5 w-5 text-primary shrink-0" />
          <h2 id="pay-family" className="font-semibold">Family leave</h2>
        </div>
        {d.familyLeave?.length ? (
          <ul className="space-y-3">
            {d.familyLeave.map(f => (
              <li key={f.reference} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {f.type} · {fmtDate(f.startDate)}{f.endDate ? ` – ${fmtDate(f.endDate)}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{f.status}</span>
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {f.weeksPaid ?? 0} week{f.weeksPaid === 1 ? '' : 's'} paid, {money(f.totalPence)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No family leave recorded.</p>
        )}
      </section>

      {/* ── Pay setup ─────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-4" aria-labelledby="pay-setup">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-5 w-5 text-primary shrink-0" />
          <h2 id="pay-setup" className="font-semibold">Your pay setup</h2>
        </div>

        {/* ⚠️ The server says this as a SENTENCE rather than leaving the screen to
            infer it from a null. "Not set up yet" is a different message from
            "no pension", and only the office can tell them apart. */}
        {d.payrollSetupMissing ? (
          <p className="text-sm text-muted-foreground">{d.payrollSetupMissing}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Tax code</dt>
            <dd className="text-right font-medium">{d.payrollSetup?.taxCode ?? '—'}</dd>
            <dt className="text-muted-foreground">NI category</dt>
            <dd className="text-right">{d.payrollSetup?.niCategory ?? '—'}</dd>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="text-right">{d.payrollSetup?.payFrequency ?? '—'}</dd>
            <dt className="text-muted-foreground">Pension</dt>
            <dd className="text-right">
              {d.payrollSetup?.pensionEnrolled ? 'Enrolled' : 'Not enrolled'}
            </dd>
            {d.payrollSetup?.pensionEnrolled && (
              <>
                <dt className="text-muted-foreground">You pay</dt>
                <dd className="text-right tabular-nums">
                  {d.payrollSetup?.pensionEmployeePercent == null ? '—' : `${d.payrollSetup.pensionEmployeePercent}%`}
                </dd>
                <dt className="text-muted-foreground">ACHU pays</dt>
                <dd className="text-right tabular-nums">
                  {d.payrollSetup?.pensionEmployerPercent == null ? '—' : `${d.payrollSetup.pensionEmployerPercent}%`}
                </dd>
              </>
            )}
            {d.payrollSetup?.studentLoanPlan && (
              <>
                <dt className="text-muted-foreground">Student loan</dt>
                <dd className="text-right">{d.payrollSetup.studentLoanPlan}</dd>
              </>
            )}
            {d.payrollSetup?.postgraduateLoan && (
              <>
                <dt className="text-muted-foreground">Postgraduate loan</dt>
                <dd className="text-right">Yes</dd>
              </>
            )}
            {d.payrollSetup?.startDate && (
              <>
                <dt className="text-muted-foreground">Started</dt>
                <dd className="text-right">{fmtDate(d.payrollSetup.startDate)}</dd>
              </>
            )}
          </dl>
        )}

        <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
          <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          If anything here is wrong, tell the office — it cannot be changed from the app.
        </p>
      </section>

      {/* ── Payslips (ACHU-335) ───────────────────────────────────── */}
      <PayslipsSection />

      {/* ── P60 and P45 (ACHU-354) ────────────────────────────────────
          Below the payslips deliberately: payslips are what somebody opens
          this tab for every month, tax forms once a year. */}
      <StatutoryFormsSection />

      {/* ACHU-377. After the forms: this is the one section somebody comes here to
          CHANGE rather than to read, so it sits below what they came to read. */}
      <BankDetailsSection />
      {/*
        🔴 §15 „Update profile" (Sesiunea 160) — aici, lângă datele bancare, nu într-un tab nou: e
        tot „ce știe firma despre mine", iar un al șaselea tab pe un ecran de telefon ar fi strâns
        toate celelalte.
      */}
      <Suspense fallback={null}><MyDetailsSection /></Suspense>

      {/* ── What this page cannot do ──────────────────────────────── */}
      {d.notAvailable && (
        <section className="bg-muted/40 border border-border rounded-xl p-4" aria-labelledby="pay-notavailable">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 id="pay-notavailable" className="font-medium text-sm">Not here yet</h2>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {/* ⚠️ ACHU-381. Falsy entries are SKIPPED. The server decides this list and may
                add keys the screen has never heard of — that is deliberate — but a key
                whose sentence is empty or null would print "null" to an employee. The
                server now removes a sentence that has gone false; this is the second
                line of defence, because the next person to retire one may reach for
                `null` rather than deleting the key. */}
            {Object.entries(d.notAvailable)
              .filter(([, sentence]) => typeof sentence === 'string' && sentence.trim() !== '')
              .map(([key, sentence]) => (
                <li key={key}>{String(sentence)}</li>
              ))}
          </ul>
        </section>
      )}

      <div className="flex justify-center pb-2">
        <Button variant="outline" size="sm" className="min-h-[44px]" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
        </Button>
      </div>
    </div>
  );
}

