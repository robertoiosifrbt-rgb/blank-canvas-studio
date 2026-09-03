/**
 * §30 (Sesiunea 144) — HOTĂRÂREA: da sau nu, plus programarea vizitei gratuite.
 *
 * ⛔ **Fișier propriu, nu un bloc în pagină** (`AGENT_RULES` §9): are trei stări de formular ale lui,
 * iar pagina are lista. Amestecate, fiecare tastare într-un motiv de refuz ar fi re-randat lista.
 *
 * ⚠️ **Butoanele apar doar pentru cine poate hotărî** — adică pentru rolul de Admin, spus de server
 * prin `canDecide`. ⛔ Nu e o măsură de securitate (aceea e `requireSuperAdmin()` pe rută); e ca
 * omul să nu apese ceva ce va fi refuzat. ⚠️ Iar cine nu poate vede o **propoziție**, nu un ecran mut.
 *
 * 🔴 **Prima variantă compara adresa cu un aprobator configurat**, fiindcă owner-ul ceruse „doar eu
 * aprob momentan". A schimbat decizia în aceeași zi: *„Lasa aprobarea pe rolul de admin"*.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { decideReClean, bookReClean, type ReCleanRecord } from '@/lib/reCleanEndpoints';
import { errMsg } from '@/lib/errorMessage';

export default function ReCleanDecision({ record, canDecide, onDone }: {
  record: ReCleanRecord;
  canDecide: boolean;
  onDone: () => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [booking, setBooking] = useState(false);
  const [jobDate, setJobDate] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setDeclining(false); setBooking(false); setNote(''); setJobDate('');
      onDone();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el numește persoana care poate hotărî, sau spune de ce nu se poate.
      toast.error(errMsg(e) || 'Could not save that.');
    } finally {
      setBusy(false);
    }
  };

  if (record.status === 'Requested') {
    if (!canDecide) {
      return (
        <p className="text-[11px] text-muted-foreground">
          {/* ⛔ Spune CE lipsește, nu „nu ai voie": un ecran mut se raportează ca aplicație ruptă. */}
          Waiting for the office to decide — this account can look, not decide.
        </p>
      );
    }

    if (declining) {
      return (
        <div className="w-full space-y-1.5">
          <Textarea
            aria-label="Why this re-clean is being turned down"
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Photos show it was done, and this is the third time this month."
          />
          <div className="flex gap-2">
            <Button
              type="button" size="sm" variant="destructive"
              /** ⛔ Stins fără motiv: un „nu" fără motiv e starea de dinainte cu o etichetă pe ea. */
              disabled={busy || !note.trim()}
              onClick={() => run(() => decideReClean({ id: record.id, status: 'Declined', decisionNote: note.trim() }))}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Turn it down'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDeclining(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        <Button
          type="button" size="sm" disabled={busy}
          aria-label={`Approve re-clean ${record.reCleanId}`}
          onClick={() => run(() => decideReClean({ id: record.id, status: 'Approved' }))}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Approve'}
        </Button>
        <Button
          type="button" size="sm" variant="outline" disabled={busy}
          aria-label={`Turn down re-clean ${record.reCleanId}`}
          onClick={() => setDeclining(true)}
        >
          Turn down
        </Button>
      </div>
    );
  }

  /** ⚠️ Programarea e a BIROULUI, nu doar a aprobatorului: hotărârea e luată, restul e organizare. */
  if (record.outcome === 'Awaiting booking' || record.outcome === 'Cancelled') {
    if (!booking) {
      return (
        <Button type="button" size="sm" onClick={() => setBooking(true)}
          aria-label={`Book the job for re-clean ${record.reCleanId}`}>
          Book the job
        </Button>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date" aria-label={`Date for re-clean ${record.reCleanId}`}
          value={jobDate} onChange={e => setJobDate(e.target.value)} className="w-auto"
        />
        <Button
          type="button" size="sm" disabled={busy || !jobDate}
          onClick={() => run(() => bookReClean({ id: record.id, jobDate }))}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Book, no charge'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setBooking(false)} disabled={busy}>Cancel</Button>
      </div>
    );
  }

  return null;
}

