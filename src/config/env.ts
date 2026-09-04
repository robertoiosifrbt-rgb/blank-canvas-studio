// Configurația nu se scrie în cod. Vine din variabile de mediu, în Vercel și
// în .env.local. Nu pentru secretizare — cheia publishable e publică oricum —
// ci ca dev și producție să nu fie hardcodate.

export type ConfigurațieSupabase = {
  url: string
  cheiePublishable: string
}

/** Citește configurația dintr-un set de variabile, oricare ar fi sursa lui. */
export function citeșteConfigurațiaSupabase(
  variabile: Record<string, string | undefined>,
): ConfigurațieSupabase {
  const url = variabile['VITE_SUPABASE_URL']?.trim() ?? ''
  const cheiePublishable =
    variabile['VITE_SUPABASE_PUBLISHABLE_KEY']?.trim() ?? ''

  const lipsesc: string[] = []
  if (url === '') lipsesc.push('VITE_SUPABASE_URL')
  if (cheiePublishable === '') lipsesc.push('VITE_SUPABASE_PUBLISHABLE_KEY')

  if (lipsesc.length > 0) {
    throw new Error(
      `Configurație lipsă: ${lipsesc.join(', ')}. ` +
        'Se pune în .env.local local, și în Vercel pentru fiecare mediu.',
    )
  }

  return { url, cheiePublishable }
}

/**
 * Configurația mediului în care rulează aplicația.
 *
 * Se citește la cerere, nu la pornire: până când există stratul de date,
 * aplicația nu are nevoie de Supabase, și un ecran nu are voie să cadă
 * pentru o variabilă pe care nu o folosește încă.
 */
export function configurațiaSupabase(): ConfigurațieSupabase {
  return citeșteConfigurațiaSupabase(import.meta.env)
}
