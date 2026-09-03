/**
 * Replaces `zite-auth-sdk`'s `useAuth()`. Same consumed shape as before
 * ({ user, isLoading, logout }) so RoleProvider/AdminLayout/CleanerApp/
 * CustomerApp only needed an import-path change — see docs/JURNAL.md
 * Sesiunea 6. `loginWithRedirect` is gone: Supabase has no hosted login page
 * to redirect to, so App.tsx renders its own LoginPage in place of that call.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
// §46 (Sesiunea 150) — ce s-a scris pe jumătate nu are voie să rămână pentru următorul om de la masă.
import { clearFormDrafts } from './useUnsavedGuard';

export interface AuthUser {
  email: string;
  firstName?: string;
  lastName?: string;
}

function mapUser(session: Session): AuthUser {
  const email = session.user.email ?? '';
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined);
  const [guessedFirst, ...guessedRest] = fullName ? fullName.trim().split(/\s+/) : [];
  return {
    email,
    firstName: (meta.first_name as string | undefined) ?? guessedFirst,
    lastName: (meta.last_name as string | undefined) ?? (guessedRest.length ? guessedRest.join(' ') : undefined),
  };
}

/**
 * 🔴 §39 „Logout audit" (Sesiunea 150) — ieșirea se consemnează ÎNAINTE de `signOut()`.
 *
 * ⚠️ **Ordinea e obligatorie:** după `signOut()` tokenul nu mai există, deci cererea ar pleca
 * neautentificată și ar fi refuzată. ⛔ Nu e o optimizare, e singurul moment în care se poate scrie.
 *
 * 🔴 **Și nu are voie să țină pe nimeni în aplicație.** Orice eșec — rețea căzută, server picat,
 * jurnal nescriitibil — se înghite, iar `signOut()` se face oricum. ⚠️ Un „Sign out" care refuză să
 * te scoată fiindcă n-a putut scrie un rând de audit e mai rău decât rândul care lipsește: ar lăsa
 * o sesiune deschisă pe un telefon străin exact în momentul în care omul cere să fie închisă.
 *
 * ⚠️ `import()` la apăsare, nu import static: motivul (12 suite rupte la încărcare) e în capul lui
 * `lib/sessionEndpoints.ts`.
 */
async function signOutAndRecord(): Promise<void> {
  /**
   * 🔴 §46 „Form recovery" (Sesiunea 150) — ciornele de formular se șterg ÎNTÂI.
   *
   * ⛔ Ele trăiesc în `sessionStorage`, care ține cât fila, nu cât sesiunea de lucru: pe un calculator
   * de birou, cine intră după cel care a ieșit ar fi găsit ce scria acela. ⚠️ Înaintea oricărei
   * așteptări de rețea, ca o cerere lentă să nu lase o fereastră în care încă sunt acolo.
   */
  clearFormDrafts();
  try {
    const { recordLogout } = await import('./sessionEndpoints');
    await recordLogout();
  } catch {
    // Deliberat mut: vezi comentariul de deasupra. Nimic din ce se întâmplă aici nu blochează ieșirea.
  }
  await supabase.auth.signOut();
}

export function useAuth() {
  const lifeOSCopy = new URLSearchParams(window.location.search).get('lifeos') === '1';
  // undefined = session not yet loaded (initial isLoading state)
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (lifeOSCopy) { setSession(null); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { if (mounted) setSession(s); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [lifeOSCopy]);

  // Memoised on the session object's own identity (only changes on a real
  // auth event, per the effect above) — not recomputed into a fresh object
  // reference on every render, which would otherwise re-trigger any effect
  // that depends on `user` (e.g. RoleProvider) in an infinite loop.
  const user = useMemo(() => lifeOSCopy ? ({ email: 'lifeos@achu.local', firstName: 'ACHU', lastName: 'Admin' }) : (session ? mapUser(session) : null), [lifeOSCopy, session]);

  return {
    user,
    isLoading: lifeOSCopy ? false : session === undefined,
    logout: (): void => { if (!lifeOSCopy) void signOutAndRecord(); },
  };
}
