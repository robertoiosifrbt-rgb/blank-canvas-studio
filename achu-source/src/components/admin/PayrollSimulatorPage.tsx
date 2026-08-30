/**
 * Sesiunea 48 — payroll ETAPA 1: the simulator screen.
 *
 * The design problem here is not the form, it is honesty. This page produces
 * numbers that look exactly like a payslip, and it must not be mistaken for one.
 * So:
 *
 * - The stage-1 notice is at the TOP, before any result, not in a footnote.
 * - The unverified-rates warning is impossible to miss, because that is the
 *   actual risk: a stale threshold gives confident, plausible, wrong numbers
 *   forever, and the first sign of trouble is a letter.
 * - The word SIMULATION is on the result itself, so a screenshot cannot be
 *   mistaken for a document.
 *
 * The most useful figure on the page for the owner is probably not net pay — it
 * is **what the person costs beyond their wage**. Paying £2,000 costs about
 * £2,237 once employer NI and pension are in, and that gap is what gets left out
 * of a price.
 */
import { useEffect, useState } from 'react';
import {
  getPayrollRates, simulatePayroll, getPayrollPeople, getTimesheetPeriod, getTimesheetSummary,
  type PayrollRatesResponse, type SimulateResponse, type PayrollPerson, type TimesheetSummaryResponse,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Loader2 } from 'lucide-react';
import { fmt } from '@/lib/format';
import { PayrollSimulatorRatesStatus } from './PayrollSimulatorRatesStatus';
import { PayrollSimulatorResult } from './PayrollSimulatorResult';
import { errMsg } from '@/lib/errorMessage';

const FREQ_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  'four-weekly': 'Every four weeks',
  monthly: 'Monthly',
};

const WAGE_BAND_LABEL: Record<string, string> = {
  age21Plus: '21 or over',
  age18to20: '18–20',
  under18: 'Under 18',
  apprentice: 'Apprentice',
};

/**
 * ACHU-259 — the minimum-wage band from a date of birth.
 *
 * Derived rather than stored, because an age is wrong from the next birthday
 * onwards and nobody remembers to change a dropdown on somebody's birthday.
 * Apprentice is NOT derivable — it depends on the contract, not the age — so a
 * date of birth never selects it, and whoever knows sets it by hand.
 */
export function bandForDob(dob: string, todayIso: string = new Date().toISOString().slice(0, 10)): string {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  if (age >= 21) return 'age21Plus';
  if (age >= 18) return 'age18to20';
  return 'under18';
}

