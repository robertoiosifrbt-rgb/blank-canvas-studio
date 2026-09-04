import type { DialogSpec } from './Dialog'
import { money, num, today, uid, ym } from './format'
import { moduleTree, descendants, itemsOf } from './modules'
import { remainingDebt } from './goals'
import type { Debt, Doc, Note, OsData, Task } from './types'

type Update = (change: (draft: OsData) => void) => void

const CATS = ['Casă', 'Mâncare', 'Transport', 'Sănătate', 'Familie', 'Business',
  'Abonamente', 'Distracție', 'Salariu', 'Altele']

/** Restul ferestrelor: bani, datorii, task-uri, obiceiuri, notițe, module. */
export function coreDialogs(data: OsData, update: Update) {
  const currency = data.settings.currency

  const movement = (month: string): DialogSpec => ({
    title: 'Mișcare nouă',
    fields: [
      { key: 'type', label: 'Fel', type: 'select', value: 'out', options: [
        { value: 'out', label: 'Cheltuială' }, { value: 'in', label: 'Venit' }] },
      { key: 'amount', label: 'Sumă', type: 'number', placeholder: '0.00' },
      { key: 'cat', label: 'Categorie', type: 'select', value: 'Altele',
        options: CATS.map(c => ({ value: c, label: c })) },
      { key: 'date', label: 'Data', type: 'date', value: month === ym() ? today() : `${month}-01` },
      { key: 'note', label: 'Descriere', placeholder: 'ex: cumpărături, factură client' },
    ],
    submit(values) {
      const amount = num(values.amount)
      if (amount <= 0) return 'Scrie o sumă mai mare ca zero.'
      if (!values.date) return 'Alege data.'
      const key = ym(values.date)
      update(draft => {
        const items = draft.finance[key]?.items ?? []
        draft.finance[key] = { items: [...items, {
          id: uid(), date: values.date, type: values.type === 'in' ? 'in' : 'out',
          amount, cat: values.cat, note: values.note,
        }] }
      })
    },
  })

  const debt = (): DialogSpec => ({
    title: 'Datorie nouă',
    fields: [
      { key: 'name', label: 'Către cine / pentru ce', placeholder: 'ex: credit auto' },
      { key: 'total', label: 'Suma totală', type: 'number', placeholder: '0.00' },
      { key: 'paid', label: 'Deja achitat (opțional)', type: 'number', placeholder: '0.00' },
      { key: 'due', label: 'Scadență (opțional)', type: 'date' },
    ],
    submit(values) {
      if (!values.name) return 'Scrie pentru ce e datoria.'
      if (num(values.total) <= 0) return 'Scrie suma totală.'
      const paid = num(values.paid)
      const id = `d${uid()}`
      update(draft => {
        draft.debts[id] = {
          id, name: values.name, total: num(values.total), due: values.due || undefined,
          payments: paid > 0 ? [{ id: uid(), date: today(), amount: paid }] : [],
          createdAt: new Date().toISOString(),
        }
      })
    },
  })

  const pay = (target: Debt): DialogSpec => {
    const left = remainingDebt(target)
    return {
      title: `Plată către „${target.name}”`,
      note: `Rest de plată acum: ${money(left, currency)}`,
      fields: [
        { key: 'amount', label: 'Cât plătești', type: 'number', value: left.toFixed(2) },
        { key: 'date', label: 'Data', type: 'date', value: today() },
      ],
      submit(values) {
        const amount = num(values.amount)
        if (amount <= 0) return 'Scrie o sumă mai mare ca zero.'
        update(draft => {
          const d = draft.debts[target.id]
          d.payments = [...(d.payments ?? []), { id: uid(), date: values.date || today(), amount }]
        })
      },
    }
  }

  const task = (mod: string, due?: string): DialogSpec => ({
    title: 'Task nou',
    fields: [
      { key: 'title', label: 'Ce ai de făcut', placeholder: 'ex: trimis factura' },
      { key: 'due', label: 'Până când (opțional)', type: 'date', value: due ?? '' },
      { key: 'proj', label: 'Proiect (opțional)', placeholder: 'ex: casă, sănătate' },
    ],
    submit(values) {
      if (!values.title) return 'Scrie ce ai de făcut.'
      const id = `t${uid()}`
      update(draft => {
        draft.tasks[id] = { id, mod, title: values.title, due: values.due || undefined,
          proj: values.proj || undefined, done: false, createdAt: new Date().toISOString() }
      })
    },
  })

  /**
   * O hârtie primită. Câmpurile sunt cele după care o cauți mai târziu — cine
   * a trimis-o și cu ce referință — plus termenul, singurul care are ce căuta
   * în calendar. Doar titlul e obligatoriu: o scrisoare pusă pe jumătate în
   * aplicație e mai bună decât una rămasă pe masă.
   */
  const doc = (mod: string, existing?: Doc): DialogSpec => ({
    title: existing ? 'Document' : 'Document nou',
    fields: [
      { key: 'title', label: 'Despre ce e', value: existing?.title ?? '', placeholder: 'ex: datorie DWP' },
      { key: 'from', label: 'De la cine', value: existing?.from ?? '', placeholder: 'ex: DWP Debt Management' },
      { key: 'date', label: 'Data de pe hârtie', type: 'date', value: existing?.date ?? '' },
      { key: 'ref', label: 'Referința lor', value: existing?.ref ?? '', placeholder: 'ex: SY361954C' },
      { key: 'amount', label: 'Sumă (dacă scrie una)', type: 'number', value: existing?.amount === undefined ? '' : String(existing.amount) },
      { key: 'due', label: 'De rezolvat până când', type: 'date', value: existing?.due ?? '' },
      { key: 'debt', label: 'Datoria pe care o privește', type: 'select', value: existing?.debt ?? '', options: [
        { value: '', label: 'Niciuna' },
        ...Object.values(data.debts).map(d => ({ value: d.id, label: d.name })),
      ] },
      { key: 'note', label: 'Ce spune, pe scurt', type: 'textarea', value: existing?.note ?? '' },
    ],
    submit(values) {
      if (!values.title) return 'Scrie despre ce e.'
      const id = existing?.id ?? `d${uid()}`
      update(draft => {
        draft.docs[id] = {
          id, mod, title: values.title,
          from: values.from || undefined,
          date: values.date || undefined,
          ref: values.ref || undefined,
          amount: values.amount ? num(values.amount) : undefined,
          due: values.due || undefined,
          debt: values.debt || undefined,
          note: values.note || undefined,
          done: existing?.done ?? false,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }
      })
    },
  })

  const habit = (mod: string): DialogSpec => ({
    title: 'Obicei nou',
    note: 'Ceva ce vrei să faci în fiecare zi.',
    fields: [{ key: 'name', label: 'Numele obiceiului', placeholder: 'ex: mișcare 30 min' }],
    submit(values) {
      if (!values.name) return 'Dă-i un nume.'
      const id = `h${uid()}`
      update(draft => { draft.habits[id] = { id, mod, name: values.name, log: {}, createdAt: new Date().toISOString() } })
    },
  })

  const note = (mod: string, existing?: Note): DialogSpec => ({
    title: existing ? 'Însemnare' : 'Însemnare nouă',
    fields: [
      { key: 'title', label: 'Titlu', value: existing?.title ?? '', placeholder: 'despre ce e' },
      { key: 'body', label: 'Conținut', type: 'textarea', value: existing?.body ?? '', placeholder: 'scrie liber…' },
    ],
    submit(values) {
      if (!values.title && !values.body) {
        if (existing) update(draft => { delete draft.notes[existing.id] })
        return
      }
      const now = new Date().toISOString()
      update(draft => {
        if (existing) {
          const n = draft.notes[existing.id]
          n.title = values.title; n.body = values.body; n.updatedAt = now
        } else {
          const id = `n${uid()}`
          draft.notes[id] = { id, mod, title: values.title, body: values.body, createdAt: now, updatedAt: now }
        }
      })
    },
  })

  const module = (): DialogSpec => ({
    title: 'Modul nou',
    note: 'Alege ce fel de modul vrei și sub ce stă. Apare imediat în navigare.',
    fields: [
      { key: 'name', label: 'Nume', placeholder: 'ex: Sănătate, Rețete' },
      { key: 'parent', label: 'Sub ce modul', type: 'select', value: '', options: [
        { value: '', label: 'Niciunul — stă la rădăcină' },
        ...moduleTree(data).map(m => ({ value: m.id, label: '— '.repeat(m.depth) + m.name }))] },
      { key: 'kind', label: 'Tip', type: 'select', value: 'tasks', options: [
        { value: 'tasks', label: 'Listă de bifat' },
        { value: 'notes', label: 'Notițe' },
        { value: 'habits', label: 'Tracker' },
        { value: 'hub', label: 'Grup — ține alte module sub el' }] },
    ],
    submit(values) {
      if (!values.name) return 'Dă-i un nume modulului.'
      const id = `m${uid()}`
      update(draft => {
        draft.modules[id] = { id, name: values.name, kind: values.kind,
          parent: values.parent || undefined, createdAt: new Date().toISOString() }
      })
    },
  })

  const removeModule = (id: string): DialogSpec => {
    const kids = descendants(data, id)
    const ids = [id, ...kids.map(k => k.id)]
    const count = ids.reduce((sum, mid) =>
      sum + itemsOf(data.tasks, mid).length + itemsOf(data.notes, mid).length + itemsOf(data.habits, mid).length, 0)
    return {
      title: `Ștergi „${data.modules[id]?.name ?? id}”?`,
      note: `${kids.length ? `Se șterg și cele ${kids.length} submodule. ` : ''}${count ? `Se pierd ${count} lucruri dinăuntru. ` : ''}Nu se poate anula.`,
      ok: 'Șterge', danger: true, fields: [],
      submit() {
        update(draft => {
          for (const mid of ids) {
            for (const bag of [draft.tasks, draft.notes, draft.habits] as const)
              for (const key of Object.keys(bag)) if ((bag[key] as { mod?: string }).mod === mid) delete bag[key]
            delete draft.modules[mid]
          }
        })
      },
    }
  }

  const confirm = (title: string, note: string, run: () => void): DialogSpec => ({
    title, note, ok: 'Șterge', danger: true, fields: [], submit() { run() },
  })

  return { movement, debt, pay, task, habit, note, doc, module, removeModule, confirm }
}

export type TaskLike = Task
