import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n/config.ts'
import { ACHU_BACKLOG_TASKS } from './data/achuBacklog'

type StoredTask = { id?: string; description?: string; children?: StoredTask[]; [key: string]: unknown }

const restoreAchuSourceDescriptions = () => {
  try {
    if (localStorage.getItem('achuRestoreSourceDescriptionsV1') === '1') return
    const raw = localStorage.getItem('tasks')
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const source = new Map((ACHU_BACKLOG_TASKS as unknown as StoredTask[]).map((task) => [task.id, task.description || '']))
    const restore = (task: StoredTask): StoredTask => {
      const generated = typeof task.description === 'string' && /(Ce trebuie făcut:|Ce înseamnă:|Finalizat când:|Criteriu de finalizare:|Context din backlog:)/i.test(task.description)
      const description = generated && task.id && source.has(task.id) ? source.get(task.id) || '' : task.description
      return { ...task, description, children: Array.isArray(task.children) ? task.children.map(restore) : task.children }
    }
    localStorage.setItem('tasks', JSON.stringify(parsed.map((value) => value && typeof value === 'object' ? restore(value as StoredTask) : value)))
    localStorage.setItem('achuRestoreSourceDescriptionsV1', '1')
  } catch { /* keep app startup safe */ }
}

restoreAchuSourceDescriptions()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
