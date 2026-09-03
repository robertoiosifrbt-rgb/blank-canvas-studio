/**
 * 🔴 §29 (Sesiunea 150) — **DOSARUL UNUI INCIDENT, pe ecranul biroului.**
 *
 * ─── Ce lipsea ──────────────────────────────────────────────────────────────
 * Registrul știa să **deschidă** un incident (ce, când, cât de grav, pe cine) și să-l **închidă**
 * (un rezultat scris). ⛔ Între cele două nu exista loc pentru ce a făcut de fapt firma: cine a
 * văzut, ce s-a făcut pe loc, ce s-a aflat după, ce s-a schimbat ca să nu se repete, cât a costat,
 * cine duce dosarul. ⚠️ Peste șase luni, când întreabă asigurătorul sau HSE, „închis cu un
 * rezultat" nu e un dosar — iar lucrurile de mai sus nu se mai pot reconstitui atunci.
 *
 * ─── ⛔ De ce un fișier propriu ─────────────────────────────────────────────
 * `IncidentsPage.tsx` e la 343 de rânduri de cod față de un plafon de 500, iar dosarul are opt
 * câmpuri și stare de formular proprie. ⚠️ Lipit în pagină, ar fi împins fișierul spre prag în
 * aceeași felie (`AGENT_RULES` §7.4) — la fel ca galeria de dovezi, care a plecat în §32.
 *
 * ─── ⚠️ Ce NU face ─────────────────────────────────────────────────────────
 * ⛔ **Nu cere nimic.** Toate câmpurile sunt opționale și nimic nu se blochează fiindcă unul
 * lipsește; ce lipsește se **numără** în panoul de sus, cum se numără deja bifa de raportare.
 * 🔴 **Suma nu e un ban:** nu se scade din nimic, nu se adaugă pe nicio vizită, nu ajunge la
 * client. Propoziția o spune pe ecran, ca nimeni să nu presupună altceva.
 */
import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveIncidentDossier, type IncidentRecord, type IncidentDossierPatch } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fmt } from '@/lib/format';

/**
 * Cele cinci câmpuri de text, cu întrebarea pusă în cuvintele biroului.
 *
 * ⚠️ **Întrebări, nu titluri de rubrică** („Investigation"): un om care vede „What we found out"
 * știe ce să scrie, unul care vede „Investigation" se întreabă cât de oficial trebuie să sune.
 */
const TEXT_FIELDS = [
  { key: 'immediateAction', label: 'What we did straight away', rows: 2, max: 2000 },
  { key: 'witnesses', label: 'Who saw it', rows: 2, max: 2000 },
  { key: 'investigation', label: 'What we found out', rows: 3, max: 4000 },
  { key: 'correctiveAction', label: 'What we put right', rows: 2, max: 4000 },
  { key: 'preventiveAction', label: 'What we changed so it does not happen again', rows: 2, max: 4000 },
] as const;

type TextKey = typeof TEXT_FIELDS[number]['key'];

