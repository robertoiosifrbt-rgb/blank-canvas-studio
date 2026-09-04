# Life Control Centre — planul de construcție

Un Life OS. Un control centre pentru tot.

NU e un task manager, nu e un calendar, nu e o aplicație de finanțe, nu e un
habit tracker. Alea sunt module ale aceluiași sistem.

Se construiește de la zero. Nu se preia nimic.

## Ce cere un Life OS

Astea nu sunt funcții. Sunt condițiile în care sistemul e folosit, nu
abandonat.

**Să fie singurul loc.** Trebuie să înghită și lucrurile murdare: o scrisoare,
un telefon de dat, o factură care vine peste trei zile.

**Să fie de încredere.** Ăsta e produsul, nu o funcție. Dacă pierde datele o
dată, nu se mai pune nimic în el.

**Să scrii în ea în două secunde.** Dacă durează mai mult, nu scrii.

**Să spună ce să faci acum.** Adunatul e partea ușoară. Valoarea e când
sistemul zice „azi: asta". Altfel e un dosar, nu un OS.

**Să lege lucrurile între ele.** O datorie e o firmă, o scrisoare, o plată, o
dată, un obiectiv. Dacă stau în cinci liste separate, legătura o face omul în
cap.

**Să meargă pe telefon, cu o mână.**

**Să supraviețuiască ignorării.** Te întorci după două săptămâni și nu te
pedepsește cu un perete roșu.

**Să-ți dea datele înapoi când vrei.** Un buton de export, un fișier pe
telefonul tău. Singurul lucru din tot planul care nu depinde de nimeni.

## Reguli absolute

Un singur loc pentru date, o singură cale către el. Nicio a doua aplicație,
niciun al doilea format, nicio a doua cale de scriere.

Un răspuns parțial nu e niciodată tratat ca adevăr întreg.

Logica unui lucru se scrie o singură dată, într-un singur loc.

Nu se construiesc tabele, coloane sau valori pentru viitor.

Sync-ul nu se construiește de două ori. Cache-ul local e pasul 4. Outbox,
drafturi persistate și rezolvare de conflicte sunt pasul 7.

Ce poate garanta baza nu se verifică în JavaScript.

Configurația nu se scrie în cod.

Nicio constrângere care te împinge să minți baza. O dată falsă pusă ca să
treci o validare strică ecranul Azi în silence — și Azi e motivul pentru care
există sistemul.

Niciun flux fără ieșire. Nu se produce niciodată un rând care nu se mai
găsește nicăieri.

Nicio promisiune pe care arhitectura nu o susține. Dacă nu persistăm local, nu
spunem „nu se pierde".

Nicio verificare care primește o listă de foldere. Verificatoarele pornesc de
la rădăcina codului și văd tot. O regulă impusă pe un subset e o regulă care
trece verde fără să verifice nimic.

## Planul, în ordine

Regula de ordine: nu se construiește infrastructură care nu e necesară
primelor ecrane. Legile coloanei se scriu de la început; tabelele lor apar la
primul caz real.

Se lucrează direct pe `main`. Nu există încă nimic de protejat, deci o ramură
de lucru ar fi infrastructură pentru un risc care nu există. Când o să existe
ceva ce nu vrei să se strice, atunci se pune ramura.

### 1. Scheletul

React + TypeScript + Vite.

- Routing adevărat. URL pentru fiecare ecran.
- SPA fallback în `vercel.json`: fișierele reale se servesc ca atare, restul
  merge la `index.html`. Fără el, o rută accesată direct sau reîncărcată dă
  404, chiar dacă navigarea în aplicație merge perfect.
  **Test manual obligatoriu:** intri direct pe `/azi` și `/calendar`, dai
  refresh, rămâi pe acel ecran.
- Mobile-first, cu marginile de siguranță respectate — bara de status a
  telefonului nu stă peste text.
- Error boundary cu reset.
- Structură pe module.
- Fără service worker. Vine la pasul 7.

