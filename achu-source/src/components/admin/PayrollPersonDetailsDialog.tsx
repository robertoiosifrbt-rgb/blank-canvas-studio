import { useState } from 'react';
import { savePayrollProfilePerson } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Person } from '@/lib/payrollPeopleShared';
import type { PayrollPeopleResponse } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

/**
 * THE PERSON HALF OF A PROFILE, FOR AN `HROnly` ACCOUNT (ACHU-357, Sesiunea 83).
 *
 * ─── Why this is a second dialog and not the same one with fields hidden ────
 * Because the two write different things to different endpoints. `ProfileDialog`
 * posts the WHOLE profile to `POST /payroll/people/:id`, where an absent field is
 * stored as null; this one PATCHes only what it holds to
 * `PATCH /payroll/people/:id/person`, whose update statement does not mention a
 * money column at all.
 *
 * Hiding inputs in the first dialog would have left it posting the whole object
 * with the fiscal half missing — which is exactly how an hourly rate gets erased
 * by somebody who was never shown it. The server refuses that (the narrow schema
 * is `.strict()`), so it would have surfaced as "save is broken" rather than as
 * lost data; but a form whose Save button is refused by design is not a form.
 *
 * ⚠️ The drift risk is real and worth naming: a person field added to
 * `ProfileDialog` and not to this one is a field HR cannot edit. That is a missing
 * feature, reported in a sentence — not a wrong wage. `payrollProfileScope.test.ts`
 * holds the SERVER's half of the partition, which is the half that matters.
 */
