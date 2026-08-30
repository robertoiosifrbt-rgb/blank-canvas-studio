/**
 * §34 (Sesiunea 160) — HTML2CANVAS, SCOS DIN PACHET. ACHU-808.
 *
 * 🔴 **Ce era:** `jspdf` cere `html2canvas` printr-un `import()` dinamic, folosit **numai** de
 * `doc.html()`. ⛔ Codul nostru nu cheamă `doc.html()` **nicăieri** — zero apeluri în `src/`,
 * măsurat, iar `html2canvas` nu apare nici în `package.json`. Deci se construia, se număra în buget
 * (**47 kB gzip**) și nu se descărca niciodată.
 *
 * ⚠️ **De ce ACUM:** bugetul total a trecut de plafon (1002 din 1000) la felia §34, iar `ACHU-808`
 * spunea deja că următoarea felie va trebui să **TAIE**, nu doar să amâne încărcarea. Asta e tăierea.
 *
 * 🔴 **Dacă cineva chiar are nevoie de `doc.html()` într-o zi**, ăsta e locul: se scoate rândul din
 * `vite.config.ts` și pachetul se întoarce. ⛔ Iar până atunci **nu tace** — aruncă un mesaj care
 * spune exact ce s-a întâmplat, în loc să deseneze o pagină goală.
 */
export default function html2canvas(): never {
  throw new Error(
    'html2canvas is deliberately not bundled (ACHU-808): nothing in this app calls jsPDF\'s doc.html(). '
    + 'If a PDF needs to be rendered from HTML, remove the alias in vite.config.ts.',
  );
}

