/**
 * §31 (Sesiunea 145) — VERDICTUL, pe ecran.
 *
 * ─── 🔴 CE FACE ECRANUL ĂSTA CA SĂ NU SE MINTĂ ───────────────────────────────
 * 1. **Arată CÂT e de privit** — „6 photos · 12 checklist points" — fiindcă bifa „am privit pozele"
 *    nu se poate pune cinstit fără să știi dacă erau zero sau douăzeci.
 * 2. **Nota e a BIROULUI, nu o a doua cifră.** Scrie pe ecran că e aceeași cu cea din §36, ca nimeni
 *    să nu caute „unde se pune scorul de QA".
 * 3. **Un „nu a trecut" cere două propoziții** — ce s-a văzut și ce se face. Butonul stă stins până
 *    sunt amândouă, iar serverul refuză oricum (regula e acolo, nu aici).
 * 4. ⛔ **Spune că nu se mai poate schimba**, ÎNAINTE de a fi apăsat.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { recordQualityCheck, type QualityCheckRecord } from '@/lib/qualityCheckEndpoints';
import { errMsg } from '@/lib/errorMessage';

const SCORES = [1, 2, 3, 4, 5] as const;

export default function QualityCheckVerdict({ record, onDone }: {
  record: QualityCheckRecord;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<'Passed' | 'Failed'>('Passed');
  const [score, setScore] = useState('4');
  const [photos, setPhotos] = useState(false);
  const [checklist, setChecklist] = useState(false);
  const [findings, setFindings] = useState('');
  const [action, setAction] = useState('');
  const [saving, setSaving] = useState(false);

  /** ⚠️ Doar ce așteaptă să fie privit are buton. Un verdict dat nu se re-deschide. */
  if (record.status !== 'Required') return null;

  const failedIncomplete = outcome === 'Failed' && (!findings.trim() || !action.trim());

  const save = async () => {
    if (failedIncomplete || saving) return;
    setSaving(true);
    try {
      await recordQualityCheck({
        id: record.id,
        outcome,
        score: Number(score),
        photosReviewed: photos,
        checklistReviewed: checklist,
        findings: findings.trim() || null,
        correctiveAction: action.trim() || null,
      });
      setOpen(false);
      onDone();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el dă exemplele, sau spune că verdictul e deja dat.
      toast.error(errMsg(e) || 'Could not record that.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Record what you saw
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border p-3">
      {/* 🔴 Cât e de privit. Fără cifrele astea, bifele de mai jos sunt o formalitate. */}
      <p className="text-[11px] text-muted-foreground">
        {`On this job: ${record.photoCount} photo(s) · ${record.checklistCount} checklist point(s)`}
        {record.customerScore !== null && ` · the customer gave it ${record.customerScore}/5`}
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Did this job pass?">
        {(['Passed', 'Failed'] as const).map(v => (
          <button
            key={v}
            type="button"
            aria-pressed={outcome === v}
            onClick={() => setOutcome(v)}
            className={`min-h-[36px] rounded-full border px-3 text-xs ${
              outcome === v ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'
            }`}
          >
            {v === 'Passed' ? 'It was fine' : 'It was not good enough'}
          </button>
        ))}
      </div>

      <div>
        {/* 🔴 Aceeași notă ca a biroului, și scrie asta pe ea. */}
        <Label htmlFor="qv-score" className="text-xs">Office score (the same one as on the job)</Label>
        <select
          id="qv-score" className="w-full rounded-md border bg-background px-2 py-2 text-sm"
          value={score} onChange={e => setScore(e.target.value)}
        >
          {SCORES.map(s => <option key={s} value={String(s)}>{s} / 5</option>)}
        </select>
      </div>

      {/* ⚠️ Bifele spun ce a PRIVIT omul, nu ce exista. Nebifat = nu s-a uitat. */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={photos} onChange={e => setPhotos(e.target.checked)} />
          I looked at the photographs
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={checklist} onChange={e => setChecklist(e.target.checked)} />
          I looked at the checklist
        </label>
      </div>

      <div>
        <Label htmlFor="qv-findings" className="text-xs">
          {outcome === 'Failed' ? 'What was wrong?' : 'What did you see? (optional)'}
        </Label>
        <Textarea
          id="qv-findings" rows={2} value={findings} onChange={e => setFindings(e.target.value)}
          placeholder="The bathroom floor was not touched."
        />
      </div>

      {/* 🔴 Doar la „nu a trecut", și obligatoriu: fără el, o verificare picată e o fișă de notare. */}
      {outcome === 'Failed' && (
        <div>
          <Label htmlFor="qv-action" className="text-xs">What is being done about it?</Label>
          <Textarea
            id="qv-action" rows={2} value={action} onChange={e => setAction(e.target.value)}
            placeholder="Spoke to her, going back on Friday."
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            “Spoke to her” is a real answer. A failed check with nothing after it is just a score.
            {/* ⛔ Și de ce NU e un buton „cere re-curățenie" aici: hotărârea e discreționară. */}
            {' '}If it needs a free re-clean, that is asked for on the Re-cleans screen — it is a
            decision somebody makes, not something this screen does.
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Once recorded this cannot be edited — if it was wrong, the next job gets a new check.
      </p>

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={failedIncomplete || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Record it'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

