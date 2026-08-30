/**
 * §33 + §14 (Sesiunea 146) — HÂRTIILE UNUI CURĂȚĂTOR, în fișa lui.
 *
 * ⛔ **Fișier propriu**, nu încă 150 de rânduri în `CleanerFormDialog.tsx` (`AGENT_RULES` §9): o
 * capabilitate nouă intră în fișierul ei, iar dialogul doar o cheamă.
 *
 * 🔴 **Propoziția care ține ecranul onest vine de la SERVER** (`audience`) și se afișează prima:
 * registrul spune ce s-a consemnat, **nu** că omul e în regulă. ⛔ Fără ea, primul om care vede o
 * listă de bife verzi citește „suntem în regulă" — iar lista nu a susținut niciodată asta, fiindcă
 * nimeni nu a stabilit care documente sunt obligatorii.
 */
import { useEffect, useState, useCallback } from 'react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import {
  getCleanerDocuments, addCleanerDocument, recordCleanerDocumentVerdict, deleteCleanerDocument,
  type CleanerDocumentRecord, type CleanerDocumentType,
} from '@/lib/cleanerDocumentEndpoints';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

/** Cum se vede starea unei hârtii. ⚠️ Expirarea bate statusul: un act verificat dar expirat e roșu. */
function tone(doc: CleanerDocumentRecord): string {
  if (doc.expiry === 'Expired') return 'text-destructive';
  if (doc.status === 'Rejected') return 'text-destructive';
  if (doc.expiry === 'ExpiringSoon') return 'text-amber-700';
  if (doc.status === 'Verified') return 'text-green-700';
  return 'text-muted-foreground';
}

function stateWord(doc: CleanerDocumentRecord): string {
  if (doc.expiry === 'Expired') return 'Out of date';
  if (doc.status === 'Rejected') return 'Rejected';
  if (doc.status === 'AwaitingVerification') return 'Not checked';
  return doc.expiry === 'ExpiringSoon' ? 'Runs out soon' : 'Verified';
}

