# Jurnal de dezvoltare

> Regulă: aici stau doar ultimele 5 intrări. Când se adaugă a 6-a, cea mai veche
> se mută în `docs/archive/dev-log/<an>-<luna>.md` (ex: `2026-08.md`). Așa fișierul
> nu crește la nesfârșit și rămâne rapid de citit la începutul unei sesiuni noi.

## 2026-08-18 — sesiunea se citea de la coadă la cap

Semnalat de proprietar: în cardul unei sesiuni, exercițiile apăreau începând cu
ultimul terminat — banda de alergare, cu care încheiase, era numerotată „1", iar
Lat Pulldown, cu care începuse, era „8".

- Jurnalul își ține intrările **cele mai noi întâi** (`byRecencyDesc`), ceea ce e
  corect pentru „ce ai făcut ultima dată la exercițiul ăsta" și greșit pentru
  citirea unei sesiuni: acolo ordinea cerută e cea în care ai lucrat.
- `byOldestFirst` în `types.ts`, lângă comparatorul existent, iar cardul își
  sortează intrările cu el. Intrările fără `createdAt` (dinainte ca acel câmp să
  existe) se așază primele în ziua lor — sunt cele mai vechi lucruri de acolo.
- Aceeași ordine și în runner pentru intrările sesiunii curente, ca un exercițiu
  logat din pagina de jurnal să intre la coada cozii, nu în față.
