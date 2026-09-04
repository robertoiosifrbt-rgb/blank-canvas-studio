import { Head, Section, Tile } from '../parts'
import { money } from '../format'
import { daysOf, summarise, totalsOf, vehicleName } from '../delivery'
import type { OsData, Vehicle, Workday } from '../types'

/**
 * Livrări: ziua de lucru, cu ce a rămas din ea.
 *
 * Cifra care contează nu e cât ai încasat, e cât rămâne după combustibil,
 * taxe, National Insurance și fondul de mașină. Aia e pusă mare; brutul stă
 * lângă ea, mai mic, pentru că e cel care înșală.
 */
export interface DeliveryActions {
  onAdd: () => void
  onEdit: (day: Workday) => void
  onFinish: (day: Workday) => void
  onReopen: (day: Workday) => void
  onDelete: (day: Workday) => void
  onVehicle: (vehicle?: Vehicle) => void
  onSettings: () => void
}

export function Delivery({ data, mod, ...on }: DeliveryActions & { data: OsData; mod: string }) {
  const currency = data.settings.currency
  const days = daysOf(data, mod)
  const month = new Date().toISOString().slice(0, 7)
  const sum = summarise(data, days.filter(day => day.date.startsWith(month)))

  return (
    <>
      <Head title="Food delivery" sub="Tura, cu tot cu ce rămâne din ea."
        action={<button className="os-btn" onClick={on.onAdd}>Tură nouă</button>} />

      <div className="os-chips" style={{ marginBottom: 14 }}>
        <button className="os-chip" onClick={() => on.onVehicle()}>Mașină nouă</button>
        <button className="os-chip" onClick={on.onSettings}>Procente și costuri</button>
      </div>

      {sum.days ? (
        <>
          <Section title="Luna asta" />
          <div className="os-tiles">
            <Tile lead label="Rămas după rezerve" value={money(sum.available, currency)}
              sub={`din ${sum.days} ${sum.days === 1 ? 'tură' : 'ture'}`} />
            <Tile label="Brut" value={money(sum.gross, currency)}
              sub={`${money(sum.perHour, currency)}/oră`} />
            <Tile label="Cheltuieli" value={money(sum.totalExpenses, currency)} tone="bad" />
            <Tile label="Rezerve" value={money(sum.reserves, currency)}
              sub="taxe, NI, mașină" />
            <Tile label="Ore" value={sum.hours.toFixed(1)} />
            <Tile label="Km de business" value={Math.round(sum.businessKm).toString()} />
          </div>
        </>
      ) : null}

      <Section title={days.length ? 'Ture' : ''} />

      {days.length === 0 ? (
        <div className="os-empty">
          <h3>Nicio tură încă</h3>
          <p>Pune orele, kilometrii și câștigul. Restul — combustibil, taxe, ce rămâne — se socotește singur.</p>
        </div>
      ) : days.map(day => {
        const t = totalsOf(data, day)
        const car = vehicleName(data, day.vehicle)
        return (
          <div className="os-card pad os-doc" key={day.id}>
            <div className="os-doc-head">
              <div>
                <b>{day.date}</b>
                <span className="os-muted">{[
                  day.archived ? 'istoric' : '',
                  day.done ? '' : 'neterminată',
                  day.from && day.to ? `${day.from}–${day.to}` : '',
                  t.hours ? `${t.hours.toFixed(1)} h` : '',
                  t.businessKm ? `${Math.round(t.businessKm)} km` : '',
                  car,
                ].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="os-doc-amount">{money(t.available, currency)}</span>
            </div>

            <div className="os-hero-facts">
              <div><b>{money(t.gross, currency)}</b><span>brut</span></div>
              <div><b>{money(t.totalExpenses, currency)}</b><span>cheltuieli</span></div>
              <div><b>{money(t.reserves, currency)}</b><span>rezerve</span></div>
              {t.hours ? <div><b>{money(t.perHour, currency)}</b><span>brut/oră</span></div> : null}
              {t.hours ? <div><b>{money(t.availablePerHour, currency)}</b><span>rămas/oră</span></div> : null}
            </div>

            {day.archived ? (
              <span className="os-pill">Nu atinge Finanțele</span>
            ) : null}

            {day.done && !day.archived && day.toDebt !== undefined ? (
              <span className={`os-pill ${Math.abs(t.debtDifference) < 0.01 ? 'good' : 'warn'}`}>
                {money(day.toDebt, currency)} la datorii
                {Math.abs(t.debtDifference) < 0.01 ? '' :
                  t.debtDifference > 0 ? ` · cu ${money(t.debtDifference, currency)} peste`
                    : ` · cu ${money(-t.debtDifference, currency)} sub`}
              </span>
            ) : null}

            {day.notes ? <p className="os-note-text">{day.notes}</p> : null}

            <div className="os-hero-acts">
              {day.done
                ? <button className="os-btn ghost sm" onClick={() => on.onReopen(day)}>Redeschide</button>
                : <button className="os-btn sm" onClick={() => on.onFinish(day)}>Închide tura</button>}
              <button className="os-btn ghost sm" onClick={() => on.onEdit(day)}>Modifică</button>
              <button className="os-icon del" onClick={() => on.onDelete(day)} aria-label="Șterge">🗑</button>
            </div>
          </div>
        )
      })}

      {Object.keys(data.vehicles).length ? (
        <>
          <Section title="Mașini" />
          <div className="os-doc-files">
            {Object.values(data.vehicles).map(car => (
              <span className="os-doc-file" key={car.id}>
                <button className="os-doc-open" onClick={() => on.onVehicle(car)}>
                  {car.name}
                  {car.plate ? <em>{car.plate}</em> : null}
                  {car.fuelPerKm !== undefined ? <em>{money(car.fuelPerKm, currency)}/km</em> : null}
                </button>
              </span>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}
