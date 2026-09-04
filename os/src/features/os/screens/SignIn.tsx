import { useState } from 'react'

/**
 * Ușa aplicației.
 *
 * Până acum aplicația te știa după un token din browser: alt browser, altă
 * aplicație, goală, până puneai tokenul cu mâna. Cu un cont, aceleași date
 * sunt peste tot, iar baza însăși refuză rândurile care nu sunt ale tale.
 */
export function SignIn({ onSignIn, onSignUp }: {
  onSignIn: (email: string, password: string) => Promise<string | null>
  onSignUp: (email: string, password: string) => Promise<string | null>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [making, setMaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!email.trim()) { setProblem('Scrie emailul.'); return }
    if (password.length < 6) { setProblem('Parola are cel puțin 6 caractere.'); return }
    setBusy(true)
    setProblem(null)
    setNote(null)
    const failed = making ? await onSignUp(email, password) : await onSignIn(email, password)
    setBusy(false)
    if (failed) { setProblem(failed); return }
    if (making) setNote('Contul e făcut. Dacă îți cere confirmarea pe email, deschide linkul, apoi intră.')
  }

  return (
    <div className="os-shell">
      <div className="os-gate">
        <h1>Roberto OS</h1>
        <p className="os-muted">
          {making
            ? 'Un cont, aceleași date pe orice telefon sau laptop.'
            : 'Intră cu contul tău. Datele vin după el, oriunde te-ai loga.'}
        </p>

        <form className="os-modal" onSubmit={e => { void submit(e) }}>
          <label className="os-fld">
            <span>Email</span>
            <input type="email" autoComplete="email" value={email}
              onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="os-fld">
            <span>Parolă</span>
            <input type="password" value={password}
              autoComplete={making ? 'new-password' : 'current-password'}
              onChange={e => setPassword(e.target.value)} />
          </label>

          {problem ? <p className="os-bad">{problem}</p> : null}
          {note ? <p className="os-muted">{note}</p> : null}

          <div className="os-hero-acts">
            <button className="os-btn" type="submit" disabled={busy}>
              {busy ? 'Un moment…' : making ? 'Fă contul' : 'Intră'}
            </button>
            <button className="os-btn ghost" type="button" disabled={busy}
              onClick={() => { setMaking(!making); setProblem(null); setNote(null) }}>
              {making ? 'Am deja cont' : 'Fă-mi cont'}
            </button>
          </div>
        </form>

        <p className="os-muted">
          Fără cont aplicația merge mai departe pe telefonul ăsta, dar nu se
          sincronizează nicăieri.
        </p>
      </div>
    </div>
  )
}
