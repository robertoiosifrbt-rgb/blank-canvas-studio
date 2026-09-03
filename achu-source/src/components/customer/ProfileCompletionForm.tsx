import { useEffect, useState, useRef } from 'react';
import { updateCustomerProfile } from '@/lib/endpoints';
import { withTimeout } from '@/lib/useTrackedRequest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Info, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITS } from '@/lib/validation';
import { errMsg } from '@/lib/errorMessage';
import type { PortalCustomer } from './portalTypes';

export default function ProfileCompletionForm({ customer, needsPhone, needsAddress, onCompleted }: {
  customer: PortalCustomer;
  needsPhone: boolean;
  needsAddress: boolean;
  onCompleted: (c: PortalCustomer) => void;
}) {
  const [phone, setPhone] = useState(customer.phone || '');
  const [address, setAddress] = useState(customer.address || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    if (!trimmedPhone) { setError('Phone is required.'); return; }
    if (trimmedPhone.length > LIMITS.phone) { setError(`Phone cannot exceed ${LIMITS.phone} characters.`); return; }
    if (!trimmedAddress) { setError('Address is required.'); return; }

    const mySeq = ++seqRef.current;
    setSaving(true);
    setError('');
    try {
      const res = await withTimeout(
        updateCustomerProfile({ phone: trimmedPhone, address: trimmedAddress }),
        30000,
      );
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      toast.success('Profile updated successfully.');
      // ACHU-752 — îmbinat, nu înlocuit: ruta întoarce doar câmpurile pe care le-a atins.
      onCompleted({ ...customer, ...res.customer });
    } catch (e) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setError(errMsg(e) || 'Unable to save. Please try again.');
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-5 w-5" /> Complete Your Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/40 rounded-lg p-3 mb-5">
          <p className="text-sm text-muted-foreground">
            <Info className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            {needsPhone && needsAddress
              ? 'Please provide your phone number and address so we can contact you about bookings and deliver our services.'
              : needsPhone
                ? 'Please provide your phone number so we can contact you about bookings.'
                : 'Please provide your address so we can deliver our services.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone" className="text-sm">Phone {needsPhone && <span className="text-destructive">*</span>}</Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              maxLength={LIMITS.phone}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-address" className="text-sm">Address {needsAddress && <span className="text-destructive">*</span>}</Label>
            <Input
              id="profile-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter your address"
              maxLength={LIMITS.address}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Check className="h-4 w-4 mr-2" />Save &amp; Continue</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

