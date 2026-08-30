/**
 * §4 „Multiple contacts per customer" (Sesiunea 160) — OAMENII DIN JURUL UNEI FIȘE.
 *
 * 🔴 **Ce rezolvă:** proprietarul plătește, chiriașul e acolo, agenția ține cheile. Până azi cele
 * trei numere stăteau, când stăteau, în caseta de note — deci nu se putea căuta după ele, iar
 * curățătorul de la ușă nu avea pe cine suna.
 *
 * ⛔ **Ecranul spune, în scris, că un contact NU e un cont.** Fără propoziția aia, cineva ar adăuga
 * aici agenția crezând că îi dă acces la portal, iar apoi ar aștepta ca ea să vadă vizitele.
 *
 * ⚠️ **Semnele se MUTĂ, și ecranul o spune înainte de salvare** — altfel biroul ar bifa „billing" pe
 * al doilea om și n-ar ști niciodată că l-a luat de la primul.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Trash2, Plus, Loader2, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCustomerContacts, addCustomerContact, deleteCustomerContact,
  type CustomerContact,
} from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';
import { CONTACT_ROLE_LABELS, CONTACT_FLAG_LABELS, contactRoleLabel } from '@/lib/customerContactLabels';

const EMPTY = { name: '', role: 'Tenant', phone: '', email: '', note: '', isPrimary: false, isBilling: false, isEmergency: false };

export default function CustomerContactsSection({ customerId }: { customerId: string }) {
  const [contacts, setContacts] = useState<CustomerContact[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    getCustomerContacts(customerId)
      .then(d => setContacts(d.contacts))
      .catch(() => setContacts([]));
  }, [customerId]);

  useEffect(load, [load]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addCustomerContact(customerId, {
        name: form.name.trim(),
        role: form.role,
        // ⚠️ `|| null`, nu șirul gol: „nu are email" și „are un email gol" nu sunt același lucru.
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        note: form.note.trim() || null,
        isPrimary: form.isPrimary,
        isBilling: form.isBilling,
        isEmergency: form.isEmergency,
      });
      setForm(EMPTY);
      setAdding(false);
      load();
      toast.success('Contact added');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact: CustomerContact) => {
    setBusyId(contact.id);
    try {
      await deleteCustomerContact(customerId, contact.id);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  };

  if (contacts === null) return null;

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Contacts
        </h4>
        <Button variant="outline" size="sm" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add contact
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        The other people around this customer — the tenant who is there, the letting agent who holds
        the keys, whoever pays. They are only names and numbers to ring:{' '}
        <strong>a contact cannot sign in and sees nothing</strong>. Portal access is a user account,
        set up under Team.
      </p>

      {contacts.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No contacts recorded.</p>
      )}

      {contacts.length > 0 && (
        <ul className="space-y-2">
          {contacts.map(c => (
            <li key={c.id} className="flex items-start justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{c.name}</span>
                  <Badge variant="outline">{contactRoleLabel(c.role)}</Badge>
                  {c.isPrimary && <Badge>{CONTACT_FLAG_LABELS.isPrimary}</Badge>}
                  {c.isBilling && <Badge variant="secondary">{CONTACT_FLAG_LABELS.isBilling}</Badge>}
                  {c.isEmergency && (
                    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                      {CONTACT_FLAG_LABELS.isEmergency}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground break-all">
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.email && <span className="inline-flex items-center gap-1 break-all"><Mail className="h-3 w-3" />{c.email}</span>}
                </div>
                {c.note && <p className="mt-1 text-xs">{c.note}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${c.name}`}
                title={`Remove ${c.name}`}
                disabled={busyId === c.id}
                onClick={() => handleDelete(c)}
              >
                {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-2 border-t pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="contact-role">Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger id="contact-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="contact-note">Note (optional)</Label>
            <Input id="contact-note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Only answers after 5pm" />
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            {(['isPrimary', 'isBilling', 'isEmergency'] as const).map(flag => (
              <label key={flag} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`contact-${flag}`}
                  checked={form[flag]}
                  onCheckedChange={v => setForm(f => ({ ...f, [flag]: v === true }))}
                />
                {CONTACT_FLAG_LABELS[flag]}
              </label>
            ))}
          </div>
          {/*
            🔴 Propoziția care evită întrebarea „de ce a dispărut de la celălalt?". Semnul se mută,
            deliberat — dar dacă ecranul n-ar spune-o, biroul ar afla din întâmplare.
          */}
          <p className="text-xs text-muted-foreground">
            Each of these belongs to one person at a time. Ticking one here takes it off whoever has
            it now — that is the point: “who do we ring?” has to have one answer.
          </p>

          <p className="text-xs text-muted-foreground">
            A phone number or an email is required — a name on its own does not help anybody standing
            at the door.
          </p>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Save contact
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setForm(EMPTY); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

