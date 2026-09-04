import { Head, Section } from '../parts'
import { money, today } from '../format'
import { itemsUnder, moduleById } from '../modules'
import { MAX_FILE_BYTES } from '../docFiles'
import type { Doc, DocFile, OsData } from '../types'

/**
 * Hârtiile primite: scrisori, facturi, decizii.
 *
 * Sortate după cât te costă dacă le uiți — întâi ce are termen, cele mai
 * apropiate primele, apoi ce n-are, la urmă ce e rezolvat. O hârtie fără
 * termen nu e urgentă; una cu termenul trecut e cea mai urgentă dintre toate.
 */
function byUrgency(a: Doc, b: Doc): number {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1
  if (!!a.due !== !!b.due) return a.due ? -1 : 1
  if (a.due && b.due) return a.due.localeCompare(b.due)
  return (b.date ?? '').localeCompare(a.date ?? '')
}

const toneOf = (doc: Doc): string => {
  if (doc.done) return 'good'
  if (doc.due && doc.due < today()) return 'bad'
  return doc.due ? 'warn' : 'acc'
}

const sizeOf = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${Math.round(bytes / 1024 / 102.4) / 10} MB`

export interface DocsActions {
  onAdd: () => void
  onOpen: (doc: Doc) => void
  onToggle: (doc: Doc) => void
  onDelete: (doc: Doc) => void
  onAttach: (doc: Doc, file: File) => void
  onOpenFile: (doc: Doc, file: DocFile) => void
  onDeleteFile: (doc: Doc, file: DocFile) => void
}

export function Docs({ data, mod, busy, ...on }: DocsActions & {
  data: OsData
  mod: string
  /** Id-ul documentului la care se urcă acum, ca butonul lui să spună asta. */
  busy: string | null
}) {
  const currency = data.settings.currency
  const list = itemsUnder(data, data.docs ?? {}, mod).sort(byUrgency)
  const open = list.filter(doc => !doc.done)

  const head = (
    <Head title="Documente" sub="Scrisori, facturi, decizii — cu termenele și scanurile lor."
      action={<button className="os-btn" onClick={on.onAdd}>Document nou</button>} />
  )

  if (list.length === 0) {
    return (
      <>
        {head}
        <div className="os-empty">
          <h3>Nicio hârtie încă</h3>
          <p>Pune aici scrisorile care cer ceva de la tine. Termenul lor intră în calendar.</p>
        </div>
      </>
    )
  }

  return (
    <>
      {head}
      <Section title={open.length ? `De rezolvat — ${open.length}` : 'Toate rezolvate'} />

      {list.map(doc => (
        <div className="os-card pad os-doc" key={doc.id}>
          <div className="os-doc-head">
            <div>
              <b>{doc.title}</b>
              <span className="os-muted">{[
                doc.mod !== mod ? moduleById(data, doc.mod)?.name : '',
                doc.from,
                doc.ref ? `ref. ${doc.ref}` : '',
                doc.date ? `din ${doc.date}` : '',
              ].filter(Boolean).join(' · ')}</span>
            </div>
            {doc.amount === undefined ? null
              : <span className="os-doc-amount">{money(doc.amount, currency)}</span>}
          </div>

          {doc.due ? (
            <span className={`os-pill ${toneOf(doc)}`}>
              {doc.done ? `era ${doc.due}` : `până ${doc.due}`}
            </span>
          ) : null}

          {doc.note ? <p className="os-note-text">{doc.note}</p> : null}

          {(doc.files ?? []).length ? (
            <div className="os-doc-files">
              {(doc.files ?? []).map(file => (
                <span className="os-doc-file" key={file.id}>
                  <button className="os-doc-open" onClick={() => on.onOpenFile(doc, file)}>
                    {file.name} <em>{sizeOf(file.size)}</em>
                  </button>
                  <button className="os-icon del" aria-label={`Șterge ${file.name}`}
                    onClick={() => on.onDeleteFile(doc, file)}>🗑</button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="os-hero-acts">
            <label className={`os-btn ghost sm${busy === doc.id ? ' busy' : ''}`}>
              {busy === doc.id ? 'Se urcă…' : 'Atașează'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                style={{ display: 'none' }} disabled={busy === doc.id}
                onChange={event => {
                  const picked = event.target.files?.[0]
                  if (picked) on.onAttach(doc, picked)
                  event.target.value = ''
                }} />
            </label>
            <button className="os-btn ghost sm" onClick={() => on.onOpen(doc)}>Modifică</button>
            <button className="os-btn ghost sm" onClick={() => on.onToggle(doc)}>
              {doc.done ? 'Redeschide' : 'Rezolvat'}
            </button>
            <button className="os-icon del" onClick={() => on.onDelete(doc)} aria-label="Șterge">🗑</button>
          </div>
        </div>
      ))}

      <p className="os-muted">PDF-uri și poze, până la {Math.round(MAX_FILE_BYTES / 1_000_000)} MB fișierul.</p>
    </>
  )
}
