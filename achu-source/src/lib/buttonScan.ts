/**
 * Citirea butoanelor din sursă, într-un singur loc (Sesiunea 154).
 *
 * ⚠️ Două păzi din §48 pun întrebări despre același lucru: „butonul ăsta e doar o iconiță?" — una
 * cere `aria-label` (pentru cine nu vede), cealaltă `title` (pentru cine vede iconița și n-o
 * recunoaște). 🔴 Dacă fiecare își citește singură butoanele, cele două definiții ale lui
 * „doar-iconiță" se despart la prima formă nouă de JSX, iar una dintre păzi tace fără să spună.
 *
 * ⛔ Parsarea de aici a fost greșită de **trei** ori, și fiecare greșeală a tăcut, nu a strigat:
 *  1. `[^>]*` pentru eticheta de deschidere — se oprea la săgeata din `onClick={() => …}`, deci
 *     butoanele scrise cu funcție pe loc (aproape toate cele de pe rânduri de tabel) erau invizibile;
 *  2. ștergerea întregii acolade — `{saving ? 'Se salvează' : 'Salvează'}` rămânea gol, deci 40 de
 *     butoane corecte erau raportate ca fără nume;
 *  3. parantezele unui JSX pe mai multe rânduri — `? (\n <Icon/>\n) : (\n <Icon/>\n)` lăsa „( ) ( )",
 *     citit ca text, deci butonul care șterge o poză din portal „avea nume".
 */

/** Unde se termină eticheta de deschidere: primul `>` din AFARA acoladelor. */
export function openTagEnd(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

/**
 * Ce **se vede** din conținutul unui buton.
 *
 * ⛔ Dintr-o expresie, condiția NU e text: în `cond ? A : B` numele e A sau B, iar în `cond && A` e
 * A. O expresie fără condiție (`{label}`) e considerată text — nu putem ști ce conține, iar o pază
 * care presupune ce-i mai rău despre ce nu poate citi produce alarme false.
 */
export function visibleText(body: string): string {
  const noTags = body.replace(/<[^>]*>/g, '');
  const curat = (t: string) => t.replace(/[?:()]/g, ' ');
  return noTags
    .replace(/\{([\s\S]*?)\}/g, (_m, expr: string) => {
      const q = expr.indexOf('?');
      const amp = expr.indexOf('&&');
      if (q >= 0) return curat(expr.slice(q + 1));
      if (amp >= 0) return curat(expr.slice(amp + 2));
      return expr;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ScannedButton {
  /** Rândul pe care se deschide butonul, numărat de la 1. */
  line: number;
  openTag: string;
  /** Conținutul lui e numai iconițe — niciun cuvânt pentru ochi. */
  iconOnly: boolean;
  ariaLabel?: string;
  title?: string;
}

const ATTR = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\b${name}=("[^"]*"|\\{[^}]*\\})`))?.[1];

/** Toate butoanele dintr-un fișier, citite o singură dată. */
export function scanButtons(source: string): ScannedButton[] {
  const out: ScannedButton[] = [];
  for (const m of source.matchAll(/<(?:button|Button)\b/g)) {
    const start = m.index!;
    const tagEnd = openTagEnd(source, start);
    if (tagEnd < 0) continue;
    const openTag = source.slice(start, tagEnd + 1);

    let body = '';
    if (!openTag.endsWith('/>')) {
      // ⚠️ `<Button … />` n-are conținut deloc — deci n-are nici cuvinte.
      const close = source.slice(tagEnd).search(/<\/(?:button|Button)>/);
      if (close < 0) continue;
      body = source.slice(tagEnd + 1, tagEnd + close);
    }

    out.push({
      line: source.slice(0, start).split('\n').length,
      openTag,
      iconOnly: visibleText(body).length === 0,
      ariaLabel: ATTR(openTag, 'aria-label'),
      title: ATTR(openTag, 'title'),
    });
  }
  return out;
}

