import { useCallback, useEffect, useState } from 'react';
import { getMyBankDetails, requestMyBankDetails, type MyBankDetailsResponse } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errMsg } from '@/lib/errorMessage';

/**
 * ─── Where my wage is sent (ACHU-377, Sesiunea 86) ──────────────────────────
 *
 * 🔴 Asking is not changing. This form creates a REQUEST — the office has to agree it
 * before anything moves, and the screen says so in the server's words, twice: once
 * before submitting and once after. Without that, somebody who submitted a change on
 * Thursday believes Friday's wage is going to the new account, and it is not.
 *
 * ⚠️ MASKED for the employee too, and that is not distrust. A payable account number
 * should not be sitting on a phone screen in a shared kitchen, and they already know
 * their own number — what they need from this screen is *which* account is on file,
 * which the last four digits answer.
 *
 * ⛔ NO reveal here. The office reveal is recorded and reviewable; a self-reveal would
 * hand out a full account number on the say-so of whoever is holding the phone, with a
 * record saying only "they looked at their own".
 */
export function BankDetailsSection() {
  const [data, setData] = useState<MyBankDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getMyBankDetails().then(setData).catch(e => setError(e?.message ?? 'Could not load your bank details.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestMyBankDetails({
        accountName, sortCode, accountNumber,
        buildingSocietyRef: rollNumber.trim() === '' ? null : rollNumber,
      });
      // The server's sentence, not a cheerful one of our own — it is the one that stops
      // them expecting Friday's wage to move.
      setSent(res?.notice ?? null);
      setEditing(false);
      setAccountNumber('');
      load();
    } catch (e) {
      setError(errMsg(e) ?? 'Could not send the request.');
    } finally { setBusy(false); }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4" aria-labelledby="pay-bank">
      <h2 id="pay-bank" className="font-medium text-sm mb-2">Where your wage is sent</h2>

      {error && <p className="text-xs text-destructive whitespace-pre-line mb-2">{error}</p>}
      {sent && <p className="text-xs text-muted-foreground mb-2">{sent}</p>}

      {data && !data.onFile && !data.pending && (
        <p className="text-xs text-muted-foreground">
          {/* Said plainly: a wage with no destination is a payday that fails. */}
          No bank details are on file for you yet. Add them so your wage can be paid.
        </p>
      )}

      {data?.onFile && (
        <div className="space-y-1 text-xs">
          <div><span className="text-muted-foreground">Name on the account</span> {data.current?.accountName}</div>
          <div><span className="text-muted-foreground">Sort code</span> {data.current?.sortCode}</div>
          <div>
            <span className="text-muted-foreground">Account number</span>{' '}
            <span className="font-mono">{data.current?.accountNumberMasked}</span>
          </div>
        </div>
      )}

      {/* 🔴 Their own pending request, shown back to them. Without this they see the OLD
          details, conclude it did not work, and send it again — then hit the
          one-request-at-a-time refusal with nothing they can act on. */}
      {data?.pending && (
        <div className="mt-2 rounded border border-border p-2 space-y-1 text-xs">
          <p className="font-medium">Waiting for the office to agree</p>
          <div><span className="text-muted-foreground">Sort code</span> {data.pending.sortCode}</div>
          <div>
            <span className="text-muted-foreground">Account number</span>{' '}
            <span className="font-mono">{data.pending.accountNumberMasked}</span>
          </div>
        </div>
      )}

      {data?.notice && <p className="mt-2 text-xs text-muted-foreground">{data.notice}</p>}

      {editing && (
        <div className="mt-3 space-y-2">
          <div>
            <Label htmlFor="mybd-name" className="text-xs">Name on the account</Label>
            <Input id="mybd-name" className="min-h-[44px]" value={accountName} onChange={e => setAccountName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mybd-sort" className="text-xs">Sort code</Label>
            <Input id="mybd-sort" className="min-h-[44px]" inputMode="numeric" value={sortCode} onChange={e => setSortCode(e.target.value)} placeholder="60-16-13" />
          </div>
          <div>
            <Label htmlFor="mybd-acc" className="text-xs">Account number</Label>
            {/* ⚠️ Starts empty and is typed in full, even when details are on file: a
                correction is a full retype, never an edit of something masked. */}
            <Input id="mybd-acc" className="min-h-[44px]" inputMode="numeric" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="31955793" />
          </div>
          <div>
            <Label htmlFor="mybd-roll" className="text-xs">Building society roll number (only if you have one)</Label>
            <Input id="mybd-roll" className="min-h-[44px]" value={rollNumber} onChange={e => setRollNumber(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            The office has to agree this before it takes effect, and they may ring you to check it was really you. Your
            next payment goes to the account on file until they do.
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="min-h-[44px]" onClick={submit} disabled={busy}>Send to the office</Button>
            <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ⚠️ No button at all while one is waiting — the server refuses a second request,
          and a button that only produces a refusal is worse than no button. */}
      {!editing && data && !data.pending && (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 min-h-[44px]"
          onClick={() => {
            setAccountName(data.current?.accountName ?? '');
            setSortCode(data.current?.sortCode ?? '');
            setRollNumber(data.current?.buildingSocietyRef ?? '');
            setAccountNumber('');
            setEditing(true);
          }}
        >
          {data.onFile ? 'Change my bank details' : 'Add my bank details'}
        </Button>
      )}
    </section>
  );
}

