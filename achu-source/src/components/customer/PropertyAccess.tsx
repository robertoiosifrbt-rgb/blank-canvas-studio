/**
 * ACHU-576 (`Backlog_Functionalitati_Viitoare` §5, Grupul B) — CUM SE INTRĂ, SCRIS DE OMUL CARE
 * LOCUIEȘTE ACOLO — **pe fiecare casă a lui**.
 *
 * ─── 🔴 CE ÎNLOCUIEȘTE, ȘI DE CE ──────────────────────────────────────────────
 * Din Sesiunea 43 (ACHU-239) exista un card „Getting in" cu **un singur** text, pe fișa
 * clientului. Un om cu două case avea deci un set de instrucțiuni **greșit pentru cel puțin
 * una**, iar cine îl citea greșit stătea la o ușă cu o cheie care nu deschidea nimic.
 *
 * ⚠️ **Câmpul s-a MUTAT, nu s-a copiat** (migrația l-a dus pe casa principală): două locuri în
 * care se poate scrie codul porții înseamnă că cineva îl citește pe cel învechit.
 *
 * ─── CE RĂMÂNE NESCHIMBAT DIN CARDUL VECHI ────────────────────────────────────
 * ✅ **Textul spune cine citește, ÎNAINTE de a scrie.** Cine tastează locul cheii merită să știe
 * cine o vede înainte, nu după — iar a o spune e și ce-l face să scrie ceva util.
 * ✅ Cardul lui, nu un câmp în formularul de contact: un cod de poartă se schimbă o dată pe an și
 * contează enorm în ziua aceea; într-un formular de telefon s-ar re-trimite la fiecare salvare.
 */
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Pencil, Loader2, Info } from 'lucide-react';
import { getMyProperties, updateMyPropertyAccess } from '@/lib/endpoints';
import { AddMyProperty, MyPropertyControls } from './PropertyManage';
import { ACCESS_TEXTS, type MyProperty } from '@/lib/propertyTypes';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import { errMsg } from '@/lib/errorMessage';

/** `''` → `null`, iar un etaj gol rămâne gol: parterul e `0`, care e un fapt. */
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

