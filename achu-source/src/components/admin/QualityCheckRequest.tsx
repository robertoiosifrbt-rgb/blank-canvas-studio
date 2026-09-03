/**
 * §31 (Sesiunea 145) — DE UNDE AJUNGE O VIZITĂ PE LISTA DE VERIFICAT.
 *
 * Două drumuri, amândouă apăsate de un om: **vizita asta** (aici) și **trage la sorți**
 * (`QualityCheckSample.tsx`). ⛔ Nu există al treilea: nicio notă mică și nicio reclamație nu pune
 * nimic pe listă singură — cine vrea o verificare o cere.
 *
 * ⛔ **Fișier propriu, nu un bloc în pagină** (`AGENT_RULES` §9): are căutarea de vizite a lui.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getJobsForSelect, type JobForSelect } from '@/lib/jobEndpoints';
import { requestQualityCheck } from '@/lib/qualityCheckEndpoints';
import { errMsg } from '@/lib/errorMessage';

export default function QualityCheckRequest({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [jobs, setJobs] = useState<JobForSelect[]>([]);
  const [jobId, setJobId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * ⚠️ **Căutarea se face pe SERVER** (`/jobs/for-select`), nu prin filtrarea unei liste încărcate
   * întreagă — aceeași alegere ca la cererea de re-curățenie.
   */
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      try {
        const res = await getJobsForSelect(search.trim() ? { search: search.trim() } : {});
        if (alive) setJobs(res.jobs.slice(0, 25));
      } catch { /* lista rămâne cum e; câmpul de căutare spune restul */ }
    })();
    return () => { alive = false; };
  }, [open, search]);

  const save = async () => {
    if (!jobId || saving) return;
    setSaving(true);
    try {
      await requestQualityCheck({ jobId, requestedNote: note.trim() || null });
      setOpen(false); setJobId(''); setNote(''); setSearch('');
      onCreated();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune dacă vizita e deja pe listă, sau deja verificată.
      toast.error(errMsg(e) || 'Could not put that on the list.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" aria-hidden="true" />Check a job
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border p-3">
      <div>
        <Label htmlFor="qc-search" className="text-xs">Which job should somebody look at?</Label>
        <Input
          id="qc-search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer or job number"
        />
        <select
          aria-label="The job to check"
          className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
          value={jobId}
          onChange={e => setJobId(e.target.value)}
        >
          <option value="">Choose the job…</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>
              #{j.jobId} · {j.customerName} · {j.jobDate} · {j.service}
            </option>
          ))}
        </select>
      </div>

      <div>
        {/* ⚠️ **Opțional, și scrie asta pe el:** „uită-te la asta" fără explicație e o cerere validă,
            iar un câmp obligatoriu ar fi făcut pe cineva să inventeze un motiv. */}
        <Label htmlFor="qc-note" className="text-xs">Why this one? (optional)</Label>
        <Textarea
          id="qc-note" rows={2} value={note} onChange={e => setNote(e.target.value)}
          placeholder="She said last time felt rushed."
        />
      </div>

      {/* 🔴 Spus ÎNAINTE de a apăsa: cine cere verificarea nu e cine o face, iar nimic din ea nu
          ajunge la client sau la curățător. */}
      <p className="text-[11px] text-muted-foreground">
        This puts the job on the list to be looked at. It does not score anything by itself, and
        nothing here reaches the customer or the cleaner.
      </p>

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!jobId || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Put it on the list'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