export default function PayrollSimulatorPage() {
  const [meta, setMeta] = useState<PayrollRatesResponse | null>(null);
  const [gross, setGross] = useState('2000');
  const [frequency, setFrequency] = useState('monthly');
  const [periodNumber, setPeriodNumber] = useState('1');
  const [taxCode, setTaxCode] = useState('1257L');
  const [niCategory, setNiCategory] = useState('A');
  const [payDate, setPayDate] = useState('');
  const [hours, setHours] = useState('');
  /**
   * ACHU-336 (Sesiunea 80o). The hourly rate, so hours × rate can produce the
   * gross without anybody doing the multiplication in their head.
   *
   * ⚠️ Empty means "leave the gross alone". Reported by Archana on 02/08/2026:
   * *"on payroll simulator seems like hours worked are optional... and won't
   * calculate anything"*. It was working as designed and as labelled — hours
   * only drove the minimum-wage check — but for a business where everybody is
   * paid hourly, hours × rate IS the normal path, not an edge case.
   */
  const [rate, setRate] = useState('');
  const [wageBand, setWageBand] = useState('age21Plus');
  const [withPension, setWithPension] = useState(true);
  const [empPct, setEmpPct] = useState('5');
  const [erPct, setErPct] = useState('3');
  const [basis, setBasis] = useState('net-pay-arrangement');
  const [qualifyingOnly, setQualifyingOnly] = useState(true);
  const [grossToDate, setGrossToDate] = useState('');
  const [taxToDate, setTaxToDate] = useState('');
  /** Sesiunea 74. 'none' is the screen's word for no loan; the API wants null. */
  const [studentLoanPlan, setStudentLoanPlan] = useState('none');
  const [postgraduateLoan, setPostgraduateLoan] = useState(false);

  /**
   * ACHU-259 — pick a person instead of retyping their details.
   *
   * This is the whole reason profiles exist. Working out what Maria costs used
   * to mean retyping her tax code, her NI letter, her frequency and her wage
   * every single time — and a mistyped tax code produces a perfectly ordinary
   * looking wrong answer, which is the failure nobody catches.
   *
   * It fills the form and then gets out of the way: every field stays editable,
   * because the commonest reason to open this screen is "what if we paid her
   * more". Locking the fields to the profile would break exactly that.
   */
  const [people, setPeople] = useState<PayrollPerson[]>([]);
  const [personId, setPersonId] = useState('');

  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * ACHU-267. What the hours in the box are: the CONTRACT, or what was actually
   * worked and approved. Held in state so the screen can say which — a gross
   * figure with no stated origin is the thing that made this whole feature
   * necessary, because the contracted figure looked like a measurement.
   */
  const [worked, setWorked] = useState<TimesheetSummaryResponse | null>(null);
  const [loadingWorked, setLoadingWorked] = useState(false);

  useEffect(() => {
    // Failing to load people must not break the simulator: it worked without
    // them yesterday and has to keep working if this call fails.
    getPayrollPeople().then(r => setPeople(r?.people ?? [])).catch(() => setPeople([]));
  }, []);

  /**
   * ACHU-267 — fill the gross from hours actually worked and APPROVED.
   *
   * The period is the one the server suggests from how this person is paid. It is
   * a suggestion, not a pay calendar; anyone who needs a different window uses the
   * Timesheets screen, where both dates are editable, rather than having a
   * calendar invented for them here.
   *
   * Only approved hours are used, and the panel below reports draft and disputed
   * hours next to the figure. That matters more than it looks: a week with 6
   * approved hours and 34 still waiting would otherwise produce a gross that is
   * simply too small, with nothing on screen suggesting anything was missing.
   */
  async function useWorkedHours() {
    const p = people.find(x => x.id === personId);
    if (!p?.profile) return;
    setLoadingWorked(true);
    setError(null);
    try {
      const period = await getTimesheetPeriod({ frequency: p.profile.payFrequency, date: new Date().toISOString().slice(0, 10) });
      const sum = await getTimesheetSummary({ cleanerId: p.id, from: period.start, to: period.end });
      setWorked(sum);
      if (sum.suggestedGross != null) {
        setGross(String(sum.suggestedGross));
        setHours(String(sum.summary.approvedHours));
      } else {
        // No figure, and the server's sentence says why — salaried, no rate, or
        // nothing approved. Surfaced rather than swallowed, because a button that
        // appears to do nothing reads as broken.
        setError(sum.grossBasis);
      }
    } catch (e) {
      setError(errMsg(e) ?? 'Could not read the hours worked.');
    } finally {
      setLoadingWorked(false);
    }
  }

  /**
   * ACHU-336. Hours × rate, whenever BOTH are filled in.
   *
   * ⚠️ Silent when the rate is empty, which is what makes it safe: somebody who
   * types hours purely for the minimum-wage check must not have a gross they
   * typed overwritten underneath them. The rate field is the opt-in.
   *
   * ⚠️ It writes into `gross` rather than replacing it. The engine takes a
   * gross, not hours — hours cannot express a bonus, a salaried month or a
   * part-period — so the derived figure stays editable and the person can
   * correct it. Making the field read-only would be the version that gets in
   * the way exactly when the arithmetic is not a straight multiplication.
   */
  const derivedGross = (() => {
    const h = Number(hours);
    const r = Number(rate);
    if (hours.trim() === '' || rate.trim() === '') return null;
    if (!Number.isFinite(h) || !Number.isFinite(r) || h <= 0 || r <= 0) return null;
    return Math.round(h * r * 100) / 100;
  })();

  function setHoursAndMaybeGross(v: string) {
    setHours(v);
    const r = Number(rate);
    const h = Number(v);
    if (rate.trim() !== '' && Number.isFinite(r) && r > 0 && Number.isFinite(h) && h > 0) {
      setGross(String(Math.round(h * r * 100) / 100));
    }
  }

  function setRateAndMaybeGross(v: string) {
    setRate(v);
    const r = Number(v);
    const h = Number(hours);
    if (hours.trim() !== '' && Number.isFinite(r) && r > 0 && Number.isFinite(h) && h > 0) {
      setGross(String(Math.round(h * r * 100) / 100));
    }
  }

  function applyPerson(id: string) {
    setPersonId(id);
    setWorked(null);
    const p = people.find(x => x.id === id);
    if (!p?.profile) return;
    const pr = p.profile;
    setTaxCode(pr.taxCode);
    setNiCategory(pr.niCategory);
    setFrequency(pr.payFrequency);
    // An hourly person's gross for the period is worked out from their
    // contracted hours; a salaried one's is the annual figure over the periods.
    const perYear: Record<string, number> = { weekly: 52, fortnightly: 26, 'four-weekly': 13, monthly: 12 };
    if (pr.annualSalary != null) {
      setGross(String(Math.round((pr.annualSalary / (perYear[pr.payFrequency] ?? 12)) * 100) / 100));
    } else if (pr.hourlyRate != null && pr.contractedHoursPerWeek != null) {
      const weeks = 52 / (perYear[pr.payFrequency] ?? 12);
      const h = pr.contractedHoursPerWeek * weeks;
      setGross(String(Math.round(pr.hourlyRate * h * 100) / 100));
      setHours(String(Math.round(h * 100) / 100));
    }
    // ACHU-336. Filled whenever they have one, even for a salaried person with
    // no contracted hours — so typing a number of hours immediately works.
    if (pr.hourlyRate != null) setRate(String(pr.hourlyRate));
    setWithPension(pr.pensionEnrolled);
    if (pr.pensionEmployeePercent != null) setEmpPct(String(pr.pensionEmployeePercent));
    if (pr.pensionEmployerPercent != null) setErPct(String(pr.pensionEmployerPercent));
    // The minimum-wage band comes from their date of birth rather than a
    // dropdown somebody has to remember to change on a birthday.
    if (pr.dateOfBirth) setWageBand(bandForDob(pr.dateOfBirth));
    // Sesiunea 74. Taken from the profile rather than asked again: a loan typed
    // here that disagrees with the one on their record is a simulation of
    // somebody who does not exist.
    setStudentLoanPlan(pr.studentLoanPlan ?? 'none');
    setPostgraduateLoan(pr.postgraduateLoan ?? false);
  }

  useEffect(() => {
    getPayrollRates().then(m => {
      setMeta(m);
      // Default to a date inside the most recent tax year we hold rates for, so
      // the form works on first load without the user guessing.
      const latest = m.taxYears?.[m.taxYears.length - 1];
      if (latest && !payDate) setPayDate(latest.startsOn);
    }).catch(() => setMeta(null));
  }, []);

  async function run() {
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await simulatePayroll({
        gross: Number(gross),
        frequency: frequency as 'monthly',
        periodNumber: Number(periodNumber),
        taxCode,
        niCategory,
        payDate,
        grossToDate: grossToDate === '' ? undefined : Number(grossToDate),
        taxToDate: taxToDate === '' ? undefined : Number(taxToDate),
        pension: withPension
          ? {
              employeePercent: Number(empPct),
              employerPercent: Number(erPct),
              basis: basis as 'net-pay-arrangement',
              onQualifyingEarningsOnly: qualifyingOnly,
            }
          : undefined,
        hoursWorked: hours === '' ? undefined : Number(hours),
        minimumWageBand: hours === '' ? undefined : (wageBand as 'age21Plus'),
        studentLoan: studentLoanPlan === 'none' && !postgraduateLoan
          ? undefined
          : {
              plan: studentLoanPlan === 'none' ? null : (studentLoanPlan as 'plan1'),
              postgraduate: postgraduateLoan,
            },
      });
      setResult(res);
    } catch (e) {
      setError(errMsg(e) ?? 'Could not work that out.');
    } finally {
      setBusy(false);
    }
  }

  const selectedYear = meta?.taxYears.find(y => payDate >= y.startsOn && payDate <= y.endsOn);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Calculator className="h-6 w-6" /> Payroll simulator (UK)
        </h1>
        <p className="text-sm text-muted-foreground">
          Works out gross → net: tax, National Insurance, pension, and what the person costs in total.
        </p>
      </div>

      <PayrollSimulatorRatesStatus meta={meta} selectedYear={selectedYear} />

      {!meta && <Skeleton className="h-64 w-full" />}

      {meta && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Form ─────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              {/* ACHU-259. First control on the form, because filling it in
                  answers four of the fields below — and every one of those four,
                  mistyped, produces a wrong answer that looks entirely normal. */}
              {/* ACHU-260. When nobody has details, say where to add them. The
                  picker simply not appearing is what sent the owner looking for a
                  screen that did not exist. */}
              {people.length > 0 && !people.some(p => p.onPayroll) && (
                <p className="text-xs text-muted-foreground">
                  Nobody has pay details saved yet — add them under{' '}
                  <strong>Setup → Employee Pay Details</strong> and they will appear here.
                </p>
              )}
              {people.some(p => p.onPayroll) && (
                <div>
                  <Label htmlFor="payrollsim-use-someone-s-details">Use someone's details</Label>
                  <Select value={personId} onValueChange={applyPerson}>
                    <SelectTrigger id="payrollsim-use-someone-s-details"><SelectValue placeholder="Type the figures myself" /></SelectTrigger>
                    <SelectContent>
                      {people.filter(p => p.onPayroll).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.active ? '' : ' (left)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fills the fields below, then leaves them editable — so "what if we paid her more" still works.
                  </p>

                  {/* ACHU-267. The figure filled in above comes from CONTRACTED hours,
                      which for an hourly cleaner is an assumption. This is the way to
                      replace it with what was actually worked and agreed. */}
                  {personId && (
                    <div className="mt-2 space-y-2">
                      <Button type="button" variant="outline" size="sm" onClick={useWorkedHours} disabled={loadingWorked}>
                        {loadingWorked && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Use hours actually worked
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        The figure above is worked out from <strong>contracted</strong> hours. For anyone whose hours
                        vary, this replaces it with the hours approved on their timesheet for the current period.
                      </p>

                      {worked && (
                        <div className="rounded-lg border p-3 text-xs space-y-1">
                          <p className="font-medium text-sm">
                            {worked.period.from} to {worked.period.to}
                          </p>
                          <p>
                            Approved <strong>{worked.summary.approvedHours}h</strong>
                            {worked.summary.draftHours > 0 && <> · waiting to be approved <strong>{worked.summary.draftHours}h</strong></>}
                            {worked.summary.disputedHours > 0 && <> · disputed <strong>{worked.summary.disputedHours}h</strong></>}
                          </p>
                          <p className="text-muted-foreground">{worked.grossBasis}</p>

                          {/* The failure mode worth shouting about: unapproved hours are
                              excluded, correctly, which makes the gross too SMALL. Silent,
                              that is an underpayment nobody would spot. */}
                          {worked.summary.draftHours > 0 && (
                            <p className="text-amber-700 dark:text-amber-400">
                              ⚠️ {worked.summary.draftHours}h in this period are not approved yet, so they are NOT in the
                              figure above. Approve them under <strong>Team → Timesheets</strong> first, or this wage is short.
                            </p>
                          )}
                          {worked.holiday && (
                            <p className="text-muted-foreground">
                              Holiday accrued on top: <strong>{worked.holiday.hours}h</strong>
                              {worked.holiday.value != null && <> (about {fmt(worked.holiday.value)})</>} — a legal
                              entitlement, and it is <strong>not</strong> included in the gross.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* ACHU-336. Wired with htmlFor/id — the labels on this page were
                      not tied to their inputs, which is a screen-reader problem
                      before it is a testing one. */}
                  <Label htmlFor="sim-gross">Gross per period (£)</Label>
                  <Input
                    id="sim-gross" type="number" step="0.01" min="0" value={gross}
                    onChange={e => setGross(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="payrollsim-how-often-they-are">How often they are paid</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger id="payrollsim-how-often-they-are"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {meta.frequencies.map((f: string) => (
                        <SelectItem key={f} value={f}>{FREQ_LABEL[f] ?? f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="payrollsim-pay-date">Pay date</Label>
                  <DateField id="payrollsim-pay-date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    This decides the tax year. The UK tax year starts on 6 April, not the 1st.
                  </p>
                </div>
                <div>
                  <Label htmlFor="payrollsim-which-period-of-the">Which period of the tax year</Label>
                  <Input id="payrollsim-which-period-of-the" type="number" min="1" value={periodNumber} onChange={e => setPeriodNumber(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Month 1 = April.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="payrollsim-tax-code">Tax code</Label>
                  <Input id="payrollsim-tax-code" value={taxCode} onChange={e => setTaxCode(e.target.value)} placeholder="1257L" />
                </div>
                <div>
                  <Label htmlFor="payrollsim-ni-category">NI category</Label>
                  <Select value={niCategory} onValueChange={setNiCategory}>
                    <SelectTrigger id="payrollsim-ni-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {meta.niCategories.map(c => (
                        <SelectItem key={c.letter} value={c.letter}>{c.letter} — {c.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sim-hours">Hours worked (optional)</Label>
                  <Input
                    id="sim-hours" type="number" step="0.5" min="0" value={hours}
                    onChange={e => setHoursAndMaybeGross(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {/* ACHU-336. Says what the field DOES, and both things it does. */}
                    Used to check the minimum wage. Add an hourly rate too and the gross is worked out for you.
                  </p>
                </div>
                <div>
                  <Label htmlFor="sim-rate">Hourly rate (£, optional)</Label>
                  <Input
                    id="sim-rate" type="number" step="0.01" min="0" value={rate}
                    onChange={e => setRateAndMaybeGross(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {derivedGross != null
                      ? `${hours} hours × £${Number(rate).toFixed(2)} = £${derivedGross.toFixed(2)} gross. You can still edit the gross.`
                      : 'Leave blank to type the gross yourself.'}
                  </p>
                </div>
                <div>
                  <Label htmlFor="payrollsim-age-band">Age / band</Label>
                  <Select value={wageBand} onValueChange={setWageBand}>
                    <SelectTrigger id="payrollsim-age-band"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(WAGE_BAND_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="pen" checked={withPension} onCheckedChange={v => setWithPension(v === true)} />
                  <Label htmlFor="pen" className="cursor-pointer">With a pension</Label>
                </div>
                {withPension && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="payrollsim-employee">Employee (%)</Label>
                        <Input id="payrollsim-employee" type="number" step="0.5" min="0" value={empPct} onChange={e => setEmpPct(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="payrollsim-employer">Employer (%)</Label>
                        <Input id="payrollsim-employer" type="number" step="0.5" min="0" value={erPct} onChange={e => setErPct(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="payrollsim-how-it-is-deducted">How it is deducted</Label>
                      <Select value={basis} onValueChange={setBasis}>
                        <SelectTrigger id="payrollsim-how-it-is-deducted"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="net-pay-arrangement">Before tax (net pay arrangement)</SelectItem>
                          <SelectItem value="relief-at-source">After tax, at 80% (relief at source)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Not a detail — it changes the amount that lands in their account. Ask the pension provider which scheme it is.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="qe" checked={qualifyingOnly} onCheckedChange={v => setQualifyingOnly(v === true)} />
                      <Label htmlFor="qe" className="cursor-pointer text-sm">
                        On qualifying earnings only (the standard)
                      </Label>
                    </div>
                  </>
                )}
              </div>

              {/* ── Student loans (Sesiunea 74) ────────────────────────────
                  Filled in from the person's record when one is picked. */}
              <div className="border-t pt-3 space-y-3">
                <div>
                  <Label htmlFor="payrollsim-student-loan">Student loan</Label>
                  <Select value={studentLoanPlan} onValueChange={setStudentLoanPlan}>
                    <SelectTrigger id="payrollsim-student-loan"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No student loan</SelectItem>
                      <SelectItem value="plan1">Plan 1</SelectItem>
                      <SelectItem value="plan2">Plan 2</SelectItem>
                      <SelectItem value="plan4">Plan 4 (Scotland)</SelectItem>
                      <SelectItem value="plan5">Plan 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="sim-pgl" checked={postgraduateLoan} onCheckedChange={v => setPostgraduateLoan(v === true)} />
                  <Label htmlFor="sim-pgl" className="cursor-pointer text-sm">Also a postgraduate loan</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {/* The rule most often got wrong, said where the figure appears:
                      everything else on this screen is cumulative, and this is not. */}
                  Worked out on this period alone, like National Insurance and unlike income tax — a big month
                  is not evened out by a small one. Rounded down to whole pounds, which is why a real payslip's
                  loan line never has pennies.
                </p>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="payrollsim-gross-so-far-this">Gross so far this tax year (£)</Label>
                  <Input id="payrollsim-gross-so-far-this" type="number" step="0.01" min="0" value={grossToDate} onChange={e => setGrossToDate(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="payrollsim-tax-paid-so-far">Tax paid so far (£)</Label>
                  <Input id="payrollsim-tax-paid-so-far" type="number" step="0.01" value={taxToDate} onChange={e => setTaxToDate(e.target.value)} placeholder="0" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave these empty for a new employee. They matter: income tax is worked out cumulatively, so it
                corrects itself when the pay varies from one month to the next.
              </p>

              <Button className="w-full" disabled={busy || !payDate} onClick={run}>
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Working it out…</> : 'Work it out'}
              </Button>
            </CardContent>
          </Card>

          <PayrollSimulatorResult result={result} error={error} selectedYear={selectedYear} />
        </div>
      )}
    </div>
  );
}

