// Singurul loc din aplicație care construiește clientul Supabase.
// Legea 4 e impusă de ESLint: orice alt fișier care importă pachetul ăsta
// face lintul roșu.

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { configurațiaSupabase } from '../config/env'

let client: SupabaseClient | null = null

/**
 * Clientul, construit la prima cerere.
 *
 * Nu la încărcarea modulului: o configurație lipsă aruncată la import ar da un
 * ecran alb, în afara error boundary-ului. Aruncată la prima folosire, se vede
 * ca mesaj.
 */
export function clientul(): SupabaseClient {
  if (client === null) {
    const configurație = configurațiaSupabase()
    client = createClient(configurație.url, configurație.cheiePublishable, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Nu folosim magic link sau OAuth, deci nu căutăm sesiuni în URL.
        detectSessionInUrl: false,
      },
    })
  }
  return client
}
