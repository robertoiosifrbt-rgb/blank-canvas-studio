// Configuration never lives in code. It comes from environment variables, in
// Vercel and in .env.local. Not for secrecy — the publishable key is public
// anyway — but so that dev and production are never hardcoded.

export type SupabaseConfig = {
  url: string
  publishableKey: string
}

/** Reads the configuration out of a set of variables, whatever their source. */
export function readSupabaseConfig(
  env: Record<string, string | undefined>,
): SupabaseConfig {
  const url = env['VITE_SUPABASE_URL']?.trim() ?? ''
  const publishableKey = env['VITE_SUPABASE_PUBLISHABLE_KEY']?.trim() ?? ''

  const missing: string[] = []
  if (url === '') missing.push('VITE_SUPABASE_URL')
  if (publishableKey === '') missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')

  if (missing.length > 0) {
    throw new Error(
      `Missing configuration: ${missing.join(', ')}. ` +
        'Set it in .env.local locally, and in Vercel per environment.',
    )
  }

  return { url, publishableKey }
}

/**
 * The configuration of the environment the app runs in.
 *
 * Read on demand, not at startup: until the data layer exists the app has no
 * need of Supabase, and a screen must not fall over for a variable it does not
 * use yet.
 */
export function supabaseConfig(): SupabaseConfig {
  return readSupabaseConfig(import.meta.env)
}
