import { useState } from 'react';
import { BellRing, BellOff, Loader2, Smartphone, AlertTriangle, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import { usePushNotifications } from '@/lib/usePushNotifications';
import { getPushDevices, removePushDevice, testPushDevice } from '@/lib/endpoints';

/**
 * Sesiunea 35 (ACHU-235). The control for out-of-app notifications, shown inside
 * the notification panel — where somebody wondering "why didn't I get told about
 * this?" is already looking.
 *
 * ─── The design problem: every failure mode is silent ────────────────────
 * Push can fail because the browser blocked it, because the server has no keys,
 * because this is an iPhone that has not been added to the Home Screen, or because
 * the service worker never activated. In every one of those cases a naive UI shows
 * an Enable button that does nothing when tapped, and the user concludes the
 * feature — or the app — is broken.
 *
 * So this component never shows a button it cannot honour. It states which
 * situation you are in and what to do about it, and it always offers a **Test**
 * once enabled, because "it says it's on" and "a notification actually reaches my
 * phone" are different claims and only the second one matters.
 */
export default function PushSettings() {
  const push = usePushNotifications();
  const [working, setWorking] = useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setWorking(true);
    const res = await fn();
    setWorking(false);
    if (res.ok) toast.success(res.message);
    // Long-lived, because these messages are instructions (browser settings, Add to
    // Home Screen) and not acknowledgements — a three-second toast is unreadable
    // for something you have to act on.
    else toast.error(res.message, { duration: 10000 });
  };

  if (push.busy && !push.configured && !push.unsupportedReason) {
    return (
      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Checking notification settings…
      </div>
    );
  }

  // ─── Cannot work here ────────────────────────────────────────────────
  if (!push.supported) {
    return (
      <div className="border-t border-border bg-muted/30 px-3 py-2.5">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {/* On iPhone this is the two-step instruction, not a dead end. */}
          <span>{push.unsupportedReason}</span>
        </p>
      </div>
    );
  }

  // ─── Server not set up ───────────────────────────────────────────────
  if (!push.configured) {
    return (
      <div className="border-t border-border bg-muted/30 px-3 py-2.5">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          {/* Deliberately not an Enable button that would 503. */}
          <span>Alerts on your phone are not set up yet. Ask Roberto to finish the setup in Railway.</span>
        </p>
      </div>
    );
  }

  const blocked = push.permission === 'denied';

  return (
    <div className="border-t border-border px-3 py-2.5 space-y-2">
      {blocked ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {/* A denied permission cannot be re-requested from code, so offering a
              button here would be a button that provably does nothing. */}
          <span>
            Notifications are <strong>blocked</strong> for this site in your browser. To allow them, tap the
            padlock (or site settings) next to the address bar and switch Notifications to Allow.
          </span>
        </p>
      ) : push.linkedToAnotherAccount ? (
        /**
         * 🔴 ACHU-436 (Sesiunea 95). This branch must come BEFORE `subscribed`, because
         * `subscribed` is true here — that is the whole defect. The browser holds a
         * push endpoint, so the old UI said "Alerts are on for this device", while the
         * server had that endpoint registered to a DIFFERENT ACHU account and would
         * never send anything here.
         *
         * ⚠️ Reported by the owner: an enquiry notification reached the office bell and
         * never his phone, because the day before he had switched alerts on for the same
         * phone in the customer portal. One browser holds one endpoint, the endpoint is
         * unique, and subscribing re-assigns it — so a second account silently takes the
         * alerts from the first.
         *
         * ⛔ The button does NOT promise both accounts can have it. It says which one
         * is losing it, because that is the part the person cannot see.
         */
        <>
          <p className="flex items-start gap-1.5 text-xs">
            <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              This device sends alerts to a <strong>different ACHU account</strong> — nothing will
              arrive here. A phone can be linked to one account at a time.
            </span>
          </p>
          <button
            onClick={() => run(push.enable)}
            disabled={working}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            {working ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellRing className="h-3 w-3" />}
            Send alerts to this account instead
          </button>
          <p className="text-[11px] text-muted-foreground">
            The other account stops getting alerts on this device. Use another phone, or a
            browser you are not signed into, if you need both.
          </p>
        </>
      ) : push.subscribed ? (
        <>
          <p className="flex items-center gap-1.5 text-xs">
            <BellRing className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>Alerts are <strong>on</strong> for this device.</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => run(push.test)}
              disabled={working}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              {working ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Send a test
            </button>
            <button
              onClick={() => run(push.disable)}
              disabled={working}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <BellOff className="h-3 w-3" />Turn off
            </button>
          </div>
          {push.deviceCount > 1 && (
            <p className="text-[11px] text-muted-foreground">
              {/* Worth knowing: someone who replaced a phone may be sending alerts
                  to a device in a drawer. */}
              Alerts are on for {push.deviceCount} of your devices.
            </p>
          )}
          <PushDevicesList />
        </>
      ) : (
        <>
          <button
            onClick={() => run(push.enable)}
            disabled={working}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
            Get alerts on this device
          </button>
          <p className="text-[11px] text-muted-foreground">
            {/* Says what it actually does, and — honestly — what it does not.
                Promising "you'll always know" would be over-claiming: a push is
                best-effort and a phone that is off receives nothing. */}
            Tells you about new direct messages even when ACHU is closed. Your browser will ask permission first.
          </p>
        </>
      )}
    </div>
  );
}

