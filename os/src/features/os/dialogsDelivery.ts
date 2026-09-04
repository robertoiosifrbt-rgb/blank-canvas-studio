import type { DialogSpec } from './Dialog'
import { DEFAULT_RATES, totalsOf } from './delivery'
import { money, num, today, uid, ym } from './format'
import type { DeliveryRates, OsData, Vehicle, Workday } from './types'

type Update = (change: (draft: OsData) => void) => void

/** Ferestrele modulului de livrări. */
export function deliveryDialogs(data: OsData, update: Update) {
  const currency = data.settings.currency
  const rates = data.settings.delivery ?? DEFAULT_RATES

  const vehicle = (existing?: Vehicle): DialogSpec => ({
    title: existing ? `Modifică „${existing.name}”` : 'Mașină nouă',
    fields: [
      { key: 'name', label: 'Cum îi zici', value: existing?.name ?? '', placeholder: 'ex: Corsa' },
      { key: 'plate', label: 'Număr', value: existing?.plate ?? '' },
      { key: 'fuelPerKm', label: 'Combustibil pe km (gol = media din setări)', type: 'number',
        value: existing?.fuelPerKm === undefined ? '' : String(existing.fuelPerKm) },
    ],
    submit(values) {
      if (!values.name) return 'Dă-i un nume.'
      const id = existing?.id ?? `v${uid()}`
      update(draft => {
        draft.vehicles[id] = {
          id, name: values.name,
          plate: values.plate || undefined,
          fuelPerKm: values.fuelPerKm ? num(values.fuelPerKm) : undefined,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }
      })
    },
  })

  /* Procentele se scriu ca numere întregi — 20 înseamnă 20% — pentru că așa
     le știi. Fracțiile rămân în cod. */
  const settings = (): DialogSpec => ({
    title: 'Cum se socotesc turele',
    note: 'Se aplică de acum înainte. Zilele terminate rămân cu procentele lor.',
    fields: [
      { key: 'taxPct', label: 'Taxe (%)', type: 'number', value: String(Math.round(rates.taxPct * 100)) },
      { key: 'niPct', label: 'National Insurance (%)', type: 'number', value: String(Math.round(rates.niPct * 100)) },
      { key: 'fuelPerKm', label: `Combustibil pe km (${currency})`, type: 'number', value: String(rates.fuelPerKm) },
      { key: 'vehPerKm', label: `Fond mașină pe km (${currency})`, type: 'number', value: String(rates.vehPerKm) },
    ],
    submit(values) {
      const next: DeliveryRates = {
        taxPct: num(values.taxPct) / 100,
        niPct: num(values.niPct) / 100,
        fuelPerKm: num(values.fuelPerKm),
        vehPerKm: num(values.vehPerKm),
      }
      update(draft => { draft.settings.delivery = next })
    },
  })

  const workday = (mod: string, existing?: Workday): DialogSpec => ({
    title: existing ? `Tura din ${existing.date}` : 'Tură nouă',
    fields: [
      { key: 'date', label: 'Ziua', type: 'date', value: existing?.date ?? today() },
      { key: 'from', label: 'De la', value: existing?.from ?? '', placeholder: '10:00' },
      { key: 'to', label: 'Până la', value: existing?.to ?? '', placeholder: '18:00' },
      { key: 'breakMinutes', label: 'Pauză (minute)', type: 'number',
        value: existing?.breakMinutes === undefined ? '' : String(existing.breakMinutes) },
      { key: 'vehicle', label: 'Mașina', type: 'select', value: existing?.vehicle ?? '', options: [
        { value: '', label: '— niciuna —' },
        ...Object.values(data.vehicles).map(v => ({ value: v.id, label: v.name })),
      ] },
      { key: 'odoStart', label: 'Km la plecare', type: 'number',
        value: existing?.odoStart === undefined ? '' : String(existing.odoStart) },
      { key: 'odoEnd', label: 'Km la întoarcere', type: 'number',
        value: existing?.odoEnd === undefined ? '' : String(existing.odoEnd) },
      { key: 'personalKm', label: 'Din care personali', type: 'number',
        value: existing?.personalKm === undefined ? '' : String(existing.personalKm) },
      { key: 'uber', label: 'Uber Eats', type: 'number', value: existing?.uber === undefined ? '' : String(existing.uber) },
      { key: 'deliveroo', label: 'Deliveroo', type: 'number', value: existing?.deliveroo === undefined ? '' : String(existing.deliveroo) },
      { key: 'justEat', label: 'Just Eat', type: 'number', value: existing?.justEat === undefined ? '' : String(existing.justEat) },
      { key: 'otherPlatform', label: 'Altă platformă', type: 'number', value: existing?.otherPlatform === undefined ? '' : String(existing.otherPlatform) },
      { key: 'tips', label: 'Bacșiș', type: 'number', value: existing?.tips === undefined ? '' : String(existing.tips) },
      { key: 'bonuses', label: 'Bonusuri', type: 'number', value: existing?.bonuses === undefined ? '' : String(existing.bonuses) },
      { key: 'parking', label: 'Parcare', type: 'number', value: existing?.parking === undefined ? '' : String(existing.parking) },
      { key: 'tolls', label: 'Taxe de drum', type: 'number', value: existing?.tolls === undefined ? '' : String(existing.tolls) },
      { key: 'otherCost', label: 'Alte costuri ale turei', type: 'number', value: existing?.otherCost === undefined ? '' : String(existing.otherCost) },
      { key: 'notes', label: 'Note', type: 'textarea', value: existing?.notes ?? '' },
    ],
    submit(values) {
      if (!values.date) return 'Pune ziua.'
      const id = existing?.id ?? `w${uid()}`
      const numbers = ['breakMinutes', 'odoStart', 'odoEnd', 'personalKm', 'uber', 'deliveroo',
        'justEat', 'otherPlatform', 'tips', 'bonuses', 'parking', 'tolls', 'otherCost'] as const
      update(draft => {
        const day: Workday = {
          ...(existing ?? {}),
          id, mod, date: values.date,
          from: values.from || undefined,
          to: values.to || undefined,
          vehicle: values.vehicle || undefined,
          notes: values.notes || undefined,
          done: existing?.done ?? false,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }
        for (const key of numbers) {
          day[key] = values[key] ? num(values[key]) : undefined
        }
        draft.workdays[id] = day
      })
    },
  })

  /**
   * Terminarea turei: îngheață procentele și scrie banii în Finanțe.
   *
   * Câștigul e venit, cheltuielile sunt cheltuială — o singură înregistrare
   * fiecare, marcate cu ziua. Tura nu ține bani de-o parte; Finanțele nu țin
   * ture. Fiecare lucru scris o dată.
   */
  const finish = (day: Workday): DialogSpec => {
    const totals = totalsOf(data, day)
    return {
      title: `Închizi tura din ${day.date}?`,
      note: `Brut ${money(totals.gross, currency)}, cheltuieli ${money(totals.totalExpenses, currency)}, ` +
        `rezerve ${money(totals.reserves, currency)}. Rămâne ${money(totals.available, currency)}.`,
      ok: 'Închide tura',
      fields: [
        { key: 'toDebt', label: 'Cât trimiți la datorii', type: 'number', value: totals.available.toFixed(2) },
        { key: 'debt', label: 'Către care', type: 'select', value: '', options: [
          { value: '', label: '— niciuna anume —' },
          ...Object.values(data.debts).map(d => ({ value: d.id, label: d.name })),
        ] },
      ],
      submit(values) {
        const month = ym(day.date)
        update(draft => {
          const target = draft.workdays[day.id]
          target.done = true
          target.rates = data.settings.delivery ?? DEFAULT_RATES
          target.toDebt = values.toDebt ? num(values.toDebt) : undefined
          target.debt = values.debt || undefined

          draft.finance[month] ??= { items: [] }
          const items = draft.finance[month].items
          if (totals.gross > 0) {
            items.push({ id: `wd-in-${day.id}`, date: day.date, type: 'in',
              amount: totals.gross, cat: 'Livrări', note: `Tură ${day.date}` })
          }
          if (totals.totalExpenses > 0) {
            items.push({ id: `wd-out-${day.id}`, date: day.date, type: 'out',
              amount: totals.totalExpenses, cat: 'Livrări', note: `Costuri tură ${day.date}` })
          }
          if (values.debt && num(values.toDebt) > 0) {
            items.push({ id: `wd-debt-${day.id}`, date: day.date, type: 'out',
              amount: num(values.toDebt), cat: 'Datorii', note: `Din tura ${day.date}`, debt: values.debt })
          }
        })
      },
    }
  }

  return { vehicle, settings, workday, finish }
}
