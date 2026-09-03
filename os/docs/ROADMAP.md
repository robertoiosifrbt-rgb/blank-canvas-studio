# Roadmap

## Fundație

- [x] Scaffold proiect (React + TypeScript + Vite)
- [x] Structură de documentație și jurnal pentru continuitate între sesiuni
- [x] Convenție de module (`src/features/<nume>`)

## Stabilizare (audit tehnic, 2026-08-05) + Redesign UI

Reparații și redesign. Etapele 1–5 din audit sunt gata și verificate (`npm run lint`, `npm test`, `npm run build` trec). Redesign UI aplicat pe ramura `claude/chat-gpt-review-jlmm9c`.

- [x] Salvarea pozelor e așteptată; selecția rămâne dacă IndexedDB refuză
- [x] Deploy gated: `lint` + `test` rulează înaintea build-ului, deci un push cu teste picate nu publică nimic
- [x] Citire/scriere `localStorage` protejată și validată; copie de siguranță pentru date corupte
- [x] Limite pentru valorile numerice (fără negative, `NaN`, `Infinity`)
- [x] Data implicită în fusul local, nu UTC
- [x] `createdAt` pentru ordonarea intrărilor din aceeași zi
- [x] O singură sursă pentru tipurile de câmp personalizate
- [x] Confirmare la ștergerea unui exercițiu (istoricul se păstrează)
- [x] Tabelul de măsurători derulează orizontal pe telefon
- [x] Suită de teste (`npm test`), obligatorie înainte de deploy
- [x] **Redesign Home**: weekly progress ring, today's workout, quick actions, recent workouts
- [x] **Body page tabs**: Overview (muscle groups) și Measurements
- [x] **Muscle visualization**: bar chart cu workout volume per muscle group
- [x] **Ecran de antrenament activ** (`workout-runner`): cronometru, progres pe exerciții, tabel de seturi cu bifă
- [x] **Ramura stabilă**: fluxul `dev` → `main` e în funcțiune; `main` e ramura live, publicată de `deploy.yml`

## Drumul până la target-ul vizual

Destinația e în `docs/DESIGN_TARGET.md` (+ mockup-ul în `docs/design/target-screens.png`).
Planul de mai jos e drumul până acolo, **o etapă per sesiune de lucru**.

Regula pentru fiecare etapă: nu se trece la următoarea până când `npm run lint`,
`npm test` și `npm run build` nu trec, iar etapa e promovată `dev` → `main`.

- [x] **Etapa 0 — fundația CSS** (fără nicio schimbare de aspect în light mode)
  - [x] `src/styles/tokens.css` — singura sursă pentru culori, raze, umbre, spațiere
  - [x] ștearsă pagina duplicată `features/measurements/BodyPage.tsx` + cele 3 foi de stil moarte
  - [x] cele 6 fișiere minificate pe un rând re-scrise citibil (10 → 3387 de linii)
  - [x] aplicația e explicit **light-only** — dark mode-ul era deja anulat pe jumătate
  - **Restul s-a mutat în etapele 1–6, intenționat** (vezi mai jos): 232 de `!important` și 36 de selectori definiți în mai multe fișiere (187 și, respectiv, mai puțini după etapele 1–2b).

  *De ce restul nu s-a făcut acum:* un `!important` nu poate fi scos în siguranță
  cât timp regula concurentă încă există — se scoate odată cu ea. Iar regulile
  concurente sunt exact straturile per ecran, care dispar când ecranul e refăcut.
  Deci `!important`-urile și selectorii dubli se curăță **per ecran**, în etapele
  de mai jos, unde ștergerea e verificabilă. A le forța acum ar însemna schimbări
  de aspect pe care nu le pot dovedi.
- [x] **Etapa 1 — shell**: scos header-ul global „Gym App" (nu există în niciun ecran din mockup) și
  `src/shared/PageHeader.tsx` ca titlu unic pentru toate ecranele — înlocuiește trei headere
  aproape identice care ajunseseră la trei mărimi de titlu diferite (1.8rem / 1.34rem / 1.28rem).
  Bara veche avea și `env(safe-area-inset-top)` propriu, care se aduna cu cel al conținutului.
- [x] **Etapa 2 — Body Overview**: siluetă față/spate cu mușchii colorați pe 4 niveluri, tab-uri
  Muscles/Body Parts, selector de perioadă (This Week / This Month / All Time), card Muscle Focus.
  Atribuirea mușchilor citește acum câmpurile **Primary/Secondary muscles** din bibliotecă —
  înainte căuta numele mușchiului în numele exercițiului, deci „Barbell Bench Press" nu contribuia
  nimic la piept.
- [x] **Etapa 2b — Home**: dalele Quick Actions erau stivuite (iconiță deasupra etichetei) pentru că
  `index.css` punea `flex-direction: column`, iar `redesign.css` seta doar `display: flex`. Home are
  acum o singură foaie proprie, `src/app/HomePage.css` — 96 de reguli șterse din fișierele comune,
  zero `!important`, plus un test care blochează revenirea la două surse.
