/**
 * Sesiunea 6: replaces `zite-auth-sdk`'s hosted auth with Supabase Auth.
 * See docs/JURNAL.md for what's required to actually run this
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — public, safe to ship in the
 * frontend bundle, but still real values only the project owner can supply).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const lifeOSCopy = new URLSearchParams(window.location.search).get('lifeos') === '1';

if (!supabaseUrl || !supabaseAnonKey) {
  // Deliberately loud rather than silently failing every auth call later.
  console.error(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
    'Sign-in will not work until they are configured — see .env.example.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? (lifeOSCopy ? 'https://life-os-copy.invalid' : ''),
  supabaseAnonKey ?? (lifeOSCopy ? 'life-os-independent-copy' : ''),
);
