import { useState } from 'react'
import type { FormEvent } from 'react'

import { intră, înregistrează } from '../../repository/auth'
import './IntrareScreen.css'

type Mod = 'intrare' | 'cont'
type Mesaj = { fel: 'eroare' | 'bine'; text: string }

export function IntrareScreen() {
  const [mod, setMod] = useState<Mod>('intrare')
  const [email, setEmail] = useState('')
  const [parolă, setParolă] = useState('')
  const [seTrimite, setSeTrimite] = useState(false)
  const [mesaj, setMesaj] = useState<Mesaj | null>(null)

  async function trimite(eveniment: FormEvent<HTMLFormElement>) {
    eveniment.preventDefault()
    setSeTrimite(true)
    setMesaj(null)
    try {
      if (mod === 'intrare') {
        await intră(email, parolă)
        // Intrarea reușită schimbă sesiunea, iar poarta schimbă ecranul.
      } else {
        const rezultat = await înregistrează(email, parolă)
        if (rezultat.cereConfirmareaEmailului) {
          setMesaj({
            fel: 'bine',
            text: 'Contul e făcut. Confirmă emailul, apoi intră.',
          })
        }
      }
    } catch (motiv) {
      setMesaj({
        fel: 'eroare',
        text: motiv instanceof Error ? motiv.message : String(motiv),
      })
    } finally {
      setSeTrimite(false)
    }
  }

  return (
    <div className="intrare">
      <h1 className="intrare-titlu">Life Control Centre</h1>
      <p className="intrare-subtitlu">
        Datele vin după cont, pe orice telefon.
      </p>

      <form className="intrare-formular" onSubmit={(eveniment) => void trimite(eveniment)}>
        <label className="intrare-câmp">
          <span className="intrare-etichetă">Email</span>
          <input
            className="intrare-input"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
            // Focalizat la deschidere: nu ceri un gest în plus ca să scrii.
            autoFocus
          />
        </label>

        <label className="intrare-câmp">
          <span className="intrare-etichetă">Parolă</span>
          <input
            className="intrare-input"
            type="password"
            name="parola"
            value={parolă}
            onChange={(e) => setParolă(e.target.value)}
            autoComplete={mod === 'intrare' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>

        {mesaj !== null && (
          <p
            className={`intrare-mesaj intrare-mesaj-${mesaj.fel}`}
            role={mesaj.fel === 'eroare' ? 'alert' : 'status'}
          >
            {mesaj.text}
          </p>
        )}

        <button className="intrare-buton" type="submit" disabled={seTrimite}>
          {mod === 'intrare' ? 'Intră' : 'Fă contul'}
        </button>
      </form>

      <button
        className="intrare-schimbă"
        type="button"
        onClick={() => {
          setMod(mod === 'intrare' ? 'cont' : 'intrare')
          setMesaj(null)
        }}
      >
        {mod === 'intrare' ? 'Nu am cont încă' : 'Am deja cont'}
      </button>
    </div>
  )
}
