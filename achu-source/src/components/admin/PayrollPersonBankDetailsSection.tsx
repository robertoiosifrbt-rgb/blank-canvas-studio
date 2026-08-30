import { useState } from 'react';
import {
  savePayrollBankDetails, revealPayrollBankDetails,
  type BankDetailsForDisplay, type RevealedBankDetails, type SaveBankDetailsResponse,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errMsg } from '@/lib/errorMessage';

/**
 * ─── Where the wage is sent (ACHU-373, backlog §22, Sesiunea 86) ────────────
 *
 * Visible to Admin and Finance, absent for HR — decided by Archana on 03/08/2026 and
 * enforced on the SERVER, which is why this component can be written plainly: if the
 * response has no `bankDetails`, there is nothing to hide because nothing arrived.
 *
 * 🔴 The account number is shown as `••••5793` and the sort code in full. That is an
 * asymmetry on purpose: a sort code identifies a branch and cannot route a payment on
 * its own, while an account number IS the account. Together with the last four digits
 * it answers the question this panel is actually opened for — *is this the right
 * account?* — without putting a payable number on a screen somebody walked away from.
 *
 * ⚠️ Entering details is NOT affected by the mask. The form takes the full number in
 * an empty field; a correction means retyping the whole number rather than editing a
 * masked one, which is safer in the same breath — nobody adjusts two digits inside
 * something they cannot fully see.
 *
 * 🔴 `Changed by / on` is always shown and never hidden. It is the entire
 * fraud-detection surface: an account swapped shortly before payday sends a real wage
 * to somebody else while the payslip and every total stay perfectly correct. Redacting
 * this pair to look thorough would remove the only defence while appearing to add one.
 *
 * ⚠️ All wording that carries a consequence is the SERVER's, quoted rather than
 * paraphrased. A compliance sentence with two versions drifts, and the one on screen
 * is the one somebody acts on.
 */
