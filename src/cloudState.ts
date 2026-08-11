import { getDeviceToken } from './push';

const STATE_API_URL = 'https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/state-api';
const STORAGE_KEYS = ['tasks', 'taskGroups', 'calendarEvents', 'eventCategories', 'userCalendars', 'achuTasksImportedV1', 'achuGroupsImportedV1'];
const VOICE_TEST_EVENT_ID = 'voice-test-event-2026-08-11';
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

const addVoiceTestEvent = () => {
  try {
    const raw = localStorage.getItem('calendarEvents');
    const events = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(events) || events.some((event) => event?.id === VOICE_TEST_EVENT_ID)) return;

    const start = new Date(Date.now() + 60_000);
    const end = new Date(start.getTime() + 30 * 60_000);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const time = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

    events.push({
      id: VOICE_TEST_EVENT_ID,
      name: 'Ping random de test 🔔',
      date,
      category: 'Personal',
      color: 'bg-blue-100',
      startTime: time(start),
      endTime: time(end),
      calendarId: 'personal',
      reminderMinutes: 0,
    });
    localStorage.setItem('calendarEvents', JSON.stringify(events));
  } catch {
    // Ignore malformed local state and leave the existing data untouched.
  }
};

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
  addVoiceTestEvent();
};

export const scheduleCloudBackup = () => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void callStateApi({ action: 'save', payload: snapshot() }).catch(() => undefined); }, 800);
};