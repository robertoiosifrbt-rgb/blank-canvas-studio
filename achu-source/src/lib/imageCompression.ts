/**
 * MICȘOREAZĂ POZA ÎNAINTE DE ÎNCĂRCARE, ÎN LOC SĂ O REFUZE.
 *
 * ─── 🔴 CE ERA STRICAT ──────────────────────────────────────────────────────
 * Toate cele cinci ecrane care încarcă poze aveau aceeași formă: `if (file.size > LIMITĂ) →
 * eroare`. Mesajul cerea omului *„fă-o din nou la o rezoluție mai mică"*. ⛔ Pe un telefon,
 * nimeni nu poate face asta: rezoluția camerei nu se schimbă din ecranul de trimitere, iar o
 * poză de cameră făcută cu un telefon recent trece des de 10 MB.
 *
 * 🔴 **Unde doare cel mai tare:** `ChecklistItemPhoto`. §16 spune că un punct care cere poză
 * **nu se bifează fără ea** — deci o încărcare refuzată nu e un neajuns de interfață, îi
 * oprește curățătorului lucrul, în casa clientului, fără nimic ce ar putea face ca să treacă.
 * ⚠️ Iar acolo nu exista nici măcar verificarea de mărime: poza pleca spre server și era
 * refuzată acolo, după ce omul aștepta încărcarea pe date mobile.
 *
 * ─── CE FACE ────────────────────────────────────────────────────────────────
 * Redesenează poza pe un canvas, la latura lungă și calitatea din `COMPRESSION_LADDER`, și se
 * oprește la **primul** pas care intră în buget. ⚠️ Nu comprimă niciodată degeaba: o poză deja
 * sub buget se citește neatinsă, deci nu pierde calitate pentru nimic.
 *
 * ⛔ **Nu atinge ce nu poate deschide.** Un PDF sau un HEIC pe care browserul nu-l poate desena
 * întoarce `null`, iar apelantul citește fișierul ca înainte. ⚠️ Un ajutor care ar fi „încercat
 * oricum" ar fi transformat un fit note PDF perfect valid într-un canvas gol.
 *
 * ─── ⚠️ DE CE E ÎMPĂRȚIT AȘA ────────────────────────────────────────────────
 * `renderStep` e primit ca parametru, nu chemat direct: canvasul nu există în jsdom, deci fără
 * asta scara de compresie — singura parte în care se poate greși tăcut — n-ar fi avut niciun
 * test. Cu el, deciziile (ce se sare, ce pas se alege, ce se întoarce dacă niciunul nu intră)
 * se verifică fără browser.
 */

/** Ce tipuri poate deschide un canvas. ⛔ HEIC lipsește dinadins: Safari îl convertește singur la alegere, iar unde nu-l convertește, canvasul l-ar desena gol. */
export const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Pașii, în ordine. 🔴 **Primul care intră în buget câștigă** — nu se coboară mai mult decât e
 * nevoie.
 *
 * ⚠️ 2048px pe latura lungă e pragul de sus dinadins: o pată pe un colț de perete trebuie să
 * rămână vizibilă, fiindcă exact aia e dovada pentru care se face poza. ⛔ Scara nu coboară sub
 * 1024px: sub atât poza încetează să fie dovadă și devine o miniatură, iar atunci mai bine
 * refuzăm cinstit decât să trimitem ceva pe care nimeni nu poate judeca nimic.
 */
export const COMPRESSION_LADDER = [
  { maxEdge: 2048, quality: 0.85 },
  { maxEdge: 2048, quality: 0.7 },
  { maxEdge: 1600, quality: 0.7 },
  { maxEdge: 1280, quality: 0.65 },
  { maxEdge: 1024, quality: 0.6 },
] as const;

export type CompressionStep = (typeof COMPRESSION_LADDER)[number];

/**
 * Bugetul implicit. ⚠️ **Mult sub plafonul serverului de 10 MB, și nu din prudență:** cererea
 * pleacă de pe date mobile, de la un curățător în casa cuiva, iar 4 MB urcă în secunde acolo
 * unde 10 MB pot dura minute sau pot cădea. ⛔ Plafonul serverului rămâne plasa de siguranță,
 * nu ținta.
 */
export const DEFAULT_BUDGET_BYTES = 4 * 1024 * 1024;

