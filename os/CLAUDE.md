# Gym App

Aplicație personalizată pentru sală, construită pas cu pas — o funcție/modul pe rând, ca proprietarul să înțeleagă fiecare piesă înainte să trecem la următoarea.

Acest fișier e **punctul de intrare fix**: nu ține istoric și nu crește — doar regulile de lucru și trimiteri către celelalte documente. Istoricul și starea curentă stau în `docs/`.

## Cum lucrăm

- Nu construim funcționalități în avans, nesolicitate. Adăugăm câte una, discutăm, apoi trecem la următoarea.
- Fiecare funcționalitate nouă devine un modul propriu în `src/features/<nume>` (vezi `docs/ARCHITECTURE.md`).
- **Fără poze / screenshot-uri.** Nu trimite imagini cu aplicația și nu cere să te uiți la ele. Dacă trebuie verificat că ceva funcționează, verifică-l în text: `npm test`, `npm run lint`, `npm run build`, sau condu aplicația și raportează rezultatele ca text (ce s-a apăsat, ce s-a salvat, ce a rămas după reload, erorile din consolă).
- **Git workflow:** Lucrez pe `dev`, promovez în `main`. Nu se creează branches separate pentru work (nu `claude/**` sau altele). Când fix/feature e gata și testat (lint/build/test pass), se merge `dev` → `main` și se push `main`. Doar `main` publică — pe `dev` rulează doar verificările (vezi „Publicare" în `docs/ARCHITECTURE.md`).
  - Regula asta **se execută**, nu doar se citește: `.claude/hooks/session-start.sh` mută sesiunea pe `dev` la pornire (sesiunile din web sunt așezate automat pe o ramură `claude/<ceva>`) și instalează dependențele, ca lint/test/build să meargă imediat. Dacă găsește modificări nesalvate, nu schimbă ramura — le-ar pune în pericol — și cere mutarea lor pe `dev` înainte de a continua.
- La finalul fiecărei sesiuni de lucru relevante, se actualizează:
  - `docs/DEV_LOG.md` — ce s-a făcut și ce decizii s-au luat (max. 5 intrări, restul în `docs/archive/dev-log/`)
  - `docs/ROADMAP.md` — ce e bifat, ce urmează (se editează pe loc, nu se adaugă la nesfârșit)

## Stack

React + TypeScript + Vite.

## Unde citești ce

| Document | Ce conține | Cum se schimbă |
|---|---|---|
| `docs/DESIGN_TARGET.md` | **Destinația**: cum trebuie să arate aplicația când e gata — token-uri de design + cele 9 ecrane | Doar dacă proprietarul schimbă target-ul |
| `docs/ROADMAP.md` | Stadiul curent și drumul până la destinație, pe etape | Se editează în loc, mereu scurt |
| `docs/ARCHITECTURE.md` | Structura de foldere, convenția pentru module noi | Doar când se schimbă structura |
| `docs/DEV_LOG.md` | Ultimele 5 sesiuni de lucru | Append, cu rotație în `docs/archive/dev-log/` |

La începutul unei sesiuni noi (alt cont/context), citește acest fișier + `docs/DESIGN_TARGET.md` + `docs/ROADMAP.md` — primul îți spune **unde mergem**, al doilea **unde am ajuns**. Deschide `docs/DEV_LOG.md` sau `docs/ARCHITECTURE.md` doar dacă ai nevoie de detalii.

Mockup-ul aprobat stă în `docs/design/target-screens.png`. E reper de **aspect**; verificarea că ceva funcționează rămâne în text (vezi regula fără poze de mai sus).
