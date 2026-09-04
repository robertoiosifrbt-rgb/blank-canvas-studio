import { Head, Section } from '../parts'
import { money, today } from '../format'
import { itemsUnder } from '../modules'
import {
  activePlan, currentHolder, everyLabel, nextDue, paymentsFor, progress, remaining,
} from '../debts'
import type { Debt, DebtAction, DebtHolder, DebtPlan, DocFile, OsData } from '../types'

/**
 * Controlul datoriilor.
 *
 * O datorie nu e o sumă, e un dosar: cine o ține acum, cu ce referință, în ce
 * stadiu legal, ce s-a vorbit și când. Ecranul arată în ordinea în care te
 * costă dacă nu te uiți — întâi cele în stadiu legal avansat, apoi restul.
 */

/* Cât de departe a mers pe drumul legal. Numărul nu se vede nicăieri; doar
   ordonează, ca cele grave să nu stea sub cele plătite. */
const HEAT: Record<string, number> = {
  'Executare': 9, 'CCJ obținut': 8, 'Acțiune în instanță': 7, 'Somație': 6,
  'Înainte de somație': 5, 'În default': 4, 'Vândută': 3,
  'Notificare de default': 3, 'Scrisoare primită': 2, 'Contestată': 2,
}

const heat = (debt: Debt): number => HEAT[debt.stage ?? ''] ?? 0
const settled = (debt: Debt): boolean =>
  ['Plătită', 'Stinsă', 'Închisă'].includes(debt.status)

function byUrgency(a: Debt, b: Debt): number {
  if (settled(a) !== settled(b)) return settled(a) ? 1 : -1
  if (heat(a) !== heat(b)) return heat(b) - heat(a)
  return a.name.localeCompare(b.name)
}

export interface DebtsActions {
  onAdd: () => void
  onEdit: (debt: Debt) => void
  onDelete: (debt: Debt) => void
  onPay: (debt: Debt) => void
  onHolder: (debt: Debt, holder?: DebtHolder) => void
  onDropHolder: (debt: Debt, holder: DebtHolder) => void
  onPlan: (debt: Debt, plan?: DebtPlan) => void
  onDropPlan: (debt: Debt, plan: DebtPlan) => void
  onAction: (debt: Debt, action?: DebtAction) => void
  onDropAction: (debt: Debt, action: DebtAction) => void
  onAttach: (debt: Debt, file: File) => void
  onOpenFile: (debt: Debt, file: DocFile) => void
  onDeleteFile: (debt: Debt, file: DocFile) => void
  onNewOrg: () => void
}

