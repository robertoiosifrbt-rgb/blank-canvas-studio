# Jurnalul de lucru

Ce nu se poate afla din `git log`, pe zile.

O sesiune pornește cu repo-ul clonat de la zero și cu zero amintiri. Ce nu e
scris, nu s-a întâmplat.

## Cât costă, și de ce e mărginit

**Se citește ultima intrare, nu fișierul.** Un jurnal citit întreg la fiecare
pornire se scumpește cu fiecare zi de lucru, la nesfârșit — cu cât proiectul
merge mai bine, cu atât costă mai mult să-l pornești. O intrare are zece
rânduri și atâta rămâne, și peste doi ani.

**Nu se scrie ce e deja în `git log`.** Ce s-a construit, în ce ordine, cu ce
commit — alea se citesc de acolo, sunt mai exacte și nu costă nimic până le
ceri. Rămâne ce nu lasă urmă: ce s-a încercat și s-a abandonat, ce s-a crezut
și s-a dovedit fals, de ce s-a ales un drum și nu altul.

**Nu ține starea problemelor deschise** — alea sunt în GitHub Issues,
permanent. **Nu ține explicații de cod** — alea sunt în mesajul commit-ului.
**Nu ține teste** — alea sunt în [TESTE.md](TESTE.md).

O intrare scrisă nu se mai modifică. Ce s-a schimbat se scrie în următoarea.

---

## 4 septembrie 2026

*Reconstituită din git și din issues. Ce a crezut sesiunea și n-a scris, s-a
pierdut — ăsta e chiar argumentul pentru fișierul de față.*

Ziua întâi, de la planul din `docs/PLAN.md`.

Ce nu se vede din `git log`: `docs/REGISTRU.md` a fost adăugat și șters în
aceeași zi. A picat pentru că un fișier nu ține numărul, data și starea unei
probleme, le cere pe toate de mână și rămâne în urmă. Întrebările deschise au
plecat în GitHub Issues și acolo au rămas.

Tot atunci s-a hotărât că un push așteaptă cuvântul proprietarului, și că baza
de cod e în engleză — regula asta a înlocuit o linie din plan care cerea
interfața în română, și nu se întoarce înapoi.

## 5 septembrie 2026

*Reconstituită, ca cea de sus.*

Ziua a doua: dimineața reparațiile din cele două audituri, după-amiaza ariile,
turele, rezervele și cheltuielile.

Ce nu se vede din `git log`: cheltuielile au fost gândite întâi ca ceva ce
consumă o tură, și s-a dovedit greșit. Plinul de la pompă e cheltuiala,
kilometrii sunt consumul ei; numărate amândouă, aceiași bani ies de două ori
din socoteală, iar a doua oară arată ca o economie. De-aia o tură *raportează*
consum, nu *cheltuiește*.

Cele cinci migrații ale zilei n-au fost aplicate pe baza live (#46).

## 5 septembrie 2026, sesiunea a doua

Prima care n-a scris cod.

**Clona era trunchiată** — sesiunea vedea 50 de commit-uri, pe GitHub erau 343,
iar codul de dinainte de golire era tot acolo. La cererea proprietarului
istoricul a fost rescris local: 61 de commit-uri, primul fiind golirea.
Rescrierea a șters semnătura de pe toate 61. Nu s-a împins nimic.

**Sesiunea a repetat afirmația unui issue ca fapt** — „baza avea migrații din
august" — deși `CLAUDE.md` o dă drept exemplu de greșeală, pe nume. Corectarea
era deja scrisă, într-un comentariu pe #37, necitit pentru că se citise doar
corpul. **Un issue închis își poate ține corectarea în comentarii, iar corpul
rămâne greșit.**

**Prima formă a jurnalului ăstuia era greșită în două feluri**, semnalate de
proprietar: repovestea ce e deja în `git log`, și cerea să fie citit întreg la
fiecare pornire — adică se scumpea singur, la nesfârșit. Ambele reparate
înainte să apuce să coste ceva.
