import type { ReactNode } from 'react';

/**
 * §48 „Clear empty states" (Sesiunea 154) — UN TABEL GOL TREBUIE SĂ SPUNĂ CĂ E GOL.
 *
 * ─── Ce s-a măsurat ─────────────────────────────────────────────────────────
 * 50 de tabele în aplicație; **16** rămâneau cu antetul complet și nimic sub el. ⛔ Un cap de tabel
 * suspendat peste nimic nu se citește ca „nu e nimic de arătat" — se citește ca **stricat**, iar
 * omul dă refresh, apoi sună. 🔴 Cel mai prost caz din listă: prima pagină a Adminului, unde exact
 * asta e răspunsul bun („n-ai nimic de făcut acum") și arăta ca o eroare.
 *
 * ⚠️ Componentă, nu încă un `<tr><td colSpan=…>` scris de mână a șaptesprezecea oară: `colSpan`
 * greșit e defectul care nu se vede la citit — rândul iese din tabel doar pe ecranul cuiva.
 */
export default function EmptyTableRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-6 text-center text-sm text-muted-foreground">{children}</td>
    </tr>
  );
}

