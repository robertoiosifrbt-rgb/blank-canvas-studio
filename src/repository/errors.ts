// Supabase sends its errors in English with a stable code alongside. The code
// is what we rely on, not the text.

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'This account is not confirmed yet. Check your email.',
  user_already_exists: 'An account with this email already exists.',
  email_exists: 'An account with this email already exists.',
  weak_password: 'That password is too weak. Pick a longer one.',
  validation_failed: 'The email or password is not in the expected format.',
  over_request_rate_limit: 'Too many attempts. Try again in a few minutes.',
  over_email_send_rate_limit:
    'Too many emails sent. Try again in a few minutes.',
  signup_disabled: 'New accounts cannot be created right now.',
}

/**
 * The message to show for an authentication error.
 *
 * For an unknown code it does not invent a soothing message: it shows the
 * original text. A "something went wrong" that hides the reason is worse than
 * a raw sentence.
 */
export function errorMessage(
  error: { code?: string | undefined; message?: string | undefined } | null,
): string {
  if (error === null) return 'It did not work, with no reason given.'

  const known = error.code === undefined ? undefined : MESSAGES[error.code]
  if (known !== undefined) return known

  const original = error.message?.trim()
  return original === undefined || original === ''
    ? 'It did not work, with no reason given.'
    : `It did not work: ${original}`
}