- [x] **Etapa 3 — Workout Log**: calendar lunar cu zilele de antrenament marcate. Lista urmează
  luna de pe ecran (altfel calendarul și lista arătau lucruri diferite), iar apăsarea unei zile
  restrânge la ea. Se deschide pe luna ultimului antrenament, nu pe cea curentă.
- [x] **Reparații raportate de proprietar (2026-08-12)** — cinci ecrane, o cauză
  comună: CSS valid care nu se aplica. Un comentariu neînchis în `redesign.css`
  ascundea 16 reguli; două containere nerandate (`.target-exercise-library`,
  `.target-workout-log`) făceau moarte alte 14; două token-uri (`--radius-full`,
  `--color-surface-secondary`) nu existau. Plus formularul de editare din Workout
  Log, care ieșea 26px lățime pentru că pica în coloana de index a unui grid.
  Gărzile generale sunt în `src/styles/screenRepairs.test.ts`.
- [x] **Etapa 4 — Exercises**: căutare, thumbnail-uri, favorite, FAB.
  Căutarea citește și mușchii și echipamentul, nu doar numele — „quads" găsește
  Leg Press, al cărui nume nu spune nimic despre quads. Chips-urile derulează
  orizontal pe un singur rând (înainte se împachetau pe două). Favoritele urcă
  în capul listei; altfel steluța n-ar face nimic. Thumbnail-ul e harta de
  mușchi la dimensiune de rând — mockup-ul are fotografie, noi n-avem poze
  (vezi „Întrebări deschise" în `DESIGN_TARGET.md`).
  **CSS-ul ecranului e acum într-o singură foaie**, `features/exercises/exercises.css`:
  `exercises-target.css` s-a mutat în modul, iar regulile lui din `index.css`
  (chips-urile vechi, lista moartă `.exercise-list`, `.new-field-row` definit de
  două ori) și din `redesign.css` (formularul, selectorul de Tracks) au venit
  după el. Ownership-ul e blocat de teste, ca la Home.
- [x] **Etapa 5 — Body Stats**: cele trei secțiuni s-au alăturat tab-ului
  „Overview" existent, pe un singur rând de patru — imbricate, drumul s-ar fi
  citit „Body › Measurements › Measurements". Cardul „Key Measurements" arată
  ultima măsurătoare cu diferența față de cea dinainte; formularul de unsprezece
  câmpuri a trecut în spatele butonului „+ Add Measurements", ca cifrele pe care
  vii să le citești să nu înceapă sub un formular pe care nu-l completezi.
- [x] **Rândul de sesiune din Workout Log**: dată citibilă, `n exercises ·
  durată`, volum, bară colorată la stânga pe sesiunea deschisă.
- [x] **Etapa 6 — Settings**: profil editabil (nume + poză), **Units** metric/imperial
  aplicat în toată aplicația, și **Import Data**. Unitățile se convertesc doar la
  afișare și la citirea din formular — ce se salvează rămâne în kg și cm, altfel
  fiecare comutare ar rescrie istoricul. Importul cere confirmare, spune ce e în
  fișier înainte să scrie și pune totul la loc dacă o scriere e refuzată la
  mijloc. Au dispărut rândurile care nu duceau nicăieri („Appearance" —
  aplicația e light-only din etapa 0). Level/XP, Rest Timer și Workout Reminders
  rămân blocate de „Întrebări deschise" din `DESIGN_TARGET.md`, punctele 2–4.

**Cele 9 ecrane din target sunt făcute.** Ce urmează nu mai e o etapă de
redesign, ci fie deciziile de mai jos, fie funcționalități noi.

La fiecare etapă, pe lângă ecranul în sine:

- se șterg regulile vechi care îl vizau din `index.css` / `*-target.css` /
  `redesign.css`, iar `!important`-urile rămase fără concurent dispar odată cu
  ele — fiecare etapă scade numărătoarea (232 la început, 187 acum);
- se rescrie componenta atinsă ca să fie lizibilă (6 componente sunt încă scrise
  pe rânduri de până la 1168 de caractere — `SessionCard.tsx` și `HomePage.tsx`
  sunt cele mai dese).

Stratul de date (`src/shared/`, hooks, `types.ts`, parsere) și testele **nu** se
rescriu: sunt partea verificată prin audit și prin teste de mutație.

## Funcționalități

- [x] Măsurători corporale (greutate, % grăsime, circumferințe) + istoric
- [x] Poze de progres (set de 4 unghiuri pe dată, galerie)
- [x] Lista de exerciții (biblioteca, câmpuri configurabile per exercițiu)
- [x] Jurnal de antrenament pe sesiuni (nume + dată, exerciții multiple per sesiune, ultimul log per exercițiu)
- [ ] Planuri de antrenament

_(lista se completează pe măsură ce decidem împreună următorii pași)_
