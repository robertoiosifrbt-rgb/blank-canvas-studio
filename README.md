# Life Control Centre

Un Life OS. Planul complet, în ordine, e în [`docs/PLAN.md`](docs/PLAN.md).

Construit până acum: **pasul 1** (scheletul) și **pasul 2** (regulile impuse).
Nu există încă strat de date — nimic nu se salvează.

## Comenzi

    npm run dev          pornește aplicația local
    npm run lint         eslint .
    npm run typecheck    tsc -b --force
    npm test             vitest run
    npm run build        tsc -b && vite build
    npm run check:structure   300 de linii, convenția CSS
    npm run check:layout      așezarea la lățime de telefon

`check:layout` are nevoie de un Chromium. În CI îl instalează
`npx playwright install chromium`. Local, dacă ai deja unul, i-l dai direct:

    CHROMIUM_EXECUTABLE=/cale/către/chromium npm run check:layout

## Configurație

Se copiază `.env.example` în `.env.local`. Aceleași două variabile se pun în
Vercel, **separat pentru Production și pentru Preview** — un Preview nu
primește niciodată URL-ul bazei de producție.

## Testele manuale

Astea nu se pot automatiza aici și nu se sar.

1. **SPA fallback pe Vercel.** Intri direct pe `/azi` și pe `/calendar` la
   URL-ul deployment-ului, dai refresh, rămâi pe acel ecran. Fără
   `vercel.json`, o rută accesată direct dă 404 chiar dacă navigarea în
   aplicație merge perfect.
2. **Marginile de siguranță pe telefon adevărat.** Verificatorul de așezare
   simulează crestătura; un telefon real o are.
