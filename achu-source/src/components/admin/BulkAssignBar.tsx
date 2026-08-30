/**
 * §41 „Bulk operations" (Sesiunea 148, extinsă în 150) — **BARA DE SELECȚIE: PREVIZUALIZARE,
 * EXPORT, ȘI LUAREA ÎNAPOI.**
 *
 * ─── 🔴 CE FACE DIFERENȚA ÎNTRE ASTA ȘI CINCIZECI DE CLICKURI ───────────────────────────────
 * Nu viteza. **Ce se vede înainte de apăsare.** ⛔ Un buton „Assign" care doar aplică ar fi
 * transformat avertismentul de pe ecranul unei vizite — *„clientul a cerut să nu-l trimitem"*
 * (ACHU-554) — în ceva ce se poate ocoli în masă. ✅ Deci: două pași, iar primul nu scrie nimic.
 *
 * ⚠️ **Fișier propriu** (`AGENT_RULES` §9): scrie, are refuzuri proprii și un dialog. Lista de
 * vizite (`JobsPage`) doar ține selecția.
 *
 * 🆕 **Sesiunea 150 — două lucruri, pe aceeași selecție:** „Export CSV" (aceleași coloane ca tabelul,
 * calculate de aceeași funcție de pe server) și **„Undo"** în fereastra rezultatului. ⛔ Butonul de
 * luare înapoi stă acolo fiindcă momentul în care se vede greșeala e chiar acela — un „undo" ascuns
 * într-un istoric ar ajunge după ce curățătorul a plecat spre client.
 *
 * ⚠️ **Doar pe ecranul lat.** Nu din lene: o selecție de douăzeci de căsuțe pe un telefon e o
 * greșeală așteptând să se întâmple, iar munca asta se face la birou. ⛔ Iar pe telefon bara **nu
 * apare deloc** — nu e ascunsă „într-un meniu", care ar fi fost varianta care se uită.
 */
import { useEffect, useState } from 'react';
import { Loader2, Users, X, AlertTriangle, Download, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCleaners, CleanerRecord } from '@/lib/cleanerEndpoints';
import {
  previewBulkAssign, applyBulkAssign, undoBulkAssign, exportSelectedVisits,
  BulkAssignPreview, BulkAssignResult, BulkUndoResult,
  previewBulkStatus, applyBulkStatus, type BulkStatusPlan,
} from '@/lib/bulkAssignEndpoints';
import { errMsg } from '@/lib/errorMessage';

/**
 * Starile pe care le ofera bara.
 *
 * `Completed` si `Cancelled` lipsesc DINADINS - se pun pe vizita, unde exista toate intrebarile
 * (checklist, ora de final, taxa de anulare, notificarea clientului). Serverul le refuza oricum,
 * cu motivul scris: lista de aici e comoditate, nu regula.
 */
const BULK_STATUS_CHOICES = ['Enquiry', 'Booked', 'Confirmed', 'In Progress', 'Completion Review', 'No Access'] as const;

