import { useEffect, useMemo, useState } from 'react'
import { GymScreens } from '../../app/App'
import type { Page as GymPage } from '../../app/App'
import { Dialog, type DialogSpec } from './Dialog'
import { OsIcon } from './OsIcon'
import { GoalStrips } from './GoalHero'
import { coreDialogs } from './dialogsCore'
import { debtDialogs } from './dialogsDebts'
import { deliveryDialogs } from './dialogsDelivery'
import { goalDialogs } from './dialogsGoals'
import { today, ym } from './format'
import { childrenOf, moduleById, moduleTree, pathOf } from './modules'
import { CalendarScreen } from './screens/CalendarScreen'
import type { DayKind } from './calendar'
import { Debts } from './screens/Debts'
import { Delivery } from './screens/Delivery'
import { Docs } from './screens/Docs'
import { Finance } from './screens/Finance'
import { Goals } from './screens/Goals'
import { Habits } from './screens/Habits'
import { Notes } from './screens/Notes'
import { SettingsScreen } from './screens/SettingsScreen'
import { Tasks } from './screens/Tasks'
import { Today } from './screens/Today'
import { SignIn } from './screens/SignIn'
import { deviceToken, setDeviceToken } from './cloud'
import { DEFAULT_ALERTS, buildAlarms } from './alerts'
import { enablePush, pushState, syncAlarms, type PushState } from './push'
import { resolveGoals } from './goalSources'
import type { DocFile } from './types'
import { describeImport, importInto } from './transfer'
import { deleteDocFile, openDocFile, uploadDocFile } from './docFiles'
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
  const { data: stored, mode, error, photos, ready, signedIn, update, signIn, signUp, signOut } = useOs()
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
  const [imported, setImported] = useState<string | null>(null)
  const [busyDoc, setBusyDoc] = useState<string | null>(null)
  /* Straturile debifate din calendar. Ținute în aplicație, nu în date: e o
     preferință de privit, nu ceva ce vrei sincronizat pe toate device-urile. */
  const [hidden, setHidden] = useState<DayKind[]>([])
  const [push, setPush] = useState<PushState | null>(null)
  const [pushNote, setPushNote] = useState<string | null>(null)

  const goals = useMemo(() => goalDialogs(data, update), [data, update])
  const core = useMemo(() => coreDialogs(data, update), [data, update])
  const owed = useMemo(() => debtDialogs(data, update), [data, update])
  const drive = useMemo(() => deliveryDialogs(data, update), [data, update])
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width:860px)').matches

  const open = (spec: DialogSpec) => { setProblem(null); setDialog(spec) }
  const go = (id: string) => { setView(id); setSheet(false); setSearch(''); window.scrollTo(0, 0) }

  const tickHabit = (habitId: string, date: string) => update(draft => {
    const log = draft.habits[habitId].log ?? {}
    if (log[date]) delete log[date]; else log[date] = 1
    draft.habits[habitId].log = log
  })

  /* Starea notificărilor se citește o dată, la deschidere: nu se schimbă
     singură, ci doar când apeși tu butonul. */
  useEffect(() => { void pushState().then(setPush) }, [])

  /**
   * Alarmele se recalculează din date și se trimit întregi.
   *
   * Amânat, pentru că orice tastă schimbă datele, iar lista e aceeași până
   * termini de scris. Tăcut dacă telefonul nu e abonat — nu are rost o eroare
   * pentru ceva ce n-ai pornit.
   */
  useEffect(() => {
    if (!ready || push !== 'pornite') return
    const timer = setTimeout(() => {
      void syncAlarms(buildAlarms(stored, stored.settings.alerts ?? DEFAULT_ALERTS))
        .catch((error: unknown) => {
          setPushNote(`Alarmele n-au ajuns la server: ${error instanceof Error ? error.message : String(error)}`)
        })
    }, 2_000)
    return () => clearTimeout(timer)
  }, [stored, ready, push])

  async function turnOnPush() {
    setPushNote(null)
    try {
      await enablePush()
      setPush('pornite')
      await syncAlarms(buildAlarms(stored, stored.settings.alerts ?? DEFAULT_ALERTS))
      setPushNote('Pornite. Termenele îți sună pe telefon.')
    } catch (error) {
      setPushNote(error instanceof Error ? error.message : String(error))
      setPush(await pushState())
    }
  }

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
      case 'debts': return <Debts data={data} mod={view} busy={busyDoc}
        onAdd={() => open(owed.debt(view))} onEdit={d => open(owed.debt(view, d))}
        onPay={d => open(owed.pay(d))}
        onNewOrg={() => open(owed.org())}
        onRef={(d, r) => open(owed.reference(d, r))}
        onDropRef={(d, r) => update(draft => {
          draft.debts[d.id].refs = (draft.debts[d.id].refs ?? []).filter(x => x.id !== r.id)
        })}
        onHolder={(d, h) => open(owed.holder(d, h))}
        onDropHolder={(d, h) => update(draft => {
          draft.debts[d.id].holders = (draft.debts[d.id].holders ?? []).filter(x => x.id !== h.id)
        })}
        onPlan={(d, p) => open(owed.plan(d, p))}
        onDropPlan={(d, p) => update(draft => {
          draft.debts[d.id].plans = (draft.debts[d.id].plans ?? []).filter(x => x.id !== p.id)
        })}
        onAction={(d, a) => open(owed.action(d, a))}
        onDropAction={(d, a) => update(draft => {
          draft.debts[d.id].actions = (draft.debts[d.id].actions ?? []).filter(x => x.id !== a.id)
        })}
        onAttach={attachToDebt} onOpenFile={showDebtFile} onDeleteFile={removeDebtFile}
        onDelete={d => open(core.confirm(`Ștergi „${d.name}”?`,
          'Dispare cu tot cu jurnal, firme și scrisori. Plățile rămân în Finanțe. Nu se poate anula.',
          () => {
            for (const file of d.files ?? []) void deleteDocFile(d.id, file).catch(() => undefined)
            update(draft => { delete draft.debts[d.id] })
          }))} />
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
      case 'delivery': return <Delivery data={data} mod={view}
        onAdd={() => open(drive.workday(view))} onEdit={d => open(drive.workday(view, d))}
        onFinish={d => open(drive.finish(d))}
        onVehicle={v => open(drive.vehicle(v))} onSettings={() => open(drive.settings())}
        onFuel={f => open(drive.fuel(view, f))}
        onCarCost={c => open(drive.carCost(view, c))}
        onPeriod={(d, p) => open(drive.period(d, p))}
        onDropPeriod={(d, p) => update(draft => {
          draft.workdays[d.id].periods = (draft.workdays[d.id].periods ?? []).filter(x => x.id !== p.id)
        })}
        onDropCarCost={c => open(core.confirm(`Ștergi cheltuiala din ${c.date}?`,
          'Dispare și din Finanțe, iar turele pe care cădea se recalculează fără ea.',
          () => update(draft => {
            delete draft.carCosts[c.id]
            for (const month of Object.keys(draft.finance)) {
              draft.finance[month].items = draft.finance[month].items.filter(i => i.id !== `car-${c.id}`)
            }
          })))}
        onDropFuel={f => open(core.confirm(`Ștergi alimentarea din ${f.date}?`,
          'Dispare și din Finanțe, iar consumul se recalculează fără ea.',
          () => update(draft => {
            delete draft.fuel[f.id]
            for (const month of Object.keys(draft.finance)) {
              draft.finance[month].items = draft.finance[month].items.filter(i => i.id !== `fuel-${f.id}`)
            }
          })))}
        onReopen={d => open(core.confirm(`Redeschizi tura din ${d.date}?`,
          'Se scot din Finanțe banii scriși la închiderea ei. Îi pui la loc când o închizi din nou.',
          () => update(draft => {
            draft.workdays[d.id].done = false
            /* Mișcările scrise de tura asta poartă id-ul ei, deci se pot lua
               înapoi exact — nu ghicim după sumă și dată. */
            for (const month of Object.keys(draft.finance)) {
              draft.finance[month].items = draft.finance[month].items
                .filter(item => !item.id.endsWith(`-${d.id}`))
            }
          })))}
        onDelete={d => open(core.confirm(`Ștergi tura din ${d.date}?`,
          'Dispare cu tot cu mișcările pe care le-a scris în Finanțe. Nu se poate anula.',
          () => update(draft => {
            delete draft.workdays[d.id]
            for (const month of Object.keys(draft.finance)) {
              draft.finance[month].items = draft.finance[month].items
                .filter(item => !item.id.endsWith(`-${d.id}`))
            }
          })))} />
      case 'docs': return <Docs data={data} mod={view} busy={busyDoc}
        onAdd={() => open(core.doc(view))} onOpen={d => open(core.doc(view, d))}
        onToggle={d => update(draft => { draft.docs[d.id].done = !draft.docs[d.id].done })}
        onDelete={d => open(core.confirm(`Ștergi „${d.title}”?`,
          `Dispare din listă și din calendar${(d.files ?? []).length ? ', împreună cu scanurile atașate' : ''}. Nu se poate anula.`,
          () => {
            /* Fișierele întâi: șterse după ce documentul dispare, n-am mai
               ști niciodată că sunt acolo, și ar ocupa loc pe veci. */
            for (const file of d.files ?? []) void deleteDocFile(d.id, file).catch(() => undefined)
            update(draft => { delete draft.docs[d.id] })
          }))}
        onAttach={attachToDoc} onOpenFile={showDocFile} onDeleteFile={removeDocFile} />
      case 'notes': return <Notes data={data} mod={view} search={search} onSearch={setSearch}
        onAdd={() => open(core.note(view))} onOpen={n => open(core.note(view, n))} />
      case 'calendar': return <CalendarScreen data={data} month={calMonth} day={calDay} hidden={hidden}
        onMonth={setCalMonth} onDay={setCalDay} onGoto={go}
        onLayer={kind => setHidden(current => current.includes(kind)
          ? current.filter(k => k !== kind) : [...current, kind])}
        onAddTask={() => open(core.task('taskuri', calDay))} />
      case 'settings': return <SettingsScreen data={data} mode={mode} error={error} token={deviceToken()}
        photos={photos} onSignOut={() => { void signOut() }}
        onCurrency={value => update(draft => { draft.settings.currency = value })}
        onToken={value => { setDeviceToken(value); location.reload() }}
        onExport={exportData} onImport={importFile} imported={imported} onUpdate={hardReload}
        push={push} pushNote={pushNote} onPush={() => { void turnOnPush() }}
        onAlerts={(lead, hour) => update(draft => { draft.settings.alerts = { lead, hour } })}
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

  async function attachToDoc(doc: { id: string }, file: File) {
    setBusyDoc(doc.id)
    setProblem(null)
    try {
      const stored = await uploadDocFile(doc.id, file)
      update(draft => { draft.docs[doc.id].files = [...(draft.docs[doc.id].files ?? []), stored] })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyDoc(null)
    }
  }

  async function showDocFile(doc: { id: string }, file: DocFile) {
    setProblem(null)
    try {
      const url = await openDocFile(doc.id, file)
      /* Deschis într-o filă nouă: browserul știe să arate un PDF mai bine
         decât aș ști eu, iar poza se vede la mărimea ei. */
      window.open(url, '_blank', 'noopener')
      /* Adresa ține fișierul în memorie cât e vie; o eliberăm după ce fila a
         apucat să-l citească. */
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    }
  }

  function removeDocFile(doc: { id: string }, file: DocFile) {
    open(core.confirm(`Ștergi „${file.name}”?`, 'Dispare din cloud. Nu se poate anula.', () => {
      update(draft => {
        draft.docs[doc.id].files = (draft.docs[doc.id].files ?? []).filter(f => f.id !== file.id)
      })
      void deleteDocFile(doc.id, file).catch((error: unknown) => {
        setProblem(error instanceof Error ? error.message : String(error))
      })
    }))
  }

  /* Scrisorile unei datorii stau în același loc ca scanurile documentelor:
     un fișier e un fișier, iar dosarul e id-ul celui care îl poartă. */
  async function attachToDebt(debt: { id: string }, file: File) {
    setBusyDoc(debt.id)
    setProblem(null)
    try {
      const stored = await uploadDocFile(debt.id, file)
      update(draft => { draft.debts[debt.id].files = [...(draft.debts[debt.id].files ?? []), stored] })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyDoc(null)
    }
  }

  const showDebtFile = showDocFile

  function removeDebtFile(debt: { id: string }, file: DocFile) {
    open(core.confirm(`Ștergi „${file.name}”?`, 'Dispare din cloud. Nu se poate anula.', () => {
      update(draft => {
        draft.debts[debt.id].files = (draft.debts[debt.id].files ?? []).filter(f => f.id !== file.id)
      })
      void deleteDocFile(debt.id, file).catch((error: unknown) => {
        setProblem(error instanceof Error ? error.message : String(error))
      })
    }))
  }

  async function importFile(file: File) {
    setImported('Se citește…')
    try {
      const parsed: unknown = JSON.parse(await file.text())
      /* Contopirea se face pe datele salvate, nu pe cele arătate: altfel
         citirile aduse din sală s-ar scrie în obiective ca și cum ar fi ale
         lor, și ar rămâne acolo după ce le ștergi din sală. */
      const result = importInto(stored, parsed)
      if (result.error) { setImported(result.error); return }
      update(draft => { Object.assign(draft, result.data) })
      setImported(`Adăugate: ${describeImport(result.added)}.`)
    } catch {
      setImported('Fișierul nu e un JSON valid.')
    }
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

  /* Fără cont nu se poate sincroniza nimic, deci nu se intră: altfel ai
     scrie ore întregi pe un telefon și n-ai găsi nimic pe celălalt. */
  if (ready && !signedIn) return <SignIn onSignIn={signIn} onSignUp={signUp} />

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