export default function PropertyAccess() {
  const req = useTrackedRequest<{ records: MyProperty[] }>({ timeoutMs: 20000 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ accessInstructions: '', floorNumber: '', ...Object.fromEntries(ACCESS_TEXTS.map(t => [t.key, ''])) as Record<string, string> });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { fire } = req;
  const load = useCallback(() => { fire(() => getMyProperties()); }, [fire]);
  useEffect(() => { load(); }, [load]);

  const records = req.data?.records ?? [];

  const openEdit = (p: MyProperty) => {
    setForm({
      accessInstructions: p.accessInstructions ?? '',
      floorNumber: (p.floorNumber ?? null) === null ? '' : String(p.floorNumber),
      ...Object.fromEntries(ACCESS_TEXTS.map(t => [t.key, p[t.key] ?? ''])) as Record<string, string>,
    });
    setEditingId(p.id);
    setError('');
  };

  const save = async () => {
    if (!editingId || saving) return;
    setSaving(true);
    setError('');
    try {
      await updateMyPropertyAccess({
        id: editingId,
        accessInstructions: form.accessInstructions.trim() || null,
        floorNumber: num(form.floorNumber),
        ...Object.fromEntries(ACCESS_TEXTS.map(t => [t.key, form[t.key].trim() || null])),
      });
      toast.success('Saved — your cleaners will see this.');
      setEditingId(null);
      /**
       * ⚠️ Se reîncarcă lista, nu se peticește starea locală: serverul întoarce rândul recitit
       * tocmai fiindcă o **golire** trebuie să se vadă (lecția ACHU-292), iar o listă peticită
       * de mână ar fi a doua cale prin care ecranul află ce s-a salvat.
       */
      load();
    } catch (e) {
      setError(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /** Câte lucruri s-au consemnat despre casa asta — decide dacă butonul spune „Add" sau „Edit". */
  const filled = (p: MyProperty) =>
    ACCESS_TEXTS.filter(t => (p[t.key] ?? '').trim() !== '').length
    + ((p.accessInstructions ?? '').trim() === '' ? 0 : 1)
    + ((p.floorNumber ?? null) === null ? 0 : 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        {/**
          * 🆕 §19, Sesiunea 142 — cardul nu mai e doar „Getting in": de aici clientul își și
          * gestionează casele (adaugă, redenumește, alege principala, retrage). ⚠️ **Un al doilea
          * card cu aceeași listă** ar fi pus același om în două locuri ca să facă două lucruri
          * despre aceeași casă.
          */}
        <CardTitle className="text-sm flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden="true" />Your properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          Only ACHU and the cleaner coming to you can see this.
          {records.length > 1 && ' Each property has its own — a gate code for one is not the code for the other.'}
        </p>

        {!req.data && !req.error && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading…
          </div>
        )}
        {req.error && <div className="text-sm text-destructive">Could not load your properties.</div>}
        {/**
          * 📜 Aici scria *„Please contact ACHU"*, corect cât timp clientul nu putea adăuga nimic.
          * De la §19 poate, deci textul nu-l mai trimite să sune pentru ceva ce are butonul lângă.
          */}
        {req.data && records.length === 0 && (
          <p className="text-sm text-muted-foreground">
            We do not have a property on your account yet — add the first one below.
          </p>
        )}

        {records.map(p => (
          <div key={p.id} className="rounded-md border p-2 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-sm">{p.label}</span>
                  {/* ⚠️ O casă stinsă se ARATĂ (altfel clientul crede că s-a pierdut ceva) dar
                      nu se poate edita: n-am mai lucra acolo, iar el ar crede că a făcut ceva. */}
                  {!p.isActive && <Badge variant="outline">Not in use</Badge>}
                </div>
                {(p.address || p.postcode) && (
                  <div className="text-xs text-muted-foreground">{[p.address, p.postcode].filter(Boolean).join(', ')}</div>
                )}
              </div>
              {editingId !== p.id && p.isActive && (
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden="true" />{filled(p) > 0 ? 'Edit' : 'Add'}
                </Button>
              )}
            </div>

            {editingId === p.id ? (
              <div className="space-y-2">
                <div>
                  <Label htmlFor={`acc-free-${p.id}`} className="text-xs">Anything the cleaner needs to get in</Label>
                  <Textarea
                    id={`acc-free-${p.id}`}
                    rows={3}
                    value={form.accessInstructions}
                    onChange={e => setForm(f => ({ ...f, accessInstructions: e.target.value }))}
                    maxLength={2000}
                    placeholder="Side gate code 4417. Please shut the gate — the dog is friendly but escapes."
                  />
                </div>
                {ACCESS_TEXTS.map(t => (
                  <div key={t.key}>
                    <Label htmlFor={`acc-${t.key}-${p.id}`} className="text-xs">{t.label}</Label>
                    <Input
                      id={`acc-${t.key}-${p.id}`}
                      value={form[t.key]}
                      onChange={e => setForm(f => ({ ...f, [t.key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <Label htmlFor={`acc-floor-${p.id}`} className="text-xs">Which floor you are on</Label>
                  <Input
                    id={`acc-floor-${p.id}`}
                    type="number"
                    value={form.floorNumber}
                    onChange={e => setForm(f => ({ ...f, floorNumber: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Leave a box empty to remove what is in it.</p>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingId(null); setError(''); }} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1" onClick={save} disabled={saving}>
                    {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" aria-hidden="true" />Saving…</> : 'Save'}
                  </Button>
                </div>
              </div>
            ) : filled(p) > 0 ? (
              <>
                {p.accessInstructions && <p className="text-sm whitespace-pre-wrap break-words">{p.accessInstructions}</p>}
                <dl className="space-y-1">
                  {ACCESS_TEXTS.filter(t => (p[t.key] ?? '').trim() !== '').map(t => (
                    <div key={t.key} className="flex gap-2 text-sm">
                      <dt className="text-muted-foreground shrink-0">{t.label}:</dt>
                      <dd className="break-words">{p[t.key]}</dd>
                    </div>
                  ))}
                  {(p.floorNumber ?? null) !== null && (
                    <div className="flex gap-2 text-sm">
                      <dt className="text-muted-foreground shrink-0">Floor:</dt>
                      <dd>{p.floorNumber === 0 ? 'Ground floor' : p.floorNumber}</dd>
                    </div>
                  )}
                </dl>
                {p.accessInstructionsUpdatedAt && (
                  <p className="text-xs text-muted-foreground">Last updated {fmtDate(p.accessInstructionsUpdatedAt)}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing yet. Add a gate code, where the key is, or anything the cleaner needs to
                get in — it saves a phone call on the day.
              </p>
            )}

            {/**
              * §19 — ce se poate face cu CASA (nume, adresă, principala, retragere), sub ce s-a
              * scris despre cum se intră în ea. ⚠️ Ascuns cât timp se editează accesul: două
              * formulare deschise pe același card, cu două butoane „Save", e felul în care omul
              * salvează altceva decât credea.
              */}
            {editingId !== p.id && <MyPropertyControls property={p} onSaved={load} />}
          </div>
        ))}

        {/* ⚠️ Doar după listă: „adaugă" nu are sens înaintea a ce ai deja. */}
        {req.data && <AddMyProperty onSaved={load} />}
      </CardContent>
    </Card>
  );
}

