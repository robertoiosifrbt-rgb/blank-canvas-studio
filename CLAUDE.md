# Roberto OS

Panou personal: finanțe, datorii, task-uri, obiceiuri, jurnal și obiective,
plus modulul de sală.

> **Aplicația e în `os/`** — React, TypeScript și Vite. Acolo se lucrează, și
> acolo stau regulile de zi cu zi: citește **`os/CLAUDE.md`**. Fișierul de aici
> ține doar regulile care privesc întreg repo-ul.

Repo-ul are exact două lucruri:

    os/         aplicația. Vercel publică numai asta
                (vercel.json: `cd os && npm run build`, ieșirea în `os/dist`)
    supabase/   funcțiile Edge (state-api, photo-api, push-api) și migrațiile
                pe care aplicația le folosește

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

## Verificarea nu se termină la teste

`npm test` verifică logica, `npm run build` verifică tipurile. Niciunul n-a
prins vreodată un titlu de culoarea fundalului, o fereastră cu titlul sub
câmpuri, sau un element ieșit din ecran — alea s-au văzut pe telefonul lui
Roberto, adică prea târziu, și de fiecare dată l-au costat o rundă.

Așezarea se măsoară într-un browser adevărat, la dimensiunea unui telefon:

    cd os
    npm run build
    npm install --no-save playwright
    node scripts/layout-check.mjs

Scriptul nu judecă frumusețea. Prinde ce face un ecran inutilizabil. Se
extinde cu fiecare astfel de greșeală găsită: dacă ceva a scăpat până pe
telefon, întâi se adaugă verificarea care l-ar fi prins, apoi se repară.

## Codul stă în module

**Un fișier = o singură responsabilitate. Maxim 300 de linii.**

Se aplică la fel pentru cod și pentru CSS. Când un fișier se apropie de
limită, se sparge — nu se umflă. Un modul nou de aplicație înseamnă un fișier
nou, nu încă o secțiune într-unul existent. Convenția pentru module noi în
`os/` stă în `os/docs/ARCHITECTURE.md`.

Regula n-are astăzi verificare automată: scriptul care o impunea măsura vechea
aplicație și a plecat cu ea.

## Limba

Interfața e în română. Comentariile din cod, la fel.
