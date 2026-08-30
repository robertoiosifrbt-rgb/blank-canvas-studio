import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { roleLabel } from '@/lib/roleLabels';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { closeAccountOnRequest, revokeAccountSessions, saveUserAccount, type UserAccountRow, type LinkOption } from '@/lib/endpoints';
import { toast } from 'sonner';
import AuditHistory from './AuditHistory';
import DiscardChangesDialog from '../shared/DiscardChangesDialog';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import { errMsg } from '@/lib/errorMessage';

export default function UserAccountDialog({ open, onClose, item, customers, cleaners, onSaved }: {
  open: boolean; onClose: () => void;
  /** `null` la creare. Forma vine de la funcția care produce rândul (`accountEndpoints.ts`). */
  item: UserAccountRow | null;
  customers: LinkOption[]; cleaners: LinkOption[]; onSaved: () => void;
}) {
  // ACHU-142: Admin and Cleaner can only be granted by accepting an invitation
  // (see the Invitations page) — this form can no longer create or promote to
  // either. It can still edit an account that already holds one of those
  // roles, or demote it to Customer.
  //
  // 🔴 ACHU-394 (Sesiunea 89): `ReadOnly`, `FinanceOnly` and `HROnly` were MISSING from
  // this list, and the effect was not cosmetic. The dropdown had no entry for the role the
  // account actually held, so opening such an account and pressing Save sent a role the
  // backend's schema rejected — including the save whose only change was to switch the
  // account OFF. An administrator could see a FinanceOnly account and could not
  // deactivate it, which is exactly what you need to do when somebody leaves.
  //
  // ⚠️ The current role is offered so it can be PRESERVED, never assigned: an account not
  // already holding it never sees it in the list, and the backend refuses the change
  // anyway (INVITATION_ONLY_ROLES in routes/userAccounts.ts). Two independent guards,
  // because this one is a dropdown and dropdowns are not a security boundary.
  //
  // 🔴 Sesiunea 144 — `SuperAdmin` intră în listă PENTRU EXACT ACELAȘI MOTIV, iar de data asta contul
  // atins ar fi al owner-ului. ⛔ Lipsă de aici, deschiderea propriului cont ar fi arătat un rol pe
  // care lista nu-l are, iar Save ar fi trimis `Admin` — adică **și-ar fi luat singur rolul mare**,
  // cu o apăsare, fără niciun avertisment. Aici e oferit ca să fie PĂSTRAT; backendul refuză mutarea
  // ÎN el oricum (`NEVER_GRANTABLE_ROLES`).
  type AccountRole = 'SuperAdmin' | 'Admin' | 'Cleaner' | 'Customer' | 'ReadOnly' | 'FinanceOnly' | 'HROnly';
  const INVITATION_ONLY: readonly AccountRole[] = ['SuperAdmin', 'Admin', 'Cleaner', 'ReadOnly', 'FinanceOnly', 'HROnly'];
  /**
   * ⚠️ Cast DELIBERAT, și e onest: `UserAccount.role` e o coloană `String` liberă în bază, deci
   * tipul rândului spune `string` — nu o uniune pe care baza n-o garantează. Îngustarea se face
   * aici, unde codul chiar tratează o valoare necunoscută: dacă rolul nu e în `INVITATION_ONLY`,
   * lista de mai jos oferă doar `Customer`. ⛔ Nu lărgi tipul rândului ca să dispară castul.
   */
  const currentRole = item?.role as AccountRole | undefined;
  /**
   * 🔴 **LA CREARE se pot alege toate rolurile, din Sesiunea 159 (hotărârea lui Roberto). LA EDITARE, nu.**
   *
   * ⛔ **Fără `SuperAdmin`**, în niciun caz: ăla se pune numai cu o linie de SQL, ca un Admin să nu-și
   * poată da singur controlul deplin dintr-un ecran.
   *
   * ⚠️ **Deosebirea creare/editare nu e o inconsecvență:** un cont NOU e o hotărâre a biroului despre
   * un om care nu e încă în aplicație; mutarea rolului unui cont EXISTENT schimbă ce poate face
   * cineva deja intrat, fără ca el să atingă nimic. ⛔ Serverul refuză oricum a doua (`PRIVILEGED_ROLES`
   * în `routes/userAccounts.ts`) — lista de aici e comoditate, nu pază: un dropdown nu e o graniță.
   *
   * 🔴 **De ce a căzut poarta de invitație:** aplicația nu are niciun expeditor de email sau SMS, deci
   * „invitația" era un cod arătat o dată pe ecran și trimis de om pe WhatsApp. Acum omul se
   * legitimează cu cutia lui de email, prin linkul de intrare. ⚠️ Autoritatea nu s-a lărgit: un Admin
   * putea deja acorda Admin, prin invitație (întrebarea „cine are voie" e ACHU-804).
   */
  const GRANTABLE_ON_CREATE: readonly AccountRole[] = ['Customer', 'Admin', 'Cleaner', 'ReadOnly', 'FinanceOnly', 'HROnly'];
  const roles: readonly AccountRole[] = item
    ? (currentRole && INVITATION_ONLY.includes(currentRole) ? [currentRole, 'Customer'] : ['Customer'])
    : GRANTABLE_ON_CREATE;
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'Customer' as AccountRole, customer: '', cleaner: '', active: true });
  /**
   * 🆕 §3 „Motiv de dezactivare" (Sesiunea 158) — DE CE s-a oprit contul.
   *
   * 🔴 Un cont oprit avea doar un comutator stins. ⚠️ Peste trei săptămâni nimeni nu mai putea spune
   * de ce — iar întrebarea vine mereu de la omul care nu mai poate intra, la telefon, la o oră la
   * care nimeni nu-și amintește. ⛔ **Opțional:** cine oprește un cont în grabă trebuie să poată
   * face asta acum, nu după ce compune o frază.
   */
  const [deactivationReason, setDeactivationReason] = useState('');
  /**
   * 🆕 §3 „Note administrative despre cont" (Sesiunea 158) — CE ȘTIE BIROUL DESPRE CONTUL ĂSTA.
   *
   * 🔴 **Despre cont, nu despre persoană:** „nu mai răspunde la telefon", „a cerut să fie oprit
   * temporar", „i-am trimis invitație de trei ori". ⚠️ Azi asemenea lucruri se spun pe chat și se
   * pierd — iar întrebarea revine la următorul om care deschide ecranul, de obicei la telefon.
   *
   * ⛔ **Ținută separat de `form`, ca motivul de dezactivare** — și nu din stil: `guard.track(form)`
   * hotărăște când apare „ai modificări nesalvate", iar nota se trimite `undefined` când nu s-a
   * atins, deci nu are ce compara cu o linie de bază.
   */
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [revoking, setRevoking] = useState(false);
  const [closing, setClosing] = useState(false);
  const revisionRef = useRef<string | undefined>(undefined);
  // Sesiunea 29 (backlog 46): guard against losing typed edits on a stray close.
  const guard = useUnsavedGuard({ onClose });
  guard.track(form);

  useEffect(() => {
    if (item) {
      // GET /user-accounts returns the raw Prisma record (customerId/cleanerId),
      // not the `customer`/`cleaner` names POST /save expects on input — those
      // are two different boundary conventions. Reading item.customer/item.cleaner
      // here always read undefined, so the dropdowns never showed the account's
      // real existing link when editing.
      const custId = Array.isArray(item.customerId) ? item.customerId[0] : item.customerId;
      const clId = Array.isArray(item.cleanerId) ? item.cleanerId[0] : item.cleanerId;
      const initial = { email: item.email ?? '', firstName: item.firstName ?? '', lastName: item.lastName ?? '', role: (item.role ?? 'Customer') as AccountRole, customer: custId ?? '', cleaner: clId ?? '', active: item.active ?? true };
      /** ⚠️ Se poate CORECTA cât timp contul e oprit: cine își amintește mai târziu trebuie să poată. */
      setDeactivationReason(typeof item.deactivationReason === 'string' ? item.deactivationReason : '');
      setNotes(typeof item.notes === 'string' ? item.notes : '');
      setForm(initial);
      guard.captureBaseline(initial);
      revisionRef.current = computeRevision(item, REVISION_FIELDS.userAccount);
    } else {
      const initial = { email: '', firstName: '', lastName: '', role: 'Customer' as const, customer: '', cleaner: '', active: true };
      setDeactivationReason('');
      setNotes('');
      setForm(initial);
      guard.captureBaseline(initial);
      revisionRef.current = undefined;
    }
    setError('');
  }, [item, open]);

  // FIX 4: When role changes, clear incompatible links
  const handleRoleChange = (newRole: AccountRole) => {
    setForm(f => {
      const updated = { ...f, role: newRole };
      // ⚠️ ACHU-394: the three narrow roles clear both links, exactly like Admin — they are
      // office roles, so no Customer or Cleaner record hangs off them. The backend refuses
      // a link on them too (OFFICE_ONLY_ROLES), so leaving one here would only produce a
      // save that fails validation for a reason the screen never showed.
      if (newRole === 'SuperAdmin' || newRole === 'Admin' || newRole === 'ReadOnly' || newRole === 'FinanceOnly' || newRole === 'HROnly') {
        updated.customer = '';
        updated.cleaner = '';
      } else if (newRole === 'Customer') {
        updated.cleaner = '';
      } else if (newRole === 'Cleaner') {
        updated.customer = '';
      }
      return updated;
    });
  };

  // FIX 4: Frontend validation — check required links
  const isMissingRequiredLink =
    form.active &&
    ((form.role === 'Customer' && !form.customer) ||
     (form.role === 'Cleaner' && !form.cleaner));

  const handleSave = async () => {
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (isMissingRequiredLink) {
      setError(form.role === 'Customer'
        ? 'An active Customer account must be linked to a Customer record.'
        : 'An active Cleaner account must be linked to a Cleaner record.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await saveUserAccount({
        ...form,
        customer: form.customer || undefined,
        cleaner: form.cleaner || undefined,
        /**
         * ⚠️ Se trimite **numai** când contul e oprit. ⛔ Pe unul activ serverul îl golește oricum —
         * dar a-l trimite ar fi însemnat că ecranul cere ceva ce nu s-a întâmplat.
         */
        deactivationReason: form.active ? undefined : (deactivationReason.trim() || null),
        /**
         * 🔴 §3 „Note administrative" — **`null` când e goală, niciodată `undefined` de aici.**
         *
         * ⚠️ Serverul citește cheia absentă ca „nu atinge" (`AGENT_RULES` §15). ⛔ Ecranul ăsta
         * **arată** caseta, deci a trimite `undefined` pentru o casetă golită de un om ar fi
         * însemnat că ștergerea unei note nu se salvează niciodată — iar omul ar vedea nota
         * întorcându-se la următoarea deschidere.
         */
        notes: notes.trim() || null,
        id: item?.id,
        _revision: revisionRef.current,
      });
      /**
       * 🔴 ACHU-401 (felia 13) — aici era o ramură `result.auditWarning` care spunea
       * *„Record saved, but audit history could not be updated"*. **Imposibilă, și mincinoasă
       * dacă ar fi apărut:** ruta de conturi scrie auditul cu `logAuditCritical`, care
       * ⛔ ARUNCĂ — o scriere de audit eșuată face salvarea să eșueze, deci nu există stare în
       * care rândul e salvat și auditul nu. Cererea ar fi ajuns în `catch`, nu aici. Câmpul nu
       * a existat niciodată în răspuns; `any` a lăsat ramura să pară vie. Scoasă, nu reparată.
       */
      if (result.message) {
        toast.success(result.message, { duration: 6000 });
      } else {
        toast.success(item ? 'Account updated' : 'User record created');
      }
      setAuditRefreshKey(k => k + 1);
      guard.markSaved();
      onSaved();
    } catch (e) {
      setError(errMsg(e) || 'Failed to save user account');
    } finally {
      setSaving(false);
    }
  };

  const showCustomerLink = form.role === 'Customer';
  const showCleanerLink = form.role === 'Cleaner';

  return (
    <Dialog open={open} onOpenChange={v => !v && guard.requestClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit User Account' : 'Create Account'}</DialogTitle>
          {!item && (
            /**
             * ⚠️ **Spune că NU trimitem nimic** — fiindcă nu trimitem: aplicația nu are expeditor de
             * email sau SMS. ⛔ Fără propoziția asta, biroul face contul și așteaptă un mesaj care nu
             * pleacă niciodată — exact ce se întâmpla cu codul de invitație, copiat pe WhatsApp.
             */
            <DialogDescription>
              Prepares the account. <strong>We do not email or text them anything.</strong> Tell the person to
              open the app, type this exact email address, and sign in with the link they receive — their role
              and any linked record are already waiting. {roleLabel('SuperAdmin')} is the one role this screen
              cannot give: it is set directly in the database on purpose.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="useraccoun-email">Email *</Label><Input id="useraccoun-email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="useraccoun-first-name">First Name</Label><Input id="useraccoun-first-name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
            <div><Label htmlFor="useraccoun-last-name">Last Name</Label><Input id="useraccoun-last-name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
          </div>
          <div><Label htmlFor="useraccoun-role">Role *</Label>
            <Select value={form.role} onValueChange={v => handleRoleChange(v as AccountRole)}>
              <SelectTrigger id="useraccoun-role"><SelectValue /></SelectTrigger>
              {/* ⚠️ Numele citit de om, dintr-un singur loc (`roleLabels.ts`) — nu valoarea din bază. */}
              <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {showCustomerLink && (
            <div>
              <Label htmlFor="useraccoun-link-to-customer">Link to Customer {form.active && <span className="text-destructive">*</span>}</Label>
              <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
                <SelectTrigger id="useraccoun-link-to-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.customerName}</SelectItem>)}</SelectContent>
              </Select>
              {form.active && !form.customer && <p className="text-xs text-destructive mt-1">Required for active Customer accounts</p>}
            </div>
          )}
          {showCleanerLink && (
            <div>
              <Label htmlFor="useraccoun-link-to-cleaner">Link to Cleaner {form.active && <span className="text-destructive">*</span>}</Label>
              <Select value={form.cleaner} onValueChange={v => setForm(f => ({ ...f, cleaner: v }))}>
                <SelectTrigger id="useraccoun-link-to-cleaner"><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                <SelectContent>{cleaners.map(c => <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>)}</SelectContent>
              </Select>
              {form.active && !form.cleaner && <p className="text-xs text-destructive mt-1">Required for active Cleaner accounts</p>}
            </div>
          )}
          <div className="flex items-center gap-2"><Checkbox id="useraccoun-active" checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))} /><Label htmlFor="useraccoun-active">Active</Label></div>

          {/*
            ─── 🆕 §1 „Revocarea tuturor sesiunilor active" (Sesiunea 160) ──────────────────
            ✅ Hotărârea lui Roberto, 29/08/2026: apasă și omul pe contul lui, și un Admin pe
            contul altcuiva, iar efectul e **de tot** — toate dispozitivele. „Se loghează iar."
            🔴 **Lângă caseta Active, dar NU e același lucru, și propoziția o spune:** un cont
            oprit nu mai poate intra deloc; ăsta îl scoate afară și îl lasă să intre înapoi.
            ⛔ Numai pe un cont care EXISTĂ: pe unul care se creează acum nu există sesiuni.
          */}
          {item?.id && (
            <div className="rounded border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Signed in on a lost phone?</p>
                  <p className="text-xs text-muted-foreground">
                    Signs this account out of every device. The account stays active — they can sign in again straight away.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={revoking}
                  onClick={async () => {
                    setRevoking(true);
                    try {
                      const result = await revokeAccountSessions(item.id);
                      /**
                       * ⚠️ `self` vine de la SERVER: dacă omul s-a scos pe el însuși, cererea
                       * următoare e refuzată. ⛔ Fără propoziția asta ar fi apăsat mai departe și ar
                       * fi primit erori fără să înțeleagă de ce.
                       */
                      toast.success(result.self
                        ? `Signed out of ${result.sessions} device(s) — including this one. Please sign in again.`
                        : `Signed out of ${result.sessions} device(s).`);
                      setAuditRefreshKey(k => k + 1);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Could not sign this account out.');
                    } finally {
                      setRevoking(false);
                    }
                  }}
                >
                  {revoking ? 'Signing out…' : 'Sign out of all devices'}
                </Button>
              </div>
            </div>
          )}

          {/*
            ─── 🆕 §1 „Închiderea contului" (Sesiunea 160) ──────────────────────────────────
            ✅ Hotărârea lui Roberto, 29/08/2026: contul NU se șterge decât la cererea omului;
            altfel se arhivează. ⛔ Deci butonul nu apare de la sine și nu se apasă „ca să facem
            curat" — se apasă când a cerut el.
            ⛔ **Nu pe conturi de client:** alea au drumul lor, care șterge și datele de business.
            ⚠️ Propoziția spune ce RĂMÂNE, nu doar ce pleacă — fișa de angajare are termen legal.
          */}
          {item?.id && !form.customer && (
            <div className="rounded border border-destructive/40 p-3">
              <p className="text-sm font-medium">They asked us to close their account</p>
              <p className="text-xs text-muted-foreground mb-2">
                Removes their email, name and account notes, and switches the account off. Their employment record stays —
                it has to be kept. Only do this when they have asked.
              </p>
              <Button
                type="button"
                variant="destructive"
                disabled={closing}
                onClick={async () => {
                  if (!window.confirm('Close this account at the person’s request? Their email, name and account notes are removed. This cannot be undone.')) return;
                  setClosing(true);
                  try {
                    const result = await closeAccountOnRequest(item.id, deactivationReason.trim() || undefined);
                    toast.success(result.alreadyClosed
                      ? 'This account was already closed.'
                      : result.employmentRecordKept
                        ? 'Account closed. The employment record has been kept.'
                        : 'Account closed.');
                    setAuditRefreshKey(k => k + 1);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not close this account.');
                  } finally {
                    setClosing(false);
                  }
                }}
              >
                {closing ? 'Closing…' : 'Close account'}
              </Button>
            </div>
          )}

          {/*
            ─── 🆕 §3 „Motiv de dezactivare" (Sesiunea 158) ─────────────────────────────────
            ⚠️ Apare **numai** când contul e oprit: pe unul activ ar fi o casetă care cere ceva ce
            nu s-a întâmplat. ⛔ Nu e obligatorie — un cont se oprește uneori în treizeci de secunde,
            iar o casetă obligatorie s-ar fi umplut cu „x".
            🔴 Ziua o pune serverul, nu ecranul: „de când nu mai poate intra" nu se scrie de la
            tastatură.
          */}
          {!form.active && (
            <div>
              <Label htmlFor="useraccoun-deactivation-reason">Why is it switched off? <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="useraccoun-deactivation-reason"
                value={deactivationReason}
                maxLength={300}
                onChange={e => setDeactivationReason(e.target.value)}
                placeholder="Left the company, phone lost, on hold…"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cleared automatically if the account is switched back on. The change itself stays in the audit history.
              </p>
            </div>
          )}
          {/*
            ─── 🆕 §3 „Note administrative despre cont" (Sesiunea 158) ──────────────────────
            ⚠️ **Mereu pe ecran**, nu doar pe contul oprit: e o notă despre cont, nu despre
            oprirea lui — iar cele mai utile se scriu cât contul e activ („a cerut să nu-l sunăm
            înainte de 10").
            ⛔ Propoziția de sub casetă spune DOUĂ lucruri, fiindcă amândouă se greșesc: nota o
            vede numai biroul (nu omul despre care e scrisă), și **se șterge** la o cerere GDPR.
          */}
          <div>
            <Label htmlFor="useraccoun-notes">Office notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="useraccoun-notes"
              value={notes}
              maxLength={2000}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything the next person opening this account should know…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Only the office sees this — never the person it is about. It is deleted if they ask for
              their data to be removed.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {item?.id && <AuditHistory entityType="UserAccount" entityId={item.id} refreshKey={auditRefreshKey} />}
          <Button className="w-full" onClick={handleSave} disabled={saving || isMissingRequiredLink}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogContent>
      <DiscardChangesDialog open={guard.confirmOpen} onDiscard={guard.discard} onKeepEditing={guard.keepEditing} />
    </Dialog>
  );
}