type PushDevice = {
  id: string; userAgent: string | null; createdAt: string; lastSuccessAt: string | null;
  /** 🆕 §20 (Sesiunea 155) — starea și propoziția vin de la server. Vezi `lib/pushDeviceState.ts`. */
  status?: 'failing' | 'delivered' | 'waiting';
  label?: string;
  needsAttention?: boolean;
};

/**
 * ACHU-263 — the backend routes and endpoint wrappers existed with zero UI
 * callers: you could not see which phones were registered for alerts, and a
 * lost or replaced phone kept a live entry with no way to remove it.
 *
 * Loaded on demand rather than with the rest of the panel — most people never
 * need it, and it is the one part of this screen that costs a network call.
 */
function PushDevicesList() {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<PushDevice[] | null>(null);
  /** 🆕 §20 (Sesiunea 155) — ce NU poate arăta lista, scris de server. */
  const [note, setNote] = useState<string>('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** 🆕 §20 (Sesiunea 158) — care rând așteaptă răspunsul de la propriul telefon. */
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    if (devices) return;
    try {
      const res = await getPushDevices();
      setDevices(res.devices);
      setNote(res.note ?? '');
    } catch {
      toast.error('Could not load your devices.');
      setOpen(false);
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      await removePushDevice({ id });
      setDevices(prev => prev?.filter(d => d.id !== id) ?? prev);
    } catch {
      toast.error('Could not remove that device. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  /**
   * ─── 🆕 §20 „Retry failed message" (Sesiunea 158) — JUMĂTATEA VIZIBILĂ ──────────────────
   *
   * ⛔ **Rândul spunea „acest telefon eșuează" și nu avea niciun buton lângă el** (ACHU-786 a adus
   * propoziția, ruta a venit la 157, butonul n-a încăput: poarta de octeți era la `975/975`, iar
   * pragul l-a mutat Roberto pe 27/08/2026). 🔴 Deci se vedea problema și nu se putea încerca nimic.
   *
   * ⚠️ **Verdictul înlocuiește rândul, nu doar afișează un mesaj:** o livrare reușită pune
   * numărătoarea de eșecuri pe zero, deci starea de pe ecran trebuie să devină cea de ACUM — altfel
   * omul apasă, primește „a mers", și rândul continuă să-i spună roșu că eșuează.
   *
   * ⛔ Un dispozitiv **scos** de server dispare din listă: nu mai are ce reîncerca.
   */
  const test = async (id: string) => {
    setTestingId(id);
    try {
      const res = await testPushDevice({ id });
      if (res.removed) setDevices(prev => prev?.filter(d => d.id !== id) ?? prev);
      else if (res.device) setDevices(prev => prev?.map(d => (d.id === id ? res.device! : d)) ?? prev);
      /** Propoziția e a serverului; ecranul alege doar tonul. */
      if (res.verdict === 'sent') toast.success(res.message);
      else toast.warning(res.message, { duration: 8000 });
    } catch {
      toast.error('Could not send a test to that device. Please try again.');
    } finally {
      setTestingId(null);
    }
  };

  if (!open) {
    return (
      <button onClick={load} className="text-[11px] text-muted-foreground underline hover:text-foreground">
        Manage devices
      </button>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-border p-2">
      {devices === null ? (
        <p className="text-[11px] text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading your devices…</p>
      ) : devices.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No devices registered.</p>
      ) : devices.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-2 text-[11px]">
          <div className="min-w-0">
            <p className="truncate text-foreground">{d.userAgent ?? 'Unknown device'}</p>
            {/*
              🆕 §20 „Delivery status" (Sesiunea 155). ⛔ Rândul spunea doar data ultimei alerte,
              deci un telefon care EȘUEAZĂ arăta identic cu unul liniștit — iar la al treilea eșec
              dispărea din listă cu totul. 🔴 Acum propoziția vine de la server și numește starea;
              roșul e rezervat singurei care cere ceva de la om.
            */}
            <p className={d.needsAttention ? 'text-destructive' : 'text-muted-foreground'}>
              {d.needsAttention && <AlertTriangle className="mr-1 inline h-3 w-3" />}
              {d.label ?? (d.lastSuccessAt
                ? `Last alert ${new Date(d.lastSuccessAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })}`
                : 'No alert sent yet')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/*
              ⚠️ **Butonul stă pe FIECARE rând, nu doar pe cele roșii.** ⛔ Pus numai lângă starea
              `failing`, ar fi lipsit exact de pe rândul „nimic trimis încă" — telefonul despre care
              omul chiar nu știe dacă merge. 🔴 „Retry" e cuvântul din backlog, dar eticheta spune ce
              face butonul: trimite acum. Un „Retry" pe un rând care n-a eșuat niciodată n-ar avea sens.
            */}
            <button
              onClick={() => test(d.id)}
              disabled={testingId === d.id || removingId === d.id}
              aria-label={`Send a test alert to ${d.userAgent ?? 'this device'}`}
              title={`Send a test alert to ${d.userAgent ?? 'this device'}`}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {testingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
            <button
              onClick={() => remove(d.id)}
              disabled={removingId === d.id || testingId === d.id}
              aria-label={`Remove ${d.userAgent ?? 'this device'}`} title={`Remove ${d.userAgent ?? 'this device'}`}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
            >
              {removingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </button>
          </div>
        </div>
      ))}
      {/* 🔴 Ce NU poate arăta lista: un telefon care a murit de tot nu mai are rând aici. */}
      {note && devices && devices.length > 0 && (
        <p className="pt-1 text-[11px] text-muted-foreground">{note}</p>
      )}
    </div>
  );
}

