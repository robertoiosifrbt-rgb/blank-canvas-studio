import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Un câmp de formular. `select` primește opțiuni, restul sunt simple. */
export interface Field {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select'
  value?: string
  placeholder?: string
  options?: { value: string; label: string }[]
}

export interface DialogSpec {
  title: string
  note?: ReactNode
  ok?: string
  danger?: boolean
  fields: Field[]
  /** Întoarce un mesaj ca să oprească închiderea, sau nimic dacă e în regulă. */
  submit: (values: Record<string, string>) => string | void
  extra?: ReactNode
}

export function Dialog({ spec, onClose, onError }:
{ spec: DialogSpec; onClose: () => void; onError: (message: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.fields.map(f => [f.key, f.value ?? ''])))
  const first = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (key: string, value: string) => setValues(v => ({ ...v, [key]: value }))

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]))
    const problem = spec.submit(trimmed)
    if (typeof problem === 'string') onError(problem)
    else onClose()
  }

  return (
    <div className="os-veil" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="os-modal" onSubmit={send} autoComplete="off">
        <header><h3>{spec.title}</h3></header>
        <div className="body">
          {spec.note ? <p className="os-note-text">{spec.note}</p> : null}
          {spec.fields.map((f, i) => (
            <label className="os-fld" key={f.key}>
              <span>{f.label}</span>
              {f.type === 'select' ? (
                <select ref={i === 0 ? first as never : undefined} value={values[f.key]}
                  onChange={e => set(f.key, e.target.value)}>
                  {(f.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea ref={i === 0 ? first as never : undefined} value={values[f.key]}
                  placeholder={f.placeholder} onChange={e => set(f.key, e.target.value)} />
              ) : (
                <input ref={i === 0 ? first as never : undefined} type={f.type ?? 'text'}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  step={f.type === 'number' ? '0.01' : undefined}
                  value={values[f.key]} placeholder={f.placeholder}
                  onChange={e => set(f.key, e.target.value)} />
              )}
            </label>
          ))}
          {spec.extra}
        </div>
        <footer>
          <button type="button" className="os-btn ghost" onClick={onClose}>Renunță</button>
          <button type="submit" className={`os-btn${spec.danger ? ' danger' : ''}`}>{spec.ok ?? 'Salvează'}</button>
        </footer>
      </form>
    </div>
  )
}