export default function CleanerDocumentsSection({ cleanerId }: { cleanerId: string }) {
  /**
   * ⚠️ **Tiparul casei** (`useTrackedRequest`), nu un `useState` + `useEffect` scris de mână: acela
   * cheamă `setState` din corpul efectului, iar lintul îl semnalează — iar clichetul de avertismente
   * nu se ridică niciodată ca să treacă un fișier nou (`AGENT_RULES` §7).
   */
  const req = useTrackedRequest<{
    records: CleanerDocumentRecord[]; types: CleanerDocumentType[];
    audience: string; expiryWarningDays: number;
    complianceGaps: { kind: string; label: string; reason: string; note: string }[];
    complianceNote: string | null;
  }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const types = req.data?.types ?? [];
  const audience = req.data?.audience ?? '';
  /** 🆕 §33 „Compliance status" (Sesiunea 158) — calculat pe server, din aceleași rânduri. */
  const gaps = req.data?.complianceGaps ?? [];

  const [form, setForm] = useState({ kind: '', label: '', effectiveDate: '', expiryDate: '' });
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  /** ⚠️ `fire` scos ca valoare simplă: ca dependință, `req.fire` cere tot obiectul în listă. */
  const { fire } = req;
  const load = useCallback(async () => {
    await fire(() => getCleanerDocuments(cleanerId));
  }, [fire, cleanerId]);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!form.kind) { toast.error('Pick what kind of document this is'); return; }
    setBusy(true);
    try {
      await addCleanerDocument({
        cleanerId,
        kind: form.kind,
        label: form.label.trim() || null,
        effectiveDate: form.effectiveDate || null,
        expiryDate: form.expiryDate || null,
      });
      setForm({ kind: '', label: '', effectiveDate: '', expiryDate: '' });
      setAdding(false);
      await load();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to record the document');
    } finally {
      setBusy(false);
    }
  };

  const verdict = async (doc: CleanerDocumentRecord, accept: boolean) => {
    /**
     * 🔴 Un „nu" cere motiv, iar serverul refuză fără el. ⚠️ Deci ecranul îl **cere înainte**, în loc
     * să trimită și să afișeze o eroare: un refuz respins arată ca un defect.
     */
    let reason: string | null = null;
    if (!accept) {
      reason = window.prompt('What was wrong with it? Whoever asks for another copy needs to know '
        + 'what to ask for — “the photo cuts off the expiry date”, “this is the old policy”.');
      if (!reason || !reason.trim()) return;
    }
    setBusy(true);
    try {
      await recordCleanerDocumentVerdict(doc.id, {
        verdict: accept ? 'Verified' : 'Rejected', rejectionReason: reason,
      });
      await load();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to record the decision');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: CleanerDocumentRecord) => {
    if (!window.confirm(`Remove this ${doc.kindLabel}? The audit trail keeps a record that it was here.`)) return;
    setBusy(true);
    try {
      await deleteCleanerDocument(doc.id);
      await load();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to remove the document');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <p className="text-sm font-medium">Documents</p>
      {/* 🔴 Propoziția serverului, neatinsă — vezi comentariul din capul fișierului. */}
      {audience && <p className="text-xs text-muted-foreground">{audience}</p>}
      {/*
        ─── 🆕 §33 „Compliance status" (Sesiunea 158) ──────────────────────────────────
        ✅ Lista obligatorie a fost aprobată de Roberto pe 28/08/2026 (drept de muncă · act de
        identitate · DBS), deci registrul poate spune, în sfârșit, **ce lipsește**.

        ⛔ **Nimic când e totul în regulă.** Un rând care spune „e în regulă" pe fiecare fișă, în
        fiecare zi, e zgomot — aceeași hotărâre ca la secțiunea de incidente de pe o vizită (§9).
        ⛔ **Și niciun semafor, niciun procent:** o cifră despre un om ar fi o afirmație pe care
        nimeni nu o poate verifica, iar biroul ar începe să compare oameni pe ea.
        ⚠️ Propoziția fiecărui gol vine de la server — patru motive diferite, fiindcă se repară
        diferit („nu s-a consemnat" ≠ „nu s-a uitat nimeni" ≠ „respins" ≠ „expirat").
      */}
      {gaps.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2" data-testid="cleaner-compliance">
          <p className="text-xs font-medium text-amber-900">
            Paperwork needed before this person works
          </p>
          <ul className="mt-1 space-y-0.5">
            {gaps.map(g => (
              <li key={g.kind} className="text-xs text-amber-800">{g.note}</li>
            ))}
          </ul>
          {/* 🔴 Chihlimbar, nu roșu, și scris: nu blochează nimic — biroul hotărăște. */}
          <p className="mt-1 text-[11px] text-amber-700">This does not stop anyone being put on a job.</p>
        </div>
      )}
      {/* ⚠️ Un registru care nu s-a încărcat nu albește dialogul: fișa omului rămâne folosibilă. */}
      {req.error && !req.data && (
        <p className="text-xs text-destructive">The documents could not be loaded.</p>
      )}

      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nothing recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {records.map(doc => (
            <li key={doc.id} className="text-sm border border-border rounded-md p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {doc.kindLabel}
                    {doc.label && <span className="text-muted-foreground font-normal"> — {doc.label}</span>}
                  </p>
                  <p className={`text-xs ${tone(doc)}`}>
                    {stateWord(doc)}
                    {doc.expiryDate && <span className="text-muted-foreground"> · runs out {doc.expiryDate}</span>}
                  </p>
                  {/* ⚠️ O propoziție despre ce e de făcut — „Rejected" nu spune nimănui ce să facă. */}
                  {doc.nextStep && <p className="text-xs text-muted-foreground mt-0.5">{doc.nextStep}</p>}
                  {doc.rejectionReason && (
                    <p className="text-xs text-destructive mt-0.5">“{doc.rejectionReason}”</p>
                  )}
                  {doc.verifiedBy && (
                    <p className="text-xs text-muted-foreground mt-0.5">Checked by {doc.verifiedBy}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.status === 'AwaitingVerification' && (
                    <>
                      <button
                        aria-label={`Verify ${doc.kindLabel}`} title={`Verify ${doc.kindLabel}`}
                        className="p-1.5 rounded hover:bg-muted"
                        disabled={busy}
                        onClick={() => verdict(doc, true)}
                      ><ShieldCheck className="h-3.5 w-3.5 text-green-700" /></button>
                      <button
                        aria-label={`Reject ${doc.kindLabel}`} title={`Reject ${doc.kindLabel}`}
                        className="p-1.5 rounded hover:bg-muted"
                        disabled={busy}
                        onClick={() => verdict(doc, false)}
                      ><ShieldX className="h-3.5 w-3.5 text-destructive" /></button>
                    </>
                  )}
                  <button
                    aria-label={`Remove ${doc.kindLabel}`} title={`Remove ${doc.kindLabel}`}
                    className="p-1.5 rounded hover:bg-muted"
                    disabled={busy}
                    onClick={() => remove(doc)}
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" />Record a document
        </Button>
      ) : (
        <div className="space-y-2 border border-border rounded-md p-2">
          <div>
            <Label htmlFor="doc-kind" className="text-xs">Kind *</Label>
            {/* ⚠️ `select` nativ, nu Radix: în jsdom Radix se deschide pe tastatură, iar aici lista e
                scurtă și fixă (`AGENT_RULES` §10). */}
            <select
              id="doc-kind"
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={form.kind}
              onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
            >
              <option value="">Choose…</option>
              {types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="doc-label" className="text-xs">Which one</Label>
            <Input id="doc-label" placeholder="Passport, Policy 4421"
              value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="doc-from" className="text-xs">Valid from</Label>
              <Input id="doc-from" type="date" value={form.effectiveDate}
                onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="doc-until" className="text-xs">Runs out</Label>
              <Input id="doc-until" type="date" value={form.expiryDate}
                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
            </div>
          </div>
          {/* ⚠️ Spune că golul e ACCEPTAT: altfel cineva scrie o dată inventată, iar o dată inventată
              într-un registru de conformitate e mai rea decât un gol. */}
          <p className="text-xs text-muted-foreground">
            Leave the dates empty if the document has no end date, or nobody has checked. A made-up
            date is worse than a blank one.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={add} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

