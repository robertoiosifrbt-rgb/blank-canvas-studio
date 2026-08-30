import { useEffect, useState, useRef } from 'react';
import { getCustomerPortal, updateCustomerProfile, getMyData } from '@/lib/endpoints';
import { withTimeout } from '@/lib/useTrackedRequest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Pencil, Check, X, Loader2, RefreshCw, Info, UserCog, Star, Download, UserX, TriangleAlert } from 'lucide-react';
import { StatusBadge } from '@/lib/format';
import { toast } from 'sonner';
// ACHU-558 — cum vrea clientul să fie contactat. Vezi antetul componentei.
import ContactPreferences from './ContactPreferences';
import { LIMITS } from '@/lib/validation';
import { errMsg } from '@/lib/errorMessage';
import type { PortalCustomer } from './portalTypes';

function AccountRow({ label, value, badge }: { label: string; value?: string; badge?: boolean }) {


  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      {badge && value ? <StatusBadge status={value} /> : <span className="text-sm font-medium text-right break-words min-w-0">{value || '—'}</span>}
    </div>
  );
}

export default function MyAccount({ customer, onUpdated, onRequest, onCloseAccount, googleReviewUrl, canInvitePublicReview = true }: {
  customer: PortalCustomer; onUpdated: (c: PortalCustomer) => void; onRequest: () => void; onCloseAccount: () => void; googleReviewUrl?: string | null;
  /**
   * ACHU-553 — dacă acestui client i se poate cere o recenzie publică. **Decis pe server**
   * (`publicReviewPolicy.ts`); ecranul nu vede reclamațiile lui.
   *
   * ⚠️ Implicit `true`, ca un backend mai vechi care nu trimite câmpul să păstreze
   * comportamentul de dinainte — link-ul depinde oricum de `googleReviewUrl`.
   */
  canInvitePublicReview?: boolean;
}) {


  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(customer.phone || '');
  const [address, setAddress] = useState(customer.address || '');
  const [postcode, setPostcode] = useState(customer.postcode || '');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /**
   * ACHU-528 — descarcă exportul ca fișier JSON.
   *
   * ⚠️ `revokeObjectURL` imediat după click, ca la exportul de backup
   * (`admin/BackupPage.tsx:47`): fișierul e dosarul complet al persoanei, deci nu are ce
   * să caute ca URL viu în pagină mai mult decât durează clickul.
   *
   * ⛔ Numele fișierului NU conține numele clientului: ajunge într-un folder Downloads
   * pe care îl poate vedea altcineva de pe același calculator. Data e destul ca să-l
   * recunoască.
   */
  const handleDownloadData = async () => {
    setDownloading(true);
    try {
      const res = await getMyData();
      const blob = new Blob([JSON.stringify(res.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-achu-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Your data has been downloaded.');
    } catch (e) {
      // ⛔ Niciun „succes" pe un fișier care nu a plecat — tiparul ACHU-520, unde
      // aplicația spunea „Photo deleted" și fișierul rămânea.
      toast.error(errMsg(e) || 'Could not prepare your file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };
  const [error, setError] = useState('');
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleEdit = () => {
    setPhone(customer.phone || '');
    setAddress(customer.address || '');
    setPostcode(customer.postcode || '');
    setError('');
    setNeedsReconcile(false);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setNeedsReconcile(false);
  };

  const reconcileAndRetry = async () => {
    // Reload server state before allowing another save
    const mySeq = ++seqRef.current;
    setSaving(true);
    setError('');
    try {
      const fresh = await withTimeout(getCustomerPortal({}), 30000);
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      if (fresh.customer) {
        onUpdated(fresh.customer);
        // Re-populate form with server state
        setPhone(fresh.customer.phone || '');
        setAddress(fresh.customer.address || '');
        setPostcode(fresh.customer.postcode || '');
      }
      setNeedsReconcile(false);
      setError('');
      toast('Server state reloaded — review and save again.');
    } catch {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setError('Could not reload server state. Please try again.');
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (needsReconcile) {
      await reconcileAndRetry();
      return;
    }

    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    if (!trimmedPhone) { setError('Phone is required.'); return; }
    if (trimmedPhone.length > LIMITS.phone) { setError(`Phone cannot exceed ${LIMITS.phone} characters.`); return; }
    if (!trimmedAddress) { setError('Address is required.'); return; }

    // ACHU-121: Send postcode as trimmed string — empty string clears, non-empty updates
    const trimmedPostcode = postcode.trim();

    const mySeq = ++seqRef.current;
    setSaving(true);
    setError('');
    try {
      const res = await withTimeout(
        updateCustomerProfile({ phone: trimmedPhone, address: trimmedAddress, postcode: trimmedPostcode }),
        30000,
      );
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      toast.success('Details updated successfully.');
      /**
       * 🔴 ACHU-752 — ÎMBINAT peste clientul de acum, nu pus în locul lui. Ruta întoarce doar
       * cele șapte câmpuri pe care le-a atins; clientul din portal are mai multe. Înlocuirea
       * ștergea de pe ecran nota scrisă de birou pentru el (ACHU-549) și preferințele lui de
       * contact (ACHU-558), imediat sub un mesaj care spunea „updated successfully".
       * ⚠️ Exact defectul ACHU-292, reintrodus de câmpurile adăugate după el.
       */
      onUpdated({ ...customer, ...res.customer });
      setEditing(false);
    } catch (e) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      const isTimeout = errMsg(e) === 'Request timed out';
      setError(errMsg(e) || 'Unable to save. Please try again.');
      if (isTimeout) setNeedsReconcile(true);
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />My Account</CardTitle>
            {!editing && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Details
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 🔴 ACHU-549 — mesajul biroului către ACEST client, primul lucru pe fișă.
              ⚠️ E singurul câmp scris de birou pe care clientul îl vede; `notes` rămâne
              intern și nu se trimite deloc. Pus SUS, nu jos: dacă biroul s-a obosit să
              scrie ceva pentru el, nu e util sub adresa lui. */}
          {customer.customerVisibleNote && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />A note from us
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{customer.customerVisibleNote}</p>
            </div>
          )}

          <AccountRow label="Name" value={customer.customerName} />
          <AccountRow label="Email" value={customer.email} />

          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <Separator />
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className="text-sm">Phone <span className="text-destructive">*</span></Label>
                <Input id="edit-phone" value={phone} onChange={e => setPhone(e.target.value)} maxLength={LIMITS.phone} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-address" className="text-sm">Address <span className="text-destructive">*</span></Label>
                <Input id="edit-address" value={address} onChange={e => setAddress(e.target.value)} maxLength={LIMITS.address} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-postcode" className="text-sm">Postcode</Label>
                <Input id="edit-postcode" value={postcode} onChange={e => setPostcode(e.target.value)} maxLength={20} placeholder="e.g. SW1A 1AA" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Separator />
              {customer.customerType && <AccountRow label="Account Type" value={customer.customerType} />}
              <AccountRow label="Status" value={customer.status} badge />
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="flex-1" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</> : needsReconcile ? <><RefreshCw className="h-4 w-4 mr-1.5" />Reload &amp; Retry</> : <><Check className="h-4 w-4 mr-1.5" />Save Changes</>}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-1.5" />Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <AccountRow label="Phone" value={customer.phone} />
              <AccountRow label="Address" value={customer.address} />
              <AccountRow label="Postcode" value={customer.postcode} />
              {customer.customerType && <AccountRow label="Account Type" value={customer.customerType} />}
              <AccountRow label="Status" value={customer.status} badge />
            </>
          )}
        </CardContent>
      </Card>
      {/* ─── ACHU-553 (Sesiunea 121) — MUTAT AICI, SUS ────────────────────────
          🔴 **Semnalat de Archana, 12/08/2026:** *„Linkul este deja in customer portal…
          dar e ascuns sub detalii pe undeva… as vrea si ala sa fie mai vizibil"*.

          ⚠️ Era **penultimul card al ecranului**, între „Download my data" (export GDPR) și
          „Close my account" (ștergerea contului). Adică o invitație la o recenzie pozitivă
          stătea înconjurată de birocrație și de cea mai distructivă acțiune din portal — un
          client mulțumit n-avea niciun motiv să ajungă până acolo.

          ✅ Acum e **primul card sub datele contului**, iar invitația principală apare oricum
          în alt loc: lângă nota pe care clientul tocmai a dat-o (`JobRatingPanel.tsx`).

          ⛔ **Ascuns complet, nu dezactivat**, în trei cazuri: nu există link (nimeni nu l-a
          completat în Invoice Settings), sau serverul spune că acestui client **nu** i se cere
          o recenzie — vezi `backend/src/lib/publicReviewPolicy.ts`. Un buton care nu duce
          nicăieri, sau o invitație către omul care s-a plâns săptămâna trecută, sunt amândouă
          mai rele decât nimic. */}
      {googleReviewUrl && canInvitePublicReview && (
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm">Happy with our service?</p>
            <Button variant="outline" size="sm" asChild>
              <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer">
                <Star className="h-3.5 w-3.5 mr-1.5" />Leave a Google review
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
      {/*
        ACHU-558 — cum vrea să fie contactat. Randată doar dacă serverul trimite câmpul:
        un backend mai vechi nu-l are, iar o secțiune goală ar cere o alegere fără opțiuni.
      */}
      {customer.contactPreference && (
        <ContactPreferences
          preference={customer.contactPreference}
          onSaved={next => onUpdated({ ...customer, contactPreference: { ...customer.contactPreference!, ...next } })}
        />
      )}

      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            If your name or email is incorrect, please contact ACHU to update your details.
          </p>
          <Button variant="outline" size="sm" onClick={onRequest}>
            <UserCog className="h-3.5 w-3.5 mr-1.5" />Request a name/email correction
          </Button>
        </CardContent>
      </Card>
      {/* ACHU-528 (Sesiunea 118, Backlog_Client_Prioritar §1) — dreptul de acces al
          clientului, exercitat de el. Exportul exista, dar numai la Admin, deci un client
          care voia datele lui trebuia să le ceară biroului și să aștepte.
          ⛔ Nu e o cerere către birou, ca celelalte butoane de aici: se descarcă pe loc.
          Serverul știe cine ești din sesiune — vezi `getMyData`. */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            You can download everything ACHU holds about you, at any time.
          </p>
          <Button variant="outline" size="sm" onClick={handleDownloadData} disabled={downloading}>
            {downloading
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Preparing your file…</>
              : <><Download className="h-3.5 w-3.5 mr-1.5" />Download my data</>}
          </Button>
        </CardContent>
      </Card>
      {/* ACHU-529 (Sesiunea 118) — închiderea contului, cerută de client.
          🔴 ULTIMUL card de pe ecran și singurul cu ton de avertisment, deliberat: e cea
          mai distructivă acțiune pe care o poate porni un client, iar un buton așezat
          lângă „Download my data" ar fi la un centimetru de o descărcare inofensivă.
          ⛔ Nu șterge nimic el însuși — deschide o CERERE. Anonimizarea e ireversibilă,
          deci o face biroul (vezi `customerRequestPolicy.ts`). */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            <TriangleAlert className="h-3 w-3 inline mr-1 text-destructive" />
            No longer need us? You can ask us to close your account and remove your personal details.
          </p>
          <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={onCloseAccount}>
            <UserX className="h-3.5 w-3.5 mr-1.5" />Request account closure
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

