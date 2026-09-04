// The only place in the app that builds the Supabase client.
// Law 4 is enforced by ESLint: any other file importing the package turns the
// lint red.

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabaseConfig } from '../config/env'

let instance: SupabaseClient | null = null

/**
 * The client, built on first request.
 *
 * Not at module load: a missing configuration thrown at import time would give
 * a blank screen, outside the error boundary. Thrown on first use, it shows up
 * as a message.
 */
export function supabase(): SupabaseClient {
  if (instance === null) {
    const config = supabaseConfig()
    instance = createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // We use neither magic links nor OAuth, so we do not look for a
        // session in the URL.
        detectSessionInUrl: false,
      },
    })
  }
  return instance
}
