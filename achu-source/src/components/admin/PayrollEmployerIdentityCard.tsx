import { useCallback, useEffect, useState } from 'react';
import {
  getEmployerPayrollSettings, saveEmployerPayrollSettings, type EmployerPayrollSettings,
} from '@/lib/endpoints';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-317 (Sesiunea 80f) — the business as an EMPLOYER.
 *
 * On this page rather than in a settings screen because it is the same job: the
 * details HMRC needs before a submission could ever be filed. The person filling
 * in employees' NI numbers is the person who has the employer's letter to hand.
 *
 * ⚠️ Separate from invoice settings, which are the business as a SELLER. Merging
 * them would let somebody editing an invoice footer break a PAYE submission.
 */
export function EmployerIdentityCard() {
  const [data, setData] = useState<EmployerPayrollSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [paye, setPaye] = useState('');
  const [accountsOffice, setAccountsOffice] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [previousNi, setPreviousNi] = useState('');
  /** Tri-state: 'undecided' is a real answer and the default. See below. */
  const [allowance, setAllowance] = useState<string>('undecided');

  const load = useCallback(() => {
    setError(null);
    getEmployerPayrollSettings()
      .then(res => {
        setData(res.employer);
        setPaye(res.employer.payeReference ?? '');
        setAccountsOffice(res.employer.accountsOfficeReference ?? '');
        setEmployerName(res.employer.employerName ?? '');
        setPreviousNi(res.employer.previousYearClass1Ni != null ? String(res.employer.previousYearClass1Ni) : '');
        setAllowance(
          res.employer.claimEmploymentAllowance == null
            ? 'undecided'
            : res.employer.claimEmploymentAllowance ? 'yes' : 'no',
        );
      })
      .catch(e => setError(e?.message ?? 'Could not load.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true);
    try {
      await saveEmployerPayrollSettings({
        payeReference: paye.trim() || null,
        accountsOfficeReference: accountsOffice.trim() || null,
        employerName: employerName.trim() || null,
        previousYearClass1Ni: previousNi.trim() === '' ? null : Number(previousNi),
        // 'undecided' → null, which is NOT the same as false. A default of false
        // would answer a question worth up to £5,000 a year on the firm's behalf.
        claimEmploymentAllowance: allowance === 'undecided' ? null : allowance === 'yes',
      });
      toast.success('Employer details saved.');
      setOpen(false);
      load();
    } catch (e) {
      // The server's sentence, which names WHICH reference is which. The two are
      // swapped often enough that a generic "invalid" would be useless.
      toast.error(errMsg(e) ?? 'Could not save.');
    } finally { setBusy(false); }
  }

  const missing = data
    ? [
        !data.payeReference && 'PAYE reference',
        !data.accountsOfficeReference && 'Accounts Office reference',
        !data.employerName && 'employer name',
      ].filter(Boolean) as string[]
    : [];

  return (
    <>
      <Card>
        <CardContent className="pt-5 text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium mr-auto">The business, as an employer</p>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {data?.everSaved ? 'Edit' : 'Add'}
            </Button>
          </div>

          {error && <p className="text-destructive">{error}</p>}

          {data && missing.length === 0 && (
            <p className="text-muted-foreground">
              PAYE <span className="font-mono">{data.payeReference}</span> · Accounts Office{' '}
              <span className="font-mono">{data.accountsOfficeReference}</span> · {data.employerName}
            </p>
          )}

          {data && missing.length > 0 && (
            <p className="text-muted-foreground">
              {/* Named rather than counted: "3 missing" makes somebody open the
                  form to find out what. */}
              Still needed before anything could be filed: {missing.join(', ')}.
            </p>
          )}
        </CardContent>
      </Card>

      {open && (
        <Dialog open onOpenChange={o => { if (!o) setOpen(false); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>The business, as an employer</DialogTitle>
              <DialogDescription>
                From the letter HMRC sent when the PAYE scheme was opened. Not the same as the invoice details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label htmlFor="er-paye">PAYE reference</Label>
                <Input id="er-paye" value={paye} onChange={e => setPaye(e.target.value)} placeholder="123/AB456" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Three digits, a slash, then the office reference.
                </p>
              </div>

              <div>
                <Label htmlFor="er-aor">Accounts Office reference</Label>
                <Input
                  id="er-aor"
                  value={accountsOffice}
                  onChange={e => setAccountsOffice(e.target.value)}
                  placeholder="123PA00012345"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {/* The warning that earns its place: these two get swapped, and a
                      return filed under the wrong one is not matched to ACHU. */}
                  ⚠️ A different reference from the one above, and not interchangeable with it — this is the one
                  payments are matched against.
                </p>
              </div>

              <div>
                <Label htmlFor="er-name">Employer name</Label>
                <Input
                  id="er-name"
                  value={employerName}
                  onChange={e => setEmployerName(e.target.value)}
                  placeholder="ACHU Cleaning Ltd"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The name on the PAYE scheme, which need not be the trading name. Left blank, the invoice legal
                  name is used.
                </p>
              </div>

              <div>
                <Label htmlFor="er-ni">Last year's total Class 1 National Insurance (£)</Label>
                <Input
                  id="er-ni"
                  type="number"
                  step="0.01"
                  value={previousNi}
                  onChange={e => setPreviousNi(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Decides how much of maternity and paternity pay comes back: 109% at or below £45,000, 92% above.
                </p>
              </div>

              <div>
                <Label htmlFor="payrollemp-claiming-employment-allowance">Claiming Employment Allowance</Label>
                <Select value={allowance} onValueChange={setAllowance}>
                  <SelectTrigger id="payrollemp-claiming-employment-allowance"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="undecided">Not decided yet</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {/* Why the third option exists at all. */}
                  ⚠️ “Not decided yet” is kept as its own answer rather than treated as “no”. It is worth up to
                  £5,000 a year, and a silent no is an expensive one.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={save} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

