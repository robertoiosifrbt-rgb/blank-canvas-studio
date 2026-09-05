# Când aplicația nu mai merge

Scris pe 5 septembrie 2026, în ziua în care s-a întâmplat de două ori.

## Întâi: ce s-a schimbat ultima dată?

Aproape întotdeauna una din trei. Le verifici în ordinea asta, fiindcă asta e
ordinea în care costă.

**1. Ai rulat un SQL.** Cel mai probabil vinovat, și cel mai rapid de dovedit:
eroarea numește lucrul care lipsește. „Fetching the reserves" înseamnă că un
tabel pe care codul îl cere nu mai e acolo.
→ **Repararea nu e să dai baza înapoi.** E să pui la loc exact lucrul șters,
sau să livrezi codul care nu-l mai cere. Vezi [MIGRATII.md](MIGRATII.md).

**2. S-a livrat cod nou.** Vercel construiește din `main`. Dacă ecranele au
început să dea eroare fără să fi atins baza, codul cere ceva ce baza n-are.
→ Rulează migrația care lipsește.

**3. Nici una, nici alta.** Atunci e sincronizarea sau contul. Apasă butonul de
sincronizare din capul ecranului — el spune de ce a picat, nu doar că a picat.

## Ce NU se face

⛔ **Nu se șterge nimic din bază ca să „iasă din eroare".** Datele tale sunt
acolo; codul nu le găsește. Un `drop` pe panică pierde definitiv ce eroarea
doar ascundea.

⛔ **Nu se dă înapoi o migrație aplicată printr-o migrație nouă.** Evidența din
bază o are deja pe prima ca aplicată. Se rulează SQL de reparație, o dată, și
se scrie în [MIGRATII.md](MIGRATII.md) ce s-a rulat și de ce.

⛔ **Nu se atinge producția dintr-o sesiune.** Nu poate, și n-are voie. Tot ce
schimbă baza trece prin mâna proprietarului, din SQL Editor.

## Datele nu se pierd ușor

Ștergerea din interfață e o coloană `deleted_at`, nu un `delete`: rândul rămâne
în bază. Un item șters greșit se întoarce punând coloana aia pe `null`.

Exportul — „Download everything", în capul ecranului — scoate tot într-un
fișier pe telefonul tău. E singurul lucru din tot planul care nu depinde de
nimeni. Dacă ceva pare grav, apasă-l înainte să repari.