Configurația, din variabile de mediu:

    VITE_SUPABASE_URL
    VITE_SUPABASE_PUBLISHABLE_KEY

În Vercel și în `.env.local`. Nu pentru secretizare — cheia publishable e
publică oricum — ci ca dev și producție să nu fie hardcodate.

### 2. Regulile impuse, în prima oră

Nu la sfârșit. Dacă nu sunt impuse din prima zi, nu există.

Linterul e **ESLint cu typescript-eslint**. Alegerea nu e „că e standard" — e
pentru că legea 4 devine o regulă de lint:

    no-restricted-imports: clientul Supabase e interzis oriunde
    în afară de src/repository/

Cea mai importantă lege arhitecturală trece din text în CI. Un linter mai
rapid care n-o poate impune valorează mai puțin.

Dimensiunea și structura fișierelor:

- La `.ts` și `.tsx`: **300 de linii**, un fișier, o responsabilitate.
- La `.css`, regulă structurală exactă: din `main.tsx` se pot importa NUMAI
  `src/styles/tokens.css` și `src/styles/reset.css`. Orice alt `.css` trebuie
  importat de exact un `.tsx` din același director. Fără limită numerică — la
  CSS numărul de linii e un proxy prost pentru responsabilitate, iar spartul
  după linii produce fragmente cu ordine de import care contează.

**Verificatorul parcurge tot ce e sub `src/`, recursiv, și NU primește
niciodată o listă de foldere.** Dacă apare un folder nou, e acoperit automat.
Un verificator care numește foldere devine, la prima mutare de cod, o
verificare verde care nu verifică nimic.

Comenzile:

    lint        eslint .
    typecheck   tsc --noEmit
    test        vitest run
    build       tsc -b && vite build

Vite nu verifică tipurile singur. De-aia `build` conține `tsc`, iar
`typecheck` rămâne comandă separată.

CI: lint → typecheck → teste → build → verificările de structură.

**CI și orice deployment care nu e producție nu ating niciodată baza de
producție.** Vercel dă Preview deployments variabile proprii; dacă un Preview
primește URL-ul de producție, cod neterminat scrie în datele reale. Testele
rulează pe Supabase local, efemer.

Testul de RLS, în CI, pe baza locală. E partea cea mai periculoasă din schemă
și singura ale cărei greșeli nu se văd ca un ecran urât, ci ca datele tale
citite de altcineva.

Negative:

    neautentificat (anon)  → nu poate citi și nu poate scrie nimic
    A citește rândurile B  → zero rânduri
    A inserează owner = B  → refuzat
    A mută un rând către B → refuzat
    A face DELETE fizic    → refuzat
    A scrie id sau version → refuzat

Pozitive, fără care cele de sus pot fi verzi și degeaba — dacă A nu poate face
nimic deloc, toate negativele trec:

    A își inserează propriul rând     → reușește
    A își citește propriul rând       → îl vede
    A își modifică propriul rând      → reușește
    A face soft-delete pe al lui      → reușește

**Verificarea așezării, în CI**, nu „când îmi amintesc": un script pornește
aplicația la lățime de telefon și cade dacă un element iese din ecran, dacă un
text stă sub bara de status, sau dacă o zonă apăsabilă e mai mică de 44 de
pixeli.

### 3. Autentificare și coloana, în bază

Supabase Auth, email și parolă. Datele vin după cont, pe orice telefon.

Un tabel:

```sql
create table public.items (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id),
  kind       text check (kind in ('task','letter')),
  state      text not null default 'inbox'
             check (state in ('inbox','active','done')),
  title      text not null,
  due        date,
  done_at    date,
  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (state =  'inbox' and kind is null)
    or
    (state <> 'inbox' and kind is not null)
  ),
  check (btrim(title) <> '')
);
```

