import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, Loader2, AlertTriangle, MessageSquare, Briefcase, CalendarDays, CalendarClock, Sparkles, CheckCircle2, XCircle, Banknote, BanknoteArrowDown, Receipt, Inbox, Star, PauseCircle, PlayCircle, CalendarX, CalendarCog, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications, getNotificationUnreadCount, markNotificationRead, markAllNotificationsRead,
  type AppNotification,
} from '@/lib/notificationEndpoints'; // ACHU-401: ieșite din `endpoints.ts`, care e la plafonul lui
import PushSettings from './PushSettings';
// §42 (Sesiunea 142) — ce anunțuri NU vrea omul. Sub controlul de push, vezi nota de jos.
import NotificationPreferences from './NotificationPreferences';

/**
 * Sesiunea 29 (backlog 42 — Tier 1). The bell, used by both the Admin layout
 * and the Cleaner portal header.
 *
 * Why the count is polled from a dedicated endpoint rather than by fetching the
 * list: this sits on every page, so it runs constantly. `/notifications/
 * unread-count` returns one number; the list (30 rows of text) is only fetched
 * when the panel is actually opened. Pulling a whole dataset to display one
 * figure is exactly the mistake ACHU-181 is still open for on the Dashboard.
 *
 * `homePath` differs per role — a Cleaner has no `/admin` — so the caller
 * supplies it and a notification with no specific link falls back to it.
 *
 * ACHU-233 (Sesiunea 34): the same reasoning extends to the link itself.
 * `resolvePath` lets each portal translate a role-relative target into its own
 * routing: a chat notification is `/chat?channel=…`, which the Admin layout maps
 * to `/admin/chat?channel=…` and the Cleaner portal to `/cleaner?tab=chat&…`,
 * because the cleaner's chat is a TAB and not a route. The bell deliberately
 * knows nothing about roles — it would have to be edited every time a portal
 * moved a screen.
 */
const POLL_MS = 30000;

/**
 * ⚠️ ACHU-401 (felia 11) — forma s-a MUTAT lângă funcția care o produce
 * (`@/lib/notificationEndpoints`), citită din `backend/src/routes/notifications.ts`.
 * Numele local rămâne `Notification` fiindcă `Notification` e și un tip global al browserului
 * (API-ul de push), iar ecranul ăsta le-ar amesteca — vezi `PushSettings`.
 */
type Notification = AppNotification;

/**
 * 🆕 ACHU-539 (Sesiunea 119) — iconițele pentru notificările CLIENTULUI.
 *
 * ⚠️ Nu e cosmetică: clopoțelul unui client care are o vizită, o factură și o rambursare
 * arăta trei rânduri identice cu același clopoțel gri, deci trebuiau CITITE ca să fie
 * deosebite. Iconița face diferența dintr-o privire — bani, calendar, curățenie.
 *
 * ⛔ `Bell` rămâne pentru orice tip necunoscut, deliberat: un tip nou de notificare trebuie
 * să arate banal, nu să spargă ecranul. Un `undefined` returnat de aici ar fi o pagină albă
 * pentru un rând de text.
 */
const ICONS: Record<string, typeof Bell> = {
  chat_dm: MessageSquare,
  job_assigned: Briefcase,
  // Vizita, în ordinea în care o trăiește clientul.
  job_booked: CalendarDays,
  job_rescheduled: CalendarClock,
  job_started: Sparkles,
  job_completed: CheckCircle2,
  job_cancelled: XCircle,
  // Banii.
  payment_received: Banknote,
  refund_issued: BanknoteArrowDown,
  invoice_issued: Receipt,
  // 🆕 ACHU-544: CONTRACTUL, nu o vizită. Iconițe distincte de cele de vizită deliberat —
  // „contractul tău e anulat" și „vizita de marți e anulată" nu au voie să arate la fel.
  recurring_series_paused: PauseCircle,
  recurring_series_active: PlayCircle,
  recurring_series_cancelled: CalendarX,
  recurring_series_updated: CalendarCog,
  // Cererile și părerile.
  customer_request_received: Inbox,
  customer_job_rating: Star,
  /**
   * 🆕 §15 (Sesiunea 158) — **un curățător nu poate face o vizită.** ⚠️ `UserX`, nu `XCircle`: „vizita
   * e anulată" și „omul nu poate veni" nu au voie să arate la fel — la prima nu mai e nimic de făcut,
   * la a doua trebuie găsit altcineva până mâine dimineață.
   */
  cleaner_declined_job: UserX,
};

