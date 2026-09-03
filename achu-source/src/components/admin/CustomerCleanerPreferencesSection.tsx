/**
 * ACHU-554 (Sesiunea 121, `Backlog_Client_Prioritar` Nivel 2) — CURĂȚĂTORUL PE CARE CLIENTUL
 * ÎL VREA, SAU PE CARE NU ÎL VREA.
 *
 * **Decizia Archanei, 12/08/2026:** *„1.a"* — aplicația **AVERTIZEAZĂ, nu refuză**.
 *
 * ─── Ce e aici și ce e în panoul de asignări ──────────────────────────────
 * Aici se **scriu** preferințele (fișa clientului). Avertismentul se **citește** unde se
 * greșește — în `JobAssignmentsPanel.tsx`, când biroul alege pe cineva pentru o vizită.
 * 🔴 Cele două ecrane nu au voie să se despartă: o preferință scrisă aici și neafișată acolo
 * ar fi exact ACHU-536 (un câmp calculat pe care nu-l vede nimeni).
 *
 * ⚠️ **Ecranul spune că nu blochează nimic.** Fără rândul acela, biroul ar presupune că
 * aplicația împiedică asignarea, s-ar baza pe ea, și ar descoperi contrariul într-o zi
 * aglomerată.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, UserX, Trash2, Plus, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCustomerCleanerPreferences, addCustomerCleanerPreference,
  removeCustomerCleanerPreference, getCleaners,
} from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

type Preference = {
  id: string;
  cleanerId: string;
  cleanerName: string;
  cleanerActive: boolean;
  kind: string;
  reason: string | null;
  createdBy: string | null;
};

type CleanerOption = { id: string; cleanerName: string; active: boolean };

export default function CustomerCleanerPreferencesSection({ customerId }: { customerId: string }) {
  /**
   * ⚠️ `useTrackedRequest`, nu `useState` + `setLoading(true)` într-un efect — acela ridică
   * un avertisment de lint („setState synchronously within an effect"), iar poarta de lint e
   * un clichet EXACT (`CLAUDE.md` §2.1a): un singur avertisment nou o sparge. Același tipar ca
   * în `CustomerConsentsSection.tsx`.
   */
  const req = useTrackedRequest<{ preferences: Preference[]; cleaners: CleanerOption[] }>({ timeoutMs: 20000 });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ cleanerId: '', kind: 'preferred', reason: '' });

  // Destructurat, nu `[req.fire]`: linterul nu poate vedea că o expresie de membru e stabilă.
  const { fire } = req;
  const load = useCallback(() => {
    fire(async () => {
      const [p, c] = await Promise.all([
        getCustomerCleanerPreferences({ customerId }),
        getCleaners({}),
      ]);
      return { preferences: p.preferences, cleaners: c.records as CleanerOption[] };
    });
  }, [fire, customerId]);

  useEffect(() => { load(); }, [load]);

  const preferences = req.data?.preferences ?? [];
  const cleaners = req.data?.cleaners ?? [];
  const loading = !req.data && !req.error;

  /**
   * ⚠️ Curățătorii deja aleși ies din dropdown, dar **numai pentru felul lor**: același om
   * poate apărea o dată ca preferat și — dacă biroul șterge întâi preferința — ca interzis.
   * Contradicția e refuzată de server, cu un mesaj citibil.
   */
  const takenForKind = preferences.filter(p => p.kind === form.kind).map(p => p.cleanerId);
  const available = cleaners.filter(c => c.active && !takenForKind.includes(c.id));

  const handleAdd = async () => {
    if (!form.cleanerId || saving) return;
    setSaving(true);
    try {
      await addCustomerCleanerPreference({
        customerId, cleanerId: form.cleanerId, kind: form.kind,
        reason: form.reason.trim() || undefined,
      });
      toast.success('Saved');
      setForm({ cleanerId: '', kind: 'preferred', reason: '' });
      setShowAdd(false);
      load();
    } catch (e) {
      // ⚠️ Mesajul serverului se arată AȘA CUM E: la contradicția preferat/interzis el spune
      // exact ce trebuie făcut („remove that first"), iar un text generic l-ar ascunde.
      toast.error(errMsg(e) || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (p: Preference) => {
    try {
      await removeCustomerCleanerPreference({ customerId, preferenceId: p.id });
      toast.success('Removed');
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not remove.');
    }
  };

  const excluded = preferences.filter(p => p.kind === 'excluded');
  const preferred = preferences.filter(p => p.kind !== 'excluded');

  const row = (p: Preference) => (
    <div key={p.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">{p.cleanerName}</span>
          {/* ⚠️ Un curățător inactiv rămâne afișat, marcat: „îl prefera, dar nu mai lucrează
              la noi" e chiar informația de care are nevoie biroul, nu un rând de ascuns. */}
          {!p.cleanerActive && <Badge variant="destructive" className="text-[10px]">No longer works here</Badge>}
        </div>
        {p.reason && <p className="text-xs text-muted-foreground">{p.reason}</p>}
      </div>
      <button
        className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"
        title={`Remove ${p.cleanerName}`}
        aria-label={`Remove ${p.cleanerName}`}
        onClick={() => void handleRemove(p)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Cleaner preferences</h3>
        {!showAdd && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" />Add
          </Button>
        )}
      </div>

      {/* 🔴 Rândul care împiedică o presupunere costisitoare. Vezi antetul fișierului. */}
      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <Info className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
        The office is warned when assigning someone the customer asked us not to send —
        but nothing is blocked. Someone still has to decide.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />Loading…
        </p>
      ) : (
        <>
          {preferences.length === 0 && !showAdd && (
            <p className="text-xs text-muted-foreground">This customer has not asked for or against any cleaner.</p>
          )}
          {preferred.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UserCheck className="h-3 w-3" aria-hidden="true" />Prefers
              </p>
              {preferred.map(row)}
            </div>
          )}
          {excluded.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UserX className="h-3 w-3" aria-hidden="true" />Asked us not to send
              </p>
              {excluded.map(row)}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="custpref-kind" className="text-xs">Which</Label>
              <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v, cleanerId: '' }))}>
                <SelectTrigger id="custpref-kind" className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preferred">Prefers this cleaner</SelectItem>
                  <SelectItem value="excluded">Do not send this cleaner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="custpref-cleaner" className="text-xs">Cleaner *</Label>
              <Select value={form.cleanerId} onValueChange={v => setForm(f => ({ ...f, cleanerId: v }))}>
                <SelectTrigger id="custpref-cleaner" className="h-8 text-sm"><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                <SelectContent>
                  {available.map(c => <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="custpref-reason" className="text-xs">Reason (optional)</Label>
            {/* ⚠️ Textul ajunge în AUDIT, iar rândul de sub câmp o spune: e o afirmație despre
                o persoană, iar cine o scrie trebuie să știe că rămâne înregistrată. */}
            <p className="text-[11px] text-muted-foreground mb-1">
              Shown to the office when assigning, and recorded in the audit history with your name.
            </p>
            <Input
              id="custpref-reason"
              className="h-8 text-sm"
              maxLength={500}
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. she knows where the key is"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" disabled={!form.cleanerId || saving} onClick={() => void handleAdd()}>
              {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving…</> : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowAdd(false); setForm({ cleanerId: '', kind: 'preferred', reason: '' }); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