`kind` e nullable, intenționat. Un lucru capturat nu e „de tip captură" — e
ceva despre care încă nu știi ce e. Un `kind='capture'` ar scrie același fapt
în două coloane, iar două coloane care spun un lucru se pot contrazice.
Marcajul lucrului neprocesat e o singură coloană: `state='inbox'`.

Constrângerea merge **în ambele sensuri**. Nu doar „nu ieși din inbox fără
kind", ci și „în inbox nu există kind" — altfel starea și felul se pot
contrazice.

`kind` are doar `task` și `letter`. `note` și `goal` nu sunt în schemă, pentru
că la pasul 5 nu pot fi create — n-au ecran în care să fie regăsite. Intră cu
ecranul lor.

Fără `body`. Nimic nu-l scrie azi.
Fără `parent_id`. Ierarhia nu e cerută de primele ecrane.
Fără valoarea `dropped`. Nimic n-o folosește.

`due` e dată, nu dată-și-oră. Ora se adaugă la prima nevoie reală.

`done_at` e ziua în care ai făcut lucrul, pusă de repository din data locală
când `state` devine `done`. Nu e câmp pentru viitor: e cerut în clipa în care
`done` există. Rezolvă două lucruri deodată — un task fără dată terminat nu
mai dispare din toate ecranele, și „Calendarul arată ce ai făcut" devine
adevărat. `due` e ce ai planificat, `done_at` e ce s-a întâmplat. Un task due
luni, terminat miercuri, apare la ambele.

**Nu există constrângerea „un task activ trebuie să aibă dată".** Multe
task-uri reale n-au dată. O astfel de regulă te împinge să pui „mâine" ca să
treci validarea; mâine apare în Azi, nu-l faci, îl muți, iar în două săptămâni
Azi are douăzeci de rânduri amânate și nu te mai uiți la el.

#### Granturi și RLS, tratate împreună

Privilegiile implicite nu se presupun. Și UPDATE se dă pe coloane, nu pe
tabel:

```sql
revoke all on table public.items from anon, authenticated;

grant select, insert on table public.items to authenticated;
grant update (kind, state, title, due, done_at, deleted_at)
  on table public.items to authenticated;

alter table public.items enable row level security;

create policy items_select on public.items for select to authenticated
  using (owner = auth.uid());

create policy items_insert on public.items for insert to authenticated
  with check (owner = auth.uid());

create policy items_update on public.items for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
```

Granturile pe coloane fac `id`, `owner`, `version`, `created_at` și
`updated_at` **imposibil de scris de client** — nu doar suprascrise de
trigger. Identitatea e imuabilă în bază, iar asta contează pentru că `id`
devine ancora tuturor modulelor de mai târziu.

Nici `anon`, nici `authenticated` nu primesc DELETE, și nu există politică de
DELETE. Ștergerea din interfață e un UPDATE care pune `deleted_at = now()`.
Altfel granturile ar anula tot rostul soft-delete-ului.

`owner default auth.uid()` doar simplifică inserturile — se aplică numai dacă
clientul nu trimite coloana. Ce îl oprește e politica. La UPDATE: `USING`
stabilește ce rând existent ai voie să atingi; `WITH CHECK` validează cum are
voie să arate rândul după UPDATE, deci el împiedică mutarea către alt owner.

#### Triggerul

Cu `create trigger` scris efectiv — altfel funcția există și nu rulează
niciodată:

```sql
create function public.stamp() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    new.version    := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    new.id         := old.id;
    new.owner      := old.owner;
    new.version    := old.version + 1;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$ language plpgsql;

create trigger items_stamp
  before insert or update on public.items
  for each row execute function public.stamp();
```

Ceasul unui telefon poate minți, și un client poate trimite orice versiune.
Niciuna nu ajunge în tabel.

Migrațiile stau în repo.

### Legile coloanei

Scrise acum, tabelele lor vin la primul caz real. Astea nu sunt tabele, sunt
reguli. O lege nu are nevoie de tabel ca să oblige.

1. Orice obiect important dintr-un modul care are viață primește un
   **item-ancoră** în `items`.
