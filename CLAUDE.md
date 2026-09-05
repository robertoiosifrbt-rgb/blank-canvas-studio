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

## Ce s-a greșit deja, și nu se mai repetă

Trei lucruri au fost făcute prost pe 5 septembrie. Sunt scrise aici pentru că
niciunul nu se prinde din teste.

**Un refuz nu e o aprobare, iar tăcerea nu e nici atât.** Regula de mai sus
cere cuvântul proprietarului înainte de push. Cuvântul înseamnă cuvântul: un
„nu", o întrebare lăsată fără răspuns, sau o cerere veche care pare să-l
implice nu țin loc de el. Dacă a zis nu și tot pare că trebuie împins, se
spune de ce și se așteaptă.

**Un issue nu e un fapt, e ce a crezut o sesiune.** Se citește ca o pistă, nu
ca o dovadă. Înainte să fie repetat ca adevăr, se verifică — iar dacă
contrazice planul, planul câștigă. Un issue a susținut zile la rând că baza
avea migrații din august, deși planul scrie la „Starea de plecare" că baza a
fost golită la pornire. Contradicția era vizibilă de la prima citire.

**Codul de dinainte de golire nu se citește.** Commitul `1d1e07f` a golit
repo-ul intenționat. Ce e înaintea lui nu e o sursă: nici pentru forma unui
tabel, nici pentru ce coloane trebuie să aibă un modul, nici pentru „cum se
făcea înainte". Se construiește numai ce există azi, iar ce conține un lucru
se află de la proprietar, nu dintr-o schemă pe care a aruncat-o.

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

## Jurnalul

[`docs/JURNAL.md`](docs/JURNAL.md) ține ce a făcut fiecare zi de lucru, în
ordine, cu commit-urile ei.

**La începutul sesiunii se citește ultima intrare. Una singură, nu fișierul.**
Fișierul crește la nesfârșit; o intrare are zece rânduri și atâta rămâne, și
peste doi ani. Restul se citește doar dacă lucrul de azi îl cere.

**O intrare ține numai ce nu se poate afla altfel.** Ce s-a construit e în
`git log`, care e mai exact și nu costă nimic până îl ceri. În jurnal intră ce
nu lasă urmă nicăieri: ce s-a încercat și s-a abandonat, ce s-a crezut și s-a
dovedit fals, de ce s-a ales un drum și nu altul. Dacă o propoziție se putea
citi din `git log`, nu se scrie.

**La finalul unei bucăți de lucru se adaugă o intrare**, la coada fișierului. O
intrare scrisă nu se mai modifică — ce s-a schimbat se scrie în următoarea.

Nu ține starea problemelor deschise, și nu ține explicații de cod. Alea stau în
issues, respectiv în mesajul commit-ului.

## Testele de mână

[`docs/TESTE.md`](docs/TESTE.md) ține ce nu poate face nicio verificare
automată: telefonul adevărat, Safari, producția. Fiecare are un ID din aceeași
serie, `T-01` în sus, dat o dată și nefolosit niciodată a doua oară.

Documentul ține **testele, nu starea lor**. Ce s-a trecut, când și pe ce commit
stă în issues — un fișier nu poate ține asta, și de-aia a fost șters
`docs/REGISTRU.md`. Un test e o definiție, deci nu rămâne în urmă.

## Auditurile

`docs/audits/` ține câte un fișier pe audit, numit după ziua în care s-a făcut.

Un audit e o **fotografie datată**: cine s-a uitat, când, pe ce commit, ce a
găsit stricat și ce a găsit bun. Odată scris, **nu se mai modifică niciodată**.
Ce s-a schimbat de atunci se vede în issue-uri și în istoricul commit-urilor.

Nu e un al doilea registru, și de-aia n-are soarta lui `docs/REGISTRU.md`: nu
pretinde că descrie prezentul, deci nu poate rămâne în urmă.

Constatările merg în issue-uri, ca orice problemă deschisă. Fișierul ține ce nu
încape într-un issue: verdictul, ordinea recomandată, și **ce s-a verificat și
era în regulă** — partea care altfel nu se consemnează nicăieri, pentru că nu e
o problemă.

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

    npm run check

**O comandă, nu șase.** Șase comenzi copiate de mână au șase ocazii de a fi
uitate; una are zero. Regula asta a înlocuit lista de mai jos după o zi în care
o sesiune a rulat cinci din șase de două ori la rând — și de fiecare dată cea
sărită a fost cea care vedea greșeala.

Poarta rulează doar pașii pe care felia îi atinge. `npm run check -- --all` îi
rulează pe toți.

**Ce nu poate rula de aici, poarta îți spune la final.** `check:rls` cere o
bază, `check:layout` cere un browser și un cont — vezi [README.md](README.md).
Nu le sări în tăcere: un checker care sare peste jumătate din aplicație e o
bifă verde care nu verifică nimic. **Nu ating niciodată producția.**

**Fiecare pas al porții își poartă costul**, scris în `scripts/check.mjs`: ce
greșeală l-a născut și cât a costat. Un pas fără povestea lui e un pas pe care
următoarea sesiune îl șterge fiindcă „încetinește".