export function BankDetailsSection({ cleanerId, personName, details: initial }: {
  cleanerId: string; personName: string; details: BankDetailsForDisplay | null;
}) {
  /**
   * ⚠️ The panel keeps its OWN copy of what is on file, refreshed from the save
   * response, and deliberately does not call the dialog's `onSaved`.
   *
   * 🔴 That callback closes the dialog and reloads the list. Calling it here would
   * discard whatever the person had half-typed in the pay fields above — saving one box
   * inside a form must not throw away the rest of the form. The masked view is the only
   * thing that needs to change, and the server hands it back.
   */
  const [details, setDetails] = useState<BankDetailsForDisplay | null>(initial);
  const [editing, setEditing] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedBankDetails | null>(null);
  /**
   * 🔴 ACHU-754 — răspunsul salvării, ținut ÎNTREG, nu strâns într-o propoziție.
   *
   * ⛔ Înainte, ecranul compunea „Tell the office and «nume»" din `notify`, care spune **pe
   * cine ar TREBUI să anunți** — o intenție. Serverul raportează separat ce s-a **întâmplat**
   * (`employeeToldFirst`), și mai ales cazul în care **nu era cui** să i se spună
   * (`nobodyToTell`). Nota de pe rută, pusă acolo la ACHU-394, spune de ce contează: un ecran
   * care afirmă că omul a fost anunțat pe baza intenției minte în numele aplicației.
   */
  const [outcome, setOutcome] = useState<SaveBankDetailsResponse | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await savePayrollBankDetails(cleanerId, {
        accountName, sortCode, accountNumber,
        buildingSocietyRef: rollNumber.trim() === '' ? null : rollNumber,
      });
      setOutcome(res);
      setEditing(false);
      setAccountNumber('');
      setRevealed(null);
      // The server's masked view, so the panel is correct without a page reload.
      if (res?.bankDetails) setDetails(res.bankDetails);
    } catch (e) {
      setOutcome(null);
      setError(errMsg(e) ?? 'Could not save the bank details.');
    } finally { setBusy(false); }
  }

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      setRevealed(await revealPayrollBankDetails(cleanerId));
    } catch (e) {
      setError(errMsg(e) ?? 'Could not show the full details.');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded border p-3 space-y-2">
      <p className="text-xs font-medium">Bank details — where their wage is sent</p>

      {error && <p className="text-xs text-destructive whitespace-pre-line">{error}</p>}

      {/* 🔴 ACHU-754 — CE S-A ÎNTÂMPLAT cu înștiințarea, nu pe cine ar trebui să anunți.
          Cazul în care nu era cui să i se spună arată DIFERIT de o salvare reușită, fiindcă
          atunci apărarea pe care se bazează toată lumea nu s-a aplicat acestei schimbări. */}
      {outcome?.nobodyToTell && (
        <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
            {personName} was NOT told — they have no active portal account, so nothing could reach them.
          </p>
          {/* Propoziția serverului despre ordine, verbatim: ea spune de ce contează. */}
          <p className="text-xs text-amber-800 dark:text-amber-400">{outcome.orderingRule}</p>
          <p className="text-xs text-amber-800 dark:text-amber-400">
            Tell {personName} yourself, by phone or face to face. If somebody else made this change, they are the
            only person who can say so.
          </p>
        </div>
      )}

      {outcome && !outcome.nobodyToTell && (
        <p className="text-xs text-muted-foreground">
          {outcome.employeeToldFirst
            // ⚠️ Un FAPT, nu o intenție: notificarea a fost chiar scrisă.
            ? `${personName} was told, and the office too.`
            // ⛔ Nicio schimbare materială — nu „nu am reușit să anunțăm".
            : 'Saved. Nothing material changed, so nobody needed telling.'}{' '}
          {outcome.formatNotice}
        </p>
      )}

      {!details?.onFile && !editing && (
        <p className="text-xs text-muted-foreground">
          {/* Said plainly rather than left blank: a wage with no destination is a
              payday that fails, and nothing else on this screen would mention it. */}
          No bank details on file. Their wage has nowhere to go until these are filled in.
        </p>
      )}

      {details?.onFile && !editing && (
        <div className="space-y-1 text-xs">
          <div><span className="text-muted-foreground">Name on the account</span> {details.accountName}</div>
          <div><span className="text-muted-foreground">Sort code</span> {details.sortCode}</div>
          <div>
            <span className="text-muted-foreground">Account number</span>{' '}
            {/* Masked unless somebody asked, on purpose. */}
            <span className="font-mono">{revealed ? revealed.accountNumber : details.accountNumberMasked}</span>
          </div>
          {details.buildingSocietyRef && (
            <div><span className="text-muted-foreground">Roll number</span> {details.buildingSocietyRef}</div>
          )}
          {/* 🔴 Never hidden. This is what makes a changed account visible at all. */}
          {details.updatedBy && (
            <div className="text-muted-foreground">
              Last changed {details.updatedAt?.slice(0, 10)} by {details.updatedBy}
            </div>
          )}
          {revealed && (
            <p className="text-muted-foreground">{revealed.notice}</p>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <div>
            <Label htmlFor="bd-name" className="text-xs">Name on the account</Label>
            {/* ⚠️ Not prefilled from their own name: a wage can go to a joint account,
                or to a name this record has not caught up with. Prefilled, the field
                would claim a fact nobody stated — and it would look verified. */}
            <Input id="bd-name" value={accountName} onChange={e => setAccountName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="bd-sort" className="text-xs">Sort code</Label>
              <Input id="bd-sort" value={sortCode} onChange={e => setSortCode(e.target.value)} placeholder="60-16-13" />
            </div>
            <div>
              <Label htmlFor="bd-acc" className="text-xs">Account number</Label>
              <Input id="bd-acc" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="31955793" />
            </div>
          </div>
          <div>
            <Label htmlFor="bd-roll" className="text-xs">Building society roll number (only if they have one)</Label>
            <Input id="bd-roll" value={rollNumber} onChange={e => setRollNumber(e.target.value)} />
          </div>
          {/* ⚠️ Said BEFORE saving, not after. The belief this prevents is that a
              green tick means the account exists — it means the digits are the right
              shape, and the first payment is the real test. */}
          <p className="text-xs text-muted-foreground">
            Type the account number in full. These are checked for shape only — a well-formed sort code and account
            number can still belong to no account, so the first payment is the real test.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy}>Save bank details</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            // Prefilled with everything EXCEPT the number, which is retyped in full.
            setAccountName(details?.accountName ?? '');
            setSortCode(details?.sortCode ?? '');
            setRollNumber(details?.buildingSocietyRef ?? '');
            setAccountNumber('');
            setEditing(true);
          }}>
            {details?.onFile ? 'Change bank details' : 'Add bank details'}
          </Button>
          {details?.onFile && !revealed && (
            <Button size="sm" variant="ghost" onClick={reveal} disabled={busy}>
              {/* The label says what happens, because it does happen: the look is recorded. */}
              Show full number (recorded)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