2. Legăturile sunt întotdeauna item ↔ item. Niciodată modul ↔ modul.
3. Tabelele cu cifre — o tură are ore, câștiguri, kilometri — sunt **extensii
   ale itemului**, nu lumi separate: au `item_id` către ancora lor.
4. Niciun ecran nu vorbește direct cu Supabase. Impusă de ESLint, nu de
   bunăvoință.
5. Orice tabel client-editabil introdus înainte de pasul 7 își declară
   strategia de sincronizare la momentul creării. Fără legea asta, pasul 7 ar
   obliga remodelarea modulelor construite la 6.
6. Nu se oferă niciodată o alegere care produce un rând fără loc în care să
   fie regăsit.

`areas` apare la prima arie adevărată. `links` apare la primul modul care
leagă efectiv ceva, cu `check` pe `kind` scris din valorile reale. Amândouă
aduc cu ele `unique (id, owner)` pe `items` și cheile străine compuse către
`(id, owner)` — mecanismul care face imposibilă structural o legătură între
rândurile a doi utilizatori.

### 4. Stratul de date, unul singur

    UI → repository → Supabase

Ecranele nu văd Supabase niciodată. Cer și primesc.

#### Snapshot, nu cache pe query

Cache-ul e un snapshot complet al rândurilor `items` ale utilizatorului, în
IndexedDB, sub `namespace = auth.uid()`. Nu se citește niciodată fără user-ul
autentificat curent — altfel logout din A și login în B arată, măcar o clipă,
datele lui A.

**Prima intrare cu cont — snapshot complet:**

- se aduc toate rândurile, **inclusiv cele cu `deleted_at`**. De-aia le ținem.
- **paginat cu `range()`**, în bucle de 1000. Supabase întoarce implicit
  maximum 1000 de rânduri per request, deci „se aduc toate" fără paginare
  devine fals la al 1001-lea item.
- doar un snapshot complet și reușit **înlocuiește** cache-ul.

**Fiecare deschidere ulterioară — delta:**

- se cere `updated_at >= last_sync`, inclusiv, paginat la fel.
- `last_sync` e per `auth.uid()` și e un timestamp venit de la server,
  niciodată de la ceasul telefonului.
- **delta face upsert rând cu rând. NU înlocuiește nimic.**
- **un delta gol înseamnă „nimic nu s-a schimbat". NU „golește cache-ul".**

Asta e regula cea mai importantă din tot planul. Un delta cu două rânduri care
ar înlocui snapshot-ul șterge tot restul din cache — un răspuns parțial crezut
ca adevăr întreg.

Cursorul e inclusiv, nu deștept: pentru că upsert-ul e idempotent, un rând
adus de două ori nu strică nimic. Așa dispare problema a două modificări cu
același `updated_at`, fără cursor compus.

Un fetch eșuat sau neinițializat **nu atinge** cache-ul. Un snapshot complet
reușit îl înlocuiește **chiar dacă e gol** — golul poate fi legitim, ai șters
ultimul item. Testul se scrie pe trei cazuri distincte: **eroare**, **snapshot
gol valid**, **delta gol**. Nu pe „gol = rău".

Azi și Calendarul sunt filtre peste snapshot, într-o singură funcție de
repository. Regula „nu se filtrează în JavaScript" rămâne respectată: ce
interzicea ea era logica împrăștiată prin ecrane, nu locul unde rulează. Și
așa un item mutat pe săptămâna viitoare nu iese din snapshot, iese doar din
rezultatul Azi — „nu mai e în Azi" nu se poate confunda cu „nu mai există".

#### Scrierea

- Pe rând, nu rescriere de tot.

- Repository-ul trimite un **patch** — doar câmpurile schimbate. Altfel
  telefonul care schimbă `due` ar scrie peste `title` schimbat pe laptop.

