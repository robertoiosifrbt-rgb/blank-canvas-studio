import { useState } from 'react'
import { Head, Section, Tile } from '../parts'
import { money } from '../format'
import { daysOf, spanHours, summarise, totalsOf, vehicleName } from '../delivery'
import { fuelRate, intervalsOf, pricePerLitre } from '../fuelChain'
import { businessPart } from '../carCosts'
import { searchCarCosts, searchDays, searchFuel } from '../deliverySearch'
import type { CarExpense, Fuel, OsData, Vehicle, Workday, WorkPeriod } from '../types'

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
  onFuel: (item?: Fuel) => void
  onDropFuel: (item: Fuel) => void
  onCarCost: (item?: CarExpense) => void
  onPeriod: (day: Workday, period?: WorkPeriod) => void
  onDropPeriod: (day: Workday, period: WorkPeriod) => void
  onDropCarCost: (item: CarExpense) => void
}

export function Delivery({ data, mod, ...on }: DeliveryActions & { data: OsData; mod: string }) {
  const currency = data.settings.currency
  const [query, setQuery] = useState('')
  const month = new Date().toISOString().slice(0, 7)
  const sum = summarise(data, daysOf(data, mod).filter(day => day.date.startsWith(month)))

  /* Cât timp cauți, listele arată doar ce se potrivește — turele, alimentările
     și cheltuielile deodată. Totalurile lunii rămân ale lunii: ele spun cum
     stai, nu ce cauți. */
  const days = searchDays(data, mod, query)
  const fuels = searchFuel(data, query)
  const carCosts = searchCarCosts(data, mod, query)
  const searching = query.trim().length > 0
  const nothing = searching && !days.length && !fuels.length && !carCosts.length

  return (
    <>
      <Head title="Food delivery" sub="Tura, cu tot cu ce rămâne din ea."
        action={<button className="os-btn" onClick={on.onAdd}>Tură nouă</button>} />

      <div className="os-chips" style={{ marginBottom: 14 }}>
        <button className="os-chip" onClick={() => on.onFuel()}>Alimentare</button>
        <button className="os-chip" onClick={() => on.onCarCost()}>Cheltuială mașină</button>
        <button className="os-chip" onClick={() => on.onVehicle()}>Mașină nouă</button>
        <button className="os-chip" onClick={on.onSettings}>Procente și costuri</button>
      </div>

      <input className="os-in" type="search" value={query} style={{ marginBottom: 14 }}
        aria-label="Caută prin livrări"
        placeholder="Caută: o zi, o mașină, o cheltuială…"
        onChange={e => setQuery(e.target.value)} />

      {nothing ? (
        <div className="os-empty">
          <h3>Nimic pentru „{query}”</h3>
          <p>Caută după zi, mașină, felul cheltuielii sau ce ai scris în note.</p>
        </div>
      ) : null}

      {sum.days > 0 && !searching ? (
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

      {days.length === 0 ? (searching ? null :
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
                  day.periods?.length ? `+${day.periods.length} ${day.periods.length === 1 ? 'interval' : 'intervale'}` : '',
                  t.hours ? `${t.hours.toFixed(1)} h` : '',
                  t.businessKm ? `${Math.round(t.businessKm)} km` : '',
                  car,
                ].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="os-doc-amount">{money(t.available, currency)}</span>
            </div>

            <div className="os-hero-facts">
              <div><b>{money(t.gross, currency)}</b><span>brut</span></div>
              <div><b>{money(t.fuel, currency)}</b><span>combustibil</span></div>
              {t.recurring ? <div><b>{money(t.recurring, currency)}</b><span>partea zilei</span></div> : null}
              <div><b>{money(t.totalExpenses, currency)}</b><span>cheltuieli</span></div>
              <div><b>{money(t.reserves, currency)}</b><span>rezerve</span></div>
              {t.hours ? <div><b>{money(t.perHour, currency)}</b><span>brut/oră</span></div> : null}
              {t.hours ? <div><b>{money(t.availablePerHour, currency)}</b><span>rămas/oră</span></div> : null}
            </div>

            {day.archived ? (
              <span className="os-pill">Nu atinge Finanțele</span>
            ) : null}

            {day.done && !day.archived && day.debt && day.toDebt !== undefined ? (
              <span className={`os-pill ${Math.abs(t.debtDifference) < 0.01 ? 'good' : 'warn'}`}>
                {money(day.toDebt, currency)} la datorii
                {Math.abs(t.debtDifference) < 0.01 ? '' :
                  t.debtDifference > 0 ? ` · cu ${money(t.debtDifference, currency)} peste`
                    : ` · cu ${money(-t.debtDifference, currency)} sub`}
              </span>
            ) : null}

            <span className="os-muted">{t.fuelSource}</span>

            {day.notes ? <p className="os-note-text">{day.notes}</p> : null}

            {day.periods?.length ? (
              <div className="os-doc-files">
                {day.periods.map(p => (
                  <span className="os-doc-file" key={p.id}>
                    <button className="os-doc-open" onClick={() => on.onPeriod(day, p)}>
                      {p.from}–{p.to}
                      {p.breakMinutes ? <em>pauză {p.breakMinutes} min</em> : null}
                      <em>{spanHours(p.from, p.to, p.breakMinutes).toFixed(1)} h</em>
                    </button>
                    <button className="os-icon del" aria-label="Șterge intervalul"
                      onClick={() => on.onDropPeriod(day, p)}>🗑</button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="os-hero-acts">
              {day.done
                ? <button className="os-btn ghost sm" onClick={() => on.onReopen(day)}>Redeschide</button>
                : <button className="os-btn sm" onClick={() => on.onFinish(day)}>Închide tura</button>}
              <button className="os-btn ghost sm" onClick={() => on.onPeriod(day)}>Alt interval</button>
              <button className="os-btn ghost sm" onClick={() => on.onEdit(day)}>Modifică</button>
              <button className="os-icon del" onClick={() => on.onDelete(day)} aria-label="Șterge">🗑</button>
            </div>
          </div>
        )
      })}

      {fuels.length ? (
        <>
          <Section title="Alimentări" />
          {Object.values(data.vehicles).map(car => {
            const rate = fuelRate(data, car.id)
            const last = intervalsOf(data, car.id).slice(-1)[0]
            const mine = fuels.filter(item => item.vehicle === car.id)
            if (!mine.length) return null
            return (
              <div className="os-card pad os-doc" key={car.id}>
                <div className="os-doc-head">
                  <div>
                    <b>{car.name}</b>
                    <span className="os-muted">{rate.source}</span>
                  </div>
                  {rate.known ? (
                    <span className="os-doc-amount">{money(rate.costPerKm, currency)}/km</span>
                  ) : null}
                </div>
                {last ? (
                  <div className="os-hero-facts">
                    <div><b>{last.litresPer100Km.toFixed(1)}</b><span>l/100 km</span></div>
                    <div><b>{last.mpg.toFixed(1)}</b><span>mpg</span></div>
                    <div><b>{Math.round(last.km)}</b><span>km pe plin</span></div>
                  </div>
                ) : null}
                <div className="os-doc-files">
                  {mine.slice(0, searching ? mine.length : 6).map(item => (
                    <span className="os-doc-file" key={item.id}>
                      <button className="os-doc-open" onClick={() => on.onFuel(item)}>
                        {item.date}
                        <em>{item.litres?.toFixed(1)} l</em>
                        {item.cost ? <em>{money(item.cost, currency)}</em> : null}
                        {item.litres && item.cost ? <em>{pricePerLitre(item).toFixed(3)}/l</em> : null}
                        <em>{item.full ? 'plin' : 'parțial'}</em>
                      </button>
                      <button className="os-icon del" aria-label="Șterge alimentarea"
                        onClick={() => on.onDropFuel(item)}>🗑</button>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      ) : null}

      {carCosts.length ? (
        <>
          <Section title="Cheltuieli cu mașina" />
          <div className="os-doc-files">
            {carCosts.map(item => (
              <span className="os-doc-file" key={item.id}>
                <button className="os-doc-open" onClick={() => on.onCarCost(item)}>
                  {item.date}
                  <em>{item.category ?? 'cheltuială'}</em>
                  {item.what ? <em>{item.what}</em> : null}
                  <em>{money(item.amount, currency)}</em>
                  {item.businessPct !== undefined && item.businessPct < 1
                    ? <em>{Math.round(item.businessPct * 100)}% business = {money(businessPart(item), currency)}</em>
                    : null}
                  {item.from && item.to ? <em>{item.from} → {item.to}</em> : null}
                </button>
                <button className="os-icon del" aria-label="Șterge cheltuiala"
                  onClick={() => on.onDropCarCost(item)}>🗑</button>
              </span>
            ))}
          </div>
        </>
      ) : null}

      {Object.keys(data.vehicles).length > 0 && !searching ? (
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
