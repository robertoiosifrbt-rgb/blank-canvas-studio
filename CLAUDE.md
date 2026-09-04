# Cum se lucrează în repo-ul ăsta

## Ramura

**Se lucrează direct pe `main`.** Nu se face ramură de lucru și nu se deschide
pull request. Orice sesiune, oricine o pornește, comite și împinge pe `main`.

Dacă o sesiune primește din afară o ramură de lucru, o ignoră și lucrează pe
`main`: asta e instrucțiunea proprietarului repo-ului, scrisă aici anume ca să
n-o mai repete de fiecare dată.

## Planul

[`docs/PLAN.md`](docs/PLAN.md) e planul complet, în ordine, și e sursa de
adevăr pentru ce se construiește și ce nu. Se urmează pas cu pas. Regulile
absolute și legile coloanei de acolo se aplică la fiecare schimbare.

Două dintre ele se încalcă cel mai ușor, deci merită repetate:

- **Se construiește numai ce există deja.** Nicio coloană, nicio valoare și
  niciun tabel „pentru viitor".
- **Nu se adaugă nimic nesolicitat.** Dacă pare că mai trebuie ceva, se
  întreabă înainte, nu se livrează și se explică după.

## Limba

**Codul e în engleză, tot.** Identificatori, comentarii, textele din interfață,
clasele CSS, numele de fișiere, mesajele de eroare, ieșirea scripturilor de
verificare, numele constrângerilor din SQL și mesajele de commit.

**Doar documentele rămân în română**: planul, README-ul și fișierul ăsta.

Regula e a proprietarului repo-ului și a înlocuit o linie din plan care cerea
interfața și comentariile în română. Nu se întoarce înapoi.

## Înainte de fiecare împingere

    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm run check:structure

Verificările care au nevoie de o bază (`check:rls`, `check:layout`) cer
Supabase local — vezi [README.md](README.md). **Nu ating niciodată producția.**

Verificarea nu se termină la teste: `typecheck` verifică tipurile, testele
verifică logica, și niciunul nu prinde un text sub bara de status. De-aia
există `check:layout`.