- Verificare de versiune atomică, într-un singur UPDATE condiționat:

      update items set <patch>
      where id = :id and owner = auth.uid() and version = :version

  Nu „citesc 4, verific în JavaScript, scriu 5" — două device-uri pot trece
  verificarea în același timp.

- Zero rânduri afectate: se recitește rândul și se reaplică **același patch**
  peste versiunea nouă. O singură dată.

- Dacă și al doilea UPDATE dă zero rânduri: se oprește. Patch-ul rămâne pe
  ecran, vizibil nesalvat, până îl reîncerci. **Dacă închizi aplicația, pierzi
  acea editare.** Nu se persistă local — un draft persistat e outbox, iar
  outbox la pasul 4 e sync-ul construit de două ori. Promisiunea mai mică e
  cea adevărată.

- Ștergerea e un UPDATE pe `deleted_at`. Clientul n-are DELETE.

- **Data de azi vine din aplicație**, nu din bază. `current_date` depinde de
  timezone-ul sesiunii PostgreSQL.

- Filtrul `deleted_at is null`, într-un singur loc.

- Indicatorul de sincronizare spune adevărul — nu „sincronizat" când nu e.

#### Exportul

O funcție de repository și un buton: **„Descarcă tot"**. Scrie snapshot-ul
întreg într-un fișier, pe telefonul tău. E singurul lucru din plan care îți dă
control care nu depinde de nimeni.

### 5. Export, Captura, Azi, Calendar și ciclul complet

Primul lucru care ține date adevărate. **Exportul se construiește primul**, ca
de la al doilea rând scris să ai deja cum să-ți iei datele.

#### Captura

Un buton mare, scrii un rând, salvezi. Scrie doar titlul, cu `state='inbox'`
și `kind=null`. Fără dată, fără întrebări.

Criteriu de acceptanță, verificat manual, nu în Vitest — timpul de tastare e
al omului: input focalizat la deschidere, un singur gest pentru salvare,
niciun formular intermediar.

#### Azi

    deleted_at is null
    and ( state = 'inbox'
       or (state = 'active' and (due is null or due <= :localToday)) )

Patru grupuri:

    Inbox        state = 'inbox'
    Azi          state = 'active' and due = :localToday
    Restanțe     state = 'active' and due < :localToday
    Fără dată    state = 'active' and due is null

OR-ul pe `state` e obligatoriu: Captura creează un item fără `due`, iar
`null <= :localToday` e fals — fără el, scrii „sun la X" și nu apare nicăieri.

OR-ul pe `due is null` e la fel de obligatoriu: procesezi „să cumpăr
bormașină" ca task fără dată, iese din inbox, devine `active` — și fără el ar
dispărea. O acțiune corectă nu are voie să facă un lucru să se evapore.

Colapsarea, cu numere în loc de interpretare:

- Restanțele din **ultimele 7 zile** stau desfășurate. Un task scadent ieri
  trebuie să-l vezi.
- Restanțele mai vechi de 7 zile se colapsează: „12 restanțe, cea mai veche
  din 20 august".
- Grupul **Fără dată** e colapsat mereu, ordonat pe `created_at`, cu
  `created_at`-ul celui mai vechi în cap — nu `due`, care nu există: „14
  lucruri, cel mai vechi din 12 august".

Nu e un perete roșu, dar nici nu ascunde o scadență care contează.

#### Foaia de item — ciclul complet, într-un singur loc

Tap pe orice item, din Azi sau din Calendar, deschide aceeași foaie. Nu un
ecran nou. În ea:

    dintr-un item de inbox   → alegi kind (task sau letter), pui o dată dacă
                               are, iese din inbox și devine active
    dintr-un item activ      → bifezi done (repository pune done_at =
                               :localToday), schimbi data, corectezi titlul,
                               îl ștergi (soft)
    dintr-un item done       → îl redeschizi (done_at se șterge)

Fără foaia asta, `done` ar exista în bază fără nicio cale definită care să-l
producă, și un item procesat n-ar mai putea fi corectat niciodată.