function iconFor(type: string) {
  return ICONS[type] ?? Bell;
}

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationBell({ homePath, resolvePath }: {
  homePath: string;
  /**
   * Translates a role-relative target from the server into this portal's own
   * route. Return null to fall back to `homePath` — that is what happens for a
   * target this portal has no screen for, which is better than navigating
   * somewhere that renders nothing.
   */
  resolvePath?: (linkPath: string) => string | null;
}) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const loadCount = useCallback(async () => {
    try {
      const res = await getNotificationUnreadCount();
      setUnread(res.unreadCount ?? 0);
    } catch {
      // A failed poll is not worth showing the user anything: the bell simply
      // keeps its last known count rather than flashing an error on every page.
    }
  }, []);

  useEffect(() => { loadCount(); }, [loadCount]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') loadCount(); };
    const t = setInterval(tick, POLL_MS);
    // Also refresh the moment the user comes back to the tab, rather than making
    // them wait out the remainder of the interval.
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [loadCount]);

  // Close on an outside click or Escape — a panel you cannot dismiss without
  // finding the exact toggle again is a nuisance on a phone.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setItems(null);
    try {
      const res = await getNotifications();
      setItems(res.notifications);
      setUnread(res.unreadCount ?? 0);
    } catch {
      setItems([]);
    }
  };

  const openItem = async (n: Notification) => {
    setOpen(false);
    if (!n.read) {
      setUnread(u => Math.max(0, u - 1));
      markNotificationRead({ id: n.id }).catch(() => { /* reverted by the next poll */ });
    }
    // A notification's link is always an in-app path (enforced backend-side);
    // anything unexpected falls back to the caller's home rather than being
    // handed to the router as-is.
    const raw = n.linkPath && n.linkPath.startsWith('/') && n.linkPath !== '/' ? n.linkPath : null;
    if (!raw) { nav(homePath); return; }
    // ACHU-233: the portal gets first refusal on the path. Without this, a chat
    // notification navigated to `/chat`, which is not a route in either portal,
    // and the user landed nowhere useful.
    //
    // A resolver returning null means "this portal has no screen for that", so it
    // falls back to home — navigating to the raw path anyway would be the very
    // bug being fixed. With no resolver at all the path is used as-is, which is
    // the original behaviour for callers that do not need mapping.
    if (!resolvePath) { nav(raw); return; }
    nav(resolvePath(raw) ?? homePath);
  };

  // Sesiunea 35 (ACHU-235): tapping a phone notification when ACHU is already
  // open focuses the existing window and posts the target here, rather than
  // opening a second tab. Reuses the SAME resolver as the in-app bell, so a
  // notification behaves identically whether it was tapped in the app or on the
  // lock screen.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; linkPath?: string } | undefined;
      if (data?.type !== 'achu:notification-click') return;
      const raw = data.linkPath && data.linkPath.startsWith('/') && data.linkPath !== '/' ? data.linkPath : null;
      if (!raw) { nav(homePath); return; }
      nav(resolvePath ? (resolvePath(raw) ?? homePath) : raw);
      loadCount();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [nav, homePath, resolvePath, loadCount]);

  const readAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setUnread(0);
      setItems(prev => prev?.map(i => ({ ...i, read: true })) ?? prev);
    } catch { /* the next poll will show the true state */ }
    setBusy(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative rounded-lg p-2 hover:bg-muted"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold tabular-nums text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {items && items.some(i => !i.read) && (
              <button
                onClick={readAll}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items === null ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nothing new.</p>
            ) : items.map(n => {
              const Icon = iconFor(n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-2.5 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60 ${
                    n.read ? '' : 'bg-primary/5'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {n.priority === 'high'
                      ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                      : <Icon className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`truncate text-sm ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                    </span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>}
                  </span>
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>

          {/* Sesiunea 35 (ACHU-235). Placed at the foot, below the list: the panel
              is opened to READ notifications, and a settings block above them would
              be in the way every single time. Below, it is found exactly when
              someone wonders why they were not told. */}
          <PushSettings />
          {/* §42 — CE i se trimite, sub CUM i se trimite: „nu vreau anunțuri despre facturi" și
              „nu vreau anunțuri pe telefon" sunt două întrebări diferite, iar amestecate într-un
              singur comutator ar fi însemnat că cine închide una pierde amândouă. */}
          <NotificationPreferences />
        </div>
      )}
    </div>
  );
}

