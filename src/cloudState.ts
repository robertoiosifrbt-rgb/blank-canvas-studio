import { getDeviceToken } from './push';

const STATE_API_URL = 'https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/state-api';
const STORAGE_KEYS = ['tasks', 'taskGroups', 'calendarEvents', 'eventCategories', 'userCalendars', 'achuTasksImportedV1', 'achuGroupsImportedV1'];
let saveTimer: number | undefined;

const callStateApi = async (body: unknown) => {
  const response = await fetch(STATE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-token': getDeviceToken() },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Cloud sync failed');
  return result;
};

const snapshot = () => Object.fromEntries(STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]));

export const bootstrapCloudState = async () => {
  const result = await callStateApi({ action: 'load' });
  const payload = result.state?.payload as Record<string, string | null> | undefined;
  if (payload) {
    STORAGE_KEYS.forEach((key) => {
      const value = payload[key];
      if (typeof value === 'string') localStorage.setItem(key, value);
    });
  } else {
    await callStateApi({ action: 'save', payload: snapshot() });
  }
};

export const scheduleCloudBackup = () => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void callStateApi({ action: 'save', payload: snapshot() }).catch(() => undefined); }, 800);
};
