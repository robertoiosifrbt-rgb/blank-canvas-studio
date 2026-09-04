/* Iconurile din bara de navigare, aceleași ca înainte de mutarea pe React.

   Un singur set, desenat pe o grilă de 16, ca să aibă toate aceeași greutate a
   liniei. `currentColor` peste tot: culoarea vine de la butonul care le poartă,
   deci starea „selectat" nu are nevoie de o a doua variantă a fiecărui icon. */

/* Modulele făcute de tine au `kind` liber, deci numele poate să nu fie în
   listă. Atunci primesc iconul de modul, nu o gaură în bară. */
const PATHS: Record<string, string> = {
  dashboard: 'M8 2 2 8h1.6v5.4h8.8V8H14zM6.4 13.4V9.6h3.2v3.8',
  goals: 'M8 2.1a5.9 5.9 0 1 0 0 11.8A5.9 5.9 0 0 0 8 2.1m0 3.3a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2',
  calendar: 'M3.8 3.4h8.4a1.4 1.4 0 0 1 1.4 1.4v7.4a1.4 1.4 0 0 1-1.4 1.4H3.8a1.4 1.4 0 0 1-1.4-1.4V4.8a1.4 1.4 0 0 1 1.4-1.4M2.4 6.6h11.2M5.6 2.2v2.4M10.4 2.2v2.4',
  finance: 'M2.4 12.6h11.2M5 12.6V6.2M8 12.6V3.4M11 12.6V8.2',
  debts: 'M8 2.2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6M8 2.2a5.8 5.8 0 0 1 5.8 5.8',
  tasks: 'M3 8.4l2.6 2.6L13 3.8',
  habits: 'M3.4 2.4h3.6v3.6H3.4zM9 2.4h3.6v3.6H9zM3.4 10h3.6v3.6H3.4zM9 10h3.6v3.6H9z',
  notes: 'M4 2.6h8v10.8H4zM6.2 5.6h3.6M6.2 8h3.6M6.2 10.4h2.2',
  hub: 'M8 1.8 2.4 4.6 8 7.4l5.6-2.8zM2.4 8 8 10.8 13.6 8M2.4 11.4 8 14.2l5.6-2.8',
  gym: 'M2.6 6v4M4.6 4.4v7.2M11.4 4.4v7.2M13.4 6v4M4.6 8h6.8',
  settings: 'M8 5.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4M8 1.6v1.9M8 12.5v1.9M14.4 8h-1.9M3.5 8H1.6M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3M12.5 12.5l-1.3-1.3M4.8 4.8L3.5 3.5',
  more: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
}

export function OsIcon({ name }: { name: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.hub} />
    </svg>
  )
}
