import { useState } from 'react';
import { completeProfile } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from './shared/BrandLogo';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 15: shown once, for any account (auto-provisioned Customer or an
 * invitation-accepted Admin/Cleaner) that has no firstName/lastName saved yet
 * — neither the magic-link sign-in nor accepting an invitation ever asked
 * for a name. Blocks entry to the actual portal until this is filled in.
 * On success, reloads the page so RoleProvider re-fetches and the gate in
 * App.tsx sees the name is no longer missing.
 */
export default function CompleteProfilePage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f || !l) { setError('Enter both your first and last name.'); return; }
    setSaving(true);
    setError('');
    try {
      await completeProfile({ firstName: f, lastName: l });
      window.location.reload();
    } catch (e) {
      setSaving(false);
      setError(errMsg(e) || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><BrandLogo /></div>
        <div className="space-y-4 rounded-lg border border-border p-6 bg-card">
          <div>
            <h1 className="text-lg font-semibold">Complete your profile</h1>
            <p className="text-sm text-muted-foreground">Just your name — we'll only ask once.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="completepr-first-name">First name</Label>
            <Input id="completepr-first-name" value={firstName} placeholder="Jane" autoFocus onChange={e => setFirstName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="completepr-last-name">Last name</Label>
            <Input id="completepr-last-name" value={lastName} placeholder="Doe" onChange={e => setLastName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

