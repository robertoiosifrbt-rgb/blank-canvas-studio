# Destinația vizuală

**Aici scrie cum trebuie să arate aplicația când e gata.** Documentul nu descrie ce
e făcut azi — pentru asta e `docs/ROADMAP.md`. Ăsta e reperul fix: orice sesiune
nouă îl citește ca să știe încotro mergem, fără să mai reconstruiască contextul.

Referința e `docs/design/target-screens.png` — mockup-ul cu 9 ecrane, aprobat de
proprietar pe 12 august 2026.

> **Poza e reper de aspect, nu instrument de verificare.** Regula din `CLAUDE.md`
> rămâne: nu se trimit screenshot-uri ca dovadă că ceva funcționează. Când
> verifici o schimbare, o verifici în text (`npm test`, `npm run lint`,
> `npm run build`, sau descriind ce s-a apăsat și ce s-a salvat). Poza spune
> **cum arată**, testele spun **dacă merge**.

---

## Sistemul de design

Valorile de mai jos sunt citite din mockup. Orice culoare sau colț rotunjit nou
folosește un token de aici, nu o valoare scrisă direct în CSS.

### Culori

| Rol | Valoare | Unde |
|---|---|---|
| Fundal pagină | `#F7F8FB` | tot ce e în spatele cardurilor |
| Suprafață | `#FFFFFF` | carduri, rânduri de listă |
| Suprafață alternativă | `#F5F7FA` | câmpuri, casete în interiorul cardurilor |
| Suprafață închisă | `#10192B` | header-ul sesiunii active, „Finish Exercise", „Add Measurements", pill-ul de tab activ |
| Accent (coral) | `#FF6553` | „Start Workout", tab-ul activ din bottom nav, bara de progres, FAB, „Add to Workout" |
| Accent difuz | `#FFF0ED` | fundalul rândului de set curent |
| Text principal | `#171B25` | |
| Text secundar | `#7F8694` | etichete, meta, unități |
| Bordură / separator | `#ECEEF2` | |
| Pozitiv | `#22B573` | bifa unui set făcut, delta din Body Stats, „done" pe sesiuni |

**Nuanțele pentru quick actions** (câte una per dală, în ordine): `#EDF7FF`
albastru, `#FFF4E8` crem, `#F2EFFF` lavandă, `#FFEDED` roz. Iconița fiecărei dale
preia o versiune saturată a nuanței.

**Harta de mușchi** (Body Overview): `#F4564A` primar · `#F5A524` secundar ·
`#5FC98A` nelucrat · `#7FB2E5` neimplicat.

### Formă și spațiu

- Colțuri: carduri `18px` · butoane și câmpuri `12–14px` · chips și bare de progres `999px` · FAB cerc complet
- Gutter de pagină `14px`, padding în card `16–17px`, distanță între carduri `12–15px`
- Umbră de card discretă: `0 5px 18px rgba(16,24,40,.055)` — nu mai mult
- Lățime maximă `430px`, centrat

### Tipografie

Font de sistem. Titlu de ecran `1.15rem/700` · titlu de card `0.95rem/700` ·
text `0.85rem` · secundar `0.72–0.78rem` · numere mari (cronometru) `2.1rem` ·
etichete de coloană `0.62rem`, majuscule, `letter-spacing .06em`.

### Shell

- **Bottom nav cu 5 tab-uri**: Home · Body · Workout · Progress · Settings. Iconiță
  plus etichetă, tab-ul activ colorat coral.
- **Fără header global.** În mockup niciun ecran nu are o bară „Gym App" deasupra —
  fiecare ecran își poartă propriul titlu (Home începe direct cu salutul, celelalte
  au titlul centrat sau la stânga). Bara globală actuală trebuie scoasă.
- **Ecranul de sesiune activă iese din shell**: pe tot ecranul, fără header și fără
  bottom nav.

---

## Cele 9 ecrane

Ordinea e cea din mockup: stânga→dreapta, sus→jos.

### 1. Home — ✅ făcut

Salut „👋 Hey Roberto" + clopoțel. Card **Weekly Progress**: inel cu procentul,
lângă el Workouts `n / 5`, Volume, Duration. Card **Today's Workout**: numele,
`n exercises · durată`, buton coral „Start Workout". **Quick Actions**: grilă 2×2
de dale colorate (Log Workout, Exercises, Body Stats, Progress Photos).
**Recent Workouts**: „View all" în dreapta, rânduri cu iconiță, nume, dată,
volum și bifă verde dacă sesiunea e încheiată.

### 2. Sesiune activă — ✅ făcut

Header închis: `‹`, numele antrenamentului, `···`. Cronometru mare `HH:MM:SS` cu
„Elapsed Time". Bară de progres: `n of m exercises` la stânga, procent la dreapta.
Card alb cu exercițiul curent, tabelul de seturi (`SET` + o coloană per câmp
urmărit + bifă), rândul curent conturat coral. Sub tabel: `−` / „Add Set" / `+`.
Buton închis „Finish Exercise ›". Card „Next" cu exercițiul următor.

