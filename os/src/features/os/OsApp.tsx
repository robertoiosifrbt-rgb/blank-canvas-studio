import { useMemo, useState } from 'react'
import { GymScreens } from '../../app/App'
import type { Page as GymPage } from '../../app/App'
import { Dialog, type DialogSpec } from './Dialog'
import { OsIcon } from './OsIcon'
import { GoalStrips } from './GoalHero'
import { coreDialogs } from './dialogsCore'
import { goalDialogs } from './dialogsGoals'
import { today, ym } from './format'
import { childrenOf, moduleById, moduleTree, pathOf } from './modules'
import { CalendarScreen } from './screens/CalendarScreen'
import { Debts } from './screens/Debts'
import { Finance } from './screens/Finance'
import { Goals } from './screens/Goals'
import { Habits } from './screens/Habits'
import { Notes } from './screens/Notes'
import { SettingsScreen } from './screens/SettingsScreen'
import { Tasks } from './screens/Tasks'
import { Today } from './screens/Today'
import { deviceToken, setDeviceToken } from './cloud'
import { resolveGoals } from './goalSources'
import { useOs } from './useOs'
import { UnitsProvider } from '../../shared/UnitsProvider'
import './osTokens.css'
import './osLayout.css'
import './osComponents.css'
import './osScreens.css'
import './osGym.css'

/* Scurtăturile din bara de jos, aceleași ca înainte de mutarea pe React.
   Gym nu stă aici: e submodul al lui Health și se ajunge la el prin Health. */
const PINNED = ['azi', 'goals', 'calendar', 'finante']

/* Ecranele sălii, arătate ca submodulele oricărui alt modul. Numele sunt în
   română pentru că bara asta e a OS-ului; ce scrie înăuntru rămâne al sălii.
   Setările sălii nu apar aici — au intrat în Setările OS-ului, ca să fie un
   singur loc de setări în toată aplicația. */
const GYM_PAGES: Array<{ key: GymPage; name: string }> = [
  { key: 'home', name: 'Acasă' },
  { key: 'workout', name: 'Antrenament' },
  { key: 'body', name: 'Corp' },
  { key: 'progress', name: 'Poze' },
]

