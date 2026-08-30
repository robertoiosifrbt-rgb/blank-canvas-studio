import { useEffect, useState, useCallback } from 'react';
import { getPayrollPeople } from '@/lib/endpoints';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, AlertCircle, Inbox } from 'lucide-react';
import { fmt } from '@/lib/format';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import { FREQUENCIES, type Person } from '@/lib/payrollPeopleShared';
import type { PayrollPeopleResponse } from '@/lib/endpoints';
import { BankDetailRequestsPanel } from './PayrollBankDetailRequestsPanel';
import { EmployerIdentityCard } from './PayrollEmployerIdentityCard';
import { ProfileDialog } from './PayrollProfileDialog';
import { PersonDetailsDialog } from './PayrollPersonDetailsDialog';

/**
 * Sesiunea 61 (ACHU-260) — the screen the pay details were missing.
 *
 * ACHU-259 built payroll profiles and wired the simulator to use them, and then
 * gave nobody a way to create one. The owner went looking and asked *"fisele de
 * angajat? unde sunt?"* — the correct question about a half-feature.
 *
 * Worth recording rather than quietly fixing: the API existed, the tests passed,
 * the simulator handled the empty case gracefully. Every check was green around a
 * feature that could not be used at all. "It has an endpoint" is not "it is
 * built", and the gap is invisible from inside the code.
 *
 * ─── Why the pay details live here and not on the Cleaners screen ─────────
 * A cleaner record is operational — who they are, how to reach them, whether
 * they are active — and it is read on nearly every screen in the app. Pay is a
 * different kind of fact with a different audience: it belongs beside the
 * simulator that consumes it, under Setup, not beside the phone number that a
 * dispatcher looks up.
 */