#### Calendar

Grupat pe zile. Fără tabel nou.

    planificat   due
    făcut        done_at, bifat

Un task due luni și terminat miercuri apare la ambele. Un task fără dată,
terminat, apare miercuri — de-aia `done_at` există, ca nimic terminat să nu
dispară din toate ecranele.

#### La finalul pasului

Scrii „sun la X" pe telefon. Apare în Inbox. Îl procesezi ca task cu data de
mâine. Apare în Calendar pe mâine. Îl bifezi. Apare ca făcut în ziua în care
l-ai bifat. Apeși „Descarcă tot" și îl vezi în fișier. Deschizi laptopul — e
acolo. Dai refresh — e acolo. De trei ori din trei.

### 6. Modulele, unul câte unul

Se alege o singură parte din viață, cu date adevărate azi, și se leagă de
coloană după legile de mai sus. Se termină, se folosește, apoi următoarea.

Tabelul de domeniu se creează odată cu modulul, nu înainte, și își declară
strategia de sync la creare (legea 5).

`note` și `goal` intră ca valori de `kind` atunci când apare ecranul în care
pot fi regăsite, și atunci se decide și starea lor.

### 7. Offline adevărat

Abia aici: scrieri fără internet, outbox, drafturi persistate, retry,
rezolvarea conflictelor cu interfață, service worker și ciclul lui de update.

`items` nu se remodelează — `version`, `updated_at`, `deleted_at` și `done_at`
sunt în bază de la pasul 3. Tabelele adăugate la 6 nici ele, pentru că legea 5
le-a obligat să declare strategia atunci.

## Ce nu se adaugă

Nici event sourcing, nici audit log, nici framework de sync, nici tabele
„pentru viitor". Fundația e un tabel și șase legi.

Planul **nu construiește istorie**. `version=17` nu păstrează versiunile 1-16,
și `deleted_at` ține ștergerile, nu editările. Dacă istoria devine o nevoie
reală, e o discuție separată — nu ceva ce planul promite pe ascuns.

## Regulile de lucru

Se construiește numai ce există deja. Se ia partea care are astăzi date în ea.
Restul se notează și se așteaptă.

Nu se adaugă nimic nesolicitat. Dacă pare că mai trebuie ceva, se întreabă
înainte, nu se livrează și se explică după.

Verificarea nu se termină la teste. `typecheck` verifică tipurile, testele
verifică logica. Niciunul nu prinde un titlu de culoarea fundalului, o
fereastră cu titlul sub câmpuri, sau bara de status peste text. De-aia
verificarea așezării e un script în CI, nu o intenție.

Codul în engleză, tot: identificatori, comentarii, interfață, clase CSS,
mesaje de commit. Doar documentele rămân în română — planul ăsta, README-ul
și CLAUDE.md.

## Ce se impune singur și ce depinde de disciplină

**Impus de mașină** — dacă e încălcat, ceva se face roșu:

    300 de linii, convenția CSS, tipurile, testele, build-ul
    RLS-ul, cu negative ȘI pozitive
    așezarea la lățime de telefon
    legea 4, prin ESLint
    DELETE fizic, refuzat de granturi
    id, owner, version, created_at, updated_at — imposibil de scris de client
    titlu gol, refuzat de check
    state și kind contradictorii, refuzate de check

**Depinde de disciplină** — aici un document nu se impune singur:

    „se construiește numai ce există"
    „nu se adaugă nimic nesolicitat"
    legile 1, 2, 3, 5 și 6 ale coloanei

Pe partea asta nu există garanție scrisă. Singura dovadă e că vezi lucrul
înainte să-l folosești, la fiecare pas.

## Starea de plecare

- Repo gol, zero fișiere în afară de documentul ăsta.
- Baza Supabase golită. Nimic de migrat.
- Conexiunea Vercel ↔ repo există; îi lipsește configurația de build.
- Se pornește curat, fără datorii tehnice și fără date de salvat.
