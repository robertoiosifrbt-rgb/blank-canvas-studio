/**
 * §19 „Manage properties" — CLIENTUL ÎȘI GESTIONEAZĂ CASELE, din portalul lui.
 *
 * ─── 🔴 DECIZIA ARCHANEI, 19/08/2026 ─────────────────────────────────────────
 * Complet: adaugă, redenumește, corectează adresa, alege principala, retrage una. 📜 Până azi,
 * portalul putea scrie **doar** instrucțiunile de acces (ACHU-576), fiindcă adresa casei
 * principale ESTE adresa de facturare. ⚠️ Consecința i-a fost spusă înainte de a alege.
 *
 * ─── CE SPUNE ECRANUL, ȘI DE CE FIECARE PROPOZIȚIE E ACOLO ───────────────────
 * 1. **„Asta e adresa mea principală"** poartă lângă ea că e adresa de pe factură. Un buton care
 *    mută unde pleacă facturile nu are voie să arate ca o preferință de afișare.
 * 2. **După o corectură de adresă**, propoziția despre vizitele deja programate — ele păstrează
 *    adresa cu care au fost programate. Vine de la SERVER, nu e scrisă aici: dacă regula se
 *    schimbă vreodată, se schimbă într-un loc.
 * 3. **„Nu mai curățăm aici"** spune că o poate reporni doar biroul. ⛔ Un buton de repornire ar
 *    anula tăcut o decizie a firmei.
 * 4. **Detaliile care mișcă prețul** (camere, băi, dotări) nu sunt pe ecran, și textul o spune:
 *    altfel un client care nu le găsește crede că aplicația e incompletă.
 *
 * ⚠️ Componentele sunt mici și primesc `onSaved`, ca `PropertyAccess.tsx` să rămână singurul loc
 * care ÎNCARCĂ lista: două ecrane care își peticesc fiecare starea sunt două adevăruri.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Home, Plus, Pencil, PowerOff, Loader2, Star, Info } from 'lucide-react';
import {
  addMyProperty, updateMyPropertyIdentity, makeMyPropertyPrimary, switchOffMyProperty,
} from '@/lib/endpoints';
import type { MyProperty } from '@/lib/propertyTypes';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

/** ⚠️ Textul apare în două locuri (adăugare și editare), deci e scris o dată. */
const OFFICE_CONFIRMS_DETAILS =
  'Rooms, size and price are set by ACHU — tell us anything else and we will confirm it with you.';

/** `''` → `null`: „nu s-a consemnat" nu e un text gol (`propertyPolicy.ts`, regula `null`). */
const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

export function AddMyProperty({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: '', address: '', postcode: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await addMyProperty({ label: form.label.trim(), address: orNull(form.address), postcode: orNull(form.postcode) });
      toast.success('Property added — we will confirm the details with you.');
      setForm({ label: '', address: '', postcode: '' });
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(errMsg(e) || 'Could not add that property. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setError(''); }}>
        <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Add a property
      </Button>
    );
  }

  return (
    <div className="rounded-md border p-2 space-y-2">
      <div className="text-sm font-medium flex items-center gap-1.5">
        <Home className="h-4 w-4" aria-hidden="true" />A property we should clean
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-property-label" className="text-xs">What do you call it?</Label>
        <Input
          id="new-property-label"
          value={form.label}
          placeholder="Home, Flat 2, Mum’s house…"
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-property-address" className="text-xs">Address</Label>
        <Input
          id="new-property-address"
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-property-postcode" className="text-xs">Postcode</Label>
        <Input
          id="new-property-postcode"
          value={form.postcode}
          onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))}
        />
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />{OFFICE_CONFIRMS_DETAILS}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving || form.label.trim() === ''}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}Add property
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * Ce se poate face cu o casă existentă.
 *
 * ⛔ Pe una **stinsă** nu se arată niciun buton: e o casă la care firma nu mai vine, iar orice
 * acțiune ar fi refuzată de server — un buton care refuză mereu e mai rău decât absența lui.
 */
