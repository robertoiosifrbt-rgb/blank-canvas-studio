import type { ReactNode } from 'react'

/** Bucățile de interfață folosite de mai multe ecrane. */

export function Head({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="os-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Section({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <div className="os-sec">
      <h2>{title}</h2>
      <div className="os-sec-line" />
      {extra}
    </div>
  )
}

export function Tile({ label, value, sub, tone, lead }:
{ label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'warn'; lead?: boolean }) {
  return (
    <div className={`os-tile${lead ? ' lead' : ''}`}>
      <span className="k">{label}</span>
      <span className={`v${tone ? ` ${tone}` : ''}`}>{value}</span>
      {sub ? <span className="s">{sub}</span> : null}
    </div>
  )
}

/** Inelul de progres: ocupă mult mai puțin decât o bară lată. */
export function Ring({ percent, ready }: { percent: number; ready: boolean }) {
  const circumference = 2 * Math.PI * 26
  const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100)
  const shown = percent < 10 && percent > 0 ? percent.toFixed(1) : percent.toFixed(0)
  return (
    <div className="os-ringwrap">
      <svg className="os-ring" viewBox="0 0 62 62" aria-hidden="true">
        <circle className="bg" cx="31" cy="31" r="26" />
        <circle className="fg" cx="31" cy="31" r="26"
          strokeDasharray={circumference.toFixed(1)} strokeDashoffset={offset.toFixed(1)} />
      </svg>
      <b className="os-ringpct">{ready ? `${shown}%` : '—'}</b>
    </div>
  )
}

export function Pill({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={`os-pill${tone ? ` ${tone}` : ''}`}>{children}</span>
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="os-empty">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="os-rows">{children}</div>
}

export function Row({ stripe, title, sub, amount, tone, action }:
{ stripe?: string; title: string; sub?: ReactNode; amount?: string; tone?: string; action?: ReactNode }) {
  return (
    <div className="os-row">
      {stripe ? <span className={`os-stripe ${stripe}`} /> : null}
      <div className="main">
        <span className="ttl">{title}</span>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
      {amount ? <span className={`amt${tone ? ` ${tone}` : ''}`}>{amount}</span> : null}
      {action}
    </div>
  )
}
