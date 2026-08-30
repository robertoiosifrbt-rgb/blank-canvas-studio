import { useEffect, useState } from 'react';
import { roleLabel, ROLE_MEANS } from '@/lib/roleLabels';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { lookupInvitation, acceptInvitation } from '@/lib/endpoints';
import { useAuth } from '@/lib/useAuth';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-142: reached at /accept-invite?token=... — by the time a signed-in
 * user lands here they already have some role (at minimum Customer, from
 * RoleProvider's auto-provisioning), so this doesn't need to bypass the
 * normal role gate. Accepting upgrades their account to the invited role.
 */
export default function AcceptInvitePage() {
  const { logout } = useAuth();
  const [sp] = useSearchParams();
  const token = sp.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'invalid' | 'ready' | 'accepting' | 'done' | 'error'>('loading');
  const [preview, setPreview] = useState<{ email: string; role: string } | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!token) { setState('invalid'); setReason('No invitation token provided.'); return; }
    lookupInvitation({ token })
      .then(r => {
        if (!r.valid) {
          setState('invalid');
          setReason(
            r.reason === 'expired' ? 'This invitation has expired.' :
            r.reason === 'revoked' ? 'This invitation has been revoked.' :
            r.reason === 'accepted' ? 'This invitation has already been accepted.' :
            'This invitation was not found.',
          );
          return;
        }
        setPreview({ email: r.email, role: r.role });
        setState('ready');
      })
      .catch(() => { setState('invalid'); setReason('Unable to check this invitation. Please try again.'); });
  }, [token]);

  const handleAccept = async () => {
    setState('accepting');
    try {
      await acceptInvitation({ token });
      setState('done');
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (e) {
      setState('error');
      setReason(errMsg(e) || 'Failed to accept invitation.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center max-w-sm">
        {state === 'loading' && <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-muted-foreground" />}

        {state === 'invalid' && (
          <>
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Invitation unavailable</h1>
            <p className="text-muted-foreground">{reason}</p>
          </>
        )}

        {(state === 'ready' || state === 'accepting') && preview && (
          <>
            <MailCheck className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">You've been invited</h1>
            <p className="text-muted-foreground mb-6">
              {/* 🔴 Aici omul află CE devine, deci pe lângă nume merge și propoziția: „Super Admin"
                  singur nu spune nimănui că are control pe bani și pe accesul celorlalți. */}
              Accept to become <strong>{roleLabel(preview.role)}</strong> with the email <strong className="break-all">{preview.email}</strong>.
              {ROLE_MEANS[preview.role] && (
                <span className="mt-1 block text-xs text-muted-foreground">{ROLE_MEANS[preview.role]}</span>
              )}
              Make sure you're signed in as that email before continuing.
            </p>
            <Button onClick={handleAccept} disabled={state === 'accepting'}>
              {state === 'accepting' ? 'Accepting...' : 'Accept Invitation'}
            </Button>
            {/* ACHU-341: offered before the mismatch happens, not just after —
                this page is reached from an email link, often on a phone
                already signed into a different account. */}
            <p className="mt-4 text-xs text-muted-foreground">
              Signed in as someone else?{' '}
              <button onClick={logout} className="underline hover:text-foreground">Sign out</button>
            </p>
          </>
        )}

        {state === 'done' && (
          <>
            <MailCheck className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Invitation accepted</h1>
            <p className="text-muted-foreground">Redirecting you now...</p>
          </>
        )}

        {state === 'error' && (
          <>
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Couldn't accept invitation</h1>
            <p className="text-muted-foreground mb-4">{reason}</p>
            {/* ACHU-341: "Try Again" alone was a dead end here — it re-runs the
                same deterministic email check against the same signed-in
                session, which fails again for the same reason every time. */}
            {reason.toLowerCase().includes('different email') ? (
              <Button variant="outline" onClick={logout}>Sign out and switch account</Button>
            ) : (
              <Button variant="outline" onClick={() => setState('ready')}>Try Again</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

