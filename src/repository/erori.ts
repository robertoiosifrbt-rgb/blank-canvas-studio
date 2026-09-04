// Interfața e în română, deci și erorile. Supabase le trimite în engleză, cu
// un cod stabil alături — codul e cel pe care ne bazăm, nu textul.

const MESAJE: Record<string, string> = {
  invalid_credentials: 'Email sau parolă greșite.',
  email_not_confirmed: 'Contul nu e confirmat încă. Verifică-ți emailul.',
  user_already_exists: 'Există deja un cont cu emailul ăsta.',
  email_exists: 'Există deja un cont cu emailul ăsta.',
  weak_password: 'Parola e prea slabă. Alege una mai lungă.',
  validation_failed: 'Emailul sau parola nu sunt în formatul cerut.',
  over_request_rate_limit: 'Prea multe încercări. Mai încearcă în câteva minute.',
  over_email_send_rate_limit:
    'Prea multe emailuri trimise. Mai încearcă în câteva minute.',
  signup_disabled: 'Nu se pot face conturi noi acum.',
}

/**
 * Mesajul de arătat pentru o eroare de autentificare.
 *
 * Pentru un cod necunoscut nu inventează un mesaj liniștitor: arată textul
 * original. Un „ceva n-a mers" care ascunde motivul e mai rău decât o
 * propoziție în engleză.
 */
export function mesajulErorii(
  eroare: { code?: string | undefined; message?: string | undefined } | null,
): string {
  if (eroare === null) return 'Nu a mers, fără motiv dat.'

  const cunoscut = eroare.code === undefined ? undefined : MESAJE[eroare.code]
  if (cunoscut !== undefined) return cunoscut

  const original = eroare.message?.trim()
  return original === undefined || original === ''
    ? 'Nu a mers, fără motiv dat.'
    : `Nu a mers: ${original}`
}