export function MyPropertyControls({ property, onSaved }: { property: MyProperty; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: '', address: '', postcode: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  /** ⚠️ Confirmarea retragerii: a doua apăsare, nu un dialog — ca la ștergerea unui fit note. */
  const [confirmOff, setConfirmOff] = useState(false);

  if (!property.isActive) return null;

  const openEdit = () => {
    setForm({
      label: property.label,
      address: property.address ?? '',
      postcode: property.postcode ?? '',
    });
    setError('');
    setEditing(true);
  };

  const save = async () => {
    if (busy) return;
    setBusy('save');
    setError('');
    try {
      const res = await updateMyPropertyIdentity({
        id: property.id,
        label: form.label.trim(),
        address: orNull(form.address),
        postcode: orNull(form.postcode),
      });
      /**
       * 🔴 Propoziția vine de la SERVER (`notice`), nu e scrisă aici — și apare doar când adresa
       * s-a schimbat cu adevărat. `toast.warning`, nu `success`: e ceva ce omul trebuie să facă,
       * nu o confirmare.
       */
      if (res.notice) toast.warning(res.notice, { duration: 8000 });
      else toast.success('Saved.');
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const makePrimary = async () => {
    if (busy) return;
    setBusy('primary');
    try {
      await makeMyPropertyPrimary({ id: property.id });
      toast.success('This is now your main address — invoices will use it.');
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not change your main address.');
    } finally {
      setBusy('');
    }
  };

  const switchOff = async () => {
    if (busy) return;
    if (!confirmOff) { setConfirmOff(true); return; }
    setBusy('off');
    try {
      const res = await switchOffMyProperty({ id: property.id });
      toast.success(res.primaryMovedTo
        ? 'Taken off your list. Your main address moved to another property.'
        : 'Taken off your list. Tell us if you want it back.');
      setConfirmOff(false);
      onSaved();
    } catch (e) {
      // ⚠️ Cazul „ultima casă activă" ajunge aici, cu propoziția serverului, care spune ce să facă.
      toast.error(errMsg(e) || 'Could not take that off your list.');
    } finally {
      setBusy('');
    }
  };

  if (editing) {
    return (
      <div className="space-y-2 pt-1">
        <div className="space-y-1.5">
          <Label htmlFor={`label-${property.id}`} className="text-xs">Name</Label>
          <Input id={`label-${property.id}`} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`address-${property.id}`} className="text-xs">Address</Label>
          <Input id={`address-${property.id}`} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`postcode-${property.id}`} className="text-xs">Postcode</Label>
          <Input id={`postcode-${property.id}`} value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} />
        </div>
        {property.isPrimary && (
          <p className="text-xs text-muted-foreground">
            This is your main address, so your invoices will use it too.
          </p>
        )}
        <p className="text-xs text-muted-foreground">{OFFICE_CONFIRMS_DETAILS}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy !== '' || form.label.trim() === ''}>
            {busy === 'save' && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy !== ''}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-1">
      {property.isPrimary && (
        <Badge variant="secondary" className="text-xs font-normal">
          <Star className="h-3 w-3 mr-1 fill-current" aria-hidden="true" />Main address — used on invoices
        </Badge>
      )}
      <Button variant="ghost" size="sm" onClick={openEdit}>
        <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Name &amp; address
      </Button>
      {!property.isPrimary && (
        <Button variant="ghost" size="sm" onClick={makePrimary} disabled={busy !== ''}>
          {busy === 'primary' && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
          Make this my main address
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={confirmOff ? 'text-destructive' : 'text-muted-foreground'}
        onClick={switchOff}
        disabled={busy !== ''}
      >
        {busy === 'off' && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
        <PowerOff className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
        {/**
          * ⚠️ A doua apăsare confirmă, și textul spune **ce urmează**, nu „sigur?": omul trebuie să
          * știe că nu poate reporni singur, ÎNAINTE de apăsare, nu după.
          */}
        {confirmOff ? 'Tap again — only ACHU can put it back' : 'We do not clean here any more'}
      </Button>
      {confirmOff && (
        <Button variant="ghost" size="sm" onClick={() => setConfirmOff(false)} disabled={busy !== ''}>Cancel</Button>
      )}
    </div>
  );
}

