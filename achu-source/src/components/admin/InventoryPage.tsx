/**
 * §34 „Equipment și inventory" (Sesiunea 160) — CE ARE FIRMA PE RAFT.
 *
 * 🔴 **UN SINGUR CATALOG, NU PATRU.** Substanțe, echipamente, consumabile — aceleași rubrici, o
 * singură listă, un filtru de fel. ⛔ Patru ecrane ar fi însemnat patru locuri de reparat aceeași
 * greșeală, iar „ce comand săptămâna asta?" ar fi cerut patru liste puse cap la cap.
 *
 * ⚠️ **Cifra de stoc e SCRISĂ DE OM**, iar ecranul o spune: nu se scade singură când cineva ia o
 * sticlă. ⛔ Fără propoziția aia, biroul ar fi crezut că lista se ține singură la zi — iar diferența
 * se descoperă în ziua în care nu mai e nimic.
 *
 * ⚠️ **Faptele (sub prag, expirat, fără fișă) vin de la SERVER**, gata scrise.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Plus, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import EmptyTableRow from '@/components/shared/EmptyTableRow';
import { getInventory, saveInventoryItem, type InventoryItem } from '@/lib/inventoryEndpoints';
import { errMsg } from '@/lib/errorMessage';

const KINDS = [
  { value: 'chemical', label: 'Chemical' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'other', label: 'Other' },
];

const GOL = {
  id: '', name: '', kind: 'consumable', code: '', supplier: '', storageLocation: '',
  quantity: '0', unit: '', minimumStock: '', reorderLevel: '', batchNumber: '', expiresOn: '',
  coshhUrl: '', notes: '', assignedVehicle: '', condition: 'good', conditionNote: '', nextServiceOn: '',
};

// §34 — „pierdut" și „stricat" sunt STĂRI, nu liste separate: articolul rămâne în catalog.
const CONDITIONS = [
  { value: 'good', label: 'Fine' },
  { value: 'worn', label: 'Worn — keep an eye on it' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
];
const NEEDS_NOTE = new Set(['damaged', 'lost']);

const nr = (v: string) => (v.trim() === '' ? null : Number(v));

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[] | null>(null);
  const [kind, setKind] = useState('all');
  const [form, setForm] = useState(GOL);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getInventory(kind === 'all' ? {} : { kind })
      .then(d => setRows(d.records))
      .catch(() => setRows([]));
  }, [kind]);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await saveInventoryItem({
        ...(form.id ? { id: form.id } : {}),
        name: form.name.trim(), kind: form.kind,
        code: form.code.trim() || null, supplier: form.supplier.trim() || null,
        storageLocation: form.storageLocation.trim() || null,
        quantity: Number(form.quantity) || 0, unit: form.unit.trim() || null,
        minimumStock: nr(form.minimumStock), reorderLevel: nr(form.reorderLevel),
        batchNumber: form.batchNumber.trim() || null,
        expiresOn: form.expiresOn || null,
        coshhUrl: form.coshhUrl.trim() || null, notes: form.notes.trim() || null,
        assignedVehicle: form.assignedVehicle.trim() || null,
        condition: form.condition, conditionNote: form.conditionNote.trim() || null,
        nextServiceOn: form.nextServiceOn || null,
      });
      setOpen(false);
      setForm(GOL);
      load();
      toast.success('Saved.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const edit = (r: InventoryItem) => {
    setForm({
      id: r.id, name: r.name, kind: r.kind, code: r.code ?? '', supplier: r.supplier ?? '',
      storageLocation: r.storageLocation ?? '', quantity: String(r.quantity), unit: r.unit ?? '',
      minimumStock: r.minimumStock == null ? '' : String(r.minimumStock),
      reorderLevel: r.reorderLevel == null ? '' : String(r.reorderLevel),
      batchNumber: r.batchNumber ?? '', expiresOn: (r.expiresOn ?? '').slice(0, 10),
      coshhUrl: r.coshhUrl ?? '', notes: r.notes ?? '',
      assignedVehicle: r.assignedVehicle ?? '', condition: r.condition,
      conditionNote: r.conditionNote ?? '', nextServiceOn: (r.nextServiceOn ?? '').slice(0, 10),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Stock</h1>
        <div className="flex items-center gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-44" aria-label="Filter by kind"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everything</SelectItem>
              {KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setForm(GOL); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
      </div>

      {/*
        🔴 Propoziția care ține lista onestă. ⛔ Fără ea, biroul ar crede că cifrele se țin singure la
        zi — iar diferența se descoperă în ziua în care nu mai e nimic pe raft.
      */}
      <p className="text-sm text-muted-foreground">
        The counts here are written by hand — nothing takes one off when a cleaner picks a bottle up.
        Anything low, out, expired, or a chemical with no safety sheet also shows in the Action Centre.
      </p>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">What we hold</CardTitle></CardHeader>
        <CardContent>
          <div tabIndex={0} className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th scope="col" className="text-left p-2 font-medium">Item</th>
                <th scope="col" className="text-left p-2 font-medium">Kind</th>
                <th scope="col" className="text-right p-2 font-medium">Held</th>
                <th scope="col" className="text-left p-2 font-medium">Where</th>
                <th scope="col" className="text-left p-2 font-medium">Who has it</th>
                <th scope="col" className="text-left p-2 font-medium">Needs</th>
                <th scope="col" className="p-2"></th>
              </tr></thead>
              <tbody>
                {rows !== null && rows.length === 0 && (
                  <EmptyTableRow colSpan={7}>Nothing on the stock list yet.</EmptyTableRow>
                )}
                {(rows ?? []).map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      <span className="font-medium">{r.name}</span>
                      {r.code && <span className="ml-1 text-xs text-muted-foreground">{r.code}</span>}
                    </td>
                    <td className="p-2">{KINDS.find(k => k.value === r.kind)?.label ?? r.kind}</td>
                    <td className="p-2 text-right">{r.quantity}{r.unit ? ` ${r.unit}` : ''}</td>
                    <td className="p-2">{r.storageLocation ?? '—'}</td>
                    {/* §34 — „pe raft" e un răspuns, nu un gol. */}
                    <td className="p-2">{r.holderLabel ?? <span className="text-muted-foreground">On the shelf</span>}</td>
                    <td className="p-2 space-x-1">
                      {/* ⚠️ Propozițiile vin de la server; ecranul alege doar culoarea. */}
                      {r.stockLabel && (
                        <Badge variant="outline" className={r.stockState === 'reorder' ? '' : 'border-amber-500 text-amber-700 dark:text-amber-400'}>
                          {r.stockLabel}
                        </Badge>
                      )}
                      {r.expiryLabel && (
                        <Badge variant="outline" className={r.expiryState === 'expired' ? 'border-red-500 text-red-700 dark:text-red-400' : ''}>
                          {r.expiryLabel}
                        </Badge>
                      )}
                      {r.condition !== 'good' && (
                        <Badge variant="outline" className={r.condition === 'good' ? '' : 'border-red-500 text-red-700 dark:text-red-400'} title={r.conditionNote ?? undefined}>
                          {CONDITIONS.find(c => c.value === r.condition)?.label ?? r.condition}
                        </Badge>
                      )}
                      {r.serviceLabel && (
                        <Badge variant="outline" className={r.serviceState === 'overdue' ? 'border-red-500 text-red-700 dark:text-red-400' : ''}>
                          {r.serviceLabel}
                        </Badge>
                      )}
                      {r.missingCoshh && (
                        <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400" title="A chemical with no safety sheet is a missing document at an inspection">
                          No COSHH sheet
                        </Badge>
                      )}
                      {r.coshhUrl && (
                        <a href={r.coshhUrl} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center gap-1">
                          Safety sheet<ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => edit(r)} aria-label={`Edit ${r.name}`}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Edit item' : 'Add to stock'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label htmlFor="inv-name">Name</Label><Input id="inv-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <Label htmlFor="inv-kind">Kind</Label>
                <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v }))}>
                  <SelectTrigger id="inv-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>{KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="inv-code">Code on the box</Label><Input id="inv-code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></div>
              <div><Label htmlFor="inv-supplier">Supplier</Label><Input id="inv-supplier" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
              <div><Label htmlFor="inv-where">Where it is kept</Label><Input id="inv-where" value={form.storageLocation} onChange={e => setForm(f => ({ ...f, storageLocation: e.target.value }))} placeholder="e.g. office cupboard" /></div>
              <div><Label htmlFor="inv-unit">Counted in</Label><Input id="inv-unit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. bottles" /></div>
              <div><Label htmlFor="inv-qty">How many we hold</Label><Input id="inv-qty" type="number" min={0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div><Label htmlFor="inv-min">Never go below</Label><Input id="inv-min" type="number" min={0} value={form.minimumStock} onChange={e => setForm(f => ({ ...f, minimumStock: e.target.value }))} /></div>
              <div><Label htmlFor="inv-reorder">Order when down to</Label><Input id="inv-reorder" type="number" min={0} value={form.reorderLevel} onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))} /></div>
              <div><Label htmlFor="inv-batch">Batch number</Label><Input id="inv-batch" value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} /></div>
              <div><Label htmlFor="inv-expiry">Expires</Label><Input id="inv-expiry" type="date" value={form.expiresOn} onChange={e => setForm(f => ({ ...f, expiresOn: e.target.value }))} /></div>
            </div>

            {/*
              ⚠️ Cele două praguri sunt lucruri DIFERITE, iar propoziția o spune sub ele: cu unul
              singur, ori comanzi prea târziu, ori „minim" înseamnă de fapt „comandă acum".
            */}
            <p className="text-xs text-muted-foreground">
              <strong>Never go below</strong> is the floor — under it the work stops.{' '}
              <strong>Order when down to</strong> is higher, so the delivery arrives before you hit the floor.
            </p>

            <div>
              <Label htmlFor="inv-coshh">Safety sheet (COSHH) — a link</Label>
              <Input id="inv-coshh" value={form.coshhUrl} onChange={e => setForm(f => ({ ...f, coshhUrl: e.target.value }))} placeholder="https://…" />
              {/*
                ⛔ O ADRESĂ, nu un fișier urcat: fișele vin de la producător și se schimbă când se
                schimbă rețeta, iar o copie a noastră ar rămâne în urmă tăcut — exact felul de
                hârtie care e periculoasă când e veche.
              */}
              <p className="text-xs text-muted-foreground mt-1">
                A link to the manufacturer's sheet, not a copy — theirs changes when the product does.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label htmlFor="inv-vehicle">In which vehicle</Label><Input id="inv-vehicle" value={form.assignedVehicle} onChange={e => setForm(f => ({ ...f, assignedVehicle: e.target.value }))} placeholder="e.g. LU12 ABC" /></div>
              <div><Label htmlFor="inv-service">Next service</Label><Input id="inv-service" type="date" value={form.nextServiceOn} onChange={e => setForm(f => ({ ...f, nextServiceOn: e.target.value }))} /></div>
              <div>
                <Label htmlFor="inv-condition">Condition</Label>
                <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                  <SelectTrigger id="inv-condition"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inv-condition-note">What happened{NEEDS_NOTE.has(form.condition) ? ' *' : ''}</Label>
                <Input id="inv-condition-note" value={form.conditionNote} onChange={e => setForm(f => ({ ...f, conditionNote: e.target.value }))} placeholder="e.g. Left at 4 High St" />
              </div>
            </div>
            {/* ⛔ „Damaged"/„Lost" fără un cuvânt e o etichetă pe care nimeni n-o poate folosi. */}
            {NEEDS_NOTE.has(form.condition) && (
              <p className="text-xs text-muted-foreground">
                Say what happened — <strong>damaged</strong> or <strong>lost</strong> on its own tells
                nobody whether it can be fixed, or where to look. The item stays on this list either way.
              </p>
            )}

            <div><Label htmlFor="inv-notes">Notes</Label><Input id="inv-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

            <Button
              className="w-full"
              disabled={saving || !form.name.trim() || (NEEDS_NOTE.has(form.condition) && !form.conditionNote.trim())}
              onClick={save}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

