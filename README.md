# Life Control Centre

Un Life OS. Planul complet, în ordine, e în [`docs/PLAN.md`](docs/PLAN.md).

Construit până acum:

- **pasul 1** — scheletul
- **pasul 2** — regulile impuse
- **pasul 3** — autentificare (email și parolă) și coloana, în bază
- **pasul 4** — stratul de date: snapshot, delta, scriere, export
- **pasul 5** — Captura, Azi, Calendarul, foaia de item și „Descarcă tot"

Ciclul complet e închis: scrii un rând, îl procesezi, îl bifezi, îl descarci,
și îl găsești pe alt dispozitiv și după refresh. Tot ce ține de date stă în
`src/repository/`, iar ESLint nu lasă niciun alt fișier să atingă Supabase.

## Comenzi

    npm run dev          pornește aplicația local
    npm run lint         eslint .
    npm run typecheck    tsc -b --force
    npm test             vitest run
    npm run build        tsc -b && vite build
    npm run check:structure   300 de linii, convenția CSS
    npm run check:rls         RLS, negative și pozitive
    npm run check:cycle       ciclul complet, prin browser
    npm run check:layout      așezarea la lățime de telefon

## Limba

Codul e în engleză, tot. Doar documentele — planul, fișierul ăsta și
`CLAUDE.md` — rămân în română.

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

`check:cycle` și `check:layout` au nevoie de un cont, pentru că ecranele stau
după autentificare. Se face unul pe baza locală (vezi jobul `local-database`
din `.github/workflows/ci.yml` pentru comanda exactă), apoi:

    npm run build
    CHECK_EMAIL=... CHECK_PASSWORD=... npm run check:cycle
    CHECK_EMAIL=... CHECK_PASSWORD=... npm run check:layout

`check:cycle` e testul de acceptanță al pasului 5, exact cum e scris în plan:
scrii „call X", apare în Inbox, îl procesezi ca task pe mâine, apare în
Calendar pe mâine, îl bifezi, apare ca făcut în ziua în care l-ai bifat, îl
descarci și îl vezi în fișier, îl găsești pe alt dispozitiv și după refresh.

Amândouă rulează pe Chromium, implicit. Telefonul pentru care e scrisă
aplicația rulează WebKit, iar acolo diferă exact ce folosim — IndexedDB,
descărcarea de Blob, `input type=date`, marginile de siguranță. Deci în CI
rulează pe amândouă, și local se schimbă cu:

    CHECK_BROWSER=webkit npm run check:cycle
    CHECK_BROWSER=webkit npm run check:layout

WebKit pe Linux nu e Safari de pe iPhone, e motorul lui. Prinde diferențele de
motor, nu tot ce ține de iOS. Testele manuale de mai jos rămân.

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
4. **Timpul de scriere la Captură.** Criteriul din plan e al omului, nu al unui
   test: câmpul e focalizat la deschidere, salvarea e un singur gest, și nu
   există formular intermediar. Se verifică cu degetul, pe telefon.
