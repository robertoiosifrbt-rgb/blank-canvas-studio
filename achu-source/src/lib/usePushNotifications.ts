import { useCallback, useEffect, useState } from 'react';
import { getPushStatus, subscribeToPush, unsubscribeFromPush, sendTestPush } from '@/lib/endpoints';

/**
 * Sesiunea 35 (ACHU-235). Everything the browser side of Web Push needs, in one
 * place, because the failure modes are numerous and every one of them is silent.
 *
 * ─── The iOS problem, stated up front ───────────────────────────────────
 * On iPhone and iPad, Web Push works **only when the app has been added to the
 * Home Screen**. Not in Safari, not in Chrome for iOS — those use the same engine
 * and the same restriction. Apple added support in iOS 16.4 and gated it behind
 * installation.
 *
 * This is not a detail to bury. If ACHU's cleaners use iPhones, "turn on
 * notifications" is genuinely a two-step job, and a UI that offers a button
 * without saying so produces a user who taps it, sees nothing happen, and
 * concludes the feature is broken. `unsupportedReason` exists to say which
 * situation someone is in, in words they can act on.
 *
 * ─── Why permission is only ever requested from a click ─────────────────
 * Browsers ignore (and increasingly punish) a permission prompt on page load, and
 * it is hostile regardless: the first thing a new user sees should not be a modal
 * asking for something they have no context for. The hook exposes `enable()` for a
 * button to call; it never asks on its own.
 */

export type PushState = {
  /** The browser can do Web Push at all. */
  supported: boolean;
  /** Why not, in plain language, when `supported` is false. */
  unsupportedReason: string | null;
  /** The server has VAPID keys set up. */
  configured: boolean;
  /** Why not, when `configured` is false. */
  notConfiguredReason: string | null;
  /** Browser permission: 'default' (never asked), 'granted', 'denied'. */
  permission: NotificationPermission | 'unavailable';
  /**
   * This browser holds a push subscription.
   *
   * ⚠️ **A BROWSER-SIDE FACT ONLY** — it says the browser has an endpoint, NOT that
   * the server will send anything to it. See `linkedToAnotherAccount`.
   */
  subscribed: boolean;
  /** How many devices this account has subscribed, across all browsers. */
  deviceCount: number;
  /**
   * 🔴 ACHU-436 (Sesiunea 95) — the browser has a subscription and THIS ACCOUNT has
   * none, so nothing will ever be delivered here despite the screen looking enabled.
   *
   * A push endpoint is per-BROWSER, and `PushSubscription.endpoint` is UNIQUE, and
   * `push.ts`'s subscribe route deliberately RE-ASSIGNS `userId` on conflict (a shared
   * tablet must not deliver the previous person's messages to the next one). The
   * consequence nobody had drawn: **one browser can be linked to exactly one ACHU
   * account at a time**, and enabling alerts on a second account silently takes them
   * away from the first.
   *
   * ⚠️ Reported by the owner: the office notification for a new enquiry reached the
   * bell and never the phone, because the day before he had enabled alerts on the same
   * phone in the CUSTOMER portal, which moved the row to his customer account.
   *
   * ⛔ The old UI could not express this: `subscribed` came from
   * `pushManager.getSubscription()` — the browser — while delivery depends on a row
   * keyed to the signed-in user. It said "Alerts are on for this device" and was wrong
   * about the only thing that matters.
   *
   * Also true when the server dropped a dead endpoint (push.ts deletes on 404/410)
   * while the browser kept its subscription. The remedy is the same either way:
   * subscribe again, which re-claims the row for this account.
   */
  linkedToAnotherAccount: boolean;
  busy: boolean;
  error: string | null;
};

const IOS_HELP =
  'On iPhone and iPad, notifications only work once ACHU is added to the Home Screen. ' +
  'Open the Share menu, choose "Add to Home Screen", then open ACHU from the new icon and turn notifications on there.';

function detectSupport(): { supported: boolean; reason: string | null } {
  if (typeof window === 'undefined') return { supported: false, reason: null };

  // iOS is checked FIRST, because on an un-installed iPhone the APIs below are
  // genuinely absent — and "your browser does not support notifications" would be
  // both useless and slightly wrong, since the same browser supports them once
  // installed.
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    // iPadOS reports itself as a Mac; the touch-point check is the standard way to
    // tell an iPad from a desktop Safari.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // `matchMedia` is guarded rather than called directly: it is absent in some
  // embedded webviews (and in jsdom), and an exception thrown here would take down
  // the whole notification panel — turning "push is unavailable" into "the bell is
  // broken". Detection must never be the thing that fails.
  const isStandalone = (typeof window.matchMedia === 'function'
      && window.matchMedia('(display-mode: standalone)').matches)
    // Non-standard but the only signal older iOS gives.
    || (window.navigator as { standalone?: boolean }).standalone === true;

  if (isIos && !isStandalone) return { supported: false, reason: IOS_HELP };

  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'This browser cannot receive notifications. Chrome, Edge or Firefox will work.' };
  }
  if (!('PushManager' in window)) {
    return { supported: false, reason: 'This browser cannot receive notifications. Chrome, Edge or Firefox will work.' };
  }
  if (!('Notification' in window)) {
    return { supported: false, reason: 'This browser cannot show notifications.' };
  }
  // Web Push requires a secure context. localhost counts as secure, which is why
  // this is not simply a protocol check.
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Notifications need a secure (https) connection.' };
  }
  return { supported: true, reason: null };
}

