interface SubNavProps<T extends string> {
  tabs: Array<{ key: T; label: string }>
  current: T
  onChange: (key: T) => void
}

export function SubNav<T extends string>({ tabs, current, onChange }: SubNavProps<T>) {
  return (
    <div className="sub-nav">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={key === current ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