- Ordinea **sesiunilor** în listă nu se schimbă: acolo tot cea mai recentă e sus.
- Verificat: 3 teste pentru comparator + o gardă la nivel de pagină (cardul
  numerotează „1 Bench Press, 2 Squat, 3 Treadmill"), verificate prin mutație.
  Plus condus în browser pe 393px, cu 8 exerciții scrise în ordinea inversă în
  care au fost făcute: cardul le listează „1 Lat Pulldown … 8 Treadmill".
- `lint` ✅, 464 de teste ✅, `build` ✅.

## 2026-08-18 — un exercițiu uitat nu se putea adăuga la o sesiune încheiată

Cerut de proprietar: „trebuie să adaug încă un exercițiu la o sesiune veche".
Nu se putea deloc — formularul „Add another exercise" se randa doar cât sesiunea
era în desfășurare (`active = !session.endedAt`). Pe o sesiune încheiată puteai
edita sau șterge ce era deja logat, dar nu adăuga nimic; singura cale era să
ștergi sesiunea și s-o rescrii.

- Datele erau deja în regulă: `onAddEntry` ștampilează intrarea cu `session.id`
  și **cu data sesiunii**, nu cu ziua de azi. Lipsea doar poarta din UI.
- Pe o sesiune încheiată, formularul stă **în spatele unui buton**
  („+ Add exercise", lângă „Edit session"). Te întorci la un antrenament vechi
  ca să-l citești, nu ca să scrii în el — dar „am uitat ultimul exercițiu" e
  real. Antetul panoului scrie „Add to this workout · 11 August 2026", ca să fie
  clar unde aterizează, nu în ziua curentă.
- Formularul rămâne deschis după salvare (poți adăuga mai multe) și se închide
  cu „Done". Butonul de anulare exista doar în modul de editare; acum apare ori
  de câte ori componenta primește `onCancel`.
- Sesiunea activă e neatinsă: acolo formularul rămâne deschis din start, fără
  buton.
- Verificat: 4 teste noi în `WorkoutLogPage.test.tsx`, verificate prin mutație
  (cu poarta pusă înapoi pică trei). Plus condus în browser pe 393px, pe o
  sesiune din 11 august: fără formular la deschidere → „+ Add exercise" →
  Seated Row 52.5kg × 10 → intrarea se scrie pe `sessionId: s0`, `date:
  2026-08-11`, `endedAt` neschimbat, iar rândul sesiunii devine „2 exercises ·
  1h 10m · 1,065 kg". „Done" închide formularul. Zero erori în consolă.
- `lint` ✅, 460 de teste ✅, `build` ✅.

## 2026-08-18 — un exercițiu fără track-uri nu se putea înregistra

Semnalat de proprietar din mijlocul unui antrenament, pe Plank: „aici nu pot să
înregistrez?". Cardul spunea „This exercise has no tracked fields. Add one under
Workout → Exercises" — adică, cu cronometrul pornit, ieși din sesiune, cauți
exercițiul în bibliotecă, îl editezi și te întorci.

- **Cum ajunge un exercițiu acolo**: `×` pe un track din lista Tracks îl
  arhivează și îl scoate din exercițiul pe care tocmai îl editezi. Dacă acela
  era singurul lui track, rămâne cu `fields: []`. Celelalte exerciții păstrează
  id-ul arhivat în `fields`, iar runner-ul construiește coloanele doar din
  track-urile active — deci și ele rămân fără tabel.
- **Reparat unde doare**: cardul oferă acum track-urile existente ca butoane
  („Reps", „Weight (kg)", „Time (s)", „Distance (m)"). O apăsare le lipește pe
  exercițiu (`addFieldToExercise`, scrie doar `fields`, nu atinge restul) și
  tabelul apare pe loc, cu atâtea rânduri câte seturi ai făcut data trecută.
  Rămâne pus, deci data viitoare tabelul e deja acolo. Dacă nu există niciun
  track activ în toată aplicația, mesajul vechi rămâne — acolo chiar n-are ce
  oferi.
- **Pastilele „Last time" ieșeau goale** la același exercițiu: seturile lui
  vechi sunt cheiate pe un track care nu mai e în listă, iar `formatSet` scria
  doar track-urile pe care le recunoaște. Acum valorile orfane se scriu fără
  etichetă — cifra fără nume e tot cifra. Repară și rândurile goale din Workout
  Log, nu doar runner-ul.
- **Ce n-am schimbat**: ștergerea unui track poate în continuare să lase un
  exercițiu fără nimic de urmărit. Se poate refuza ștergerea ultimului track sau
  se poate scoate track-ul din toate exercițiile deodată (`removeFieldFromExercises`
  există deja, nefolosit) — decizie de proprietar, nu o iau singur.
- Verificat: 4 teste noi în `WorkoutRunnerScreen.test.tsx`, toate prin mutație.
  Plus condus în browser pe 393px, cu date care reproduc exact cazul: Plank fără
  track-uri și un log vechi pe un track dispărut → pastilele arată „1 40 / 2 45 /
  3 50", apăs „Time (s)", tabelul apare cu 3 rânduri, `fields` devine `['time']`,
  scriu 45 și 40, „Finish Exercise" salvează `[{time:45},{time:40}]` și trece la
  Treadmill, „1 of 2 exercises". Zero erori în consolă, pagina rămâne 393px.
- `lint` ✅, 456 de teste ✅, `build` ✅.

## 2026-08-18 — ecranele ieșeau lateral: două `input type=file` ascunse

Semnalat de proprietar („fixează ecranele"), cu cardul sesiunii tăiat pe
margine. Măsurat în Chromium pe 320 / 393 / 430 px, plimbând fiecare ecran și
fiecare panou care se deschide: **un singur ecran ieșea din pagină — Settings**,
cu 13px (28px cu panoul de profil deschis).

- **Cauza**: `input:not([type='checkbox']):not([type='radio'])` din `index.css`
  bate `.visually-hidden` la specificitate (0-2-1 față de 0-1-0), deci cele două
  câmpuri de fișier ascunse (poza de profil, Import Data) erau late cât ecranul,
  nu 1px. Poziționate absolut, dar tot numărau ca overflow. Reparat cu
  `:not(.visually-hidden)` în selector — clasa nu mai e călcată.
- **De ce se vedea tocmai în runner, care n-are niciun `input type=file`**:
  `overflow-x: hidden` oprește derularea laterală, dar pe iOS *viewport-ul de
  layout* tot crește până la lățimea conținutului, iar cutiile `position: fixed`
  se măsoară după el. Bara de jos (`width: min(760px, 100%)`) și runner-ul
  (`inset: 0`) se desenau la 406–421px pe un ecran de 393 — cardul ieșea pe
  dreapta, iar zona vizibilă se putea plimba stânga-dreapta peste el. O intrare
  în Settings strica așezarea pentru tot ce urma, până la o reîncărcare.
- `.runner-root` cere acum explicit `overflow-x: hidden`: cu `overflow-y: auto`
  singur, `overflow-x` se calculează tot `auto`, adică un derulator lateral care
  așteaptă primul card care nu încape.
- Verificat cu browser-ul, nu cu ochiul: un script Playwright deschide fiecare
  tab și apasă pe rând fiecare buton din ecran (panouri, formulare, taburi,
  runner-ul cu toate exercițiile și meniul lui), apoi compară
  `documentElement.scrollWidth` cu lățimea ecranului și raportează orice element
  care depășește marginea. Înainte: Settings pica pe 393 și 430. După: „no
  screen sticks out" pe toate cele trei lățimi. Câmpul de fișier măsoară 1×1,
  bara de jos exact 393, iar dialogul de import încă se deschide din buton.
- Trei gărzi noi în `src/styles/screenRepairs.test.ts` (fișierul care ține
  reparațiile de layout), toate verificate prin mutație. jsdom n-are motor de
  layout, deci pinează regula, nu pixelul.
- Verificat: `lint` ✅, 452 de teste ✅, `build` ✅.

**De reținut pe telefon**: aplicația salvată pe ecranul principal ține așezarea
veche până la o reîncărcare completă — după update, închide și redeschide
aplicația dacă marginile încă arată strâmb.

## 2026-08-18 — în runner nu se vedea ce ai ridicat data trecută

Semnalat de proprietar, cu ecranul de sesiune activă deschis: „aici nu îmi arată
ultimul exercițiu". Pe pagina Workout Log, formularul de intrare arată de mult
rândul „Last time (dată): ..." (`ExerciseEntryForm`). În runner, ultimul log era
citit **doar** ca să decidă câte rânduri goale apar în tabel — nu se vedea nicăieri.

- Cardul exercițiului are acum, între harta de mușchi și tabelul de seturi, un
  bloc „LAST TIME · 10 July 2026" cu o pastilă per set (`1  8 reps · 60kg`). Stă
  **deasupra** tabelului fiindcă e reperul după care completezi tabelul.
- **Ultimul log exclude sesiunea de pe ecran**: `getLastEntry(exerciseId, excludeSessionId?)`.
  Fără asta, după „Finish Exercise" + „Previous exercise", blocul ar fi arătat
  exact seturile din tabelul de deasupra lui — și-ar fi răspuns la propria
  întrebare. Excluderea se aplică și numărului de seturi de pe cardul „Next".
- Etichetele vin din `allFieldTypes` (inclusiv tipurile arhivate), ca la istoricul
  din Workout Log — altfel un log vechi pe un track șters ar fi rămas fără unitate.
- Data se scrie cu `dayLabel` („10 July 2026"), nu ISO.
- 4 teste noi în `WorkoutRunnerScreen.test.tsx`, verificate prin mutație: cu blocul
  scos pică două, cu excluderea sesiunii scoasă pică cel care cere ca sesiunea
  curentă să nu se citeze pe ea însăși.
- Verificat: `lint` ✅, 449 de teste ✅, `build` ✅.
