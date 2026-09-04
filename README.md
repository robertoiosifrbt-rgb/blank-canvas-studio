# Life Control Centre

Un Life OS. Planul complet, în ordine, e în [`docs/PLAN.md`](docs/PLAN.md).

Construit până acum:

- **pasul 1** — scheletul
- **pasul 2** — regulile impuse
- **pasul 3** — autentificare (email și parolă) și coloana, în bază

Nu există încă stratul de date: `items` există în bază, dar niciun ecran nu
citește și nu scrie în el. Vine la pasul 4.

## Comenzi

    npm run dev          pornește aplicația local
    npm run lint         eslint .
    npm run typecheck    tsc -b --force
    npm test             vitest run
    npm run build        tsc -b && vite build
    npm run check:structure   300 de linii, convenția CSS
    npm run check:rls         RLS, negative și pozitive
    npm run check:layout      așezarea la lățime de telefon

## Configurație

Se copiază `.env.example` în `.env.local` și se completează. Aceleași două
variabile se pun în Vercel, **separat pentru Production și pentru Preview** —
un Preview nu primește niciodată URL-ul bazei de producție.

Configurația se citește la prima folosire, nu la încărcare: dacă lipsește, se
vede ca mesaj în aplicație, nu ca ecran alb.

## Baza, local

Migrațiile stau în `supabase/migrations/`. Verificările care au nevoie de o
bază rulează pe Supabase local, efemer — niciodată pe producție.

    supabase start

    # RLS
    DATABASE_URL="$(supabase status -o env | grep '^DB_URL' | cut -d= -f2- | tr -d '\"')" \
      npm run check:rls

`check:layout` are nevoie de un cont, pentru că ecranele aplicației stau după
autentificare. Se face unul pe baza locală (vezi jobul `baza-locala` din
`.github/workflows/ci.yml` pentru comanda exactă), apoi:

    VERIFICARE_EMAIL=... VERIFICARE_PAROLA=... npm run check:layout

Dacă ai deja un Chromium, i-l dai direct în loc să-l descarci:

    CHROMIUM_EXECUTABLE=/cale/către/chromium npm run check:layout

## Testele manuale

Astea nu se pot automatiza aici și nu se sar.

1. **SPA fallback pe Vercel.** Intri direct pe `/azi` și pe `/calendar` la
   URL-ul deployment-ului, dai refresh, rămâi pe acel ecran. Fără
   `vercel.json`, o rută accesată direct dă 404 chiar dacă navigarea în
   aplicație merge perfect.
2. **Contul, pe două dispozitive.** Faci contul pe telefon, intri cu el pe
   laptop. „Datele vin după cont, pe orice telefon" e o promisiune care se
   verifică doar așa.
3. **Marginile de siguranță pe telefon adevărat.** Verificatorul de așezare
   simulează crestătura; un telefon real o are.
