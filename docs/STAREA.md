# Starea — ce e construit, ce e livrat, ce așteaptă un om

**Actualizat:** 5 septembrie 2026.

⚠️ **Cifrele nu sunt aici.** `git log` spune ce s-a construit, issues spun ce e
deschis, `docs/MIGRATII.md` spune ce e pe bază. Aici stau **trei** lucruri: ce
merge azi, ce așteaptă o hotărâre a proprietarului, și ce e stricat și se știe.

📜 **Povestea nu e aici.** Ce s-a încercat și s-a abandonat stă în
[JURNAL.md](JURNAL.md). Scris în amândouă, s-ar plăti de două ori la scris și
încă o dată la citit, în fiecare sesiune.

---

## Ce merge azi

**Trei ecrane în bară:** Azi, Calendar, Arii. Plus ecranul unei arii, în care
intri apăsând pe numele ei, și `/hmrc`, din butonul de sus.

**Un modul construit: livrările.** Tura are kilometraj, ore cu ceas, banii de
la Uber Eats / Deliveroo / Just Eat, bacșiș, aria, și kilometrii personali
separați. Cheltuiala are sumă, categorie, procentul de folosire în business, și
— la motorină — kilometrajul și dacă s-a făcut plinul.

**Consumul se calculează singur** din plinuri: de la un plin plin la
următorul, banii împărțiți la distanță. Până n-ai două plinuri complete, spune
că n-are rată, nu inventează una.

**HMRC, pe an fiscal.** Impozit, dividende, Class 4, Class 2 ca ofertă și nu ca
datorie, ratele în avans cu datele lor. Cifrele anului le pui tu, o dată pe an.

**Rezerva unei zile** e cât adaugă ea la factura anului — nimic sub scutire, o
cincime peste, mai mult mai sus. Feliile se adună la an: un test o dovedește.

## Ce așteaptă o hotărâre a proprietarului

- **Unde stă HMRC în structură.** Azi e un buton în capul ecranului. Dacă
  ariile sunt domenii de viață cu module înăuntru, un buton în ramă nu e locul
  lui — dar bara de jos are trei locuri și al patrulea taie „Calendar" la
  320px, măsurat.
- **Ștergerea istoricului vechi de pe GitHub.** 283 de commit-uri de dinainte
  de golirea repo-ului. Ștearsă local pe 5 septembrie, adusă înapoi ca strămoș
  la un merge, fiindcă trimiterea ei cere un `push --force` pe care mediul
  sesiunii îl refuză fără o permisiune scrisă de proprietar.
- **`reserves` de pe baza live**, care nu mai e folosit de nimic. Vezi
  [MIGRATII.md](MIGRATII.md).

## Ce e stricat și se știe

- **Nu există modul pentru mașină.** Kilometrajul, MOT, asigurarea, taxa de
  drum, service-ul, schimbul de ulei — niciunul nu are unde sta. Consumul e
  cheiat pe arie, nu pe mașină, ceea ce merge cât timp o linie de muncă
  înseamnă o mașină.
- **Plinul nu ține litrii.** Fără ei nu se poate ști consumul real, l/100km sau
  MPG — doar £/km.
- **Turele și ratele se pot pune pe un container** (`Business`,
  `Self-employed`), unde n-au sens. Nimic nu te oprește și nimic nu te
  avertizează.
- **Nu există niciun alt modul** din câte cere planul: scrisori, datorii,
  obiective, documente, contacte. `kind='letter'` există în bază și n-are ecran.
