import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect, useRef } from 'react';
import { saveCleaner, getTeams, type CleanerRecord, type TeamRecord } from '@/lib/endpoints';
// 🆕 §13 (Sesiunea 158) — zilele obișnuite de lucru; etichetele și ordinea, într-un singur loc.
import { WORKING_DAYS, daysFromText, daysToText, toggleDay } from '@/lib/workingDays';
import { toast } from 'sonner';
import AuditHistory from './AuditHistory';
import CleanerDocumentsSection from './CleanerDocumentsSection';
import DiscardChangesDialog from '../shared/DiscardChangesDialog';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import { errMsg } from '@/lib/errorMessage';

export default function CleanerFormDialog({ open, onClose, item, onSaved }: {
  open: boolean; onClose: () => void;
  /** `null` la creare. ACHU-401 (felia 16): forma vine de la funcția care produce rândul. */
  item: CleanerRecord | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    cleanerName: '', phone: '', email: '', active: true, notes: '', teamId: '',
    /** 🆕 §13 (Sesiunea 158) — programul obișnuit. ⚠️ Zilele ca listă de numere, orele ca „HH:MM". */
    workingDays: [] as number[], standardStartTime: '', standardFinishTime: '',
  });
  /**
   * 🆕 §26 „Profit by team" B (Sesiunea 154) — echipele, pentru selector.
   * ⚠️ Doar cele ACTIVE: ruta refuză oricum să pună un om într-o echipă dezactivată, deci o listă
   * care le-ar arăta ar oferi o alegere care se termină în eroare.
   */
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const revisionRef = useRef<string | undefined>(undefined);
  // Sesiunea 29 (backlog 46): guard against losing typed edits on a stray close.
  const guard = useUnsavedGuard({ onClose });
  guard.track(form);

  useEffect(() => {
    if (item) {
      const initial = { cleanerName: item.cleanerName ?? '', phone: item.phone ?? '', email: item.email ?? '', active: item.active ?? true, notes: item.notes ?? '', teamId: item.teamId ?? '',
        workingDays: daysFromText(item.standardWorkingDays), standardStartTime: item.standardStartTime ?? '', standardFinishTime: item.standardFinishTime ?? '' };
      setForm(initial);
      guard.captureBaseline(initial);
      revisionRef.current = computeRevision(item, REVISION_FIELDS.cleaner);
    } else {
      const initial = { cleanerName: '', phone: '', email: '', active: true, notes: '', teamId: '',
        workingDays: [] as number[], standardStartTime: '', standardFinishTime: '' };
      setForm(initial);
      guard.captureBaseline(initial);
      revisionRef.current = undefined;
    }
  }, [item, open]);

  /**
   * ⚠️ Lista se cere doar când dialogul e deschis, iar un eșec **nu blochează salvarea**: echipa e
   * un câmp opțional, deci o listă care n-a venit lasă selectorul gol în loc să oprească editarea.
   */
  useEffect(() => {
    if (!open) return;
    getTeams().then(r => setTeams(r.records)).catch(() => setTeams([]));
  }, [open]);

  const handleSave = async () => {
    if (!form.cleanerName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const result = await saveCleaner({
        ...form,
        /** ⚠️ Șirul gol al selectorului înseamnă „fără echipă", adică `null` — nu „nu atinge". */
        teamId: form.teamId || null,
        /**
         * 🆕 §13 (Sesiunea 158) — aceeași convenție: gol = `null` = „șterge ce era scris".
         * ⛔ `workingDays` nu pleacă așa cum e ținut pe ecran (o listă): baza ține text.
         */
        standardWorkingDays: daysToText(form.workingDays) || null,
        standardStartTime: form.standardStartTime || null,
        standardFinishTime: form.standardFinishTime || null,
        workingDays: undefined,
        id: item?.id,
        _revision: revisionRef.current,
      });
      // ACHU-047: Show audit warning if present
      if (result.auditWarning) {
        console.warn('[CleanerFormDialog] Audit warning:', result.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(item ? 'Cleaner updated' : 'Cleaner created');
      }
      setAuditRefreshKey(k => k + 1);
      guard.markSaved();
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to save cleaner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && guard.requestClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Cleaner' : 'New Cleaner'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="cleanerfor-cleaner-name">Cleaner Name *</Label><Input id="cleanerfor-cleaner-name" value={form.cleanerName} onChange={e => setForm(f => ({ ...f, cleanerName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="cleanerfor-phone">Phone</Label><Input id="cleanerfor-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label htmlFor="cleanerfor-email">Email</Label><Input id="cleanerfor-email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          {/**
            * 🆕 §26 „Profit by team" B (Sesiunea 154) — echipa. Hotărârea lui Roberto: una singură.
            * ⚠️ `<select>` simplu, ca la celelalte câmpuri ale acestui dialog; ⛔ nu se ascunde când
            * nu există nicio echipă — atunci spune de ce e gol, altfel arată ca un câmp defect.
            */}
          <div>
            <Label htmlFor="cleanerfor-team">Team</Label>
            <select
              id="cleanerfor-team"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.teamId}
              onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
            >
              <option value="">No team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {teams.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">No teams yet — add one under Team → Teams.</p>
            )}
          </div>
          {/**
            * ─── 🆕 §13 „Standard working days" + „Standard working hours" (Sesiunea 158) ──────
            * 🔴 **Ce lipsea, măsurat:** raportul de vizite a trebuit să scrie pe ecran că tabelul lui
            * pe zile e „cerere, nu capacitate", fiindcă nimic din bază nu spunea cine e disponibil
            * când. ⛔ **Nu blochează nimic** — e ce a scris biroul despre programul obișnuit al
            * omului, iar ecranul de asignare îl **arată** înainte de apăsare, nu refuză.
            * ⚠️ Gol e o stare normală: „nimeni nu a scris", nu „nu lucrează".
            */}
          <div>
            <Label>Usual working days</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {WORKING_DAYS.map(d => {
                const on = form.workingDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.long}
                    onClick={() => setForm(f => ({ ...f, workingDays: toggleDay(f.workingDays, d.value) }))}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >{d.short}</button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cleanerfor-start">Usual start</Label>
                <Input id="cleanerfor-start" type="time" value={form.standardStartTime} onChange={e => setForm(f => ({ ...f, standardStartTime: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cleanerfor-finish">Usual finish</Label>
                <Input id="cleanerfor-finish" type="time" value={form.standardFinishTime} onChange={e => setForm(f => ({ ...f, standardFinishTime: e.target.value }))} />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used to flag a job put on someone outside their usual days. It never blocks an assignment.
            </p>
          </div>
          <div className="flex items-center gap-2"><Checkbox id="cleanerfor-active" checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))} /><Label htmlFor="cleanerfor-active">Active</Label></div>
          <div><Label htmlFor="cleanerfor-notes">Notes</Label><Textarea id="cleanerfor-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          {/**
            * §33 + §14 — hârtiile omului. ⛔ Doar la EDITARE: un document are nevoie de o fișă
            * existentă sub care să stea, iar fișa nu există până nu e salvată.
            */}
          {item?.id && <CleanerDocumentsSection cleanerId={item.id} />}
          {item?.id && <AuditHistory entityType="Cleaner" entityId={item.id} refreshKey={auditRefreshKey} />}
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogContent>
      <DiscardChangesDialog open={guard.confirmOpen} onDiscard={guard.discard} onKeepEditing={guard.keepEditing} />
    </Dialog>
  );
}

