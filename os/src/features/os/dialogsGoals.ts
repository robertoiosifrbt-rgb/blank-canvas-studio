import type { DialogSpec } from './Dialog'
import { GYM_METRICS, gymMetric, latestGym } from './gymBridge'
import { current, formatValue, hasTarget, isMetric } from './goals'
import { money, num, today, uid } from './format'
import type { Goal, OsData } from './types'

type Update = (change: (draft: OsData) => void) => void

/** Ferestrele care ating obiectivele. */
export function goalDialogs(data: OsData, update: Update) {
  const currency = data.settings.currency

  const add = (): DialogSpec => ({
    title: 'Obiectiv nou',
    note: 'O sumă se adună spre o țintă. O măsurătoare se mută de la o valoare la alta.',
    fields: [
      { key: 'name', label: 'Numele obiectivului', placeholder: 'ex: 100k, six pack' },
      { key: 'kind', label: 'Fel', type: 'select', value: 'sum', options: [
        { value: 'sum', label: 'Sumă de strâns — bani, contribuții' },
        { value: 'metric', label: 'Măsurătoare — kg, %, cm' }] },
      /* Legat de o măsurătoare din sală, obiectivul se actualizează singur
         când completezi acolo — nu mai ai de introdus același număr de două
         ori, în două locuri, cu riscul ca ele să nu mai fie de acord. */
      { key: 'source', label: 'Măsurat unde', type: 'select', value: '', options: [
        { value: '', label: 'Îl scriu eu de mână' },
        ...GYM_METRICS.map(m => ({ value: `gym:${m.key}`, label: `Sală — ${m.name} (${m.unit})` })),
      ] },
      { key: 'unit', label: 'Unitate (doar dacă îl scrii de mână)', placeholder: 'kg, %, cm' },
      /* Lăsat gol pentru un obiectiv legat de sală, punctul de plecare e
         ultima ta măsurătoare — o știe deja aplicația, n-are rost s-o scrii. */
      { key: 'start', label: 'De la ce valoare pornești (gol = ultima măsurătoare)', type: 'number', placeholder: '0' },
      { key: 'target', label: 'Ținta', type: 'number', placeholder: '0' },
      { key: 'due', label: 'Până când (opțional)', type: 'date' },
    ],
    submit(values) {
      if (!values.name) return 'Dă-i un nume obiectivului.'
      if (!values.target) return 'Scrie ținta.'
      const metric = values.kind === 'metric'
      const fromGym = metric && values.source ? latestGym(values.source.slice(4)) : null
      const start = values.start ? num(values.start) : fromGym ?? 0
      const target = num(values.target)
      if (metric && start === target) return 'Ținta trebuie să fie diferită de valoarea de start.'
      if (!metric && target <= 0) return 'Ținta trebuie să fie mai mare ca zero.'
      const id = `g${uid()}`
      update(draft => {
        draft.goals[id] = {
          id, name: values.name, kind: metric ? 'metric' : 'sum', target, due: values.due || undefined,
          main: true, habits: [], createdAt: new Date().toISOString(),
          ...(metric
            ? {
              source: values.source || undefined,
              unit: gymMetric(values.source.slice(4))?.unit ?? values.unit ?? undefined,
              start,
              reads: [{ id: uid(), date: today(), value: start, note: 'Punct de pornire' }],
            }
            : { contrib: start > 0 ? [{ id: uid(), date: today(), amount: start, note: 'Punct de pornire' }] : [] }),
        }
      })
    },
  })

  const edit = (goal: Goal): DialogSpec => ({
    title: `Modifică „${goal.name}”`,
    fields: [
      { key: 'name', label: 'Nume', value: goal.name },
      ...(isMetric(goal) ? [
        { key: 'source', label: 'Măsurat unde', type: 'select' as const, value: goal.source ?? '', options: [
        { value: '', label: 'Îl scriu eu de mână' },
        ...GYM_METRICS.map(m => ({ value: `gym:${m.key}`, label: `Sală — ${m.name} (${m.unit})` })),
      ] },
        { key: 'unit', label: 'Unitate', value: goal.unit ?? '', placeholder: 'kg, %, cm' },
        { key: 'start', label: 'Valoarea de plecare (gol = ultima măsurătoare)', type: 'number' as const, value: goal.start === undefined ? '' : String(goal.start) },
      ] : []),
      { key: 'target', label: 'Ținta', type: 'number', value: hasTarget(goal) ? String(goal.target) : '' },
      { key: 'due', label: 'Până când (opțional)', type: 'date', value: goal.due ?? '' },
    ],
    submit(values) {
      if (!values.name) return 'Dă-i un nume.'
      if (!values.target) return 'Scrie ținta.'
      const target = num(values.target)
      const metric = isMetric(goal)
      const fromGym = metric && values.source ? latestGym(values.source.slice(4)) : null
      const start = values.start ? num(values.start) : fromGym ?? num(values.start)
      if (metric && start === target) return 'Ținta trebuie să fie diferită de valoarea de plecare.'
      if (!metric && target <= 0) return 'Ținta trebuie să fie mai mare ca zero.'
      update(draft => {
        const g = draft.goals[goal.id]
        g.name = values.name
        g.target = target
        g.due = values.due || undefined
        if (metric) {
          g.source = values.source || undefined
          g.unit = gymMetric((values.source ?? '').slice(4))?.unit ?? values.unit ?? undefined
          g.start = start
          if (!(g.reads ?? []).length) g.reads = [{ id: uid(), date: today(), value: start, note: 'Punct de pornire' }]
        }
      })
    },
  })

  const contribute = (goal: Goal): DialogSpec => {
    const remaining = Math.max(0, num(goal.target) - current(goal))
    return {
      title: `Contribuție la „${goal.name}”`,
      note: `Mai ai de strâns ${money(remaining, currency)}.`,
      fields: [
        { key: 'amount', label: 'Cât adaugi', type: 'number', placeholder: '0.00' },
        { key: 'date', label: 'Data', type: 'date', value: today() },
        { key: 'note', label: 'Din ce (opțional)', placeholder: 'ex: economii septembrie' },
      ],
      submit(values) {
        const amount = num(values.amount)
        if (amount <= 0) return 'Scrie o sumă mai mare ca zero.'
        update(draft => {
          const g = draft.goals[goal.id]
          g.contrib = [...(g.contrib ?? []), { id: uid(), date: values.date || today(), amount, note: values.note }]
        })
      },
    }
  }

  const measure = (goal: Goal): DialogSpec => ({
    title: `Măsurătoare — ${goal.name}`,
    note: hasTarget(goal)
      ? `Acum: ${formatValue(goal, current(goal), currency)} · ținta: ${formatValue(goal, num(goal.target), currency)}`
      : undefined,
    fields: [
      { key: 'value', label: `Valoarea de azi${goal.unit ? ` (${goal.unit})` : ''}`, type: 'number', placeholder: '0' },
      { key: 'date', label: 'Data', type: 'date', value: today() },
      { key: 'note', label: 'Observație (opțional)', placeholder: 'ex: dimineața, pe nemâncate' },
    ],
    submit(values) {
      if (!values.value) return 'Scrie valoarea măsurată.'
      const value = num(values.value)
      const date = values.date || today()
      update(draft => {
        const g = draft.goals[goal.id]
        g.reads = [...(g.reads ?? []).filter(r => r.date !== date), { id: uid(), date, value, note: values.note }]
      })
    },
  })

  const remove = (goal: Goal): DialogSpec => ({
    title: `Ștergi „${goal.name}”?`,
    note: 'Se pierde și tot istoricul. Nu se poate anula.',
    ok: 'Șterge', danger: true, fields: [],
    submit() { update(draft => { delete draft.goals[goal.id] }) },
  })

  return { add, edit, contribute, measure, remove }
}
