import { Head, Rows, Row, Section } from '../parts'
import { money, today } from '../format'
import type { Doc, OsData } from '../types'

/**
 * Hârtiile primite: scrisori, facturi, decizii.
 *
 * Sortate după cât te costă dacă le uiți — întâi ce are termen, cele mai
 * apropiate primele, apoi ce n-are, apoi ce e rezolvat. O hârtie fără termen
 * nu e urgentă; una cu termenul trecut e cea mai urgentă dintre toate.
 */
function byUrgency(a: Doc, b: Doc): number {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1
  if (!!a.due !== !!b.due) return a.due ? -1 : 1
  if (a.due && b.due) return a.due.localeCompare(b.due)
  return (b.date ?? '').localeCompare(a.date ?? '')
}

const stripeOf = (doc: Doc): string => {
  if (doc.done) return 'good'
  if (doc.due && doc.due < today()) return 'bad'
  return doc.due ? 'warn' : 'acc'
}

export function Docs({ data, mod, onAdd, onOpen, onToggle, onDelete }: {
  data: OsData
  mod: string
  onAdd: () => void
  onOpen: (doc: Doc) => void
  onToggle: (doc: Doc) => void
  onDelete: (doc: Doc) => void
}) {
  const currency = data.settings.currency
  const list = Object.values(data.docs ?? {}).filter(doc => doc.mod === mod).sort(byUrgency)
  const open = list.filter(doc => !doc.done)

  if (list.length === 0) {
    return (
      <>
        <Head title="Documente" sub="Scrisori, facturi, decizii — cu termenele lor."
          action={<button className="os-btn" onClick={onAdd}>Document nou</button>} />
        <div className="os-empty">
          <h3>Nicio hârtie încă</h3>
          <p>Pune aici scrisorile care cer ceva de la tine. Termenul lor intră în calendar.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Head title="Documente" sub="Scrisori, facturi, decizii — cu termenele lor."
        action={<button className="os-btn" onClick={onAdd}>Document nou</button>} />

      <Section title={open.length ? `De rezolvat — ${open.length}` : 'Toate rezolvate'} />
      <Rows>
        {list.map(doc => (
          <Row key={doc.id} stripe={stripeOf(doc)}
            title={doc.title}
            sub={[
              doc.from,
              doc.ref ? `ref. ${doc.ref}` : '',
              doc.date ? `din ${doc.date}` : '',
              doc.due ? `${doc.done ? 'era' : 'până'} ${doc.due}` : '',
            ].filter(Boolean).join(' · ')}
            amount={doc.amount === undefined ? undefined : money(doc.amount, currency)}
            action={
              <>
                <button className="os-btn ghost sm" onClick={() => onOpen(doc)}>Deschide</button>
                <button className="os-btn ghost sm" onClick={() => onToggle(doc)}>
                  {doc.done ? 'Redeschide' : 'Rezolvat'}
                </button>
                <button className="os-icon del" onClick={() => onDelete(doc)} aria-label="Șterge">🗑</button>
              </>
            } />
        ))}
      </Rows>
    </>
  )
}