export default function BulkAssignBar({ selectedIds, onClear, onDone }: {
  selectedIds: string[];
  onClear: () => void;
  /** Chemat după o aplicare reușită, ca lista de vizite să se recitească. */
  onDone: () => void;
}) {
  const [cleaners, setCleaners] = useState<CleanerRecord[]>([]);
  const [cleanerId, setCleanerId] = useState('');
  const [preview, setPreview] = useState<BulkAssignPreview | null>(null);
  const [result, setResult] = useState<BulkAssignResult | null>(null);
  const [undone, setUndone] = useState<BulkUndoResult | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * NOU §41 "Bulk change status" (Sesiunea 157) - starea in care se mutá vizitele bifate.
   *
   * Doua stari NU se pun in masa si serverul le refuza cu motivul scris: `Completed` (poarta de
   * checklist, ora de final, uneori se rezolva in `Completion Review`) si `Cancelled` (taxa de
   * anulare promisa in scris + notificarea clientului). Lista de aici NU le ofera, dar refuzul
   * serverului rámâne singura regula - ecranul nu-si scrie propria copie.
   */
  const [statusTarget, setStatusTarget] = useState('');
  const [statusPlan, setStatusPlan] = useState<BulkStatusPlan | null>(null);
  const [statusApplied, setStatusApplied] = useState(false);

  useEffect(() => {
    /**
     * ⚠️ **Doar cei ACTIVI în listă**, fiindcă serverul refuză oricum un inactiv — iar un nume în
     * dropdown care întoarce un refuz e o promisiune ruptă. ⛔ Eșecul se spune, nu se înghite: un
     * dropdown gol fără explicație arată ca o aplicație stricată.
     */
    getCleaners({})
      .then(res => setCleaners(res.records.filter(c => c.active)))
      .catch(e => toast.error(errMsg(e)));
  }, []);

  if (selectedIds.length === 0) return null;

  const runPreview = async () => {
    if (!cleanerId) { toast.error('Pick the cleaner first — the preview is about a specific person.'); return; }
    setBusy(true);
    try {
      setResult(null);
      setPreview(await previewBulkAssign({ jobIds: selectedIds, cleanerId }));
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const runApply = async () => {
    setBusy(true);
    try {
      const res = await applyBulkAssign({ jobIds: selectedIds, cleanerId });
      setResult(res);
      setUndone(null);
      setPreview(null);
      onDone();
      /**
       * ⚠️ Confirmarea spune **cifra**, nu „gata": „12 asignate, 3 sărite" e ce se verifică. ⛔ Iar
       * dacă ceva a eșuat, tonul nu e de succes — lista rămâne pe ecran ca să se poată reia.
       */
      if (res.summary.failed > 0) {
        toast.warning(`${res.summary.assigned} assigned, ${res.summary.failed} could not be done.`);
      } else {
        toast.success(`${res.summary.assigned} assigned to ${res.cleanerName}.`);
      }
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  /**
   * 🔴 §41 „Undo where safe" (Sesiunea 150) — **se ia înapoi ce s-a FĂCUT, nu ce e bifat.**
   *
   * ⛔ `result.lines`, filtrat pe cele chiar asignate — nu `selectedIds`. ⚠️ Între apăsări selecția se
   * poate schimba, iar un „undo" care ar citi bifele ar scoate omul de pe vizite pe care nu i le-a
   * pus operația asta. 🔴 Iar cele sărite („era deja asignat") **nu** intră: acelea existau înainte,
   * deci nu sunt ale acestei operații.
   */
  const runUndo = async () => {
    if (!result) return;
    const jobIds = result.lines.filter(l => l.verdict === 'assign').map(l => l.id);
    if (jobIds.length === 0) return;
    setBusy(true);
    try {
      const res = await undoBulkAssign({ jobIds, cleanerId });
      setUndone(res);
      onDone();
      if (res.summary.refused > 0) {
        toast.warning(`${res.summary.undone} taken back, ${res.summary.refused} could not be.`);
      } else {
        toast.success(`${res.summary.undone} taken back off ${res.cleanerName}.`);
      }
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  /**
   * §41 „Bulk export" (Sesiunea 150) — ⚠️ **fără curățător ales:** exportul e despre vizitele bifate,
   * nu despre o persoană, deci butonul lucrează și când dropdown-ul e gol.
   */
  const runExport = async () => {
    setBusy(true);
    try {
      await exportSelectedVisits({ jobIds: selectedIds });
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const runStatusPreview = async () => {
    if (!statusTarget) { toast.error('Pick the status first - the check is about a specific one.'); return; }
    setBusy(true);
    try {
      setStatusApplied(false);
      setStatusPlan(await previewBulkStatus({ jobIds: selectedIds, status: statusTarget }));
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const runStatusApply = async () => {
    setBusy(true);
    try {
      const res = await applyBulkStatus({ jobIds: selectedIds, status: statusTarget });
      setStatusPlan(res);
      setStatusApplied(true);
      onDone();
      /** Confirmarea spune CIFRA, nu "gata" - inclusiv cele sarite si cele care nu mai exista. */
      if (res.summary.missing > 0) toast.warning(res.summary.summary);
      else toast.success(res.summary.summary);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const closeStatusDialog = () => { setStatusPlan(null); setStatusApplied(false); };

  const closeDialog = () => { setPreview(null); setResult(null); setUndone(null); };

  return (
    <>
      <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 mb-3">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">
          {selectedIds.length} job{selectedIds.length === 1 ? '' : 's'} selected
        </span>
        <select
          value={cleanerId}
          onChange={e => setCleanerId(e.target.value)}
          aria-label="Cleaner to assign"
          className="ml-2 rounded border bg-background px-2 py-1 text-sm"
        >
          <option value="">Choose a cleaner…</option>
          {cleaners.map(c => <option key={c.id} value={c.id}>{c.cleanerName}</option>)}
        </select>
        <Button size="sm" onClick={() => void runPreview()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          Check first
        </Button>
        {/*
          §41 „Bulk export" (Sesiunea 150) — ⚠️ lângă „Check first", nu într-un meniu: exportă EXACT
          ce e bifat, deci butonul are sens doar acolo unde se vede selecția.
          ⛔ Aceleași coloane ca tabelul, calculate de aceeași funcție (`lib/jobListRows.ts`).
        */}
        <Button size="sm" variant="outline" onClick={() => void runExport()} disabled={busy}>
          <Download className="h-3.5 w-3.5 mr-1" />Export CSV
        </Button>
        {/*
          NOU §41 (Sesiunea 157) - starea, cu propriul buton de verificare: se schimba ALTCEVA decat
          asignarea, deci nu se amesteca in acelasi "Check first". Cele doua stari care nu se pun in
          masa nu apar in lista, iar serverul le refuza oricum, cu motivul.
        */}
        <select
          value={statusTarget}
          onChange={e => setStatusTarget(e.target.value)}
          aria-label="Status to set"
          className="ml-2 rounded border bg-background px-2 py-1 text-sm"
        >
          <option value="">Change status to...</option>
          {BULK_STATUS_CHOICES.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => void runStatusPreview()} disabled={busy}>
          Check status change
        </Button>
        <button onClick={onClear} className="ml-auto p-1 rounded hover:bg-muted" aria-label="Clear the selection" title="Clear the selection">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={statusPlan !== null} onOpenChange={open => { if (!open) closeStatusDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {statusApplied ? 'What happened' : `Move these jobs to ${statusPlan?.status ?? ''}?`}
            </DialogTitle>
          </DialogHeader>
          {statusPlan && (
            <div className="space-y-3">
              {/* Propozitia vine de la server: acolo se numara ce se schimba, ce e deja acolo, ce a dispărut. */}
              <p className="text-sm font-medium">{statusPlan.summary.summary}</p>
              <ul className="max-h-56 overflow-auto text-xs space-y-0.5">
                {statusPlan.lines.map(l => (
                  <li key={l.jobId} className={l.action === 'change' ? '' : 'text-muted-foreground'}>
                    {l.jobNumber ? `Job #${l.jobNumber}` : l.jobId}
                    {l.customerName ? ` - ${l.customerName}` : ''}
                    {l.fromStatus ? ` (${l.fromStatus})` : ''}
                    {l.note ? ` - ${l.note}` : ''}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={closeStatusDialog} disabled={busy}>
                  {statusApplied ? 'Close' : 'Cancel'}
                </Button>
                {!statusApplied && (
                  <Button size="sm" onClick={() => void runStatusApply()} disabled={busy || statusPlan.summary.changed === 0}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                    Change {statusPlan.summary.changed} job{statusPlan.summary.changed === 1 ? '' : 's'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={preview !== null || result !== null} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {result ? 'What happened' : `Assign ${preview?.cleanerName ?? ''} to these jobs?`}
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{preview.summary.toAssign}</strong> will be assigned
                {preview.summary.skipped > 0 && <>, <strong>{preview.summary.skipped}</strong> skipped</>}.
              </p>
              {/**
                * 🔴 Avertismentele SUS și numărate. ⛔ Pierdute printre patruzeci de rânduri, ar fi
                * fost ca și inexistente — iar ăsta e chiar avertismentul pe care o operație în masă
                * l-ar fi putut ocoli.
                */}
              {preview.summary.warnings > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1">
                  <p className="flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {preview.summary.warnings} of these customers said something about this cleaner
                  </p>
                  {preview.lines.filter(l => l.warning).map(l => (
                    <p key={l.id} className="text-xs text-amber-800 dark:text-amber-300">{l.label}: {l.warning}</p>
                  ))}
                </div>
              )}
              <ul className="max-h-56 overflow-auto text-xs space-y-0.5">
                {preview.lines.map(l => (
                  <li key={l.id} className={l.verdict === 'assign' ? '' : 'text-muted-foreground'}>{l.label}</li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={closeDialog} disabled={busy}>Cancel</Button>
                <Button size="sm" onClick={() => void runApply()} disabled={busy || preview.summary.toAssign === 0}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Assign {preview.summary.toAssign}
                </Button>
              </div>
            </div>
          )}

          {result && !undone && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{result.summary.assigned}</strong> assigned
                {result.summary.skipped > 0 && <>, {result.summary.skipped} skipped</>}
                {result.summary.failed > 0 && <>, <strong>{result.summary.failed}</strong> could not be done</>}.
              </p>
              {/* ⛔ Rândurile care NU s-au făcut rămân pe ecran, cu motivul: fără ele, „12 din 20"
                  nu se poate relua. */}
              <ul className="max-h-56 overflow-auto text-xs space-y-0.5">
                {result.lines.filter(l => l.verdict === 'failed' || l.verdict === 'missing').map(l => (
                  <li key={l.id} className="text-destructive">{l.label}</li>
                ))}
              </ul>
              <div className="flex justify-between gap-2">
                {/*
                  🔴 §41 „Undo where safe" (Sesiunea 150) — **butonul stă AICI, în fereastra
                  rezultatului, și nu altundeva.** ⛔ Momentul în care se vede greșeala („l-am pus pe
                  cine nu trebuia") e chiar ăsta; un „undo" ascuns într-un istoric ar fi ajuns prea
                  târziu, când curățătorul e deja pe drum.
                  ⚠️ Serverul refuză pe rând ce nu se poate lua înapoi (vizită începută, ore
                  înregistrate) — ecranul nu ghicește nimic, arată ce a spus el.
                */}
                <Button
                  size="sm" variant="outline"
                  onClick={() => void runUndo()}
                  disabled={busy || result.summary.assigned === 0}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Undo2 className="h-3.5 w-3.5 mr-1" />}
                  Undo these {result.summary.assigned}
                </Button>
                <Button size="sm" onClick={() => { closeDialog(); onClear(); }}>Done</Button>
              </div>
            </div>
          )}

          {undone && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{undone.summary.undone}</strong> taken back off {undone.cleanerName}
                {undone.summary.nothingToUndo > 0 && <>, {undone.summary.nothingToUndo} were not theirs any more</>}
                {undone.summary.refused > 0 && <>, <strong>{undone.summary.refused}</strong> could not be</>}.
              </p>
              {/* ⛔ Ce NU s-a putut lua înapoi rămâne pe ecran CU MOTIVUL — altfel „17 din 20" nu
                  spune pe care trei trebuie să se uite un om. */}
              <ul className="max-h-56 overflow-auto text-xs space-y-0.5">
                {undone.lines.filter(l => l.verdict !== 'undone').map(l => (
                  <li key={l.id} className={l.verdict === 'refused' || l.verdict === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
                    {l.label}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { closeDialog(); onClear(); }}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

