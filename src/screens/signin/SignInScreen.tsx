import { useState } from 'react'
import type { FormEvent } from 'react'

import { signIn, signUp } from '../../repository/auth'
import './SignInScreen.css'

type Mode = 'sign-in' | 'sign-up'
type Message = { kind: 'error' | 'good'; text: string }

export function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      if (mode === 'sign-in') {
        await signIn(email, password)
        // A successful sign-in changes the session, and the gate changes the
        // screen.
      } else {
        const result = await signUp(email, password)
        if (result.needsEmailConfirmation) {
          setMessage({
            kind: 'good',
            text: 'Account created. Confirm your email, then sign in.',
          })
        }
      }
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : String(reason),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="signin">
      <h1 className="signin-title">Life Control Centre</h1>
      <p className="signin-subtitle">Your data follows the account, on any phone.</p>

      <form className="signin-form" onSubmit={(event) => void submit(event)}>
        <label className="signin-field">
          <span className="signin-label">Email</span>
          <input
            className="signin-input"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
            // Focused on open: writing must not cost an extra gesture.
            autoFocus
          />
        </label>

        <label className="signin-field">
          <span className="signin-label">Password</span>
          <input
            className="signin-input"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>

        {message !== null && (
          <p
            className={`signin-message signin-message-${message.kind}`}
            role={message.kind === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}

        <button className="signin-button" type="submit" disabled={submitting}>
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button
        className="signin-switch"
        type="button"
        onClick={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
          setMessage(null)
        }}
      >
        {mode === 'sign-in' ? 'I do not have an account yet' : 'I already have an account'}
      </button>
    </div>
  )
}
