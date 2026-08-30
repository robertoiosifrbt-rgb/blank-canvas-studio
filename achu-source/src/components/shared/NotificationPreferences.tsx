/**
 * §42 „Notification preferences" (Sesiunea 142) — comutatoarele, în panoul clopoțelului.
 *
 * ─── De ce AICI, sub `PushSettings` ──────────────────────────────────────────
 * Panoul se deschide ca să CITEȘTI notificări, deci un bloc de setări deasupra listei ar sta în
 * drum de fiecare dată. ✅ Dedesubt, se găsește exact când cineva se întreabă *„de ce am primit
 * asta?"* — aceeași alegere, și pentru același motiv, ca la controlul de push (ACHU-235).
 *
 * ─── ⛔ CE NU FACE ACEST ECRAN ───────────────────────────────────────────────
 * **Nu știe ce se poate tăcea.** Grupurile, etichetele, propoziția de sus și refuzurile vin de la
 * server (`notificationPreferencePolicy.ts`). Un ecran cu lista lui ar rămâne în urmă exact când
 * se adaugă un tip nou: omul ar avea fie un comutator care nu taie nimic, fie un anunț despre care
 * nu poate spune nimic.
 *
 * ⚠️ **Se încarcă doar când e deschis.** Panoul clopoțelului se deschide de zeci de ori pe zi; o
 * cerere în plus la fiecare deschidere, pentru un ecran pe care omul îl atinge o dată pe an, e
 * chiar felul în care o listă devine lentă fără ca nimeni să înțeleagă de ce.
 */
import { useState } from 'react';
import { BellMinus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
/**
 * ⚠️ Direct din `notificationEndpoints`, NU prin `endpoints.ts`: acela e la plafonul lui de mărime
 * și nu re-exportă modulul ăsta (ACHU-401, felia 11). Aceeași cale ca `NotificationBell.tsx`.
 */
import { getNotificationPreferences, setNotificationPreference } from '@/lib/notificationEndpoints';
import { errMsg } from '@/lib/errorMessage';

type Group = { key: string; label: string; description: string; muted: boolean; mutedTypes: number; typeCount: number };

export default function NotificationPreferences() {
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState('');
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await getNotificationPreferences();
      setIntro(res.intro);
      setGroups(res.groups);
    } catch (e) {
      setError(errMsg(e) || 'Could not load your notification settings.');
    }
  };

  const toggle = async (group: Group) => {
    if (busy) return;
    setBusy(group.key);
    try {
      const next = !group.muted;
      await setNotificationPreference({ group: group.key, muted: next });
      /**
       * ⚠️ Se reîncarcă de la server, nu se petici starea locală: serverul e cel care spune dacă
       * un grup e închis **de tot** (toate tipurile lui), iar un `muted: true` pus de mână aici ar
       * putea arăta închis un grup pe jumătate închis — cea mai rea stare posibilă a unui comutator.
       */
      await load();
      toast.success(next ? `Switched off: ${group.label}` : `Switched back on: ${group.label}`);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="border-t p-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => { const next = !open; setOpen(next); if (next && !groups) void load(); }}
      >
        <BellMinus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">What you get told about</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!groups && !error && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Loading…
            </p>
          )}

          {groups && (
            <>
              {/* 🔴 Propoziția care spune de ce lista nu e completă. Vine de la server. */}
              <p className="text-[11px] leading-snug text-muted-foreground">{intro}</p>

              {groups.map(g => (
                <div key={g.key} className="rounded-md border p-2">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      /** ⚠️ Bifat = PRIMESC. Un comutator etichetat „muted" cere omului să gândească invers. */
                      checked={!g.muted}
                      disabled={busy !== ''}
                      onChange={() => void toggle(g)}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{g.label}</span>
                      <span className="block text-[11px] leading-snug text-muted-foreground">{g.description}</span>
                    </span>
                    {busy === g.key && <Loader2 className="ml-auto mt-0.5 h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />}
                  </label>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

