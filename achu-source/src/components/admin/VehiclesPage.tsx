/**
 * §35 „Vehicles și travel" (Sesiunea 160) — MAȘINILE FIRMEI.
 *
 * 🔴 Trei hârtii care expiră — asigurare, ITP, taxă — și fără ele duba nu poate pleca legal.
 * ⛔ **O fișă goală NU arată curată:** lipsa unei date nu e „e în regulă", iar ecranul o spune.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EmptyTableRow from '@/components/shared/EmptyTableRow';
import { getVehicles, saveVehicle, type Vehicle } from '@/lib/vehicleEndpoints';
import { errMsg } from '@/lib/errorMessage';

const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'in-service', label: 'In for service' },
  { value: 'off-road', label: 'Off the road' },
];
const NEEDS_NOTE = new Set(['in-service', 'off-road']);

const GOL = {
  id: '', registration: '', label: '', make: '', model: '', ownedBy: '',
  insuranceExpiresOn: '', motExpiresOn: '', taxExpiresOn: '', serviceDueOn: '',
  mileage: '', mileageReadOn: '', status: 'available', statusNote: '', notes: '',
};

const PAPERS: [keyof typeof GOL, string][] = [
  ['insuranceExpiresOn', 'Insurance expires'],
  ['motExpiresOn', 'MOT expires'],
  ['taxExpiresOn', 'Tax expires'],
  ['serviceDueOn', 'Service due'],
];

export default function VehiclesPage() {
  const [rows, setRows] = useState<Vehicle[] | null>(null);
  const [form, setForm] = useState(GOL);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getVehicles().then(d => setRows(d.records)).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await saveVehicle({
        ...(form.id ? { id: form.id } : {}),
        registration: form.registration.trim(),
        label: form.label.trim() || null, make: form.make.trim() || null, model: form.model.trim() || null,
        ownedBy: form.ownedBy.trim() || null,
        insuranceExpiresOn: form.insuranceExpiresOn || null,
        motExpiresOn: form.motExpiresOn || null,
        taxExpiresOn: form.taxExpiresOn || null,
        serviceDueOn: form.serviceDueOn || null,
        // ⚠️ Cifra și ziua citirii merg împreună — serverul le refuză separat.
        mileage: form.mileage.trim() === '' ? null : Number(form.mileage),
        mileageReadOn: form.mileageReadOn || null,
        status: form.status, statusNote: form.statusNote.trim() || null,
        notes: form.notes.trim() || null,
      });
      setOpen(false); setForm(GOL); load();
      toast.success('Saved.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally { setSaving(false); }
  };

  const edit = (v: Vehicle) => {
    setForm({
      id: v.id, registration: v.registration, label: v.label ?? '', make: v.make ?? '', model: v.model ?? '',
      ownedBy: v.ownedBy ?? '',
      insuranceExpiresOn: (v.insuranceExpiresOn ?? '').slice(0, 10),
      motExpiresOn: (v.motExpiresOn ?? '').slice(0, 10),
      taxExpiresOn: (v.taxExpiresOn ?? '').slice(0, 10),
      serviceDueOn: (v.serviceDueOn ?? '').slice(0, 10),
      mileage: v.mileage == null ? '' : String(v.mileage),
      mileageReadOn: (v.mileageReadOn ?? '').slice(0, 10),
      status: v.status, statusNote: v.statusNote ?? '', notes: v.notes ?? '',
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Truck className="h-5 w-5" /> Vehicles</h1>
        <Button onClick={() => { setForm(GOL); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>

      {/* ⛔ Propoziția care ține fișa onestă: un câmp gol nu e o verificare trecută. */}
      <p className="text-sm text-muted-foreground">
        A date left empty means <strong>nobody has written it down</strong> — not that the paperwork is
        in order. Anything expired or due soon also shows in the Action Centre.
      </p>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">What we run</CardTitle></CardHeader>
        <CardContent>
          <div tabIndex={0} className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th scope="col" className="text-left p-2 font-medium">Vehicle</th>
                <th scope="col" className="text-left p-2 font-medium">Driver</th>
                <th scope="col" className="text-right p-2 font-medium">Mileage</th>
                <th scope="col" className="text-left p-2 font-medium">Status</th>
                <th scope="col" className="text-left p-2 font-medium">Paperwork</th>
                <th scope="col" className="p-2"></th>
              </tr></thead>
              <tbody>
                {rows !== null && rows.length === 0 && (
                  <EmptyTableRow colSpan={6}>No vehicles on file yet.</EmptyTableRow>
                )}
                {(rows ?? []).map(v => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2">
                      <span className="font-medium font-mono">{v.registration}</span>
                      {v.label && <span className="ml-1 text-xs text-muted-foreground">{v.label}</span>}
                    </td>
                    <td className="p-2">{v.driverName ?? '—'}</td>
                    <td className="p-2 text-right">
                      {v.mileage == null ? '—' : v.mileage.toLocaleString()}
                      {v.mileageReadOn && <span className="block text-xs text-muted-foreground">read {v.mileageReadOn}</span>}
                    </td>
                    <td className="p-2">
                      <Badge variant={v.status === 'available' ? 'outline' : 'default'} title={v.statusNote ?? undefined}>
                        {STATUSES.find(s => s.value === v.status)?.label ?? v.status}
                      </Badge>
                    </td>
                    <td className="p-2 space-x-1">
                      {/* ⚠️ Un rând per hârtie: cine rezolvă asigurarea nu a rezolvat și ITP-ul. */}
                      {v.warnings.length === 0 && <span className="text-xs text-muted-foreground">Nothing flagged</span>}
                      {v.warnings.map(w => (
                        <Badge
                          key={w.field}
                          variant="outline"
                          className={w.state === 'expired' ? 'border-red-500 text-red-700 dark:text-red-400' : 'border-amber-500 text-amber-700 dark:text-amber-400'}
                        >
                          {w.label}
                        </Badge>
                      ))}
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => edit(v)} aria-label={`Edit ${v.registration}`}>Edit</Button>
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
          <DialogHeader><DialogTitle>{form.id ? 'Edit vehicle' : 'Add a vehicle'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label htmlFor="veh-reg">Registration</Label><Input id="veh-reg" value={form.registration} onChange={e => setForm(f => ({ ...f, registration: e.target.value }))} placeholder="LU12 ABC" /></div>
              <div><Label htmlFor="veh-label">What we call it</Label><Input id="veh-label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. the white van" /></div>
              <div><Label htmlFor="veh-make">Make</Label><Input id="veh-make" value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} /></div>
              <div><Label htmlFor="veh-model">Model</Label><Input id="veh-model" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
              <div><Label htmlFor="veh-owner">Owned by</Label><Input id="veh-owner" value={form.ownedBy} onChange={e => setForm(f => ({ ...f, ownedBy: e.target.value }))} placeholder="e.g. the company, leased" /></div>
              <div>
                <Label htmlFor="veh-status">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger id="veh-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {PAPERS.map(([field, label]) => (
                <div key={field}>
                  <Label htmlFor={`veh-${field}`}>{label}</Label>
                  <Input id={`veh-${field}`} type="date" value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div><Label htmlFor="veh-mileage">Mileage</Label><Input id="veh-mileage" type="number" min={0} value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} /></div>
              <div><Label htmlFor="veh-mileage-on">Read on</Label><Input id="veh-mileage-on" type="date" value={form.mileageReadOn} onChange={e => setForm(f => ({ ...f, mileageReadOn: e.target.value }))} /></div>
            </div>

            {/* ⛔ „82.000" de acum doi ani nu e o măsurătoare. */}
            <p className="text-xs text-muted-foreground">
              A mileage needs the day it was read — a number on its own tells you nothing a year later.
            </p>

            {NEEDS_NOTE.has(form.status) && (
              <div>
                <Label htmlFor="veh-status-note">Why, and when it is back *</Label>
                <Input id="veh-status-note" value={form.statusNote} onChange={e => setForm(f => ({ ...f, statusNote: e.target.value }))} placeholder="e.g. clutch, back Monday" />
                <p className="text-xs text-muted-foreground mt-1">Without this nobody can plan around it.</p>
              </div>
            )}

            <div><Label htmlFor="veh-notes">Notes</Label><Input id="veh-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

            <Button
              className="w-full"
              disabled={saving || !form.registration.trim() || (NEEDS_NOTE.has(form.status) && !form.statusNote.trim())}
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

