# Testele care se fac de mână

Ce nu poate face nicio verificare automată, și de ce.

**Documentul ăsta ține testele, nu starea lor.** Aici scrie ce se verifică și
cum. Dacă a fost trecut, când, și pe ce commit — aia stă în issues, unde
unealta ține data și starea. Un fișier nu le poate ține, și de-aia a fost șters
`docs/REGISTRU.md`.

Un test e o definiție. Nu se strică în timp, deci fișierul nu poate rămâne în
urmă.

**ID-urile.** O singură serie, `T-01` în sus. Se dă o dată, nu se schimbă
niciodată, nu se refolosește. Nu spune în ce grupă stă testul, pentru că un
test mutat între grupe și-ar pierde numele — iar un identificator care se
schimbă nu e identificator.

**Următorul liber: `T-13`.**

**Cine le face.** Proprietarul. Nicio sesiune nu poate: n-are telefon, iar
rețeaua ei nu ajunge la adresa de producție — s-a încercat, toate rutele au
răspuns nimic.

## Pe iPhone, în Safari

Nu în simulator. Verificatoarele din CI rulează pe WebKit de Linux: ăla e
motorul lui Safari, nu Safari, și nu știe nimic despre iOS.

### T-01 — intrarea în cont

Deschizi aplicația în Safari, la adresa de producție, și intri cu email și
parolă.

### T-02 — ciclul unui item, cu degetul

Faci un item, îl modifici, îl bifezi, îl redeschizi și îl ștergi. Toate din
foaia de item.

### T-03 — datele supraviețuiesc închiderii

Închizi Safari de tot — nu doar tabul — și te întorci. Datele sunt acolo.

Verifică IndexedDB pe motorul adevărat, adică tot cache-ul.

### T-04 — revenirea din fundal, și ziua de azi

Lași aplicația în fundal și revii. Datele sunt acolo, **și ziua e cea de azi**.
Dacă revii a doua zi, Azi arată ziua nouă și Calendarul mută marcajul.

Ziua se schimbă acum dintr-un temporizator și din revenirea în prim-plan.
Niciuna nu poate fi verificată de un test aici.

### T-05 — descărcarea ajunge pe telefon

Apeși „Descarcă tot" și fișierul chiar ajunge undeva de unde îl poți deschide.

Pe iOS descărcarea unui Blob e alt drum decât pe desktop. E singurul lucru din
plan care nu depinde de nimeni, deci merită văzut cu ochii.

### T-06 — selectorul de dată

Deschizi un item din Inbox și pui o dată. Selectorul nativ se deschide, se
alege, se închide, iar data ajunge în câmp.

### T-07 — crestătura, tastatura și foile

Te uiți: crestătura nu stă peste text, tastatura nu acoperă butonul de salvare
când scrii, foile se închid cu gestul și cu butonul.

Verificatorul de așezare simulează crestătura. Un telefon adevărat o are, și
are și tastatură.

## Pe Vercel

### T-08 — `/today` deschis direct

Pui adresa în bară, nu navighezi prin aplicație. Dai refresh. Rămâi pe ecran,
fără 404.

Fără `rewrites` din `vercel.json`, o rută deschisă direct dă 404 chiar dacă
navigarea în aplicație merge perfect — și afli când dai cuiva un link. Regula
de rescriere e a Vercel-ului și se verifică doar acolo.

### T-09 — `/calendar` deschis direct

La fel ca `T-08`, pe Calendar.

### T-10 — operații reale, apoi refresh

Faci câteva lucruri adevărate pe deployment-ul de producție, dai refresh, și
sunt tot acolo.

## Ce numai un om poate spune

### T-11 — contul, pe două dispozitive

Faci contul pe telefon, intri cu el pe laptop. Datele sunt acolo.

„Datele vin după cont, pe orice telefon" e o promisiune care se verifică doar
așa.

### T-12 — timpul de scriere la Captură

Deschizi Captura și scrii o linie. Criteriul din plan e al omului, nu al unui
test: câmpul e focalizat la deschidere, salvarea e un singur gest, și nu există
formular intermediar.

Dacă durează mai mult de două secunde, nu scrii. Se verifică cu degetul.