export function PersonDetailsDialog({ person, meta, onClose, onSaved }: {
  person: Person; meta: PayrollPeopleResponse | null; onClose: () => void; onSaved: () => void;
}) {
  const p = person.profile;
  const [niNumber, setNiNumber] = useState(p?.niNumber ?? '');
  const [address, setAddress] = useState(p?.address ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(p?.dateOfBirth ?? '');
  const [startDate, setStartDate] = useState(p?.startDate ?? '');
  const [endDate, setEndDate] = useState(p?.endDate ?? '');
  const [hours, setHours] = useState(p?.contractedHoursPerWeek != null ? String(p.contractedHoursPerWeek) : '');
  const [employmentStatus, setEmploymentStatus] = useState<string>(p?.employmentStatus ?? 'Employee');
  // ACHU-353. HR's, like the status it belongs to — see `payrollProfileScope.ts`.
  const [directorAppointedOn, setDirectorAppointedOn] = useState(p?.directorAppointedOn ?? '');
  const [department, setDepartment] = useState(p?.department ?? '');
  const [costCentre, setCostCentre] = useState(p?.costCentre ?? '');
  const [pensionEnrolled, setPensionEnrolled] = useState(p?.pensionEnrolled ?? false);
  const [dutyDate, setDutyDate] = useState(p?.autoEnrolDutyDate ?? '');
  const [enrolledOn, setEnrolledOn] = useState(p?.pensionEnrolledOn ?? '');
  const [letterSentOn, setLetterSentOn] = useState(p?.pensionLetterSentOn ?? '');
  const [optedOutOn, setOptedOutOn] = useState(p?.pensionOptedOutOn ?? '');
  const [notes, setNotes] = useState(p?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      await savePayrollProfilePerson(person.id, {
        niNumber: niNumber.trim() || null,
        address: address.trim() || null,
        dateOfBirth: dateOfBirth || null,
        startDate: startDate || null,
        endDate: endDate || null,
        contractedHoursPerWeek: num(hours),
        employmentStatus: employmentStatus || null,
        // ACHU-353. Cleared when the status is not Director, for the same reason the
        // full dialog does it: the server refuses a dormant date, and a save that
        // fails over a hidden field reads as a broken Save button.
        directorAppointedOn: employmentStatus === 'Director' ? (directorAppointedOn || null) : null,
        department: department.trim() || null,
        costCentre: costCentre.trim() || null,
        pensionEnrolled,
        // ⚠️ Sent regardless of the tick, exactly as the full dialog does it: an
        // opt-out date belongs to somebody who is NOT in the scheme any more, and
        // clearing it with the tick would erase the record of a refund being owed.
        autoEnrolDutyDate: dutyDate || null,
        pensionEnrolledOn: enrolledOn || null,
        pensionLetterSentOn: letterSentOn || null,
        pensionOptedOutOn: optedOutOn || null,
        notes: notes.trim() || null,
      });
      toast.success('Employee details saved');
      onSaved();
    } catch (e) {
      // The server's own sentence, never a rephrasing — it is the one that explains
      // why a placeholder NI number is refused, or why a start date clashes with a
      // recorded P45.
      toast.error(errMsg(e) ?? 'Could not save.');
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{person.name}</DialogTitle>
          <DialogDescription>
            Employee details. Pay rates and tax codes are not part of this account — see the note below.
          </DialogDescription>
        </DialogHeader>

        {!person.onPayroll && (
          /* Said BEFORE anything is typed, because the refusal otherwise arrives on
             Save with a form full of work in it. Setting somebody up needs a tax code
             and an NI category, which are pay decisions this account cannot make. */
          <Card className="border-amber-400">
            <CardContent className="pt-4 text-sm">
              <p className="font-medium">{person.name} is not on payroll yet</p>
              <p className="text-muted-foreground mt-1">
                Adding someone needs a tax code, an NI letter and a pay frequency, which are pay decisions rather
                than employee details. Ask an Admin to set them up first — then their details can be kept here.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="pd-dob">Date of birth</Label>
              <DateField id="pd-dob" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pd-start">Started</Label>
              <DateField id="pd-start" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pd-end">Left</Label>
              <DateField id="pd-end" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-medium">For HMRC</p>
            <div>
              <Label htmlFor="pd-ni">National Insurance number</Label>
              <Input id="pd-ni" value={niNumber} onChange={e => setNiNumber(e.target.value)} placeholder="AB123456C" />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave blank if it is not known yet — do not put TN, NT or anything else in its place. A blank gets
                chased; a placeholder gets trusted.
              </p>
            </div>
            <div>
              <Label htmlFor="pd-address">Home address</Label>
              <Textarea id="pd-address" rows={3} value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pd-hours">Contracted hours per week</Label>
              <Input id="pd-hours" type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="payrollper-employment-status">Employment status</Label>
              <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                <SelectTrigger id="payrollper-employment-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(meta?.employmentStatuses ?? []).map(s => (
                    <SelectItem key={s.status} value={s.status}>{s.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {/* Both of these move a figure this account cannot see, and saying so is
                the only thing that keeps the change deliberate. Holiday entitlement is
                5.6 weeks OF the contracted hours, and a director's National Insurance
                is worked out against annual thresholds rather than per period. */}
            ⚠️ These two do change pay indirectly: holiday entitlement is 5.6 weeks of the contracted hours, and
            marking somebody a Director changes how their National Insurance is worked out.
          </p>

          {/* ACHU-353. Shown only for a director, same rule as the pay-details
              dialog. HR owns this date because it is the same employment fact as
              the status beside it — and a status without a date is exactly the
              combination that produces the wrong National Insurance. */}
          {employmentStatus === 'Director' && (
            <div>
              <Label htmlFor="pd-director-appointed">Became a director on</Label>
              <DateField
                id="pd-director-appointed"
                value={directorAppointedOn}
                onChange={e => setDirectorAppointedOn(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Not the same as the date they started here. Somebody appointed part-way through a tax year gets
                National Insurance thresholds reduced pro-rata; left blank, the payslip says full annual thresholds
                were used, which is <strong>too generous</strong> for anybody promoted mid-year.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pd-dept">Department</Label>
              <Input id="pd-dept" value={department} onChange={e => setDepartment(e.target.value)} list="pd-depts" />
              <datalist id="pd-depts">
                {(meta?.departmentsInUse ?? []).map((d: string) => <option key={d} value={d} />)}
              </datalist>
            </div>
            <div>
              <Label htmlFor="pd-cc">Cost centre</Label>
              <Input id="pd-cc" value={costCentre} onChange={e => setCostCentre(e.target.value)} list="pd-ccs" />
              <datalist id="pd-ccs">
                {(meta?.costCentresInUse ?? []).map((c: string) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Neither of these changes anybody's pay — they group the payroll reports. Pick an existing label where
            there is one, so the same department does not end up spelled two ways.
          </p>

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-medium">Pension enrolment</p>
            <label className="flex items-center gap-2">
              <Checkbox checked={pensionEnrolled} onCheckedChange={v => setPensionEnrolled(v === true)} />
              <span>In a pension scheme</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pd-duty">Duty date</Label>
                <DateField id="pd-duty" value={dutyDate} onChange={e => setDutyDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pd-enrolled">Enrolled on</Label>
                <DateField id="pd-enrolled" value={enrolledOn} onChange={e => setEnrolledOn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pd-letter">Letter sent</Label>
                <DateField id="pd-letter" value={letterSentOn} onChange={e => setLetterSentOn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pd-optout">Opted out on</Label>
                <DateField id="pd-optout" value={optedOutOn} onChange={e => setOptedOutOn(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {/* The same sentence the module carries everywhere: recording is not
                  enrolling, and nothing here tells a provider anything. */}
              ⚠️ Recording a date here does not enrol anybody. ACHU has no pension provider yet, and nothing in the
              app contacts one — these are the dates the legal deadlines are measured from.
            </p>
          </div>

          <div>
            <Label htmlFor="pd-notes">Notes</Label>
            <Textarea id="pd-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <Card>
            <CardContent className="pt-4 text-xs text-muted-foreground">
              Pay rate, annual salary, tax code, NI letter, student loan and the previous employer's P45 figures are
              not shown to this account and are not changed by saving here. They stay exactly as an Admin left them.
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !person.onPayroll}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

