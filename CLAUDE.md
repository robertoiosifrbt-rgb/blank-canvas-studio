# Roberto OS

> **Se mută pe React.** Aplicația care rulează azi e cea din `app/`,
> scrisă fără build. Temelia noii versiuni stă în `os/` — React, TypeScript
> și Vite, pornită de la aplicația de sală, care intră astfel gata făcută.
> `os/` are propriile lui reguli, în `os/CLAUDE.md`; regulile de mai jos
> privesc `app/` cât timp acela e cel publicat.

Panou personal: finanțe, datorii, task-uri, obiceiuri, jurnal și obiective.

## Regula lui Roberto — cât mai simplu

**Se construiește numai ce există deja. Ce apare, se adaugă atunci.**

Când vine un model de altundeva — o schemă, o altă aplicație, o listă de
câmpuri — nu se copiază întreg. Se ia partea care are astăzi date în ea.
Restul se notează și se așteaptă.

Exemplu, ca să fie limpede: modulul de datorii a fost gândit după o schemă cu
douăsprezece tabele. S-au făcut șase. CCJ-uri, oferte de stingere, plăți
planificate una câte una și istoric de sold declarat au rămas afară — sunt
reale, dar Roberto n-are niciunul acum. Când primește primul CCJ, se face
atunci, cu datele lui adevărate în față.

Motivul nu e lenea. Un câmp gol pe care nu l-ai cerut e un câmp pe care îl
sari de fiecare dată când completezi ceva, și o decizie luată fără să știi
cum arată cazul real. Se ghicește mai prost înainte decât după.

Corolarul, valabil oriunde: **nu se adaugă nimic nesolicitat.** Nici un modul
pe lângă, nici un task pe lângă, nici un câmp „că poate o să trebuiască".
Dacă pare că mai trebuie ceva, se întreabă înainte, nu se livrează și se
explică după.

## Regula principală — codul stă în module

**Un fișier = o singură responsabilitate. Maxim 300 de linii.**

Se aplică la fel pentru `.js` și pentru `.css`.

Când un fișier se apropie de limită, se sparge — nu se umflă. Un modul nou de
aplicație înseamnă un fișier nou, nu încă o secțiune într-unul existent.

Regula e verificată automat: `node scripts/check-modules.mjs` cade dacă un
fișier o încalcă, iar GitHub Actions rulează verificarea la fiecare push.
Nu e o convenție de bunăvoință.

## Structura

    index.html            doar scheletul + <script type="module">
    app/css/*.css         CSS-ul, spart pe roluri
    app/state.js          starea. FĂRĂ importuri — altfel apar cicluri
    app/config.js         constante, icoane, monede, versiunea
    app/util.js           date, sume, escape, ajutoare mici
    app/cloud.js          vorbește cu state-api
    app/store.js          salvare, încărcare, moduri de stocare
    app/limits.js         limitele locului unde rulează
    app/modules.js        arborele de module și elementele lor
    app/goals.js          calculele obiectivelor
    app/calendar.js       aduna ce cade intr-o zi, din toate modulele
    app/ui.js             randare, navigare, bucăți de interfață
    app/modal.js          ferestre
    app/views/*.js        câte un ecran per fișier
    app/actions/*.js      acțiunile butoanelor, grupate pe domeniu
    app/actions.js        le adună într-o singură hartă
    app/app.js            pornirea și ascultătorii de evenimente

## Cum se adaugă un ecran nou

1. `app/views/nume.js` — exportă `viewNume(m)`, întoarce HTML
2. `app/actions/nume.js` — exportă `numeActions`, un obiect cu acțiuni
3. Îl legi în `app/ui.js` (harta `fns`) și în `app/actions.js`
4. Dacă e un modul vizibil, îl adaugi în `BUILTIN` din `app/config.js`

Modulele formează un arbore: orice modul are un `parent` opțional, pe
oricâte niveluri. Cele incluse stau la rădăcină. Firul de navigare și
lista de submodule se randează o singură dată, în `app/ui.js` — nu în
fiecare ecran.

## Reguli tehnice

- **Fără build, fără dependențe.** Module ES native. Vercel servește fișierele
  ca atare. Nu se adaugă npm, bundler sau framework.
- **Fără cod inline** în `index.html` — nici `<script>` cu conținut, nici `<style>`.
- **Nu atribui unei variabile importate** — importurile sunt doar-citire.
  Folosește un setter, ca `setCloseModal` din `app/modal.js`.
- **`app/state.js` nu importă nimic.** Orice import acolo creează un ciclu.
- Interfața e în română. Comentariile din cod, la fel.

## Stocare

Aplicația alege singură unde salvează, în ordine: baza de date a Artifact-ului
(când rulează acolo), altfel `state-api` — aceeași funcție Edge folosită de
celălalt proiect, autentificată cu `x-device-token`, fără cheie Supabase —
altfel `localStorage`.

Datele stau sub cheia `roberto-os-v1`. Fiecare salvare rescrie payload-ul
comun cu doar acea cheie schimbată, ca să nu atingă datele celeilalte aplicații.