export function OsApp() {
  const { data: stored, mode, error, photos, update } = useOs()
  /* Ecranele văd obiectivele cu citirile sălii deja aduse; scrierile merg tot
     în ce e salvat, deci măsurătorile sălii nu ajung niciodată copiate aici. */
  const data = useMemo(() => resolveGoals(stored), [stored])
  const [view, setView] = useState('azi')
  const [month, setMonth] = useState(ym())
  const [calMonth, setCalMonth] = useState(ym())
  const [calDay, setCalDay] = useState(today())
  const [taskFilter, setTaskFilter] = useState<'open' | 'all' | 'done'>('open')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogSpec | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [gymPage, setGymPage] = useState<GymPage>('home')

  const goals = useMemo(() => goalDialogs(data, update), [data, update])
  const core = useMemo(() => coreDialogs(data, update), [data, update])
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width:860px)').matches

  const open = (spec: DialogSpec) => { setProblem(null); setDialog(spec) }
  const go = (id: string) => { setView(id); setSheet(false); setSearch(''); window.scrollTo(0, 0) }

  const tickHabit = (habitId: string, date: string) => update(draft => {
    const log = draft.habits[habitId].log ?? {}
    if (log[date]) delete log[date]; else log[date] = 1
    draft.habits[habitId].log = log
  })

  const current = moduleById(data, view)
  const kind = view === '__set' ? 'settings' : current?.kind ?? 'dashboard'

  const screen = () => {
    if (kind === 'gym') {
      return (
        <div className="os-gym">
          <GymScreens hosted page={gymPage} onPage={setGymPage} />
        </div>
      )
    }
    switch (kind) {
      case 'goals': return <Goals data={data}
        onAdd={() => open(goals.add())} onEdit={g => open(goals.edit(g))}
        onContribute={g => open(goals.contribute(g))} onMeasure={g => open(goals.measure(g))}
        onDelete={g => open(goals.remove(g))}
        onAnchor={g => update(draft => { draft.goals[g.id].main = !draft.goals[g.id].main })}
        onToggleHabit={(goalId, habitId) => update(draft => {
          const list = draft.goals[goalId].habits ?? []
          draft.goals[goalId].habits = list.includes(habitId) ? list.filter(x => x !== habitId) : [...list, habitId]
        })} />
      case 'finance': return <Finance data={data} month={month} onMonth={setMonth}
        onAdd={() => open(core.movement(month))}
        onDelete={id => update(draft => {
          draft.finance[month] = { items: (draft.finance[month]?.items ?? []).filter(i => i.id !== id) }
        })} />
      case 'debts': return <Debts data={data} onAdd={() => open(core.debt())}
        onPay={d => open(core.pay(d))}
        onDelete={d => open(core.confirm(`Ștergi „${d.name}”?`,
          'Se pierde și istoricul plăților. Nu se poate anula.',
          () => update(draft => { delete draft.debts[d.id] })))} />
      case 'tasks': return <Tasks data={data} mod={view} filter={taskFilter} onFilter={setTaskFilter}
        onAdd={() => open(core.task(view))}
        onToggle={t => update(draft => { draft.tasks[t.id].done = !draft.tasks[t.id].done })}
        onDelete={t => update(draft => { delete draft.tasks[t.id] })}
        onClear={() => open(core.confirm('Ștergi task-urile bifate?',
          'Dispar definitiv din listă. Nu se poate anula.',
          () => update(draft => {
            for (const key of Object.keys(draft.tasks))
              if (draft.tasks[key].mod === view && draft.tasks[key].done) delete draft.tasks[key]
          })))} />
      case 'habits': return <Habits data={data} mod={view} phone={phone}
        onAdd={() => open(core.habit(view))} onTick={tickHabit}
        onDelete={h => open(core.confirm(`Ștergi „${h.name}”?`,
          'Se pierde tot istoricul de bife. Nu se poate anula.',
          () => update(draft => { delete draft.habits[h.id] })))} />
      case 'notes': return <Notes data={data} mod={view} search={search} onSearch={setSearch}
        onAdd={() => open(core.note(view))} onOpen={n => open(core.note(view, n))} />
      case 'calendar': return <CalendarScreen data={data} month={calMonth} day={calDay}
        onMonth={setCalMonth} onDay={setCalDay} onAddTask={() => open(core.task('taskuri', calDay))} />
      case 'settings': return <SettingsScreen data={data} mode={mode} error={error} token={deviceToken()}
        photos={photos}
        onCurrency={value => update(draft => { draft.settings.currency = value })}
        onToken={value => { setDeviceToken(value); location.reload() }}
        onExport={exportData} onUpdate={hardReload}
        onNewModule={() => open(core.module())}
        onDeleteModule={id => open(core.removeModule(id))} />
      case 'hub': return <div className="os-head"><div><h1>{current?.name}</h1>
        <p>{childrenOf(data, view).length ? 'Alege de mai sus.' : 'Nu are încă submodule.'}</p></div></div>
      default: return <Today data={data} onGoals={() => go('goals')} onTick={tickHabit} />
    }
  }

  function exportData() {
    const payload = JSON.stringify({ app: 'Roberto OS', exportat: new Date().toISOString(), ...data }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `roberto-os-${today()}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function hardReload() {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations()
      await Promise.all((registrations ?? []).map(r => r.unregister()))
      const keys = await caches?.keys()
      await Promise.all((keys ?? []).map(k => caches.delete(k)))
    } catch { /* nu blocăm reîncărcarea dacă browserul refuză */ }
    const url = new URL(location.href)
    url.searchParams.set('v', String(Date.now()))
    location.replace(url.toString())
  }

  const tree = moduleTree(data)
  const trail = current ? pathOf(data, current.id) : []
  const kids = current ? childrenOf(data, current.id) : []

  return (
    <UnitsProvider>
    <div className="os-shell">
      <aside className="os-rail">
        <div className="os-brand"><b>Roberto OS</b></div>
        <nav className="os-nav">
          {tree.map(m => (
            <button key={m.id} className={`${view === m.id ? 'on ' : ''}${PINNED.includes(m.id) ? 'mob' : ''}`}
              style={{ ['--d' as string]: m.depth }} onClick={() => go(m.id)}>
              <OsIcon name={m.kind} /><span>{m.name}</span>
            </button>
          ))}
          <button className={`only-mob${PINNED.includes(view) ? '' : ' on'}`} onClick={() => setSheet(true)}>
            <OsIcon name="more" /><span>Mai mult</span>
          </button>
          <button className={view === '__set' ? 'on' : ''} onClick={() => go('__set')}>
            <OsIcon name="settings" /><span>Setări</span>
          </button>
        </nav>
      </aside>

      <main className="os-main">
        {kind !== 'dashboard' && kind !== 'goals' ? <GoalStrips data={data} onGoals={() => go('goals')} /> : null}
        {trail.length > 1 ? (
          <nav className="os-crumb">
            {trail.map((p, i) => i === trail.length - 1
              ? <span key={p.id}>{p.name}</span>
              : <span key={p.id}><button onClick={() => go(p.id)}>{p.name}</button><i>›</i></span>)}
          </nav>
        ) : null}
        {kids.length ? (
          <div className="os-subs">
            {kids.map(c => <button className="os-sub-chip" key={c.id} onClick={() => go(c.id)}>{c.name}</button>)}
          </div>
        ) : null}
        {kind === 'gym' ? (
          <div className="os-subs">
            {GYM_PAGES.map(page => (
              <button key={page.key} className={`os-chip${gymPage === page.key ? ' on' : ''}`}
                onClick={() => setGymPage(page.key)}>{page.name}</button>
            ))}
          </div>
        ) : null}
        {screen()}
      </main>

      {sheet ? (
        <div className="os-veil" onMouseDown={e => { if (e.target === e.currentTarget) setSheet(false) }}>
          <div className="os-modal">
            <header><h3>Toate modulele</h3></header>
            <div className="body os-sheet">
              {tree.map(m => (
                <button key={m.id} className={`os-sheet-i${view === m.id ? ' on' : ''}`}
                  style={{ paddingLeft: 12 + m.depth * 16 }} onClick={() => go(m.id)}>{m.name}</button>
              ))}
              <button className="os-sheet-i" onClick={() => { setSheet(false); open(core.module()) }}>Modul nou</button>
              <button className="os-sheet-i" onClick={() => go('__set')}>Setări</button>
            </div>
            <footer><button className="os-btn ghost" onClick={() => setSheet(false)}>Închide</button></footer>
          </div>
        </div>
      ) : null}

      {dialog ? <Dialog spec={dialog} onClose={() => { setDialog(null); setProblem(null) }} onError={setProblem} /> : null}
      {problem ? <div className="os-toast">{problem}</div> : null}
    </div>
    </UnitsProvider>
  )
}
