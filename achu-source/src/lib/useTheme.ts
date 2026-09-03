import { useCallback, useEffect, useState } from 'react';
// ⚠️ Cele două reguli (citirea nu aruncă, o valoare necunoscută se ignoră) sunt acum într-un singur
// loc: al doilea ecran care ține minte o alegere le-ar fi rescris. Vezi `rememberedChoice.ts`.
import { readChoice as read, writeChoice as write } from './rememberedChoice';

/**
 * Sesiunea 57 (ACHU-256) — light/dark and an accent colour, remembered.
 *
 * Owner: *"adauga niste theme ceva culori... fao sa par vie... nu o baza de date
 * plictisitoare"*.
 *
 * ─── Why this had to exist before any colour work ─────────────────────────
 * Tailwind was set to `darkMode: ["class"]` on day one and 58 `dark:` classes
 * had accumulated across the app, but nothing ever put the class on. Every one
 * of them was dead. So the switch is not a nicety on top of a dark theme — it
 * is the thing that makes the dark theme exist at all.
 *
 * ─── Stored per device, not per account ───────────────────────────────────
 * localStorage, deliberately. The owner works on a phone at night and a laptop
 * in the day; dark on one and light on the other is the point, and an
 * account-level setting would force the same choice on both. It also means the
 * theme survives a logout, which an account setting would not.
 *
 * ─── Applied before React paints ──────────────────────────────────────────
 * `applyTheme` is exported and called from main.tsx before the app mounts. Left
 * to an effect, the page would render light and then flip — a white flash on a
 * phone in the dark is the exact thing dark mode is for.
 */

export type Mode = 'light' | 'dark' | 'system';
export type Accent = 'ocean' | 'fresh' | 'berry' | 'sunset';

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: 'ocean', label: 'Ocean', swatch: 'bg-blue-700' },
  { value: 'fresh', label: 'Fresh', swatch: 'bg-emerald-700' },
  { value: 'berry', label: 'Berry', swatch: 'bg-purple-700' },
  { value: 'sunset', label: 'Sunset', swatch: 'bg-orange-600' },
];

const MODE_KEY = 'achu:theme-mode';
const ACCENT_KEY = 'achu:theme-accent';


export function prefersDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Puts the classes on <html>. Exported so main.tsx can call it before the first
 * paint, and so the tests can assert the DOM rather than the hook's internals.
 */
export function applyTheme(mode: Mode, accent: Accent) {
  const root = document.documentElement;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark());
  root.classList.toggle('dark', dark);
  for (const a of ACCENTS) root.classList.toggle(`accent-${a.value}`, a.value === accent);
  // Lets the browser paint form controls and scrollbars to match, which is the
  // difference between a dark app and a dark app with a white scrollbar.
  root.style.colorScheme = dark ? 'dark' : 'light';
}

/** Called once from main.tsx, before React mounts. */
export function initTheme() {
  applyTheme(readMode(), readAccent());
}

export function readMode(): Mode {
  return read<Mode>(MODE_KEY, ['light', 'dark', 'system'], 'system');
}

export function readAccent(): Accent {
  return read<Accent>(ACCENT_KEY, ACCENTS.map(a => a.value), 'ocean');
}

export function useTheme() {
  const [mode, setModeState] = useState<Mode>(readMode);
  const [accent, setAccentState] = useState<Accent>(readAccent);

  useEffect(() => { applyTheme(mode, accent); }, [mode, accent]);

  // On 'system', follow the device when it changes — someone whose phone flips
  // to dark at sunset expects the app to come with it, without being reopened.
  useEffect(() => {
    if (mode !== 'system' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system', accent);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [mode, accent]);

  const setMode = useCallback((m: Mode) => { write(MODE_KEY, m); setModeState(m); }, []);
  const setAccent = useCallback((a: Accent) => { write(ACCENT_KEY, a); setAccentState(a); }, []);

  return { mode, accent, setMode, setAccent };
}