export default function IncidentDossier({ record, onSaved }: { record: IncidentRecord; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  /** ⚠️ Ce e scris ACUM în dosar, ca să se poată trimite doar diferența. */
  const current: Record<string, string> = {
    immediateAction: record.immediateAction ?? '',
    witnesses: record.witnesses ?? '',
    investigation: record.investigation ?? '',
    correctiveAction: record.correctiveAction ?? '',
    preventiveAction: record.preventiveAction ?? '',
    owner: record.owner ?? '',
    costAmount: record.costAmount === null ? '' : String(record.costAmount),
    costNote: record.costNote ?? '',
  };

  const value = (key: string) => draft[key] ?? current[key];
  const set = (key: string, v: string) => setDraft(d => ({ ...d, [key]: v }));

  const filled = TEXT_FIELDS.filter(f => current[f.key].trim()).length
    + (current.owner.trim() ? 1 : 0)
    + (current.costAmount ? 1 : 0);

  const dirty = Object.keys(draft).some(k => (draft[k] ?? '') !== current[k]);

  const save = async () => {
    setSaving(true);
    try {
      /**
       * 🔴 **Se trimite DOAR ce s-a schimbat.** ⛔ Trimis întreg, formularul ar fi șters ce a scris
       * altcineva în alt câmp între încărcare și salvare, iar cel de-al doilea nici nu ar afla.
       */
      const patch: IncidentDossierPatch = {};
      for (const key of Object.keys(draft)) {
        const next = (draft[key] ?? '').trim();
        if (next === current[key].trim()) continue;
        if (key === 'costAmount') {
          patch.costAmount = next === '' ? null : Number(next);
          continue;
        }
        (patch as Record<string, string | null>)[key] = next === '' ? null : next;
      }
      if (patch.costAmount !== undefined && patch.costAmount !== null && !Number.isFinite(patch.costAmount)) {
        toast.error('Give the cost as a number, or leave it empty.');
        return;
      }

      const res = await saveIncidentDossier(record.id, patch);
      // ⚠️ Mesajul spune CÂTE, nu „saved": biroul verifică des dacă a apăsat pe ce credea.
      toast.success(res.changed.length === 0 ? 'Nothing had changed.' : 'Record updated.');
      setDraft({});
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save the record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          The record
          {filled > 0 && <span className="font-normal">· {filled} of 7 filled in</span>}
        </p>
        <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>
          {open ? 'Hide' : filled > 0 ? 'Open the record' : 'Write the record'}
        </Button>
      </div>

      {/*
        ⚠️ **Închis, se arată ce E scris**, nu că există un dosar: cine trece cu ochii pe listă
        trebuie să vadă dacă s-a aflat ceva, fără să deschidă opt câmpuri.
      */}
      {!open && filled > 0 && (
        <div className="space-y-1">
          {TEXT_FIELDS.filter(f => current[f.key].trim()).map(f => (
            <p key={f.key} className="text-xs text-muted-foreground">
              <span className="font-medium">{f.label}:</span>{' '}
              <span className="whitespace-pre-wrap">{current[f.key]}</span>
            </p>
          ))}
          {current.owner.trim() && (
            <p className="text-xs text-muted-foreground"><span className="font-medium">Looked after by:</span> {current.owner}</p>
          )}
          {current.costAmount && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Cost to us:</span> {fmt(Number(current.costAmount))}
              {current.costNote.trim() ? ` — ${current.costNote}` : ''}
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="space-y-3 pt-1">
          {TEXT_FIELDS.map(f => (
            <div key={f.key}>
              <Label htmlFor={`dossier-${record.id}-${f.key}`} className="text-xs">
                {f.label} <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id={`dossier-${record.id}-${f.key}`}
                rows={f.rows}
                maxLength={f.max}
                value={value(f.key as TextKey)}
                onChange={e => set(f.key, e.target.value)}
              />
            </div>
          ))}

          <div>
            <Label htmlFor={`dossier-${record.id}-owner`} className="text-xs">
              Who is looking after this <span className="text-muted-foreground font-normal">(email, optional)</span>
            </Label>
            <Input
              id={`dossier-${record.id}-owner`}
              value={value('owner')}
              onChange={e => set('owner', e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={`dossier-${record.id}-cost`} className="text-xs">
              What it cost us <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id={`dossier-${record.id}-cost`}
                type="number"
                min={0}
                step="0.01"
                className="w-32"
                value={value('costAmount')}
                onChange={e => set('costAmount', e.target.value)}
              />
              <Input
                aria-label="What the cost was for"
                placeholder="What the money went on"
                value={value('costNote')}
                onChange={e => set('costNote', e.target.value)}
                maxLength={2000}
              />
            </div>
            {/*
              🔴 **Spune pe ecran ce NU e cifra.** Fără rândul ăsta, cine o completează poate crede
              că suma se facturează cuiva sau se scade de undeva. Nu atinge nimic: e registru.
            */}
            <p className="text-[11px] text-muted-foreground">
              Written down for the record only. Nothing is charged to anybody from this figure.
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setDraft({}); setOpen(false); }} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save the record'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

