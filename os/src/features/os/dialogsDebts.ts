import type { DialogSpec } from './Dialog'
import {
  ACTION_KINDS, CATEGORIES, DIRECTIONS, EVERY, ORG_KINDS, PLAN_KINDS,
  PLAN_STATUSES, ROLES, STAGES, STATUSES, remaining,
} from './debts'
import { money, num, today, uid, ym } from './format'
import type { Debt, DebtAction, DebtHolder, DebtPlan, DebtRef, Org, OsData, PlanEvery } from './types'

type Update = (change: (draft: OsData) => void) => void

const pick = (list: readonly string[], value = '') =>
  list.map(item => ({ value: item, label: item })).concat(value && !list.includes(value)
    ? [{ value, label: value }] : [])

/** Ferestrele modulului de datorii. */
export function debtDialogs(data: OsData, update: Update) {
  const currency = data.settings.currency

  const debt = (mod: string, existing?: Debt): DialogSpec => ({
    title: existing ? `Modifică „${existing.name}”` : 'Datorie nouă',
    fields: [
      { key: 'name', label: 'Către cine / pentru ce', value: existing?.name ?? '', placeholder: 'ex: card Barclays' },
      { key: 'direction', label: 'În ce sens', type: 'select', value: existing?.direction ?? 'owe',
        options: DIRECTIONS.map(d => ({ value: d.value, label: d.label })) },
      { key: 'total', label: 'Cât e în total', type: 'number', value: existing ? String(existing.total) : '', placeholder: '0.00' },
      { key: 'category', label: 'Ce fel', type: 'select', value: existing?.category ?? '', options: pick(CATEGORIES, existing?.category) },
      { key: 'status', label: 'Status', type: 'select', value: existing?.status ?? 'Activă', options: pick(STATUSES, existing?.status) },
      { key: 'stage', label: 'Stadiu legal', type: 'select', value: existing?.stage ?? 'Niciunul', options: pick(STAGES, existing?.stage) },
      { key: 'since', label: 'De când există', type: 'date', value: existing?.since ?? '' },
      { key: 'defaulted', label: 'Data intrării în default', type: 'date', value: existing?.defaulted ?? '' },
      { key: 'due', label: 'Termen (opțional)', type: 'date', value: existing?.due ?? '' },
      /* Firma și referința se scriu aici, nu în alt ecran. Cazul obișnuit e o
         datorie cu o firmă; drumul obișnuit nu trebuie să treacă prin trei
         ferestre. Restul referințelor se adaugă după, de pe card. */
      ...(existing ? [] : [
        { key: 'org', label: 'Cine ți-o cere', placeholder: 'ex: Lowell, DWP' },
        { key: 'ref', label: 'Referința lor', placeholder: 'ex: SY361954C' },
      ]),
      { key: 'notes', label: 'Note', type: 'textarea', value: existing?.notes ?? '' },
    ],
    submit(values) {
      if (!values.name) return 'Scrie pentru ce e datoria.'
      if (num(values.total) <= 0) return 'Scrie cât e în total.'
      const id = existing?.id ?? `d${uid()}`
      /* Firma scrisă de mână: o găsim după nume, altfel o facem. Fără asta,
         fiecare datorie ar fi creat încă o copie a aceleiași firme. */
      const typed = (values.org ?? '').trim()
      const found = Object.values(data.orgs)
        .find(o => o.name.toLowerCase() === typed.toLowerCase())
      const orgId = typed ? found?.id ?? `o${uid()}` : ''
      update(draft => {
        if (typed && !found) {
          draft.orgs[orgId] = { id: orgId, name: typed, createdAt: new Date().toISOString() }
        }
        draft.debts[id] = {
          ...(existing ?? {}),
          id, mod, name: values.name,
          holders: existing?.holders ?? (orgId
            ? [{ id: `h${uid()}`, org: orgId, role: 'Proprietar curent', ref: values.ref || undefined }]
            : []),
          direction: values.direction === 'owed' ? 'owed' : 'owe',
          total: num(values.total),
          category: values.category || undefined,
          status: values.status || 'Activă',
          stage: values.stage || undefined,
          since: values.since || undefined,
          defaulted: values.defaulted || undefined,
          due: values.due || undefined,
          notes: values.notes || undefined,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }
      })
    },
  })

  /**
   * Plata e o mișcare în Finanțe marcată cu datoria, nu o intrare în datorie.
   * Un singur loc unde sunt scriși banii înseamnă că Finanțele și datoria nu
   * pot ajunge să spună lucruri diferite despre aceeași plată.
   */
  const pay = (target: Debt): DialogSpec => {
    const left = remaining(data, target)
    const incoming = target.direction === 'owed'
    return {
      title: incoming ? `Încasare de la „${target.name}”` : `Plată către „${target.name}”`,
      note: `Rest: ${money(left, currency)}. Intră și în Finanțe, ca ${incoming ? 'venit' : 'cheltuială'}.`,
      fields: [
        { key: 'amount', label: 'Cât', type: 'number', value: left.toFixed(2) },
        { key: 'date', label: 'Data', type: 'date', value: today() },
        { key: 'note', label: 'Notă (opțional)', placeholder: 'ex: rată septembrie' },
      ],
      submit(values) {
        const amount = num(values.amount)
        if (amount <= 0) return 'Scrie o sumă mai mare ca zero.'
        const date = values.date || today()
        update(draft => {
          const month = ym(date)
          draft.finance[month] ??= { items: [] }
          draft.finance[month].items.push({
            id: uid(), date, type: incoming ? 'in' : 'out', amount,
            cat: 'Datorii', note: values.note || target.name, debt: target.id,
          })
        })
      },
    }
  }

  const org = (existing?: Org): DialogSpec => ({
    title: existing ? `Modifică „${existing.name}”` : 'Organizație nouă',
    note: 'Banca, recuperatorul, avocatul, instanța. Datele lor stau o dată, nu pe fiecare datorie.',
    fields: [
      { key: 'name', label: 'Numele firmei', value: existing?.name ?? '' },
      { key: 'kind', label: 'Ce fel', type: 'select', value: existing?.kind ?? '', options: pick(ORG_KINDS, existing?.kind) },
      { key: 'phone', label: 'Telefon', value: existing?.phone ?? '' },
      { key: 'email', label: 'Email', value: existing?.email ?? '' },
      { key: 'address', label: 'Adresă', type: 'textarea', value: existing?.address ?? '' },
      { key: 'web', label: 'Site', value: existing?.web ?? '' },
    ],
    submit(values) {
      if (!values.name) return 'Scrie numele firmei.'
      const id = existing?.id ?? `o${uid()}`
      update(draft => {
        draft.orgs[id] = {
          id, name: values.name,
          kind: values.kind || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: values.address || undefined,
          web: values.web || undefined,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }
      })
    },
  })

  const holder = (target: Debt, existing?: DebtHolder): DialogSpec => ({
    title: existing ? 'Modifică firma' : 'Cine ține datoria',
    note: 'Datoriile se vând. Pune-le pe toate, cu rolul lor — vezi oricând cine ce a fost.',
    fields: [
      { key: 'org', label: 'Firma', type: 'select', value: existing?.org ?? '', options: [
        { value: '', label: '— alege —' },
        ...Object.values(data.orgs).map(o => ({ value: o.id, label: o.name })),
      ] },
      { key: 'role', label: 'Rolul ei', type: 'select', value: existing?.role ?? 'Proprietar curent', options: pick(ROLES, existing?.role) },
      { key: 'ref', label: 'Referința pe care ți-o dă ea', value: existing?.ref ?? '' },
      { key: 'from', label: 'Din ce dată', type: 'date', value: existing?.from ?? '' },
      { key: 'to', label: 'Până când (gol = încă)', type: 'date', value: existing?.to ?? '' },
    ],
    submit(values) {
      if (!values.org) return 'Alege firma. Dacă nu e în listă, adaug-o întâi.'
      const id = existing?.id ?? `h${uid()}`
      update(draft => {
        const list = (draft.debts[target.id].holders ?? []).filter(h => h.id !== id)
        list.push({
          id, org: values.org, role: values.role || 'Proprietar curent',
          ref: values.ref || undefined, from: values.from || undefined, to: values.to || undefined,
        })
        draft.debts[target.id].holders = list
      })
    },
  })

  const plan = (target: Debt, existing?: DebtPlan): DialogSpec => ({
    title: existing ? 'Modifică planul' : 'Plan de plată',
    fields: [
      { key: 'amount', label: 'Cât plătești odată', type: 'number', value: existing ? String(existing.amount) : '' },
      { key: 'every', label: 'Cât de des', type: 'select', value: existing?.every ?? 'month',
        options: EVERY.map(e => ({ value: e.value, label: e.label })) },
      { key: 'next', label: 'Următoarea scadență', type: 'date', value: existing?.next ?? today() },
      { key: 'kind', label: 'Ce fel de plan', type: 'select', value: existing?.kind ?? 'Standard', options: pick(PLAN_KINDS, existing?.kind) },
      { key: 'status', label: 'Status', type: 'select', value: existing?.status ?? 'Activ', options: pick(PLAN_STATUSES, existing?.status) },
      { key: 'to', label: 'Până când (opțional)', type: 'date', value: existing?.to ?? '' },
      { key: 'notes', label: 'Note', type: 'textarea', value: existing?.notes ?? '' },
    ],
    submit(values) {
      if (num(values.amount) <= 0) return 'Scrie cât plătești odată.'
      const id = existing?.id ?? `p${uid()}`
      update(draft => {
        const list = (draft.debts[target.id].plans ?? []).filter(p => p.id !== id)
        list.push({
          id, amount: num(values.amount), every: values.every as PlanEvery,
          next: values.next || undefined, kind: values.kind || undefined,
          status: values.status || 'Activ', to: values.to || undefined,
          notes: values.notes || undefined,
        })
        draft.debts[target.id].plans = list
      })
    },
  })

  const action = (target: Debt, existing?: DebtAction): DialogSpec => ({
    title: existing ? 'Modifică intrarea' : 'Ce s-a întâmplat',
    note: 'Fiecare telefon și scrisoare. Peste șase luni, asta e dovada ta.',
    fields: [
      { key: 'date', label: 'Când', type: 'date', value: existing?.date ?? today() },
      { key: 'kind', label: 'Ce fel', type: 'select', value: existing?.kind ?? 'Telefon', options: pick(ACTION_KINDS, existing?.kind) },
      { key: 'summary', label: 'Ce s-a discutat', value: existing?.summary ?? '' },
      { key: 'outcome', label: 'Ce a ieșit', type: 'textarea', value: existing?.outcome ?? '' },
      { key: 'org', label: 'Cu cine', type: 'select', value: existing?.org ?? '', options: [
        { value: '', label: '— nimeni anume —' },
        ...Object.values(data.orgs).map(o => ({ value: o.id, label: o.name })),
      ] },
      { key: 'followUp', label: 'De reluat pe', type: 'date', value: existing?.followUp ?? '' },
    ],
    submit(values) {
      if (!values.summary) return 'Scrie ce s-a discutat.'
      const id = existing?.id ?? `a${uid()}`
      update(draft => {
        const list = (draft.debts[target.id].actions ?? []).filter(a => a.id !== id)
        list.push({
          id, date: values.date || today(), kind: values.kind || 'Telefon',
          summary: values.summary, outcome: values.outcome || undefined,
          org: values.org || undefined, followUp: values.followUp || undefined,
        })
        draft.debts[target.id].actions = list
      })
    },
  })

  const reference = (target: Debt, existing?: DebtRef): DialogSpec => ({
    title: existing ? 'Modifică referința' : 'Încă o referință',
    note: 'O scrisoare poate purta mai multe numere deodată. Pune-le pe toate, cu ce sunt.',
    fields: [
      { key: 'value', label: 'Numărul', value: existing?.value ?? '' },
      { key: 'label', label: 'Ce e', value: existing?.label ?? '', placeholder: 'ex: număr de client, dosar, cont' },
      { key: 'org', label: 'De la cine', type: 'select', value: existing?.org ?? '', options: [
        { value: '', label: '— nu se știe —' },
        ...Object.values(data.orgs).map(o => ({ value: o.id, label: o.name })),
      ] },
    ],
    submit(values) {
      if (!values.value) return 'Scrie numărul.'
      const id = existing?.id ?? `r${uid()}`
      update(draft => {
        const list = (draft.debts[target.id].refs ?? []).filter(r => r.id !== id)
        list.push({ id, value: values.value, label: values.label || undefined, org: values.org || undefined })
        draft.debts[target.id].refs = list
      })
    },
  })

  return { debt, pay, org, holder, plan, action, reference }
}
