import { SettingsPage as GymSettings } from '../../settings'
import { Rows, Row, Section } from '../parts'
import { moduleTree } from '../modules'
import type { OsData } from '../types'
import type { SyncMode } from '../storage'
import type { PhotoSync } from '../photoCloud'
import type { PushState } from '../push'
import { DEFAULT_ALERTS } from '../alerts'

/* Scurt, cât să se compare cu un commit din GitHub. */
const BUILD = __APP_VERSION__.slice(0, 7)
const LS_MAX = 5_000_000

/* Ce înseamnă fiecare stare, în cuvinte care spun și ce ai de făcut. */
const PUSH_NOTES: Record<PushState, string> = {
  'pornite': 'Termenele îți sună pe telefon, chiar cu aplicația închisă.',
  'oprite': 'Nu sună nimic. Pornește-le ca să nu scapi un termen.',
  'refuzate': 'Le-ai refuzat cândva. Se dau înapoi din setările telefonului, la notificări.',
  'nu-se-poate': 'Browserul ăsta nu știe notificări push.',
  'de-instalat': 'Pe iPhone merg doar din aplicația instalată: Share → Add to Home Screen, apoi deschide-o de acolo.',
}

export function SettingsScreen({ data, mode, error, token, photos, imported, push, pushNote, onPush, onAlerts, onCurrency, onToken, onExport, onImport, onUpdate, onNewModule, onDeleteModule, onSignOut }: {
  data: OsData
  mode: SyncMode
  error: string | null
  token: string
  photos: PhotoSync | null
  push: PushState | null
  pushNote: string | null
  onPush: () => void
  onAlerts: (lead: number, hour: number) => void
  onCurrency: (value: string) => void
  onToken: (value: string) => void
  onExport: () => void
  onImport: (file: File) => void
  imported: string | null
  onUpdate: () => void
  onNewModule: () => void
  onDeleteModule: (id: string) => void
  onSignOut: () => void
}) {
  let used = 0
  try { used = new TextEncoder().encode(localStorage.getItem('roberto-os-v1') ?? '').length } catch { used = 0 }
  const pct = Math.min(100, (used / LS_MAX) * 100)
  const kb = `${(used / 1024).toFixed(1)} KB`
  const tree = moduleTree(data)
  const alerts = data.settings.alerts ?? DEFAULT_ALERTS

  return (
    <>
      <div className="os-head"><div><h1>Setări</h1><p>Moneda, spațiul ocupat și exportul datelor tale.</p></div></div>

      <div className="os-card pad os-split">
        <div>
          <b>Versiunea aplicației</b>
          <span className="os-mono">{BUILD}</span>
          <span className="os-muted">Dacă nu vezi ultimele modificări, apasă aici: șterge tot ce a rămas în memoria browserului și încarcă versiunea nouă.</span>
        </div>
        <button className="os-btn" onClick={onUpdate}>Actualizează</button>
      </div>

      <div className="os-grid2">
        <div className="os-card pad">
          <label className="os-fld">
            <span>Monedă</span>
            <select value={data.settings.currency} onChange={e => onCurrency(e.target.value)}>
              <option value="£">Liră (£)</option>
              <option value="€">Euro (€)</option>
              <option value="RON">Leu (RON)</option>
              <option value="$">Dolar ($)</option>
            </select>
          </label>
        </div>
        <div className="os-card pad">
          <div className="os-gauge">
            <div className="os-gauge-t"><span>Spațiu folosit</span><span>{kb}</span></div>
            <div className="os-gauge-bar"><i style={{ width: `${Math.max(1.5, pct)}%` }} /></div>
          </div>
          <p className="os-muted">Copia locală, ca aplicația să meargă și fără internet.</p>
        </div>
      </div>

      <Section title="Datele tale" />
      <div className="os-card pad os-stack">
        <div className="os-split">
          <div>
            <b>Unde stau acum</b>
            <span className="os-muted">
              {mode === 'cloud'
                ? 'În baza ta de date, pe rânduri: fiecare tură, plată și scrisoare are rândul ei. Se scrie doar ce atingi.'
                : `${error ? `Baza n-a răspuns (${error}). ` : ''}Doar în acest browser, pe acest aparat.`}
            </span>
          </div>
          <span className={`os-pill ${mode === 'cloud' ? 'good' : 'warn'}`}>{mode === 'cloud' ? 'baza ta' : 'local'}</span>
        </div>

        <div className="os-split">
          <div>
            <b>Contul</b>
            <span className="os-muted">Datele vin după cont, pe orice telefon sau laptop te loghezi.</span>
          </div>
          <button className="os-btn ghost sm" onClick={onSignOut}>Ieși din cont</button>
        </div>

        <div className="os-split">
          <div>
            <b>Datele de la sală</b>
            <span className="os-muted">
              {mode === 'cloud'
                ? 'Antrenamentele, exercițiile și măsurătorile merg în același cloud, în sertarul lor. Pozele de progres rămân pe aparat — sunt prea mari și se salvează doar prin exportul din setările sălii.'
                : 'Cât timp cloud-ul nu răspunde, sala scrie doar pe aparatul ăsta.'}
            </span>
          </div>
          <span className={`os-pill ${mode === 'cloud' ? 'good' : 'warn'}`}>{mode === 'cloud' ? 'sincronizat' : 'local'}</span>
        </div>

        <div className="os-split">
          <div>
            <b>Poze de progres</b>
            <span className="os-muted">
              {photos === null
                ? 'Se verifică…'
                : photos.error
                  ? `Nu urcă: ${photos.error}. Pozele rămân pe aparatul ăsta.`
                  : `În Storage, în dosarul tău. Urcate acum: ${photos.uploaded}. Aduse: ${photos.downloaded}.`}
            </span>
          </div>
          <span className={`os-pill ${photos && !photos.error ? 'good' : 'warn'}`}>
            {photos === null ? '…' : photos.error ? 'local' : 'sincronizat'}
          </span>
        </div>

        <div>
          <b>Cod de sincronizare</b>
          <span className="os-muted">Rămas pentru datele sălii, care încă merg pe cod, nu pe cont. Pune-l la fel pe telefon și pe laptop.</span>
          <input className="os-in" type="text" spellCheck={false} defaultValue={token}
            onBlur={e => onToken(e.target.value)} />
        </div>

        <div className="os-split">
          <div>
            <b>Export</b>
            <span className="os-muted">Descarci tot într-un fișier pe care îl păstrezi tu.</span>
          </div>
          <button className="os-btn" onClick={onExport}>Exportă tot</button>
        </div>

        <div className="os-split">
          <div>
            <b>Import</b>
            <span className="os-muted">
              {imported ?? 'Aduce datele dintr-un fișier exportat. Adaugă și înlocuiește după id — nu șterge nimic din ce ai.'}
            </span>
          </div>
          {/* Input-ul de fișier nu se poate stiliza, deci stă ascuns sub o
              etichetă care arată ca restul butoanelor. */}
          <label className="os-btn ghost">
            Alege fișier
            <input type="file" accept="application/json,.json" style={{ display: 'none' }}
              onChange={event => {
                const file = event.target.files?.[0]
                if (file) onImport(file)
                event.target.value = ''
              }} />
          </label>
        </div>
      </div>

      <Section title="Notificări" />
      <div className="os-card pad os-stack">
        <div className="os-split">
          <div>
            <b>Notificări pe telefon</b>
            <span className="os-muted">{pushNote ?? PUSH_NOTES[push ?? 'oprite']}</span>
          </div>
          {push === 'oprite' ? <button className="os-btn" onClick={onPush}>Pornește</button>
            : <span className={`os-pill ${push === 'pornite' ? 'good' : 'warn'}`}>{push ?? '…'}</span>}
        </div>

        <div className="os-grid2">
          <label className="os-fld">
            <span>Cu cât timp înainte</span>
            <select value={alerts.lead} onChange={e => onAlerts(Number(e.target.value), alerts.hour)}>
              <option value={0}>în ziua respectivă</option>
              <option value={1}>cu o zi înainte</option>
              <option value={3}>cu trei zile înainte</option>
              <option value={7}>cu o săptămână înainte</option>
            </select>
          </label>
          <label className="os-fld">
            <span>La ce oră</span>
            <select value={alerts.hour} onChange={e => onAlerts(alerts.lead, Number(e.target.value))}>
              {[7, 8, 9, 10, 12, 18, 20].map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Setările sălii, aici, nu într-un al doilea ecran de setări în alt
          colț al aplicației. Sunt ale ei — unități, profil, importul și
          exportul antrenamentelor — dar locul de setări e unul singur. */}
      <Section title="Sală" />
      <div className="os-gym os-gym-settings">
        <GymSettings />
      </div>

      <Section title="Module" />
      <Rows>
        {tree.map(m => (
          <Row key={m.id} title={'— '.repeat(m.depth) + m.name}
            sub={data.modules[m.id] ? 'creat de tine' : 'inclus'}
            action={data.modules[m.id]
              ? <button className="os-icon del" onClick={() => onDeleteModule(m.id)} aria-label="Șterge">🗑</button>
              : undefined} />
        ))}
      </Rows>
      <div style={{ marginTop: 12 }}>
        <button className="os-btn ghost" onClick={onNewModule}>Modul nou</button>
      </div>
    </>
  )
}
