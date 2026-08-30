import { useState } from 'react';
import { savePayrollProfile, type PayrollPeopleResponse } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
// ACHU-380. The same audit viewer that Payments, Jobs and Cleaners already use —
// it renders the previous → new diff, who and when. A second one would drift.
import AuditHistory from '@/components/admin/AuditHistory';
import { FREQUENCIES, type Person } from '@/lib/payrollPeopleShared';
import { PayHistory } from './PayrollPersonPayHistory';
import { StatutoryForms } from './PayrollPersonStatutoryForms';
import { RecurringSection } from './PayrollPersonRecurringSection';
import { EarningsSection } from './PayrollPersonEarningsSection';
import { BankDetailsSection } from './PayrollPersonBankDetailsSection';
import { MileageSection } from './PayrollPersonMileageSection';
import { ExpensesSection } from './PayrollPersonExpensesSection';
import { DeductionsSection } from './PayrollPersonDeductionsSection';
import { errMsg } from '@/lib/errorMessage';

export function ProfileDialog({ person, meta, onClose, onSaved }: {
  person: Person; meta: PayrollPeopleResponse | null; onClose: () => void; onSaved: () => void;
}) {
  const p = person.profile;
  const [taxCode, setTaxCode] = useState(p?.taxCode ?? '1257L');
  const [niCategory, setNiCategory] = useState(p?.niCategory ?? 'A');
  const [payFrequency, setPayFrequency] = useState(p?.payFrequency ?? 'monthly');
  const [hourlyRate, setHourlyRate] = useState(p?.hourlyRate != null ? String(p.hourlyRate) : '');
  const [annualSalary, setAnnualSalary] = useState(p?.annualSalary != null ? String(p.annualSalary) : '');
  const [hours, setHours] = useState(p?.contractedHoursPerWeek != null ? String(p.contractedHoursPerWeek) : '');
  const [dateOfBirth, setDateOfBirth] = useState(p?.dateOfBirth ?? '');
  const [startDate, setStartDate] = useState(p?.startDate ?? '');
  const [endDate, setEndDate] = useState(p?.endDate ?? '');
  const [pensionEnrolled, setPensionEnrolled] = useState(p?.pensionEnrolled ?? false);
  /**
   * ACHU-344, Sesiunea 82. The four dates automatic enrolment is measured from.
   *
   * ⚠️ Dates and not checkboxes, and that is the whole point of the field: every
   * deadline in automatic enrolment runs from a date, and the opt-out date decides
   * whether the person's contributions have to be REFUNDED. A tick would record
   * that something happened and lose when.
   */
  const [dutyDate, setDutyDate] = useState(p?.autoEnrolDutyDate ?? '');
  const [enrolledOn, setEnrolledOn] = useState(p?.pensionEnrolledOn ?? '');
  const [letterSentOn, setLetterSentOn] = useState(p?.pensionLetterSentOn ?? '');
  const [optedOutOn, setOptedOutOn] = useState(p?.pensionOptedOutOn ?? '');
  const [empPct, setEmpPct] = useState(p?.pensionEmployeePercent != null ? String(p.pensionEmployeePercent) : '5');
  const [erPct, setErPct] = useState(p?.pensionEmployerPercent != null ? String(p.pensionEmployerPercent) : '3');
  const [studentLoanPlan, setStudentLoanPlan] = useState<string>(p?.studentLoanPlan ?? 'none');
  const [postgraduateLoan, setPostgraduateLoan] = useState(p?.postgraduateLoan ?? false);
  const [employmentStatus, setEmploymentStatus] = useState<string>(p?.employmentStatus ?? 'Employee');
  // ACHU-366. '' means "not recorded", which is what every profile written before
  // this slice holds — and the server refuses to guess a holiday method from it.
  const [contractType, setContractType] = useState<string>(p?.contractType ?? '');
  /**
   * ACHU-353, Sesiunea 84. When they became a director — a different question from
   * when they joined, and the one a director's NI thresholds are pro-rated from.
   *
   * ⚠️ Blank stays a real answer. The payslip says what it assumed instead, so an
   * office that does not know the date is not blocked; it is told.
   */
  const [directorAppointedOn, setDirectorAppointedOn] = useState(p?.directorAppointedOn ?? '');
  /**
   * ACHU-317, Sesiunea 80f. Stored from 02/08/2026, when Roberto authorised it.
   * Both stay optional: blank means "not recorded", which is a real answer for a
   * new starter who has not been given their number yet.
   */
  const [niNumber, setNiNumber] = useState(p?.niNumber ?? '');
  const [address, setAddress] = useState(p?.address ?? '');
  /**
   * ACHU-328, Sesiunea 80k. What a new starter brings with them.
   *
   * ⚠️ `starterDeclaration` starts at 'none', NOT at 'A'. Statement A means "no
   * other income since 6 April" — the most generous of the three, and exactly
   * the assumption that underpays tax. An unanswered question has to stay
   * visibly unanswered.
   */
  const [starterDeclaration, setStarterDeclaration] = useState<string>(p?.starterDeclaration ?? 'none');
  const [p45Pay, setP45Pay] = useState(p?.p45Pay != null ? String(p.p45Pay) : '');
  const [p45Tax, setP45Tax] = useState(p?.p45Tax != null ? String(p.p45Tax) : '');
  const [p45LeavingDate, setP45LeavingDate] = useState(p?.p45LeavingDate ?? '');
  /**
   * ACHU-343, Sesiunea 82. Grouping labels for the payroll reports.
   *
   * ⚠️ Neither one changes a figure of pay — the dialog says so next to them,
   * because every other field on this form does, and somebody filling in a form
   * has no way to know which is which.
   */
  const [department, setDepartment] = useState(p?.department ?? '');
  const [costCentre, setCostCentre] = useState(p?.costCentre ?? '');
  const [notes, setNotes] = useState(p?.notes ?? '');
  const [busy, setBusy] = useState(false);

  /**
   * Sesiunea 74. Two statuses make the engine REFUSE to calculate, and the person
   * choosing one needs to know at that moment rather than at the first payroll
   * run. The note comes from the server (`meta.employmentStatuses`) so that the
   * screen and the engine cannot end up describing the refusal differently.
   */
  const statusMeta = (meta?.employmentStatuses ?? []).find(s => s.status === employmentStatus);
  /**
   * ⚠️ ACHU-352 (Sesiunea 82): this was `Director || Self-employed Contractor`. A
   * director is CALCULATED now — cumulatively, inside a payroll run — so the amber
   * warning has come off that option. The note itself still comes from the server, so
   * the wording only had to change in one place; the highlight did not, and a screen
   * still shouting a refusal the engine no longer makes is how somebody keeps doing
   * by hand a job the app has started doing.
   */
  const statusRefuses = employmentStatus === 'Self-employed Contractor';

  /**
   * ACHU-366. The hint and the warning come from the server's list, not from a copy
   * here — a second wording of a legal point is the one that goes stale.
   */
  const contractTypeMeta = (meta?.contractTypes ?? []).find(t => t.code === contractType);
  /**
   * ⚠️ Read from the OPTION, not from the saved profile. Taken from the profile it
   * would appear one save too late — and for `self-employed` that means after a
   * payroll record exists for somebody who should not have one. The warnings exist
   * to be read while the choice is being made.
   */
  const contractTypeWarning = contractTypeMeta?.warning ?? null;

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      await savePayrollProfile(person.id, {
        taxCode, niCategory, payFrequency,
        hourlyRate: num(hourlyRate),
        annualSalary: num(annualSalary),
        contractedHoursPerWeek: num(hours),
        dateOfBirth: dateOfBirth || null,
        startDate: startDate || null,
        endDate: endDate || null,
        pensionEnrolled,
        pensionEmployeePercent: pensionEnrolled ? num(empPct) : null,
        pensionEmployerPercent: pensionEnrolled ? num(erPct) : null,
        // ACHU-344. ⚠️ Sent regardless of the `pensionEnrolled` tick, unlike the two
        // percentages above. An opt-out date belongs to somebody who is NOT in the
        // scheme any more, and clearing it with the tick would erase the record of
        // a refund being owed.
        autoEnrolDutyDate: dutyDate || null,
        pensionEnrolledOn: enrolledOn || null,
        pensionLetterSentOn: letterSentOn || null,
        pensionOptedOutOn: optedOutOn || null,
        // 'none' is the screen's way of saying "no loan"; the API wants null.
        studentLoanPlan: studentLoanPlan === 'none' ? null : studentLoanPlan,
        postgraduateLoan,
        employmentStatus,
        // ACHU-366. Empty select → null, not ''. The column means "not recorded".
        contractType: contractType || null,
        // ACHU-353. ⚠️ Cleared when the status is not Director, rather than left as
        // typed. The server refuses a date on a non-director — a date left behind
        // would start pro-rating thresholds the moment the status went back — and
        // sending it anyway would turn changing somebody's status into a save that
        // fails with a message about a field the screen has just hidden.
        directorAppointedOn: employmentStatus === 'Director' ? (directorAppointedOn || null) : null,
        // Sent as typed, including the spaces people copy off a payslip: the
        // server normalises and is the only place that decides what a valid
        // number looks like. Trimming to null here, and only here, keeps a
        // cleared field meaning "not recorded" rather than an empty string.
        niNumber: niNumber.trim() || null,
        address: address.trim() || null,
        // 'none' is the screen's way of saying "not asked yet"; the API wants null.
        starterDeclaration: starterDeclaration === 'none' ? null : starterDeclaration,
        // ⚠️ Sent as typed, and NOT defaulted to 0 when blank. A confirmed zero
        // and an empty box mean different things to the calculation, and the
        // server refuses one figure without the other rather than guessing.
        p45Pay: num(p45Pay),
        p45Tax: num(p45Tax),
        p45LeavingDate: p45LeavingDate || null,
        // ACHU-343. Blank means "not assigned", which is a real answer and gets its
        // own row in the reports — so it is sent as null rather than as "".
        department: department.trim() || null,
        costCentre: costCentre.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(`Pay details saved for ${person.name}.`);
      onSaved();
    } catch (e) {
      // The server's own sentence. It explains WHY a Scottish or K code is
      // refused rather than approximated, and rewording it here would give the
      // same refusal two different explanations.
      toast.error(errMsg(e) ?? 'Could not save.');
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {person.name}
            {person.employeeNumber && (
              <span className="text-muted-foreground font-normal text-sm"> · {person.employeeNumber}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Whatever HMRC actually issued. The app applies the code — it never works one out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pp-taxcode">Tax code</Label>
              <Input id="pp-taxcode" value={taxCode} onChange={e => setTaxCode(e.target.value)} placeholder="1257L" />
            </div>
            <div>
              <Label htmlFor="payrollpro-ni-category">NI category</Label>
              <Select value={niCategory} onValueChange={setNiCategory}>
                <SelectTrigger id="payrollpro-ni-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(meta?.niCategories ?? []).map(c => (
                    <SelectItem key={c.letter} value={c.letter}>{c.letter} — {c.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="payrollpro-paid">Paid</Label>
            <Select value={payFrequency} onValueChange={setPayFrequency}>
              <SelectTrigger id="payrollpro-paid"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Two ways to be paid, and filling both is a contradiction rather than
              extra information — so the form says which one is being used. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pp-hourly">Hourly rate (£)</Label>
              <Input id="pp-hourly" type="number" step="0.01" value={hourlyRate}
                onChange={e => { setHourlyRate(e.target.value); if (e.target.value) setAnnualSalary(''); }} />
            </div>
            <div>
              <Label htmlFor="pp-annual">Or annual salary (£)</Label>
              <Input id="pp-annual" type="number" step="1" value={annualSalary}
                onChange={e => { setAnnualSalary(e.target.value); if (e.target.value) setHourlyRate(''); }} />
            </div>
          </div>

          <div>
            <Label htmlFor="pp-hours">Contracted hours a week</Label>
            <Input id="pp-hours" type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Used with the hourly rate to work out a period's pay.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="pp-dob">Date of birth</Label>
              <DateField id="pp-dob" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pp-start">Started</Label>
              <DateField id="pp-start" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pp-end">Left</Label>
              <DateField id="pp-end" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {/* The reason a date of birth is asked for at all. Without saying it,
                it reads as data collected for no reason. */}
            The date of birth sets which minimum wage applies — it is banded by age, and the underpayment
            warning is measured against it.
          </p>

          {/* ACHU-317. Grouped and labelled as HMRC identity rather than mixed in
              with pay, so it is obvious why the app is asking for a home address
              at all — the commonest reason someone types a placeholder. */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-medium">For HMRC</p>
            <div>
              <Label htmlFor="pp-ni">National Insurance number</Label>
              <Input
                id="pp-ni"
                value={niNumber}
                onChange={e => setNiNumber(e.target.value)}
                placeholder="AB123456C"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {/* The instruction that prevents the failure the validation exists for:
                    a blank is chased, a placeholder is trusted. */}
                Leave blank if it is not known yet — do not put TN, NT or anything else in its place.
                A blank shows up as something to chase; a made-up number looks answered.
              </p>
            </div>
            <div>
              <Label htmlFor="pp-address">Home address</Label>
              <Textarea
                id="pp-address"
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="4 Bridge Street, Leeds LS1 4AP"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Needs a postcode. HMRC falls back on the address when a National Insurance number
                cannot be matched.
              </p>
            </div>
          </div>

          {/* ACHU-328. Kept in its own box, away from pay: these figures are
              about a job the person no longer has, and mixing them in with the
              hourly rate is how somebody types this employer's numbers here. */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-medium">New starter — their last job</p>
            <div>
              <Label htmlFor="pp-starter">Starter declaration</Label>
              <select
                id="pp-starter"
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={starterDeclaration}
                onChange={e => setStarterDeclaration(e.target.value)}
              >
                <option value="none">Not asked yet</option>
                <option value="A">A — first job since 6 April, no other taxable income since</option>
                <option value="B">B — only job now, but has had another (or taxable JSA/ESA) since 6 April</option>
                <option value="C">C — has another job, or a State or Occupational Pension</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {/* Said plainly, because it is a legal duty and not a preference. */}
                HMRC wants this for every new starter, before their first payday — including one who
                hands in a P45.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pp-p45pay">P45 — total pay to date (£)</Label>
                <Input
                  id="pp-p45pay" type="number" step="0.01" value={p45Pay}
                  onChange={e => setP45Pay(e.target.value)} placeholder="8000.00"
                />
              </div>
              <div>
                <Label htmlFor="pp-p45tax">P45 — total tax to date (£)</Label>
                <Input
                  id="pp-p45tax" type="number" step="0.01" value={p45Tax}
                  onChange={e => setP45Tax(e.target.value)} placeholder="343.00"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {/* The distinction the server refuses on, said before it refuses. */}
              Both figures or neither. If the previous employer deducted no tax, type <strong>0</strong> —
              a blank means &ldquo;not looked up yet&rdquo;, and the two produce different tax on the first payday.
            </p>

            <div>
              <Label htmlFor="pp-p45date">P45 — leaving date</Label>
              <DateField
                id="pp-p45date" value={p45LeavingDate}
                onChange={e => setP45LeavingDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {/* Why a date is not optional decoration here. */}
                Needed before the figures can be used: it says which tax year they belong to. Figures from
                an earlier year never carry forward, and without the date they are stored but not applied.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              {/* The reason the box exists at all, in the money terms that make it
                  worth filling in rather than skipping. */}
              ⚠️ Without these, somebody joining part-way through the year is given the whole year&rsquo;s
              tax-free allowance a second time. Their wage looks right and they are quietly underpaying
              tax, more every month, until HMRC catches up with them.
            </p>
          </div>

          {/* ACHU-321. Only for somebody who already has pay details — a bonus for
              a person no run would collect is refused by the API anyway, and
              offering the field would invite the refusal. */}
          {person.onPayroll && <EarningsSection cleanerId={person.id} personName={person.name} />}
          {person.onPayroll && <RecurringSection cleanerId={person.id} personName={person.name} />}
          {/* ACHU-331. Same condition, same reason: a deduction for somebody
              no run would collect is refused by the API anyway. */}
          {person.onPayroll && <DeductionsSection cleanerId={person.id} personName={person.name} />}
          {/* ACHU-360. Below the deduction box, so the two money boxes that ARE
              pay sit together and the one that is not comes after them. */}
          {person.onPayroll && <MileageSection cleanerId={person.id} personName={person.name} />}
          {/* ACHU-361. Beside mileage: the other kind of money that is paid with
              a wage and is not one. */}
          {person.onPayroll && <ExpensesSection cleanerId={person.id} personName={person.name} />}
          {/* ACHU-373. Last of the boxes, and the only one that is not an amount: the
              others say how much, this one says where it goes. ⚠️ Rendered only when the
              server actually sent `bankDetails` — for HR it is absent, so there is
              nothing to hide because nothing arrived. */}
          {person.onPayroll && person.profile?.bankDetails && (
            <BankDetailsSection
              cleanerId={person.id}
              personName={person.name}
              details={person.profile.bankDetails}
            />
          )}

          <div className="flex items-center gap-2 pt-1">
            <Checkbox id="pen" checked={pensionEnrolled} onCheckedChange={v => setPensionEnrolled(v === true)} />
            <Label htmlFor="pen" className="cursor-pointer">In the pension scheme</Label>
          </div>
          {pensionEnrolled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pp-emp">Employee %</Label>
                <Input id="pp-emp" type="number" step="0.1" value={empPct} onChange={e => setEmpPct(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pp-er">Employer %</Label>
                <Input id="pp-er" type="number" step="0.1" value={erPct} onChange={e => setErPct(e.target.value)} />
              </div>
            </div>
          )}

          {/* ─── Automatic enrolment dates (ACHU-344, Sesiunea 82) ──────────
              ⛔ RECORDS WHAT HAPPENED. Nothing here enrols anybody: putting
              somebody into a scheme takes the pension provider, and the letter has
              to be sent outside this app. Filling these in is how the deadlines
              become checkable — the assessment cannot measure a six-week window
              from a tick. */}
          <div className="rounded border p-3 space-y-3">
            <p className="text-xs font-medium">Automatic enrolment — what happened, and when</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pp-duty">Duty started</Label>
                <DateField id="pp-duty" value={dutyDate} onChange={e => setDutyDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pp-enrolled-on">Put into the scheme</Label>
                <DateField id="pp-enrolled-on" value={enrolledOn} onChange={e => setEnrolledOn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pp-letter">Enrolment letter sent</Label>
                <DateField id="pp-letter" value={letterSentOn} onChange={e => setLetterSentOn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pp-optout">Opted out</Label>
                <DateField id="pp-optout" value={optedOutOn} onChange={e => setOptedOutOn(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {/* The two sentences an office needs and would not guess: the letter
                  is its own legal duty, and an early opt-out means money goes back. */}
              Leave blank what has not happened. <strong>Sending the letter is a duty of its own</strong> — enrolling
              somebody without telling them does not discharge it. An opt-out within <strong>one month</strong> of the
              later of those two dates means every contribution taken has to be <strong>refunded</strong> through
              payroll; this app works out neither the refund nor the payment.
            </p>
          </div>

          {/* ─── Employment status (Sesiunea 74) ───────────────────────────
              Not a label: two of these five stop the calculation outright. */}
          <div>
            <Label htmlFor="payrollpro-employment-status">Employment status</Label>
            <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
              <SelectTrigger id="payrollpro-employment-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(meta?.employmentStatuses ?? []).map(s => (
                  <SelectItem key={s.status} value={s.status}>{s.status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusMeta && (
              <p className={`mt-1 text-xs ${statusRefuses ? 'text-amber-700 dark:text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                {statusRefuses && '⚠️ '}{statusMeta.note}
              </p>
            )}
          </div>

          {/* ─── What kind of contract (ACHU-366, Sesiunea 85) ─────────────
              🔴 Not a label either: this is what decides WHICH statutory holiday
              method applies. 12.07% accrual is right for irregular hours and too
              low for a settled week, and until this field existed the app could
              only warn — off `contractedHoursPerWeek`, which merely hints at the
              answer, so the warning fired on people for whom nothing was wrong. */}
          <div>
            <Label htmlFor="payrollpro-contract-type">Contract type</Label>
            <Select value={contractType || 'none'} onValueChange={v => setContractType(v === 'none' ? '' : v)}>
              <SelectTrigger id="payrollpro-contract-type"><SelectValue placeholder="Not recorded" /></SelectTrigger>
              <SelectContent>
                {/* An explicit "not recorded" rather than an empty option: leaving
                    it blank is a real answer that the server reports on, and a
                    dropdown you cannot get back out of is worse than one entry. */}
                <SelectItem value="none">Not recorded</SelectItem>
                {(meta?.contractTypes ?? []).map(t => (
                  <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contractTypeMeta && (
              <p className="mt-1 text-xs text-muted-foreground">{contractTypeMeta.hint}</p>
            )}
            {/* ⚠️ From the server, not composed here: two wordings for one legal
                point is how they drift apart. Amber rather than red — none of these
                is an error, each is something the office has to know now. */}
            {contractTypeWarning && (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-500">{contractTypeWarning}</p>
            )}
            {!contractType && meta?.contractTypeNote && (
              <p className="mt-1 text-xs text-muted-foreground">
                Leave it blank if you do not know. While it is blank the holiday screen shows the{' '}
                <strong>12.07% accrual</strong>, which is the method for <strong>irregular</strong> hours — right for
                a zero-hours or casual worker and <strong>too low</strong> for somebody with a settled week.
              </p>
            )}
            {meta?.contractTypeNote && (
              <p className="mt-1 text-[11px] text-muted-foreground">{meta.contractTypeNote}</p>
            )}
          </div>

          {/* ─── When they became a director (ACHU-353, Sesiunea 84) ────────
              Shown only for a director, because it means nothing for anybody
              else and the server refuses it there. Not a hidden field with a
              value in it: the save clears it when the status is not Director. */}
          {employmentStatus === 'Director' && (
            <div>
              <Label htmlFor="director-appointed">Became a director on</Label>
              <DateField
                id="director-appointed"
                value={directorAppointedOn}
                onChange={e => setDirectorAppointedOn(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {/* The one thing an office would not guess: this is NOT the date
                    they joined, and getting it wrong moves real money in a
                    direction nobody notices until HMRC reconciles. */}
                Not the same as the date they started here. A director appointed part-way through a tax year gets
                National Insurance thresholds <strong>reduced pro-rata</strong> to the weeks left in it.
                {!directorAppointedOn && (
                  <>
                    {' '}Leave it blank if you do not know it — the payslip will say the full annual thresholds were
                    used, which is right for a director who held office from 6 April and makes the National Insurance
                    <strong> too low</strong> for anybody promoted mid-year.
                  </>
                )}
              </p>
            </div>
          )}

          {/* ─── Student loans (Sesiunea 74) ───────────────────────────────
              Options come from the server. A hand-written list here would
              eventually acquire a "Plan 3", which HMRC does not have. */}
          <div>
            <Label htmlFor="payrollpro-student-loan">Student loan</Label>
            <Select value={studentLoanPlan} onValueChange={setStudentLoanPlan}>
              <SelectTrigger id="payrollpro-student-loan"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No student loan</SelectItem>
                {(meta?.studentLoanPlans ?? []).map(pl => (
                  <SelectItem key={pl.plan} value={pl.plan}>{pl.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Whatever HMRC told you on the starter checklist or the P45. Repayments are 9% of pay above
              the plan's threshold, worked out separately for each pay period — not spread across the year.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="pgl" checked={postgraduateLoan} onCheckedChange={v => setPostgraduateLoan(v === true)} />
            <Label htmlFor="pgl" className="cursor-pointer">Also repaying a postgraduate loan</Label>
          </div>
          {postgraduateLoan && studentLoanPlan !== 'none' && (
            <p className="text-xs text-muted-foreground">
              {/* Two loan lines on one payslip is the sort of thing that gets
                  queried as a duplicate, so it is explained before it appears. */}
              Both will be deducted, as two separate lines at different rates (9% and 6%). That is correct —
              a postgraduate loan is repaid on top of a plan, not instead of one.
            </p>
          )}

          {/* ─── Department and cost centre (ACHU-343, Sesiunea 82) ─────────
              ⚠️ A native <datalist>, not a Radix Select, and for two reasons that
              both matter: the field is FREE TEXT — a new department has to be
              typeable — and a Radix Select opened inside a Radix Dialog closes the
              dialog in jsdom (ACHU-LIM-004), which would make this untestable.

              The suggestions are the labels already in use, from the server. They
              are the only thing stopping "Comercial" from being created next to
              "Commercial", because there is no departments table to constrain it. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pp-department">Department</Label>
              <Input
                id="pp-department" list="pp-departments" value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Domestic"
              />
              <datalist id="pp-departments">
                {(meta?.departmentsInUse ?? []).map((d: string) => <option key={d} value={d} />)}
              </datalist>
            </div>
            <div>
              <Label htmlFor="pp-costcentre">Cost centre</Label>
              <Input
                id="pp-costcentre" list="pp-costcentres" value={costCentre}
                onChange={e => setCostCentre(e.target.value)}
                placeholder="e.g. CC-1"
              />
              <datalist id="pp-costcentres">
                {(meta?.costCentresInUse ?? []).map((c: string) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {/* Said here because every other field on this form changes what somebody
                is paid, and association is how a label acquires a calculation in
                somebody's head. */}
            For grouping the payroll reports only — neither one changes pay, tax, National Insurance or pension.
            Leave blank if the person is not assigned to one; unassigned wages still appear in the reports, on
            their own row.
          </p>

          <div>
            <Label htmlFor="pp-notes">Notes</Label>
            <Textarea id="pp-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <PayHistory cleanerId={person.id} />
          <StatutoryForms cleanerId={person.id} />

          {/**
            * ─── ACHU-380: when did this person's pay change, and who changed it? ────
            *
            * 🔴 The data was always there and nobody could see it. `PayHistory` above
            * answers *what was this person PAID* — from payroll runs. This answers a
            * different question that nothing in the app answered: **what was agreed, and
            * when did it change.** A wage dispute is about the second one.
            *
            * ⚠️ `entityId` is the PROFILE id, not the cleaner id, because that is what
            * the save audits. The distinction is invisible on screen and would silently
            * render an empty history — the failure mode being an empty box that reads as
            * "nothing ever changed" rather than "you asked the wrong question".
            *
            * ⛔ Gated on the SERVER's `auditHistoryVisible`, not on `fiscal`. Audit
            * history is closed to BOTH narrow roles, so `fiscal` would let a
            * `FinanceOnly` account through to an endpoint the guard refuses — the bug
            * this screen has already shipped twice.
            */}
          {meta?.auditHistoryVisible && person.profile?.id && (
            <div className="space-y-1">
              <AuditHistory entityType="PayrollProfile" entityId={person.profile.id} />
              {/* Said once, and it is the honest half. Rates were not recorded before
                  ACHU-380 (04/08/2026) — so an old change shows the tax code moving and
                  says nothing about the money, and no screen can invent what was never
                  written. Without this line, a short history reads as a stable wage. */}
              <p className="text-xs text-muted-foreground">
                Pay rates are recorded in this history from 04/08/2026. Changes made before that date appear here
                but without the rate — it was not being saved, so it cannot be shown.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save pay details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

