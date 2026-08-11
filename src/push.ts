const PUSH_API_URL = 'https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/push-api';
const VAPID_PUBLIC_KEY = 'BJZ22QScbxYl8uXqm6hylyXxZHs10hGieEwBLz5nxENiTjq2UckaT7qPhMsR5rrhQIUOOaz9biNnfiJOEl1bXGQ';

export interface PushAlarm {
  id: string;
  title: string;
  body: string;
  url: string;
  scheduledAt: string;
}

const urlBase64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
};

const vapidApplicationServerKey = () => {
  const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

export const getDeviceToken = () => {
  let token = localStorage.getItem('pushDeviceToken');
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem('pushDeviceToken', token);
  }
  return token;
};

const callPushApi = async (body: unknown) => {
  const response = await fetch(PUSH_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-token': getDeviceToken() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json()).error || 'Push request failed');
};

export const enablePush = async () => {
  const fail = (step: string, error: unknown): never => {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new Error(`Push a eșuat la pasul „${step}”. ${detail}`);
  };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIOS && !isStandalone) {
    throw new Error('Pe iPhone, notificările funcționează doar din aplicația instalată. Apasă Share → Add to Home Screen, apoi deschide aplicația de pe ecranul principal.');
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Notificările push nu sunt disponibile în acest browser.');
  }
  let permission: NotificationPermission = 'default';
  try {
    permission = await Notification.requestPermission();
  } catch (error) {
    fail('permisiune iPhone', error);
  }
  if (permission !== 'granted') throw new Error(`Permisiunea pentru notificări este „${permission}”. Verifică Settings → Notifications → Tasks.`);
  let readyRegistration: ServiceWorkerRegistration | null = null;
  try {
    const registration = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href);
    await registration.update();
    readyRegistration = await navigator.serviceWorker.ready;
  } catch (error) {
    fail('service worker', error);
  }
  if (!readyRegistration) throw new Error('Service worker-ul nu este activ.');
  let existing: PushSubscription | null = null;
  try { existing = await readyRegistration.pushManager.getSubscription(); } catch (error) { fail('citire abonament', error); }
  let subscription = existing;
  try {
    subscription ??= await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidApplicationServerKey(),
    });
  } catch (error) {
    fail('abonare Apple Push', error);
  }
  if (!subscription) throw new Error('Apple Push nu a returnat un abonament.');
  try { await callPushApi({ action: 'subscribe', subscription: subscription.toJSON() }); } catch (error) { fail('salvare server', error); }
  return subscription;
};

export const syncPushAlarms = async (alarms: PushAlarm[]) => {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;
  await callPushApi({ action: 'sync', endpoint: subscription.endpoint, alarms });
  return true;
};

export const syncAllStoredAlarms = async () => {
  const tasks = JSON.parse(localStorage.getItem('tasks') || '[]') as Array<Record<string, unknown>>;
  const events = JSON.parse(localStorage.getItem('calendarEvents') || '[]') as Array<Record<string, unknown>>;
  const flatten = (items: Array<Record<string, unknown>>): Array<Record<string, unknown>> => items.flatMap((item) => [item, ...flatten(Array.isArray(item.children) ? item.children as Array<Record<string, unknown>> : [])]);
  const alarms: PushAlarm[] = [
    ...flatten(tasks).flatMap((task) => {
      const reminder = typeof task.reminderMinutes === 'number' ? task.reminderMinutes : 15;
      const start = typeof task.startAt === 'string' && task.startAt ? task.startAt : (typeof task.dueDate === 'string' && task.dueDate ? `${task.dueDate}T09:00` : '');
      return start && reminder >= 0 ? [{ id: `task:${String(task.id)}`, title: String(task.name || 'Task'), body: 'Taskul începe acum.', url: '/', scheduledAt: new Date(new Date(start).getTime() - reminder * 60000).toISOString() }] : [];
    }),
    ...events.flatMap((event) => {
      const reminder = typeof event.reminderMinutes === 'number' ? event.reminderMinutes : 15;
      const start = typeof event.date === 'string' && event.date ? `${event.date}T${typeof event.startTime === 'string' ? event.startTime : '09:00'}` : '';
      return start && reminder >= 0 ? [{ id: `event:${String(event.id)}`, title: String(event.name || 'Eveniment'), body: 'Evenimentul începe acum.', url: '/', scheduledAt: new Date(new Date(start).getTime() - reminder * 60000).toISOString() }] : [];
    }),
  ].filter((alarm) => !Number.isNaN(Date.parse(alarm.scheduledAt)) && Date.parse(alarm.scheduledAt) > Date.now() - 60000);
  return syncPushAlarms(alarms);
};