export function Debts({ data, mod, busy, ...on }: DebtsActions & {
  data: OsData
  mod: string
  busy: string | null
}) {
  const currency = data.settings.currency
  const list = itemsUnder(data, data.debts, mod).sort(byUrgency)
  const owe = list.filter(d => d.direction !== 'owed' && !settled(d))
  const total = owe.reduce((sum, debt) => sum + remaining(data, debt), 0)

  const head = (
    <Head title="Datorii" sub={owe.length
      ? `${money(total, currency)} de plată, pe ${owe.length} ${owe.length === 1 ? 'datorie' : 'datorii'}.`
      : 'Cine ține fiecare datorie, cu ce referință, în ce stadiu.'}
      action={<button className="os-btn" onClick={on.onAdd}>Datorie nouă</button>} />
  )

  if (list.length === 0) {
    return (
      <>
        {head}
        <div className="os-empty">
          <h3>Nicio datorie</h3>
          <p>Pune-le aici cu tot cu firme, referințe și ce s-a vorbit. Scadențele intră în calendar.</p>
        </div>
      </>
    )
  }

  return (
    <>
      {head}
      <div className="os-chips" style={{ marginBottom: 14 }}>
        <button className="os-chip" onClick={on.onNewOrg}>Organizație nouă</button>
      </div>

      {list.map(debt => {
        const left = remaining(data, debt)
        const done = progress(data, debt)
        const holder = currentHolder(debt)
        const org = holder ? data.orgs[holder.org] : undefined
        const plan = activePlan(debt)
        const due = plan ? nextDue(plan) : undefined
        const payments = paymentsFor(data, debt.id)
        const incoming = debt.direction === 'owed'

        return (
          <div className="os-card pad os-doc" key={debt.id}>
            <div className="os-doc-head">
              <div>
                <b>{debt.name}</b>
                <span className="os-muted">{[
                  incoming ? 'mi se datorează' : '',
                  debt.category,
                  debt.status,
                  debt.stage && debt.stage !== 'Niciunul' ? debt.stage : '',
                ].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="os-doc-amount">{money(left, currency)}</span>
            </div>

            <div className="os-prog"><i style={{ width: `${Math.max(1.5, done)}%` }} /></div>
            <span className="os-muted">
              {money(debt.total - left, currency)} din {money(debt.total, currency)}
              {payments.length ? ` · ${payments.length} ${payments.length === 1 ? 'plată' : 'plăți'}` : ''}
            </span>

            {org ? (
              <div className="os-doc-files">
                <span className="os-doc-file">
                  <span className="os-doc-open" role="note">
                    {org.name} <em>{holder?.role}</em>
                    {holder?.ref ? <em>ref. {holder.ref}</em> : null}
                    {org.phone ? <em>{org.phone}</em> : null}
                  </span>
                </span>
              </div>
            ) : (
              <span className="os-muted">Nu știi cine o ține. Adaugă firma.</span>
            )}

            {plan ? (
              <span className={`os-pill ${due && due < today() ? 'bad' : 'warn'}`}>
                {money(plan.amount, currency)} {everyLabel(plan.every)}{due ? ` · ${due}` : ''}
              </span>
            ) : null}

            {(debt.actions ?? []).length ? (
              <div className="os-doc-files">
                {[...(debt.actions ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(action => (
                  <span className="os-doc-file" key={action.id}>
                    <button className="os-doc-open" onClick={() => on.onAction(debt, action)}>
                      {action.date} · {action.kind} — {action.summary}
                      {action.followUp ? <em>reluat {action.followUp}</em> : null}
                    </button>
                    <button className="os-icon del" aria-label="Șterge intrarea"
                      onClick={() => on.onDropAction(debt, action)}>🗑</button>
                  </span>
                ))}
              </div>
            ) : null}

            {(debt.files ?? []).length ? (
              <div className="os-doc-files">
                {(debt.files ?? []).map(file => (
                  <span className="os-doc-file" key={file.id}>
                    <button className="os-doc-open" onClick={() => on.onOpenFile(debt, file)}>{file.name}</button>
                    <button className="os-icon del" aria-label={`Șterge ${file.name}`}
                      onClick={() => on.onDeleteFile(debt, file)}>🗑</button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="os-hero-acts">
              <button className="os-btn sm" onClick={() => on.onPay(debt)}>
                {incoming ? 'Încasare' : 'Plată'}
              </button>
              <button className="os-btn ghost sm" onClick={() => on.onAction(debt)}>Ce s-a întâmplat</button>
              <button className="os-btn ghost sm" onClick={() => on.onHolder(debt)}>Firmă</button>
              <button className="os-btn ghost sm" onClick={() => on.onPlan(debt, plan)}>
                {plan ? 'Planul' : 'Plan de plată'}
              </button>
              <label className={`os-btn ghost sm${busy === debt.id ? ' busy' : ''}`}>
                {busy === debt.id ? 'Se urcă…' : 'Scrisoare'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  style={{ display: 'none' }} disabled={busy === debt.id}
                  onChange={event => {
                    const picked = event.target.files?.[0]
                    if (picked) on.onAttach(debt, picked)
                    event.target.value = ''
                  }} />
              </label>
              <button className="os-btn ghost sm" onClick={() => on.onEdit(debt)}>Modifică</button>
              <button className="os-icon del" onClick={() => on.onDelete(debt)} aria-label="Șterge">🗑</button>
            </div>

            {(debt.holders ?? []).length > 1 ? (
              <>
                <Section title="Cine a ținut-o" />
                <div className="os-doc-files">
                  {(debt.holders ?? []).map(h => (
                    <span className="os-doc-file" key={h.id}>
                      <button className="os-doc-open" onClick={() => on.onHolder(debt, h)}>
                        {data.orgs[h.org]?.name ?? 'firmă ștearsă'} <em>{h.role}</em>
                        {h.from ? <em>din {h.from}</em> : null}
                        {h.to ? <em>până {h.to}</em> : null}
                      </button>
                      <button className="os-icon del" aria-label="Șterge"
                        onClick={() => on.onDropHolder(debt, h)}>🗑</button>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )
      })}
    </>
  )
}
