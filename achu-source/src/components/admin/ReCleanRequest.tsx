/**
 * §30 (Sesiunea 144) — DE UNDE SE CERE O RE-CURĂȚENIE.
 *
 * ⛔ **Cererea pornește MEREU de la o vizită anume**, alesă de un om. ⚠️ Asta e „DISCRETIONARY" în
 * formă de ecran: nu există niciun drum prin care o reclamație sau o notă mică să ajungă aici
 * singură, iar cine cere trebuie să spună **care** curățenie nu a ieșit bine.
 *
 * ⛔ **Fișier propriu, nu un bloc în pagină** (`AGENT_RULES` §9): are căutarea de vizite și patru
 * câmpuri ale lui.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getJobsForSelect, type JobForSelect } from '@/lib/jobEndpoints';
import { requestReClean, RECLEAN_SOURCES, CLEANER_PREFERENCES, type ReCleanSource, type CleanerPreference } from '@/lib/reCleanEndpoints';
import { errMsg } from '@/lib/errorMessage';

const SOURCE_LABEL: Record<ReCleanSource, string> = {
  Customer: 'The customer told us',
  Admin: 'The office spotted it',
  QualityCheck: 'A quality check found it',
};

const PREF_LABEL: Record<CleanerPreference, string> = {
  NoPreference: 'Whoever is free',
  Same: 'The same cleaner',
  Different: 'A different cleaner',
};

export default function ReCleanRequest({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [jobs, setJobs] = useState<JobForSelect[]>([]);
  const [jobId, setJobId] = useState('');
  const [source, setSource] = useState<ReCleanSource>('Customer');
  const [reason, setReason] = useState('');
  const [pref, setPref] = useState<CleanerPreference>('NoPreference');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * ⚠️ **Căutarea se face pe SERVER** (`/jobs/for-select`), nu prin filtrarea unei liste încărcate
   * întreagă: aceea e forma care se oprește când numărul de vizite crește (lecția Sesiunii 28).
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
    if (!jobId || !reason.trim() || saving) return;
    setSaving(true);
    try {
      await requestReClean({
        originalJobId: jobId,
        source,
        reason: reason.trim(),
        cleanerPreference: pref,
        dueDate: dueDate || null,
      });
      setOpen(false); setJobId(''); setReason(''); setDueDate(''); setSearch('');
      setSource('Customer'); setPref('NoPreference');
      onCreated();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el dă exemplele de motiv, sau spune că mai e una deschisă.
      toast.error(errMsg(e) || 'Could not raise that.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" aria-hidden="true" />Raise a re-clean
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border p-3">
      <div>
        <Label htmlFor="rc-search" className="text-xs">Which job went wrong?</Label>
        <Input
          id="rc-search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer or job number"
        />
        <select
          aria-label="The job that went wrong"
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
        <Label htmlFor="rc-reason" className="text-xs">What was wrong?</Label>
        <Textarea
          id="rc-reason" rows={2} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="The bathroom was not touched."
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor="rc-source" className="text-xs">How did we find out?</Label>
          <select
            id="rc-source" className="w-full rounded-md border bg-background px-2 py-2 text-sm"
            value={source} onChange={e => setSource(e.target.value as ReCleanSource)}
          >
            {RECLEAN_SOURCES.map(v => <option key={v} value={v}>{SOURCE_LABEL[v]}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="rc-pref" className="text-xs">Who should go?</Label>
          <select
            id="rc-pref" className="w-full rounded-md border bg-background px-2 py-2 text-sm"
            value={pref} onChange={e => setPref(e.target.value as CleanerPreference)}
          >
            {CLEANER_PREFERENCES.map(v => <option key={v} value={v}>{PREF_LABEL[v]}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="rc-due" className="text-xs">Wanted by (optional)</Label>
          <Input id="rc-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      {/* 🔴 Spus ÎNAINTE de a apăsa: cine ridică cererea trebuie să știe că nu hotărăște el, și că
          nu promite nimic clientului. ⚠️ Fără propoziția asta, cineva ar spune clientului „vă
          trimitem pe cineva" în timp ce cererea abia așteaptă o hotărâre. */}
      <p className="text-[11px] text-muted-foreground">
        This asks for a re-clean; it does not agree to one. Nothing is promised to the customer until
        it has been approved.
      </p>

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!jobId || !reason.trim() || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Raise it'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

