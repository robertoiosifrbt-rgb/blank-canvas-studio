/**
 * 🔴 §6 (Sesiunea 158) — „câmpul ăsta chiar are ceva în el?", într-un singur loc.
 *
 * ⛔ **Stă în `lib/`, nu lângă componentele care îl folosesc**, și nu din gust: un fișier care
 * exportă **și** componente **și** o funcție rupe reîmprospătarea rapidă a lui Vite, iar lintul o
 * spune ca avertisment. 📜 Clichetul de lint e EXACT (`AGENT_RULES` §7) — un avertisment nou îl
 * sparge, iar regula zice să scoți avertismentul, nu să ridici cifra.
 *
 * ⚠️ **Zero nu e „ceva".** Pe ecranul unei cereri de ofertă, `0` băi înseamnă „nu s-a completat",
 * iar un rând „Bathrooms: 0" ar fi arătat ca o informație acolo unde nu e niciuna.
 */
export const hasVal = (v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return true;
};

