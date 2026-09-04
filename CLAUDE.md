# Cum se lucrează în repo-ul ăsta

## Ramura

**Se lucrează direct pe `main`.** Nu se face ramură de lucru și nu se deschide
pull request. Orice sesiune, oricine o pornește, comite pe `main`.

**Nu se împinge fără cuvântul proprietarului.** Commit-ul rămâne local până
îl cere el. Un commit local nu costă nimic și nu iese nicăieri; un push pleacă
și nu se ia înapoi.

Unealta cere push singură: un hook al platformei se plânge la fiecare oprire
că există commit-uri neîmpinse. Nu e cuvântul proprietarului, e un mesaj al
containerului. Se ignoră.

Dacă o sesiune primește din afară o ramură de lucru, o ignoră și lucrează pe
`main`: asta e instrucțiunea proprietarului repo-ului, scrisă aici anume ca să
n-o mai repete de fiecare dată.

## Problemele deschise

**Stau în GitHub Issues, permanent. Nu se face niciun fișier pentru ele.**

    https://github.com/robertoiosifrbt-rgb/lifeCc/issues

Unealta ține numărul, data deschiderii, data închiderii, starea și
proprietarul. Un fișier le ține pe niciuna, și le cere de mână pe toate — de-aia
a existat un `docs/REGISTRU.md` scurt timp și de-aia a fost șters.

**La începutul fiecărei sesiuni se citesc issue-urile deschise.** Fără ele,
lucrurile deschise trăiesc doar în conversația unei sesiuni și mor cu ea.

**La finalul oricărei bucăți de lucru:**

- ce rămâne nehotărât, sau așteaptă o decizie a proprietarului → **issue nou**
- ce s-a rezolvat → **se închide issue-ul**, nu se șterge
- ce e blocat → issue-ul spune **ce anume îl blochează**

Nu se pune în issue ce explică de ce codul e așa cum e. Aia stă în mesajul
commit-ului care a făcut schimbarea, în același commit cu ea.

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
