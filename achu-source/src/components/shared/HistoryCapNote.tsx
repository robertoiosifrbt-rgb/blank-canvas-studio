/**
 * 🔴 ACHU-781 · ACHU-786 (Sesiunea 156) — **PROPOZIȚIA CARE SPUNE CĂ O LISTĂ E TĂIATĂ.**
 *
 * ⛔ O listă scurtată fără să spună că e scurtată e o minciună despre cât are firma, iar cine se uită
 * la ea nu are de unde bănui. ⚠️ Patru ecrane au acum istoric plafonat — Action Centre (vizite
 * terminate · cheltuieli anulate · plăți anulate · cereri convertite), re-curățeniile și verificările
 * de calitate — și **toate trebuie să spună la fel**.
 *
 * 🔴 **Textul vine de pe SERVER**, întreg: el știe câte rânduri sunt de fapt și unde se văd toate.
 * ⛔ Componenta asta nu compune nimic — dacă ar lipi bucăți, a doua zi două ecrane ar spune altceva.
 *
 * ⚠️ **`null` înseamnă „nu s-a tăiat nimic"**, iar atunci nu se desenează nimic: o notă care apare
 * degeaba e una pe care omul învață să o sară.
 */
export default function HistoryCapNote({ note }: { note?: string | null }) {
  if (!note) return null;
  return <p className="pt-1 text-xs text-muted-foreground">{note}</p>;
}

