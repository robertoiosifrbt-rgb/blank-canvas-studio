# Roberto OS

Panou personal: finanțe, datorii, task-uri, obiceiuri, jurnal și obiective.

## Regula principală — codul stă în module

**Un fișier = o singură responsabilitate. Maxim 300 de linii.**

Când un fișier se apropie de limită, se sparge — nu se umflă. Un modul nou de
aplicație înseamnă un fișier nou, nu încă o secțiune într-unul existent.

Regula e verificată automat: `node scripts/check-modules.mjs` cade dacă un
fișier o încalcă, iar GitHub Actions rulează verificarea la fiecare push.
Nu e o convenție de bunăvoință.

## Structura

    index.html            doar scheletul + <script type="module">
    app/styles.css        tot CSS-ul
    app/state.js          starea. FĂRĂ importuri — altfel apar cicluri
    app/config.js         constante, icoane, monede, versiunea
    app/util.js           date, sume, escape, ajutoare mici
    app/cloud.js          vorbește cu state-api
    app/store.js          salvare, încărcare, moduri de stocare
    app/limits.js         limitele locului unde rulează
    app/modules.js        lista de module și elementele lor
    app/goals.js          calculele obiectivelor
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
