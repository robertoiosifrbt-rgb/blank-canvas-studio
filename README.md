# Roberto OS

Panou personal: finanțe, datorii, task-uri, obiceiuri, jurnal și obiective,
plus modulul de sală.

Aplicația e în `os/` — React + TypeScript + Vite. Funcțiile Edge și migrațiile
pe care le folosește stau în `supabase/`.

## Cum pornești

```bash
cd os
npm install
npm run dev
```

## Verificări

```bash
cd os
npm run lint
npm test
npm run build
```

## Publicare

Vercel construiește numai `os/` și publică `os/dist` — vezi `vercel.json`.

Regulile de lucru sunt în `CLAUDE.md` (întreg repo-ul) și `os/CLAUDE.md`
(aplicația).
