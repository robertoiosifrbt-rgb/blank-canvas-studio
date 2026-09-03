/**
 * 🔴 ACHU-787 (Sesiunea 156) — **CEASUL ARĂTAT OMULUI, ÎN FUSUL LUI.**
 *
 * ─── Ce se întâmpla până azi, măsurat ───────────────────────────────────────
 *
 * `fmtDateTime`/`fmtDate` **tăiau text** din șirul primit: `'2026-08-25T08:12:00.000Z'` →
 * `'25/08/2026 08:12'`. ⛔ Dar `Z` înseamnă **UTC**, iar în Marea Britanie, din ultima duminică din
 * martie până în ultima din octombrie, ceasul e cu o oră înainte (BST). Ora adevărată era **09:12**.
 * Șapte luni pe an, fiecare moment venit dintr-o coloană `DateTime` a bazei apărea **cu o oră mai
 * devreme**.
 *
 * ⚠️ **De ce nu a sărit nimănui în ochi:** iarna ieșea corect. Un defect care se repară singur de
 * Crăciun și revine de Paște arată ca „mi s-a părut mie”.
 *
 * 🔴 Ce atingea, verificat rând cu rând: *„They know you are on the way — told at …”* (ACHU-565 — omul
 * anunță la 09:12 și i se scrie 08:12, chiar pe ecranul care există ca să-l liniștească), *Submitted*
 * și *Last Updated* pe cererile de ofertă, *„asked …”* pe cererile de date bancare, orele din jurnalul
 * de erori și cele ale comunicărilor cu clientul.
 *
 * ─── ⛔ DE CE NU SE CONVERTEȘTE TOT ─────────────────────────────────────────
 *
 * Fiindcă aplicația ține **două feluri** de momente, și nu din neglijență:
 *   1. **instante** — coloane `DateTime` (Prisma le trimite `…Z`) sau șiruri ACHU-141 cu decalaj
 *      explicit (`…+01:00`): un punct în timp, care trebuie **tradus** în fusul cititorului;
 *   2. **ore de perete** — `Job.actualStartTime` e `String`, scris deja în ora Marii Britanii
 *      (`ukNowString`), fără niciun marcaj de fus.
 *
 * ⛔ O conversie oarbă le-ar strica pe cele din a doua categorie: `new Date('2026-08-25 09:12:00')`
 * le-ar citi ca UTC și *Actual Start* ar sări cu o oră — exact defectul reparat aici, mutat pe alt ecran.
 * ✅ De asta regula e pe **marcajul de fus din șir**, nu pe numele câmpului.
 *
 * ⚠️ **De ce un fișier separat de `format.tsx`:** acela exportă și o componentă (`StatusBadge`), deci
 * fiecare funcție adăugată acolo costă un avertisment de lint (`react-refresh`), pe un clichet exact.
 */
const UK_TZ = 'Europe/London';

/** `Z`, `+01:00`, `-0500` — marcajul care face dintr-un șir un INSTANT, nu o oră de perete. */
export const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * ⚠️ `hourCycle: 'h23'`, nu `hour12: false`: al doilea dă `24:30` la miezul nopții pe unele ICU-uri,
 * iar o oră care nu există pe niciun ceas e mai rea decât una greșită — nimeni nu o raportează.
 */
const UK_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** `null` = șirul nu e o dată pe care JS o poate citi. ⛔ Nu se inventează nimic: apelantul arată textul primit. */
export function ukParts(iso: string): { date: string; time: string } | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const parts = UK_PARTS.formatToParts(at);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const [day, month, year, hour, minute] = ['day', 'month', 'year', 'hour', 'minute'].map(get);
  if (!day || !month || !year) return null;
  return { date: `${day}/${month}/${year}`, time: `${hour}:${minute}` };
}

/**
 * Numai ora, „HH:MM”.
 *
 * 🔴 **Există fiindcă ecranele și-o formatau singure** — `SchedulePage` chema
 * `toLocaleTimeString('en-GB', …)` **fără `timeZone`**, deci pe fusul CALCULATORULUI. ⛔ Pe un laptop
 * pus pe alt fus, același „On the way” apărea cu altă oră decât în portalul curățătorului. Aceeași
 * faptă, două ecrane, două ore: cine le compară nu are cum să afle care e adevărată.
 */
export const fmtTime = (d?: string | null) => {
  if (!d) return '—';
  if (HAS_ZONE.test(d)) return ukParts(d)?.time ?? d;
  const [, timePart] = d.includes('T') ? d.split('T') : d.split(' ');
  return timePart ? timePart.slice(0, 5) : d;
};