export default function PayrollPeoplePage() {
  const [data, setData] = useState<PayrollPeopleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);

  const load = useCallback(() => {
    setError(null);
    getPayrollPeople().then(setData).catch(e => setError(e?.message ?? 'Could not load.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const people = data?.people ?? [];
  const onPayroll = people.filter(p => p.onPayroll);
  /**
   * ACHU-357. Taken from the SERVER's answer rather than from the role in the
   * browser, deliberately: the redaction is decided by
   * `backend/src/lib/payrollProfileScope.ts`, and a screen that decided for itself
   * would be a second copy of that rule — free to disagree with it. `false` here
   * means the fiscal half is not in the payload at all, not that it is hidden.
   *
   * ⚠️ Absent means "show everything", because every caller before this feature sent
   * no flag at all — a default that hid fields would shrink the Admin screen.
   *
   * 🐛 But `data` is null until the list arrives, so this is TRUE for the first paint
   * of every load, HR included. Caught by a test: the employer identity card fired
   * its request during that window, and its endpoint is one an HR account is refused
   * — so the reward for opening the screen was a flash of a permission error. Nothing
   * that depends on this flag may render before `data` exists; `loaded` below is what
   * the render guards on.
   */
  const fiscal: boolean = data?.fiscalFieldsVisible !== false;
  const loaded = data != null;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title={fiscal ? 'Employee pay details' : 'Employee details'}
        description={fiscal
          ? 'Tax code, National Insurance letter, wage and pension — so the salary simulator stops asking every time.'
          : 'National Insurance number, address, dates, department and pension enrolment. Pay rates and tax codes belong to an Admin and are not shown here.'}
        actions={<RefreshButton onRefresh={load} />}
      />

      {/* The stage-1 boundary, on this screen too. Somebody filling in tax codes
          is exactly the person most likely to assume this is a payroll system. */}
      <Card className="border-amber-400">
        <CardContent className="pt-5 text-sm">
          <p className="font-medium">These details are used by the simulator only</p>
          <p className="text-muted-foreground mt-1">
            Nothing here is sent to HMRC and nobody is paid from it. Real payroll — with a report to HMRC at every
            payment — is a separate decision that has not been taken.
          </p>
          <p className="text-muted-foreground mt-1.5">
            {/* 📜 REVERSED in Sesiunea 80f (ACHU-317). This used to read "There is
                deliberately no National Insurance number field", which was true
                and is now false — Roberto authorised storing it on 02/08/2026.
                Replaced rather than deleted: somebody who read the old sentence
                needs to see that the change was a decision, not a slip. */}
            The National Insurance number and home address <em>are</em> stored, from 02/08/2026. They are what an
            HMRC submission cannot be filed without. ⚠️ Storing them is still not filing anything — nothing is
            sent, and nothing here can send it.
          </p>
        </CardContent>
      </Card>

      {/**
        * ACHU-377. Gated on `loaded && fiscal`, and both halves matter.
        *
        * 🐛 `loaded` is the bug this screen already paid for once: `fiscal` is TRUE for
        * the first paint of every load, HR included, so a panel that fetched before the
        * list arrived would greet an HR account with a permission error — the endpoint
        * is Admin + Finance only (`authorise.ts`, the `bank-detail-requests` row).
        *
        * ⚠️ `fiscal` is the SERVER's answer, not the role in the browser. A screen that
        * decided for itself would be a second copy of an access rule, free to disagree
        * with the real one.
        */}
      {loaded && fiscal && <BankDetailRequestsPanel />}

      {error && (
        <Card className="border-destructive/60">
          <CardContent className="pt-5 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* ACHU-357. The employer's PAYE identity is on the finance side of the line,
          so this card's endpoint refuses an HR account. Rendered anyway it would show
          a permission error on a screen the person is entitled to be on.
          ⚠️ `loaded` and not just `fiscal`: before the list arrives the flag is not
          known yet, and defaulting to "show" would fire the request anyway. */}
      {loaded && fiscal && <EmployerIdentityCard />}

      {!data && !error && <Skeleton className="h-64 w-full" />}

      {data && people.length === 0 && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          There are no cleaners yet. Add them under Team → Cleaners first, then come back.
        </CardContent></Card>
      )}

      {data && people.length > 0 && (
        <Card><CardContent className="pt-5 space-y-1">
          {onPayroll.length === 0 && (
            <p className="pb-2 text-sm text-muted-foreground">
              Nobody has pay details yet. Pick someone to add theirs.
            </p>
          )}
          <div className="divide-y divide-border">
            {people.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEditing(p)}
                className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-muted/50 rounded px-2 -mx-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {p.name}
                    {/* ACHU-382. The employee number Archana chose on 04/08/2026. Beside
                        the name rather than on its own line: it is how the office refers
                        to somebody out loud, and a number nobody can see is a number
                        nobody uses. The SERVER formats it — the same string goes on the
                        payslip and to HMRC as the Payroll ID. */}
                    {p.employeeNumber && (
                      <span className="text-muted-foreground font-normal text-xs"> · {p.employeeNumber}</span>
                    )}
                    {!p.active && <span className="text-muted-foreground font-normal"> · left</span>}
                  </span>
                  {p.profile ? (
                    <span className="block text-xs text-muted-foreground">
                      {/* ACHU-357. Without the fiscal half there is no tax code to lead
                          with, so the line leads with what this account is for. Not a
                          shortened version of the same sentence — an empty "· NI ·" with
                          nothing between the separators reads as data that failed to load. */}
                      {fiscal ? (
                        <>
                          {p.profile.taxCode} · NI {p.profile.niCategory} ·{' '}
                          {FREQUENCIES.find(f => f.value === p.profile!.payFrequency)?.label}
                          {p.profile.hourlyRate != null && ` · ${fmt(p.profile.hourlyRate)}/hour`}
                          {p.profile.annualSalary != null && ` · ${fmt(p.profile.annualSalary)}/year`}
                        </>
                      ) : (
                        <>
                          {FREQUENCIES.find(f => f.value === p.profile!.payFrequency)?.label}
                          {p.profile.niNumber ? ` · NI ${p.profile.niNumber}` : ' · no NI number recorded'}
                          {p.profile.department ? ` · ${p.profile.department}` : ''}
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="block text-xs text-muted-foreground">No pay details yet</span>
                  )}
                </span>
                <Badge variant={p.onPayroll ? 'default' : 'outline'}>
                  {p.onPayroll ? 'On payroll' : 'Not set up'}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent></Card>
      )}

      {editing && (fiscal ? (
        <ProfileDialog
          person={editing}
          meta={data}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ) : (
        <PersonDetailsDialog
          person={editing}
          meta={data}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ))}
    </div>
  );
}

