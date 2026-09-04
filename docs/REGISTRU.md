# Registru

Ce e deschis, ce e blocat, ce s-a rezolvat, ce s-a decis altfel decât în plan,
și ce au găsit auditurile.

Se ține la zi la fiecare schimbare. Fără el, lucrurile deschise trăiesc doar
în conversația unei sesiuni și mor cu ea.

---

## Deschise

### De decis — alegerea e a proprietarului

| # | Ce | De ce e deschis |
|---|---|---|
| D1 | `on delete cascade` pe `items.owner` | Planul scrie `references auth.users(id)` fără acțiune la ștergere. Fără cascade, ștergerea contului din Supabase dă eroare de cheie străină cât ai itemi. Se adaugă ca migrație separată. |
| D2 | Emailul în capul ecranului | Adăugat de mine, nesolicitat. Argument: altfel nu se vede în ce cont ești. Se scoate la un cuvânt. |
| D3 | Ziua de azi marcată în Calendar | Adăugat de mine, nesolicitat. Linie și titlu galben pe ziua curentă. |
| D4 | Atribute `name=` pe butoane | Adăugate ca verificatoarele din browser să nu depindă de textul vizibil. |
| D5 | Ordinea Calendarului | Crește de la cea mai veche zi în jos, deci azi fuge tot mai departe de vârf. Planul nu spune nimic despre ordine sau limită. |
| D6 | Care modul la pasul 6 | Candidați cu date reale în istoricul repo-ului: turele de livrări, mașina, datoriile. Pasul 6 nu poate începe fără alegere. |

### De făcut — nu e nevoie de decizie

| # | Ce |
|---|---|
| F1 | Testul manual din pasul 1, pe Vercel: intrare **directă** pe `/today`, apoi refresh. Verifică `vercel.json`; CI îl verifică pe serverul lui, nu pe Vercel. |
| F2 | Site URL în Supabase e încă `localhost:3000`. Din cauza lui, linkul de confirmare pe email duce în gol. |

---

## Blocate

| # | Ce | Ce îl blochează |
|---|---|---|
| B1 | Ștergerea ramurii `claude/incepe-sa-construiesti-26xk4o` de pe GitHub | Ștergerea de ref e refuzată cu **403** din sesiunea asta. O face proprietarul. |
| B2 | Pasul 6, modulele | Așteaptă D6. |
| B3 | Pasul 7, offline adevărat | Planul îl pune explicit după pasul 6. |

---

## Rezolvate

| Când | Ce |
|---|---|
| 2026-09-04 | Migrația `items` aplicată pe proiectul de producție. Verificat: 3 politici, 1 trigger, RLS pornit, 6 coloane scriibile. |
| 2026-09-04 | Variabilele de mediu puse în Vercel pe Production, plus redeploy. Aplicația e vie pe telefon. |
| 2026-09-04 | Ciclul complet al pasului 5, verificat în CI pe Supabase adevărat și cu mâna pe telefon. |
| 2026-09-04 | Subtitlul de pe ecranul de intrare scos — era o afirmație, nu o informație. |
| 2026-09-04 | Un item planificat și bifat în aceeași zi apărea de două ori în Calendar. Acum o dată, sub Done. |
| 2026-09-04 | Verificatorul de așezare cădea pe conținut care doar se derulează. Restrâns la elementele lipite de ecran. |
| 2026-09-04 | Mesajul de configurație lipsă nu spunea că trebuie redeploy. Acum o spune, și un test o ține pe loc. |
| 2026-09-04 | Codul trecut integral în engleză; documentele au rămas în română. |
| 2026-09-04 | Trei funcții fără apelant, șterse (`plusDays`, `today()`, `calendar()`). |
| 2026-09-04 | Verificatorul de structură se uita doar în `src/`. Acum pornește de la rădăcina repo-ului; a prins imediat `rls.mjs` la 315 linii și l-a spart. |

---

## Decizii care se abat de la plan

| # | Abaterea | De ce |
|---|---|---|
| A1 | `check (title ~ '\S')` în loc de `btrim(title) <> ''` | `btrim` implicit taie doar spații, deci un titlu din taburi trecea și ar fi apărut în Azi ca rând care nu arată nimic. Aceeași lege, scrisă complet. Găsită de test. |
| A2 | Cursorul de sincronizare e `max(updated_at)` din rândurile aduse | Tot de la server, fără RPC și fără schemă în plus. Planul cerea „timestamp de la server" fără să spună cum. |
| A3 | `assertAccount` la fiecare intrare în repository | Planul cere ca cache-ul să nu se citească fără contul curent. Verificarea o face imposibilă, nu doar improbabilă. |
| A4 | Grupurile colapsate se deschid la tap | Planul zice „colapsat mereu". Citit ca „nu se desface singur", nu „inaccesibil": un lucru la care nu poți ajunge e pierdut. |
| A5 | `check:cycle` | Verificator pe care planul nu-l numește, dar care automatizează chiar testul lui de acceptanță de la pasul 5. |
| A6 | Codul în engleză | Regula proprietarului. A înlocuit linia din plan care cerea interfața și comentariile în română. |
| A7 | Verificatorul de structură pornește de la rădăcina repo-ului, nu din `src/` | Planul se contrazice: o linie zice „tot ce e sub `src/`", alta zice „de la rădăcina codului, o regulă pe un subset trece verde fără să verifice nimic". A doua a câștigat, după ce prima a lăsat 315 linii nevăzute. |

---

## Audituri

| Când | Ce s-a verificat | Ce a găsit |
|---|---|---|
| 2026-09-04 | Codul față de plan: tabele, coloane, valori, legi, cod fără apelant | Schema curată — un tabel, zece coloane, nimic „pentru viitor". Trei funcții fără apelant, șterse. |
| 2026-09-04 | Contrastul culorilor, 20 de perechi text-fundal, ambele teme | Cea mai slabă 4.81 față de minimul 4.5. Niciun text la limita fundalului. |
| 2026-09-04 | Limita de 300 de linii, în afara `src/` | `scripts/lib/rls.mjs` la 315 linii, peste limită din pasul 3, nevăzut. Spart în două. |
