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

const getDeviceToken = () => {
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
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported on this device');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await callPushApi({ action: 'subscribe', subscription: subscription.toJSON() });
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

