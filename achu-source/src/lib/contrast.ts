/**
 * §48 „Contrast" (Sesiunea 154) — CÂT DE TARE SE VEDE TEXTUL PE FUNDALUL LUI.
 *
 * ⚠️ Raportul de contrast nu e o părere: e o formulă din WCAG, iar paleta aplicației e scrisă în
 * `index.css` ca variabile HSL. Deci se poate **calcula**, nu privit și aprobat.
 *
 * 🔴 Pragul e **4.5:1** pentru text obișnuit (WCAG 2.1, criteriul 1.4.3, nivel AA). 3:1 e pentru
 * text mare și pentru contururi de comenzi — un buton cu scris normal nu se califică.
 */

/** O culoare scrisă ca în CSS: `225 91% 34%` (cum le ține Tailwind, fără `hsl()`). */
export function hslToRgb(value: string): [number, number, number] {
  const [h, s, l] = value.trim().split(/\s+/).map(part => parseFloat(part));
  const hh = h / 360, ss = s / 100, ll = l / 100;
  if (ss === 0) return [ll, ll, ll];
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const channel = (t0: number): number => {
    const t = ((t0 % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(hh + 1 / 3), channel(hh), channel(hh - 1 / 3)];
}

/** Luminanța relativă, exact ca în definiția WCAG. */
export function luminance(value: string): number {
  const [r, g, b] = hslToRgb(value).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Raportul de contrast dintre două culori, între 1 (identice) și 21 (negru pe alb). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Blocurile de temă din CSS, cu variabilele lor de culoare.
 *
 * ⚠️ Acoladele se numără, nu se caută `}`: o regulă cuprinsă (un `@media` înăuntru) ar tăia blocul
 * la jumătate, iar paza ar „vedea" mai puține culori decât are tema — adică ar trece tăcut.
 */
export function themeBlocks(css: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const m of css.matchAll(/(?:^|\n)\s*([.:][\w.-]+)\s*\{/g)) {
    const selector = m[1];
    const open = css.indexOf('{', m.index! + m[0].length - 1);
    let depth = 0, close = -1;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) { close = i; break; }
    }
    if (close < 0) continue;
    const vars: Record<string, string> = {};
    for (const v of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*([\d.]+\s+[\d.]+%\s+[\d.]+%)\s*;/g)) {
      vars[v[1]] = v[2].trim();
    }
    if (Object.keys(vars).length) out.set(selector, vars);
  }
  return out;
}

/**
 * Culorile pe care le vede cineva cu tema `selector` pornită.
 *
 * 🔴 Temele de accent sunt **suprapuneri**, nu palete: `.accent-sunset` schimbă patru variabile, iar
 * restul rămân de la `:root`. De asta contrastul se calculează pe tema **compusă** — o combinație
 * nereușită apare doar acolo, exact unde nu s-ar uita nimeni.
 */
export function resolveTheme(blocks: Map<string, Record<string, string>>, selector: string): Record<string, string> {
  const merged = { ...(blocks.get(':root') ?? {}) };
  if (selector.startsWith('.dark')) Object.assign(merged, blocks.get('.dark') ?? {});
  if (selector !== ':root' && selector !== '.dark') Object.assign(merged, blocks.get(selector) ?? {});
  return merged;
}

/** Perechile de text-pe-fundal care chiar apar pe ecran. */
export const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['sidebar-foreground', 'sidebar-background'],
  ['sidebar-primary-foreground', 'sidebar-primary'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
];

export const AA_TEXT = 4.5;

