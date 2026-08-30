import { useState } from 'react';
import { takeSessionExpired, SESSION_EXPIRED_MESSAGE } from '@/lib/sessionExpiry';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import { BrandLogo } from './shared/BrandLogo';

/**
 * Replaces the hosted login page zite-auth-sdk used to redirect to —
 * Supabase Auth has no equivalent hosted UI, so the app owns this screen.
 * Matches zite.config.json's enabled methods: magic link (email) + Google.
 * SSO is not enabled there, so it's not offered here either.
 *
 * Sesiunea 13: redirect target was `window.location.origin` (bare "/"),
 * dropping the path+query of wherever the user actually started — most
 * concretely, an invited Admin/Cleaner opening /accept-invite?token=... who
 * isn't logged in yet would land here, sign in, and get bounced to "/" with
 * the invitation token gone. Fixed to `window.location.href`, so a
 * not-yet-authenticated deep link survives the round trip through Supabase.
 */
export default function LoginPage() {
  /**
   * 🆕 §1 „Mesaj clar pentru sesiune expirată" (Sesiunea 155).
   *
   * ⚠️ **Citit o SINGURĂ dată, la montare, și șters** (`takeSessionExpired`): lăsat pe loc, mesajul
   * ar apărea și mâine, la o intrare obișnuită — iar un avertisment care apare degeaba e unul pe
   * care omul învață să-l sară. ⛔ Nu e o eroare: nu se colorează roșu, fiindcă nimeni nu a greșit
   * nimic.
   */
  const [expired] = useState(() => takeSessionExpired());
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError('Enter your email address.'); return; }
    setState('sending');
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.href },
    });
    if (err) { setState('error'); setError(err.message); return; }
    setState('sent');
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (err) { setGoogleLoading(false); setError(err.message); }
    // On success the browser navigates to Google — nothing else to do here.
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><BrandLogo /></div>

        {/*
          🆕 §1 (Sesiunea 155) — ⚠️ **deasupra formularului, nu sub el:** e explicația pentru care
          omul e aici, iar sub câmpuri ar fi citit-o după ce își pune din nou emailul. ⛔ Ton neutru,
          nu roșu: nimeni nu a greșit nimic, doar a trecut timpul.
        */}
        {expired && (
          <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground" role="status">
            {SESSION_EXPIRED_MESSAGE}
          </p>
        )}

        {/*
          🔴 ACHU-788 (Sesiunea 157) — **ecranul ăsta nu se numea nicicum.** Singurul titlu al
          fișierului era cel de pe „Check your email", adică de DUPĂ ce omul a apăsat — deci primul
          ecran al aplicației, singurul pe care îl vede oricine înainte să intre, nu spunea unde
          este. ⚠️ Un cititor de ecran anunța o poză de logo și un câmp de email.
          ⛔ Titlul stă în afara ramurii, ca amândouă stările să aibă unul (cea de trimis are al ei,
          mai jos, care spune ce s-a întâmplat) — și e `h1`, fiindcă nu există nimic deasupra lui pe
          ecranul acesta.
        */}
        {/*
          ⚠️ Titlul singur, fără propoziție de sub el, și e o alegere măsurată: bucata de intrare se
          descarcă de TOATĂ lumea și e la plafon (§52), iar cele două butoane de mai jos —
          „Send sign-in link" și „Continue with Google" — spun deja singurele două feluri de intrare.
          ⛔ Ce nu se putea lăsa pe seama butoanelor e **numele ecranului**: acela nu se deduce.
        */}
        {state !== 'sent' && <h1 className="text-lg font-semibold text-center">Sign in to ACHU</h1>}

        {state === 'sent' ? (
          <div className="text-center space-y-3">
            <Mail className="h-10 w-10 mx-auto text-primary" />
            <h1 className="text-lg font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground break-words">We sent a sign-in link to {email}. Click it to continue.</p>
            <Button variant="ghost" size="sm" onClick={() => setState('idle')}>Use a different email</Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-border p-6 bg-card">
            <div className="space-y-1.5">
              <Label htmlFor="loginpage-email">Email</Label>
              <Input id="loginpage-email"
                type="email" value={email} placeholder="name@example.com" autoFocus
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMagicLink()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={sendMagicLink} disabled={state === 'sending'}>
              {state === 'sending' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send sign-in link
            </Button>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
            </div>
            <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={googleLoading}>
              {googleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Continue with Google
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