*Diferență acceptată:* mockup-ul are fotografia exercițiului și o diagramă mică de
mușchi. Noi avem un bloc cu iconiță + mușchii primari/secundari ca text. Pozele
reale sunt o decizie separată (vezi „Întrebări deschise").

### 3. Body Overview — ✅ făcut

Tab-uri **Muscles / Body Parts** (pill închis pe cel activ). **Silueta anatomică
față + spate**, cu grupele musculare colorate după cât au fost lucrate. Legendă cu
4 stări, toate răspunzând la aceeași întrebare — ce a făcut antrenamentul din
perioada selectată — deci toate se schimbă odată cu perioada:
**Primary** (l-ai lucrat ca mușchi principal) · **Secondary** (doar ca secundar) ·
**Untargeted** (i-ai lucrat zona, dar pe el nu) · **Not Involved** (nimic din ce ai
făcut n-a atins zona aia). Card **Muscle Focus** cu
selector de perioadă („This Week") și bare orizontale per grupă, cu numărul de
seturi la dreapta. Barele **nu** copiază culorile de pe siluetă (în mockup,
umerii sunt roșii pe corp dar bara „Shoulders" e galbenă) — sunt un gradient
după volum, de la grupa cea mai lucrată spre cea mai puțin lucrată.

*Făcut în etapa 2 și 2c.*

### 4. Workout Log — ✅ făcut

Header cu `‹` și titlu centrat. **Calendar lunar** cu navigare `‹ May 2025 ›`,
zilele pe rânduri Mon–Sun, zilele cu antrenament marcate (cerc plin pe ziua
selectată, cerc colorat pe zilele cu sesiune). Sub calendar, lista de sesiuni:
dată, nume, `n exercises · durată`, volum, bară colorată la stânga pe sesiunea
selectată.

*Făcut în etapa 3 (calendarul) și completat după: rândul poartă acum
`12 August 2026 | Legs | 6 exercises · 1h 10m` plus volumul, iar sesiunea
deschisă are bara colorată la stânga.*

### 5. Exercises — ✅ făcut

Titlu, **bară de căutare** cu lupă, buton de filtru la dreapta. **Chips** de
categorie (All, Chest, Back, Legs, Shoulders…) cu cel activ închis. Listă de
rânduri: thumbnail, nume, eticheta categoriei, **steluță de favorit**. **FAB**
coral rotund, jos-dreapta.

*Făcut în etapa 4. Diferență acceptată: thumbnail-ul e harta de mușchi, nu o
fotografie — vezi „Întrebări deschise", punctul 1.*

### 6. Detaliu exercițiu — ✅ făcut

Header închis cu `‹` și steluță. Zonă vizuală cu exercițiul. Grilă 2×2:
Category · Equipment · Primary Muscles · Secondary Muscles. Tab-uri
**Instructions / Muscles**, pași numerotați în cerculețe coral. Buton coral
„Add to Workout".

*Diferență acceptată:* fără fotografie (același punct ca la ecranul 2).

### 7. Body Stats — ✅ făcut

Tab-uri **Measurements / Composition / History**. Card **Key Measurements** cu data
sub titlu și rânduri: iconiță, nume, valoare + unitate, și **delta față de
măsurătoarea anterioară** (săgeată sus/jos, verde). Buton închis
„+ Add Measurements".

*Diferență acceptată:* cele trei tab-uri stau pe același rând cu „Overview" al
ecranului 3, nu într-un al doilea rând sub el — altfel drumul s-ar citi
„Body › Measurements › Measurements".

*Diferență acceptată:* delta nu e colorată în verde. Săgeata arată direcția, nu
dă un verdict: la talie scăderea e de obicei ținta, la braț creșterea, deci
verde-sus/roșu-jos ar face dintr-un centimetru pierdut în talie un eșec.

### 8. Progress Photos — ✅ făcut

Titlu + `+`. Chips **All Photos / Front / Side / Back**. Grilă de 3 coloane,
grupată pe dată, cu data sub fiecare grup.

*Data citibilă a fost rezolvată — se afișează „15 July 2026".*

### 9. Settings — ✅ cât se poate fără decizii

Card de profil: avatar, nume, **Level** și **bară de XP** (`2,450 / 5,000 XP`).
Secțiunea **Preferences**: Units (`kg, cm`), Workout Reminders (`On`),
Rest Timer (`60 sec`), Default Rest Time (`90 sec`) — fiecare rând cu iconiță,
valoare la dreapta și chevron. Secțiunea **Data**: Export Data, Import Data.
Secțiunea **About**.

*Făcut în etapa 6:* cardul de profil e editabil (nume + poză, sau inițialele
numelui cât timp nu e nicio poză), Units comută metric/imperial în toată
aplicația, iar Data are Export și Import.

*Diferență acceptată:* nu există **Level și bară de XP** (punctul 2 din
„Întrebări deschise") și nici **Rest Timer / Default Rest Time** (punctul 3).
Nu sunt afișate deloc, nici măcar gri: un „Level 1" fără sistem de puncte în
spate arată ca o funcționalitate, nu ca o decizie neluată. **Workout
Reminders** apare, marcat „Soon" (punctul 4).

*Diferență acceptată:* rândul „Appearance" a dispărut — aplicația e light-only
din etapa 0, deci „System default" spunea ceva neadevărat.

---

## Întrebări deschise

Lucruri din mockup pe care nu le putem face fără o decizie de proprietar:

1. **Fotografiile exercițiilor.** Mockup-ul are poze reale la fiecare exercițiu și
   o diagramă mică de mușchi. Variante: le încarci tu per exercițiu (ca la pozele
   de progres, în IndexedDB), sau punem un set de imagini în aplicație, sau
   rămânem cu iconiță + text. Momentan: iconiță + text.
2. **Level și XP.** Nu există niciun sistem de puncte în aplicație. Trebuie decis
   ce dă XP (o sesiune încheiată? volum? constanță?) înainte să afișăm un nivel.
3. **Rest Timer.** Apare în Settings, dar nu există un cronometru de pauză între
   seturi în ecranul de sesiune. E o funcționalitate, nu un setting.
4. **Notificări.** Clopoțelul din Home și „Workout Reminders" din Settings
   presupun notificări, care pe web înseamnă permisiuni de browser și service
   worker. Nu e început nimic.