export type CompressionResult = {
  /** Data URL-ul de trimis, exact în forma pe care o aștepta `readAsDataURL`. */
  dataUrl: string;
  /** Câți octeți are după decodare — cifra pe care o măsoară serverul, nu lungimea textului. */
  bytes: number;
  /** Câți avea fișierul ales. */
  originalBytes: number;
  /** `true` dacă era deja sub buget și nu s-a re-codat nimic. */
  skipped: boolean;
  /** Al câtelea pas din scară a intrat în buget; `null` dacă niciunul. */
  stepUsed: number | null;
};

/** Poate un canvas să deschidă tipul ăsta? */
export function isCompressibleImage(type: string): boolean {
  return (COMPRESSIBLE_TYPES as readonly string[]).includes(type);
}

/**
 * Câți OCTEȚI are un data URL după decodare.
 *
 * 🔴 Nu lungimea textului — base64 umflă cu o treime, iar serverul măsoară binarul decodat
 * (`decodeImageUpload`). ⛔ Comparând lungimea textului cu un buget în octeți, o poză bună ar fi
 * fost coborâtă încă un pas degeaba.
 */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/** Laturile după încadrarea în `maxEdge`, păstrând proporția. ⚠️ O poză deja mai mică nu se mărește. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Ce trebuie să facă un randator: un fișier și un pas, înapoi un data URL. */
export type RenderStep = (file: File, step: CompressionStep) => Promise<string>;

/**
 * Randatorul real, de browser. ⛔ Nu se poate testa în jsdom (nu are canvas), de aceea nu ține
 * nicio decizie — doar desenează pasul care i se cere.
 *
 * ⚠️ Fundal alb pus dinadins înainte de desen: un PNG cu transparență re-codat ca JPEG face
 * transparența **neagră**, iar o poză de dovadă cu colțuri negre arată ca un defect de aparat.
 */
export const renderStepInBrowser: RenderStep = async (file, step) => {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, step.maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', step.quality);
  } finally {
    bitmap.close?.();
  }
};

/**
 * Citește fișierul așa cum era citit până acum, fără nicio atingere.
 *
 * ⚠️ Rămâne aici, și nu în fiecare ecran, ca „sub buget" și „nu se poate comprima" să iasă pe
 * același drum ca „s-a comprimat" — altfel fiecare apelant ar fi avut două ramuri de scris, iar
 * a doua e cea care se uită.
 */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Pregătește un fișier pentru încărcare: îl micșorează dacă trebuie, altfel îl citește întreg.
 *
 * ⛔ **Nu aruncă niciodată pentru că poza a rămas prea mare** — întoarce cel mai mic rezultat pe
 * care l-a obținut, iar apelantul compară cu plafonul lui și dă mesajul lui. ⚠️ Ecranele au
 * plafoane diferite (15 MB pe chat, 10 MB în rest), deci mesajul nu poate veni de aici.
 */
export async function prepareImageForUpload(
  file: File,
  opts: { budgetBytes?: number; renderStep?: RenderStep } = {},
): Promise<CompressionResult> {
  const budget = opts.budgetBytes ?? DEFAULT_BUDGET_BYTES;
  const render = opts.renderStep ?? renderStepInBrowser;

  // Deja mică, sau un tip pe care canvasul nu-l poate deschide: se citește neatinsă.
  if (file.size <= budget || !isCompressibleImage(file.type)) {
    const dataUrl = await readAsDataUrl(file);
    return { dataUrl, bytes: dataUrlBytes(dataUrl), originalBytes: file.size, skipped: true, stepUsed: null };
  }

  let best: { dataUrl: string; bytes: number; stepUsed: number } | null = null;

  for (const [i, step] of COMPRESSION_LADDER.entries()) {
    let dataUrl: string;
    try {
      dataUrl = await render(file, step);
    } catch {
      /**
       * ⛔ Randarea a căzut (tip pe care browserul nu-l desenează, memorie, canvas murdărit).
       * Nu e un motiv să pierdem poza: dacă un pas de dinainte a reușit îl ținem, altfel
       * întoarcem fișierul neatins și lăsăm plafonul apelantului să decidă.
       */
      break;
    }
    const bytes = dataUrlBytes(dataUrl);
    // Ținem mereu cel mai mic obținut, chiar dacă niciun pas nu intră în buget.
    if (!best || bytes < best.bytes) best = { dataUrl, bytes, stepUsed: i };
    if (bytes <= budget) break;
  }

  if (!best) {
    const dataUrl = await readAsDataUrl(file);
    return { dataUrl, bytes: dataUrlBytes(dataUrl), originalBytes: file.size, skipped: true, stepUsed: null };
  }

  return { ...best, originalBytes: file.size, skipped: false };
}

