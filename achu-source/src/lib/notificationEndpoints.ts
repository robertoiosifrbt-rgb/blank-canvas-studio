/**
 * ACHU-401, felia a unsprezecea — NOTIFICĂRILE: apelurile lor, plus formele răspunsurilor.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7 — acela e peste
 * plafonul lui de mărime și nu are voie să crească). Același tipar ca `absenceEndpoints.ts`.
 *
 * 🔴 **Citit din `backend/src/routes/notifications.ts`**, din `res.json`-ul fiecărei rute.
 *
 * ⚠️ **Nu confunda cu `usePushNotifications.ts`** — acela e despre permisiunea browserului de a
 * afișa o notificare push. Aici e clopoțelul din aplicație, care citește rânduri din bază.
 */
import { apiGet, apiPost, apiPut } from './apiClient';

/**
 * Un rând din clopoțel. ⚠️ Serverul trimite `read: boolean`, nu `readAt` — ecranul nu află
 * niciodată **când** s-a citit, fiindcă nu are ce face cu ora.
 */
export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  /** Unde duce apăsarea. `null` = notificare pur informativă, fără destinație. */
  linkPath: string | null;
  priority: 'normal' | 'high';
  read: boolean;
  createdAt: string;
};

/**
 * ⚠️ `unreadCount` e numărat peste TOT ce e necitit, nu peste cele 30 de rânduri întoarse —
 * altfel badge-ul ar minți exact când sunt multe.
 */
export type NotificationsResponse = { unreadCount: number; notifications: AppNotification[] };

/** Ruta separată, minusculă, pe care o cere badge-ul din fiecare pagină. */
export type NotificationUnreadCount = { unreadCount: number };

export type NotificationMarked = { success: true };
/** `marked` = câte rânduri au fost atinse; ecranul nu îl citește, dar ruta îl trimite. */
export type NotificationsAllMarked = { success: true; marked: number };

export function getNotifications(params: { filter?: 'all' | 'unread' } = {}) {
  return apiGet<NotificationsResponse>('/notifications', params);
}

export function getNotificationUnreadCount() {
  return apiGet<NotificationUnreadCount>('/notifications/unread-count');
}

export function markNotificationRead(params: { id: string }) {
  return apiPost<NotificationMarked>(`/notifications/${params.id}/read`);
}

export function markAllNotificationsRead() {
  return apiPost<NotificationsAllMarked>('/notifications/read-all');
}

/**
 * §42 „Notification preferences" (Sesiunea 142) — ce anunțuri NU vrea cineva.
 *
 * ⚠️ **Grupurile, etichetele și propoziția de sus vin de la SERVER.** Un ecran cu lista lui ar
 * rămâne în urmă exact când se adaugă un tip nou: omul ar avea fie un comutator care nu taie
 * nimic, fie un anunț fără comutator. ⛔ Și tot serverul decide ce **nu** se poate tăcea.
 */
export function getNotificationPreferences() {
  return apiGet<{
    intro: string;
    groups: { key: string; label: string; description: string; muted: boolean; mutedTypes: number; typeCount: number }[];
  }>('/notification-preferences', {});
}

/** ⚠️ Se trimite CHEIA unui grup, nu tipuri: ecranul nu compune liste proprii. */
export function setNotificationPreference(params: { group: string; muted: boolean }) {
  return apiPut<{ success: boolean; group: string; muted: boolean }>('/notification-preferences', params);
}

