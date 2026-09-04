import type { DialogSpec } from './Dialog'
import { DEFAULT_RATES, totalsOf } from './delivery'
import { money, num, today, uid, ym } from './format'
import { CASH, accountsOf, earningsOf, platformBalance } from './accounts'
import type {
  Account, CarExpense, DeliveryRates, Fuel, OsData, Vehicle, Workday, WorkPeriod,
} from './types'

const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']

const CAR_CATEGORIES = ['Reparație', 'Service', 'Asigurare', 'ITP', 'Cauciucuri',
  'Taxă de drum', 'Spălare', 'Rovinietă', 'Leasing', 'Altele']

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

  /**
   * Un cont: o platformă, o bancă, sau buzunarul.
   *
   * La platforme se scrie și când plătesc singure — ziua, ora și contul în
   * care intră banii. Alea nu sunt bătute în cuie nicăieri: dacă Deliveroo
   * mută plata de marți pe miercuri, o schimbi aici.
   */
  const account = (existing?: Account, fresh: Account['kind'] = 'platform'): DialogSpec => {
    const banks = accountsOf(data, 'bank')
    return {
      title: existing ? `Modifică „${existing.name}”` : 'Cont nou',
      fields: [
        { key: 'name', label: 'Cum îi zici', value: existing?.name ?? '', placeholder: 'ex: Stuart, Monzo' },
        { key: 'kind', label: 'Ce fel de cont', type: 'select', value: existing?.kind ?? fresh, options: [
          { value: 'platform', label: 'Platformă de livrări' },
          { value: 'bank', label: 'Cont bancar' },
          { value: 'cash', label: 'Cash' },
        ] },
        { key: 'cashOutFee', label: `Comision la scoaterea pe loc (${currency})`, type: 'number',
          value: existing?.cashOutFee === undefined ? '' : String(existing.cashOutFee) },
        { key: 'payDay', label: 'Plătește singură în ziua de', type: 'select',
          value: existing?.payout ? String(existing.payout.day) : '', options: [
            { value: '', label: '— nu plătește singură —' },
            ...DAYS.map((name, index) => ({ value: String(index), label: name })),
          ] },
        { key: 'payAt', label: 'La ora', value: existing?.payout?.at ?? '', placeholder: '13:00' },
        { key: 'payTo', label: 'Banii intră în', type: 'select', value: existing?.payTo ?? '', options: [
          { value: '', label: banks.length ? '— niciun cont —' : '— n-ai încă niciun cont bancar —' },
          ...banks.map(bank => ({ value: bank.id, label: bank.name })),
        ] },
        { key: 'notes', label: 'Note', type: 'textarea', value: existing?.notes ?? '' },
      ],
      submit(values) {
        if (!values.name) return 'Dă-i un nume.'
        const kind = (values.kind || 'platform') as Account['kind']
        if (kind === 'platform' && values.payDay && !values.payAt) return 'Pune și ora la care plătește.'
        const id = existing?.id ?? `a${uid()}`
        update(draft => {
          draft.accounts[id] = {
            id, name: values.name, kind,
            cashOutFee: kind === 'platform' && values.cashOutFee ? num(values.cashOutFee) : undefined,
            payout: kind === 'platform' && values.payDay
              ? { day: Number(values.payDay), at: values.payAt || '23:59' }
              : undefined,
            payTo: kind === 'platform' ? values.payTo || undefined : undefined,
            notes: values.notes || undefined,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          }
        })
      },
    }
  }

  /**
   * Scoaterea banilor pe loc.
   *
   * De pe platformă pleacă suma întreagă; în bancă ajunge mai puțin, cu
   * comisionul. Se scriu amândouă — altfel comisionul ar dispărea din
   * socoteală și n-ai ști niciodată cât te-a costat graba.
   */
  const cashOut = (from: Account): DialogSpec => {
    const balance = platformBalance(data, from.id)
    const fee = num(from.cashOutFee)
    const banks = accountsOf(data, 'bank')
    return {
      title: `Scoți banii de pe ${from.name}`,
      note: fee > 0
        ? `Ai ${money(balance, currency)}. Scoaterea pe loc costă ${money(fee, currency)}.`
        : `Ai ${money(balance, currency)}.`,
      ok: 'Scoate banii',
      fields: [
        { key: 'amount', label: `Cât scoți (${currency})`, type: 'number', value: balance.toFixed(2) },
        { key: 'to', label: 'În ce cont', type: 'select', value: from.payTo ?? banks[0]?.id ?? '', options:
          banks.map(bank => ({ value: bank.id, label: bank.name })) },
        { key: 'date', label: 'Ziua', type: 'date', value: today() },
      ],
      submit(values) {
        const amount = num(values.amount)
        if (amount <= 0) return 'Scrie cât scoți.'
        if (amount > balance + 0.001) return `N-ai atât pe ${from.name}. Ai ${money(balance, currency)}.`
        if (!values.to) return 'Fă întâi un cont bancar, ca să aibă unde intra.'
        const id = `out-${uid()}`
        const month = ym(values.date)
        update(draft => {
          draft.finance[month] ??= { items: [] }
          draft.finance[month].items.push({
            id, date: values.date, type: 'in', amount: amount - fee, gross: amount,
            cat: 'Livrări', note: `Scos de pe ${from.name}`,
            account: values.to, from: from.id,
          })
          if (fee > 0) {
            draft.finance[month].items.push({
              id: `${id}-fee`, date: values.date, type: 'out', amount: fee,
              cat: 'Comisioane', note: `Scoatere pe loc ${from.name}`, account: values.to,
            })
          }
        })
      },
    }
  }


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
      /* Câte un câmp pe platformă, luate din conturi. Adaugi un cont nou,
         apare aici singur — nu mai e nimic bătut în cod. */
      ...accountsOf(data, 'platform').map(account => {
        const had = existing ? earningsOf(existing)[account.id] : undefined
        return { key: `earn:${account.id}`, label: account.name, type: 'number' as const,
          value: had === undefined ? '' : String(had) }
      }),
      { key: 'tips', label: 'Bacșiș', type: 'number', value: existing?.tips === undefined ? '' : String(existing.tips) },
      { key: 'bonuses', label: 'Bonusuri', type: 'number', value: existing?.bonuses === undefined ? '' : String(existing.bonuses) },
      { key: 'parking', label: 'Parcare', type: 'number', value: existing?.parking === undefined ? '' : String(existing.parking) },
      { key: 'tolls', label: 'Taxe de drum', type: 'number', value: existing?.tolls === undefined ? '' : String(existing.tolls) },
      { key: 'otherCost', label: 'Alte costuri ale turei', type: 'number', value: existing?.otherCost === undefined ? '' : String(existing.otherCost) },
      { key: 'archived', label: 'Intrare veche', type: 'select',
        value: existing?.archived ? 'da' : '', options: [
          { value: '', label: 'Nu — banii intră în Finanțe' },
          { value: 'da', label: 'Da — doar pentru istoric, fără bani în Finanțe' },
        ] },
      { key: 'notes', label: 'Note', type: 'textarea', value: existing?.notes ?? '' },
    ],
    submit(values) {
      if (!values.date) return 'Pune ziua.'
      const id = existing?.id ?? `w${uid()}`
      const numbers = ['breakMinutes', 'odoStart', 'odoEnd', 'personalKm',
        'tips', 'bonuses', 'parking', 'tolls', 'otherCost'] as const
      const earnings: Record<string, number> = {}
      for (const account of accountsOf(data, 'platform')) {
        const written = values[`earn:${account.id}`]
        if (written) earnings[account.id] = num(written)
      }
      update(draft => {
        const day: Workday = {
          ...(existing ?? {}),
          id, mod, date: values.date,
          from: values.from || undefined,
          to: values.to || undefined,
          vehicle: values.vehicle || undefined,
          earnings,
          notes: values.notes || undefined,
          archived: values.archived === 'da' ? true : undefined,
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
    const money_ = `Brut ${money(totals.gross, currency)}, cheltuieli ${money(totals.totalExpenses, currency)}, ` +
      `rezerve ${money(totals.reserves, currency)}. Rămâne ${money(totals.available, currency)}.`
    /* Se spune unde se duc banii, ca să nu-i cauți în Finanțe și să crezi că
       s-au pierdut: pe platforme stau până în ziua lor de plată. */
    const whereTo = totals.platform > 0
      ? ` ${money(totals.platform, currency)} rămân pe platforme până plătesc ele.`
      : ''
    return {
      title: `Închizi tura din ${day.date}?`,
      note: day.archived
        ? `${money_} Fiind intrare veche, nu se scrie nimic în Finanțe.`
        : money_ + whereTo,
      ok: 'Închide tura',
      /* Fără nicio datorie, întrebarea n-are răspuns: ar cere o sumă pentru
         un loc care nu există, iar tura ar rămâne cu o cifră care nu înseamnă
         nimic. Câmpurile apar singure când bagi prima datorie. */
      fields: day.archived || Object.keys(data.debts).length === 0 ? [] : [
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

          /* Intrările vechi se opresc aici: rămân în istoric, cu socoteala
             lor, dar registrul de azi nu le vede niciodată. */
          if (day.archived) return

          draft.finance[month] ??= { items: [] }
          const items = draft.finance[month].items

          /* Câștigul de pe platforme NU intră în Finanțe. El rămâne pe Uber,
             pe Deliveroo, pe Just Eat — bani câștigați, dar nu bani pe care
             îi ai. Intră abia când platforma îi trimite în bancă.

             Bacșișul și bonusurile sunt altceva: alea le-ai luat pe loc, deci
             se scriu acum, în contul de cash. */
          const inHand = num(day.tips) + num(day.bonuses)
          if (inHand > 0) {
            items.push({ id: `wd-in-${day.id}`, date: day.date, type: 'in',
              amount: inHand, cat: 'Livrări', note: `Bacșiș și bonusuri, tura ${day.date}`,
              account: CASH })
          }
          /* Fără combustibil și fără cheltuielile cu mașina: alea intră în
             Finanțe la locul lor, cu sumele adevărate. Aici sunt doar
             împărțite pe zile, ca să se vadă cât a costat tura. */
          const costsWithoutFuel = totals.directCosts - totals.fuel + num(day.expenses) + num(day.recurring)
          if (costsWithoutFuel > 0) {
            items.push({ id: `wd-out-${day.id}`, date: day.date, type: 'out',
              amount: costsWithoutFuel, cat: 'Livrări', note: `Costuri tură ${day.date}`,
              account: CASH })
          }
          if (values.debt && num(values.toDebt) > 0) {
            items.push({ id: `wd-debt-${day.id}`, date: day.date, type: 'out',
              amount: num(values.toDebt), cat: 'Datorii', note: `Din tura ${day.date}`,
              debt: values.debt, account: CASH })
          }
        })
      },
    }
  }

  /**
   * O ieșire în plus, în aceeași zi.
   *
   * Tura de prânz și cea de seară sunt aceeași zi de lucru, dar nu același
   * interval. Scrise separat, orele ies câte au fost și câștigul pe oră
   * rămâne adevărat.
   */
  const period = (day: Workday, existing?: WorkPeriod): DialogSpec => ({
    title: existing ? 'Modifică intervalul' : `Alt interval în ${day.date}`,
    fields: [
      { key: 'from', label: 'De la', value: existing?.from ?? '', placeholder: '17:00' },
      { key: 'to', label: 'Până la', value: existing?.to ?? '', placeholder: '22:00' },
      { key: 'breakMinutes', label: 'Pauză (minute)', type: 'number',
        value: existing?.breakMinutes === undefined ? '' : String(existing.breakMinutes) },
    ],
    submit(values) {
      if (!values.from || !values.to) return 'Pune și ora de început, și cea de sfârșit.'
      const id = existing?.id ?? `p${uid()}`
      update(draft => {
        const target = draft.workdays[day.id]
        const periods = (target.periods ?? []).filter(p => p.id !== id)
        periods.push({
          id, from: values.from, to: values.to,
          breakMinutes: values.breakMinutes ? num(values.breakMinutes) : undefined,
        })
        periods.sort((a, b) => a.from.localeCompare(b.from))
        target.periods = periods
      })
    },
  })

  const fuel = (mod: string, existing?: Fuel): DialogSpec => ({
    title: existing ? `Alimentarea din ${existing.date}` : 'Alimentare',
    note: 'Bifează „plin" când umpli rezervorul. Consumul se poate socoti numai între două plinuri.',
    fields: [
      { key: 'date', label: 'Ziua', type: 'date', value: existing?.date ?? today() },
      { key: 'vehicle', label: 'Mașina', type: 'select', value: existing?.vehicle ?? '', options: [
        { value: '', label: '— niciuna —' },
        ...Object.values(data.vehicles).map(v => ({ value: v.id, label: v.name })),
      ] },
      { key: 'odometer', label: 'Km pe bord', type: 'number',
        value: existing?.odometer === undefined ? '' : String(existing.odometer) },
      { key: 'litres', label: 'Litri', type: 'number',
        value: existing?.litres === undefined ? '' : String(existing.litres) },
      { key: 'cost', label: `Cât ai plătit (${currency})`, type: 'number',
        value: existing?.cost === undefined ? '' : String(existing.cost) },
      { key: 'full', label: 'Plin sau parțial', type: 'select', value: existing?.full ? 'da' : '', options: [
        { value: 'da', label: 'Plin' },
        { value: '', label: 'Parțial' },
      ] },
      { key: 'notes', label: 'Note', type: 'textarea', value: existing?.notes ?? '' },
    ],
    submit(values) {
      if (!values.date) return 'Pune ziua.'
      if (num(values.litres) <= 0) return 'Scrie câți litri.'
      const id = existing?.id ?? `f${uid()}`
      const month = ym(values.date)
      update(draft => {
        draft.fuel[id] = {
          id, mod, date: values.date,
          vehicle: values.vehicle || undefined,
          odometer: values.odometer ? num(values.odometer) : undefined,
          litres: num(values.litres),
          cost: values.cost ? num(values.cost) : undefined,
          full: values.full === 'da' ? true : undefined,
          notes: values.notes || undefined,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }

        /* Banii dați la pompă sunt bani ieșiți acum, deci intră în Finanțe.
           Costul cu combustibilul dintr-o tură rămâne o estimare, folosită ca
           să judeci tura — el nu mai ajunge în registru, altfel aceeași
           motorină ar fi numărată de două ori. */
        for (const key of Object.keys(draft.finance)) {
          draft.finance[key].items = draft.finance[key].items.filter(item => item.id !== `fuel-${id}`)
        }
        if (num(values.cost) > 0) {
          draft.finance[month] ??= { items: [] }
          draft.finance[month].items.push({
            id: `fuel-${id}`, date: values.date, type: 'out', amount: num(values.cost),
            cat: 'Combustibil', note: `${values.litres} l`,
          })
        }
      })
    },
  })

  const carCost = (mod: string, existing?: CarExpense): DialogSpec => ({
    title: existing ? `Cheltuiala din ${existing.date}` : 'Cheltuială cu mașina',
    note: 'Dacă acoperă o perioadă — asigurare, taxă anuală — pune și datele. ' +
      'Se împarte pe zilele acoperite, în loc să cadă toată într-una.',
    fields: [
      { key: 'date', label: 'Ziua plății', type: 'date', value: existing?.date ?? today() },
      { key: 'category', label: 'Ce fel', type: 'select', value: existing?.category ?? '',
        options: CAR_CATEGORIES.map(c => ({ value: c, label: c })) },
      { key: 'what', label: 'Ce anume', value: existing?.what ?? '', placeholder: 'ex: plăcuțe față' },
      { key: 'amount', label: `Cât ai plătit (${currency})`, type: 'number',
        value: existing ? String(existing.amount) : '' },
      { key: 'businessPct', label: 'Cât la sută e de business', type: 'number',
        value: String(Math.round((existing?.businessPct ?? 1) * 100)) },
      { key: 'vehicle', label: 'Mașina', type: 'select', value: existing?.vehicle ?? '', options: [
        { value: '', label: '— niciuna —' },
        ...Object.values(data.vehicles).map(v => ({ value: v.id, label: v.name })),
      ] },
      { key: 'from', label: 'Acoperă din (opțional)', type: 'date', value: existing?.from ?? '' },
      { key: 'to', label: 'Până la (opțional)', type: 'date', value: existing?.to ?? '' },
      { key: 'notes', label: 'Note', type: 'textarea', value: existing?.notes ?? '' },
    ],
    submit(values) {
      if (!values.date) return 'Pune ziua.'
      if (num(values.amount) <= 0) return 'Scrie cât ai plătit.'
      if (!values.from !== !values.to) return 'Pune amândouă datele perioadei, sau niciuna.'
      if (values.from && values.to && values.to < values.from) return 'Perioada se termină înainte să înceapă.'
      const id = existing?.id ?? `c${uid()}`
      const month = ym(values.date)
      update(draft => {
        draft.carCosts[id] = {
          id, mod, date: values.date,
          category: values.category || undefined,
          what: values.what || undefined,
          amount: num(values.amount),
          businessPct: values.businessPct ? num(values.businessPct) / 100 : undefined,
          vehicle: values.vehicle || undefined,
          from: values.from || undefined,
          to: values.to || undefined,
          notes: values.notes || undefined,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }

        /* În Finanțe intră suma întreagă, în ziua plății: atât ai scos din
           buzunar, atunci. Împărțirea pe zile e o socoteală de business, nu
           o mișcare de bani. */
        for (const key of Object.keys(draft.finance)) {
          draft.finance[key].items = draft.finance[key].items.filter(item => item.id !== `car-${id}`)
        }
        draft.finance[month] ??= { items: [] }
        draft.finance[month].items.push({
          id: `car-${id}`, date: values.date, type: 'out', amount: num(values.amount),
          cat: 'Mașină', note: values.what || values.category || 'Cheltuială mașină',
        })
      })
    },
  })

  return { vehicle, settings, workday, finish, period, fuel, carCost, account, cashOut }
}
