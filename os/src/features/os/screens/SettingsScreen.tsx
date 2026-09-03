import { Rows, Row, Section } from '../parts'
import { moduleTree } from '../modules'
import type { OsData } from '../types'
import type { SyncMode } from '../storage'

const BUILD = '2026-09-03 · React'
const LS_MAX = 5_000_000

export function SettingsScreen({ data, mode, error, token, onCurrency, onToken, onExport, onUpdate, onNewModule, onDeleteModule }: {
  data: OsData
  mode: SyncMode
  error: string | null
  token: string
  onCurrency: (value: string) => void
  onToken: (value: string) => void
  onExport: () => void
  onUpdate: () => void
  onNewModule: () => void
  onDeleteModule: (id: string) => void
}) {
  let used = 0
  try { used = new TextEncoder().encode(localStorage.getItem('roberto-os-v1') ?? '').length } catch { used = 0 }
  const pct = Math.min(100, (used / LS_MAX) * 100)
  const kb = `${(used / 1024).toFixed(1)} KB`
  const tree = moduleTree(data)

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
                ? 'În baza ta de date, prin state-api. Sertar propriu — nu atinge datele celeilalte aplicații.'
                : `${error ? `Cloud-ul n-a răspuns (${error}). ` : ''}Doar în acest browser, pe acest aparat.`}
            </span>
          </div>
          <span className={`os-pill ${mode === 'cloud' ? 'good' : 'warn'}`}>{mode === 'cloud' ? 'cloud propriu' : 'local'}</span>
        </div>

        <div>
          <b>Cod de sincronizare</b>
          <span className="os-muted">Pune același cod pe telefon și pe laptop ca să vezi aceleași date.</span>
          <input type="text" spellCheck={false} defaultValue={token}
            onBlur={e => onToken(e.target.value)} />
        </div>

        <div className="os-split">
          <div>
            <b>Export</b>
            <span className="os-muted">Descarci tot într-un fișier pe care îl păstrezi tu.</span>
          </div>
          <button className="os-btn" onClick={onExport}>Exportă tot</button>
        </div>
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