/** Base64url → Uint8Array, the form `pushManager.subscribe` demands for the key. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function usePushNotifications() {
  const support = detectSupport();
  const [state, setState] = useState<PushState>({
    supported: support.supported,
    unsupportedReason: support.reason,
    configured: false,
    notConfiguredReason: null,
    permission: typeof Notification === 'undefined' ? 'unavailable' : Notification.permission,
    subscribed: false,
    deviceCount: 0,
    linkedToAnotherAccount: false,
    busy: true,
    error: null,
  });
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, busy: true, error: null }));
    try {
      const status = await getPushStatus();
      setPublicKey(status.publicKey ?? null);

      // Whether THIS browser holds a subscription is a local question — the server
      // knows how many devices this ACCOUNT has, but not which one you are holding.
      //
      // 🔴 ACHU-436: the two answers together are what matters. A browser that holds a
      // subscription while the account has none is linked to a DIFFERENT account, and
      // nothing will be delivered here. Neither number says that on its own, which is
      // why the screen could report "on" for two weeks and be wrong.
      let subscribed = false;
      if (support.supported) {
        const registration = await navigator.serviceWorker.getRegistration();
        const existing = await registration?.pushManager.getSubscription();
        subscribed = !!existing;
      }

      setState(s => ({
        ...s,
        configured: !!status.configured,
        notConfiguredReason: status.reason ?? null,
        deviceCount: status.deviceCount ?? 0,
        permission: typeof Notification === 'undefined' ? 'unavailable' : Notification.permission,
        subscribed,
        linkedToAnotherAccount: subscribed && (status.deviceCount ?? 0) === 0,
        busy: false,
      }));
    } catch (e: unknown) {
      setState(s => ({ ...s, busy: false, error: (e as Error)?.message ?? 'Could not check notification settings.' }));
    }
  }, [support.supported]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Registers the service worker, asks permission, subscribes, and tells the
   * server. Called from a click, never automatically.
   */
  const enable = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!support.supported) return { ok: false, message: support.reason ?? 'Not supported here.' };
    if (!publicKey) return { ok: false, message: 'Notifications are not set up on the server yet.' };

    setState(s => ({ ...s, busy: true, error: null }));
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // Waits for activation. Subscribing against a worker that is still installing
      // throws an obscure InvalidStateError, which reads as a bug rather than as
      // "try again in a second".
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(s => ({ ...s, busy: false, permission }));
        return {
          ok: false,
          message: permission === 'denied'
            // A denied permission cannot be re-requested by code — only the user
            // can undo it in browser settings, so saying "try again" would be a lie.
            ? 'Notifications are blocked for this site. You will need to allow them in your browser settings — look for the padlock or the site-settings icon next to the address bar.'
            : 'Notifications were not allowed.',
        };
      }

      // Reuses an existing subscription rather than creating a second one for the
      // same browser.
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        // Required to be true by every browser: we may not subscribe silently and
        // then not show anything.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const raw = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
        return { ok: false, message: 'The browser returned an incomplete subscription. Try again.' };
      }

      await subscribeToPush({ endpoint: raw.endpoint, keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth } });
      await refresh();
      return { ok: true, message: 'Notifications are on for this device.' };
    } catch (e: unknown) {
      const message = (e as Error)?.message ?? 'Could not turn notifications on.';
      setState(s => ({ ...s, busy: false, error: message }));
      return { ok: false, message };
    }
  }, [support.supported, support.reason, publicKey, refresh]);

  /**
   * Unsubscribes locally AND tells the server. Both matter: dropping only the
   * local subscription leaves the server sending to an endpoint the browser will
   * silently discard, and dropping only the server row leaves the browser
   * believing it is still subscribed.
   */
  const disable = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    setState(s => ({ ...s, busy: true, error: null }));
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unsubscribeFromPush({ endpoint });
      }
      await refresh();
      return { ok: true, message: 'Notifications are off for this device.' };
    } catch (e: unknown) {
      const message = (e as Error)?.message ?? 'Could not turn notifications off.';
      setState(s => ({ ...s, busy: false, error: message }));
      return { ok: false, message };
    }
  }, [refresh]);

  /** Proves delivery end to end. Push fails silently in too many ways to trust it untested. */
  const test = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await sendTestPush();
      if (res.note) return { ok: false, message: res.note };
      return { ok: true, message: `Sent to ${res.sent} device${res.sent === 1 ? '' : 's'}. It should appear in a moment.` };
    } catch (e: unknown) {
      return { ok: false, message: (e as Error)?.message ?? 'Could not send the test.' };
    }
  }, []);

  return { ...state, enable, disable, test, refresh };
}

