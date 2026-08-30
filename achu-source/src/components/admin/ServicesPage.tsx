/**
 * §8 „Services catalogue" (Sesiunea 146) — ecranul catalogului.
 *
 * 🔴 **Propoziția de sus nu e decor.** Fără ea, primul om care vede „How long it usually takes"
 * presupune că ofertele se calculează din ea. Nu se calculează: prețurile și minutele rămân în
 * Price Calculator, iar catalogul nu schimbă ce plătește nimeni.
 *
 * ⛔ **Fără câmp de nume la editare** — serverul refuză redenumirea, iar un câmp care arată
 * editabil și primește „nu se poate" e mai rău decât unul care lipsește.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  getServices, addService, updateService, type ServiceRecord,
} from '@/lib/serviceEndpoints';
import ServiceItemsSection from './ServiceItemsSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';

type FormState = {
  name: string; category: string; customerDescription: string; internalDescription: string;
  standardMinutes: string; standardCleaners: string; minimumNoticeHours: string;
  sortOrder: string; active: boolean;
};

const EMPTY: FormState = {
  name: '', category: '', customerDescription: '', internalDescription: '',
  standardMinutes: '', standardCleaners: '', minimumNoticeHours: '', sortOrder: '0', active: true,
};

/** ⚠️ Gol → `null` („nu s-a consemnat"), nu `0`. Un `0` ar afirma „fără preaviz" (`AGENT_RULES` §15). */
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

function hours(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function ServicesPage() {
  const req = useTrackedRequest<{ scope: string; records: ServiceRecord[] }>({ timeoutMs: 30000 });
  // ⚠️ Scos din obiect înainte de `useCallback`: cu `req.fire` în lista de dependențe, regula de
  // hooks cere obiectul întreg — iar clichetul de lint e EXACT, deci un avertisment nou sparge poarta.
  const { fire } = req;
  const records = req.data?.records ?? [];
  const [editItem, setEditItem] = useState<ServiceRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { fire(() => getServices()); }, [fire]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditItem(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (r: ServiceRecord) => {
    setEditItem(r);
    setForm({
      name: r.name,
      category: r.category ?? '',
      customerDescription: r.customerDescription ?? '',
      internalDescription: r.internalDescription ?? '',
      standardMinutes: r.standardMinutes?.toString() ?? '',
      standardCleaners: r.standardCleaners?.toString() ?? '',
      minimumNoticeHours: r.minimumNoticeHours?.toString() ?? '',
      sortOrder: r.sortOrder.toString(),
      active: r.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editItem && !form.name.trim()) { toast.error('Give the service a name'); return; }
    setSaving(true);
    try {
      const body = {
        category: form.category.trim() || null,
        customerDescription: form.customerDescription.trim() || null,
        internalDescription: form.internalDescription.trim() || null,
        standardMinutes: num(form.standardMinutes),
        standardCleaners: num(form.standardCleaners),
        minimumNoticeHours: num(form.minimumNoticeHours),
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      };
      const result = editItem
        ? await updateService(editItem.id, body)
        : await addService({ name: form.name.trim(), ...body });
      if (result.auditWarning) {
        toast.warning('Saved, but the history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(editItem ? 'Service updated' : 'Service added');
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;

  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        titleClassName="text-2xl font-bold"
        title="Services"
        actions={
          <>
            <RefreshButton onRefresh={load} />
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Service</Button>
          </>
        }
      />

      {/* 🔴 Propoziția vine de la server — nu e scrisă a doua oară aici. */}
      {req.data?.scope && (
        <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 p-3">{req.data.scope}</p>
      )}

      {req.error && records.length > 0 && (
        <div className="rounded-lg p-3 flex items-center gap-2 bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm flex-1 text-destructive">{req.error}</p>
          <Button variant="ghost" size="sm" onClick={load} disabled={req.loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />Retry
          </Button>
        </div>
      )}

      <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th scope="col" className="text-left p-3 font-medium">Service</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Category</th>
            <th scope="col" className="text-left p-3 font-medium">Priced positions</th>
            <th scope="col" className="text-left p-3 font-medium">Usually takes</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Cleaners</th>
            <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Notice</th>
            <th scope="col" className="text-left p-3 font-medium">On the form</th>
            <th scope="col" className="p-3 w-16"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={8} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load the catalogue. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={load} disabled={req.loading}>Retry</Button>
                </div>
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No services yet</td></tr>
            ) : records.map(r => (
              <tr key={r.id} className={`border-t border-border hover:bg-muted/30 ${r.active ? '' : 'opacity-60'}`}>
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{r.category ?? '—'}</td>
                <td className="p-3">{r.items.filter(i => i.active).length}</td>
                <td className="p-3">{hours(r.standardMinutes)}</td>
                <td className="p-3 hidden md:table-cell">{r.standardCleaners ?? '—'}</td>
                <td className="p-3 hidden lg:table-cell">{r.minimumNoticeHours == null ? '—' : `${r.minimumNoticeHours}h`}</td>
                <td className="p-3">
                  {r.active
                    ? <span className="text-green-600 text-xs font-medium">Offered</span>
                    : <span className="text-muted-foreground text-xs">Switched off</span>}
                </td>
                <td className="p-3">
                  <button aria-label={`Edit ${r.name}`} title={`Edit ${r.name}`} className="p-1.5 rounded hover:bg-muted" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? editItem.name : 'New Service'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editItem ? (
              /**
               * 🔴 Nu un câmp dezactivat, ci o propoziție: un câmp gri invită la întrebarea „de ce
               * nu pot", iar răspunsul (vizitele vechi țin numele ca text) e chiar ce scrie aici.
               */
              <p className="text-xs text-muted-foreground">
                The name cannot be changed — every past job and quote stores it. Switch this one off
                and add the new name instead.
              </p>
            ) : (
              <div>
                <Label htmlFor="svc-name">Service name *</Label>
                <Input id="svc-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            )}

            <div><Label htmlFor="svc-category">Category</Label>
              <Input id="svc-category" value={form.category} placeholder="Interior, Exterior, Specialist…"
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>

            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="svc-minutes">Usually takes (min)</Label>
                <Input id="svc-minutes" inputMode="numeric" value={form.standardMinutes}
                  onChange={e => setForm(f => ({ ...f, standardMinutes: e.target.value }))} /></div>
              <div><Label htmlFor="svc-cleaners">Cleaners</Label>
                <Input id="svc-cleaners" inputMode="numeric" value={form.standardCleaners}
                  onChange={e => setForm(f => ({ ...f, standardCleaners: e.target.value }))} /></div>
              <div><Label htmlFor="svc-notice">Notice (h)</Label>
                <Input id="svc-notice" inputMode="numeric" value={form.minimumNoticeHours}
                  onChange={e => setForm(f => ({ ...f, minimumNoticeHours: e.target.value }))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave any of these empty if nobody has measured it. They are shown to whoever is booking —
              quotes are still worked out in Price Calculator.
            </p>

            <div><Label htmlFor="svc-customer-desc">Description customers see</Label>
              <Textarea id="svc-customer-desc" rows={2} value={form.customerDescription}
                onChange={e => setForm(f => ({ ...f, customerDescription: e.target.value }))} /></div>

            <div><Label htmlFor="svc-internal-desc">Internal notes for the team</Label>
              <Textarea id="svc-internal-desc" rows={2} value={form.internalDescription}
                onChange={e => setForm(f => ({ ...f, internalDescription: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Office and cleaners only — never shown to a customer.</p></div>

            <div className="grid grid-cols-2 gap-3 items-end">
              {/**
                * 🔴 Roberto, 21/08/2026: *„si intrun serviciu… order on the form??? Cum imi dau seama
                * mai repeee?"*. ⛔ Eticheta singură nu spune nici la ce folosește cifra, nici că e
                * inofensivă. ⚠️ Explicația stă **lângă câmp**, nu doar în panoul de ajutor: cine se
                * uită la o căsuță cu „100" în ea nu deschide un panou ca să afle ce e.
                */}
              <div><Label htmlFor="svc-order">Where it sits in the list</Label>
                <Input id="svc-order" inputMode="numeric" value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
                <p className="text-xs text-muted-foreground mt-1">
                  Position only — 10 shows above 20, 20 above 100. Nothing else uses it.
                </p></div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox id="svc-active" checked={form.active}
                  onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))} />
                <Label htmlFor="svc-active">Offered to customers</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Switching a service off takes it off new quote forms. Jobs and quotes that already use it
              are not touched.
            </p>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>

            {/**
              * §8 felia a doua — subserviciile. ⛔ Doar la EDITARE: o poziție are nevoie de un
              * serviciu existent sub care să stea, iar serviciul nu există până nu e salvat.
              */}
            {editItem && <ServiceItemsSection service={editItem} onChanged={load} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

