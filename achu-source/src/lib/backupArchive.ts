/**
 * ARHIVA DE FIȘIERE — tot ce ține aplicația în Storage, într-un singur zip.
 *
 * 🔴 **De ce există: ACHU-675.** Backupul de bază exportă **tabelele**. Fișierele reale stau în
 * Supabase Storage, un serviciu separat, și **nu sunt octeți în acel export**. După o restaurare
 * pe infrastructură goală rămâneau metadate perfecte care arată spre fișiere inexistente.
 *
 * ⚠️ **Arhiva se construiește în BROWSER, nu pe server**, și asta nu e o alegere de comoditate:
 * backendul ține doar cheia anonimă și **nu poate citi un bucket privat**; browserul are deja o
 * sesiune autentificată care poate. Tiparul e cel folosit pentru bonuri de la ACHU-396 — ce era
 * greșit nu era tiparul, era **acoperirea**: un bucket din patru.
 *
 * ⚠️ **Scos din `BackupPage.tsx`**, care e la plafonul de mărime (`AGENT_RULES` §7.4). Ecranul
 * rămâne despre butoane și stare; ce se întâmplă cu fișierele stă aici.
 */
import JSZip from 'jszip';
import { supabase } from './supabaseClient';
import type { BackupFileEntry } from './endpointsBackup';

const SIGNED_URL_TTL_SECONDS = 600;

/** Dosarul din arhivă pentru fiecare fel de fișier — ca un om să găsească fără să caute. */
const FOLDER: Record<BackupFileEntry['kind'], string> = {
  'receipt': 'receipts',
  'job-photo': 'visit-photos',
  'property-file': 'property-files',
  'quote-photo': 'enquiry-photos',
  'fit-note': 'fit-notes',
};

export type ArchiveResult = { blob: Blob; ok: number; total: number; failed: string[] };

/**
 * @param onProgress chemat înaintea fiecărui fișier, ca ecranul să poată spune unde e.
 */
export async function buildFileArchive(
  files: BackupFileEntry[],
  onProgress: (message: string) => void,
): Promise<ArchiveResult> {
  const zip = new JSZip();
  const failed: string[] = [];
  let ok = 0;

  /**
   * ⚠️ Secvențial, nu în paralel: fiecare fișier are nevoie de propriul URL semnat, iar zeci de
   * cereri deodată sunt exact felul în care ajungi limitat la jumătate și cu o arhivă parțială
   * care **arată** completă.
   */
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress(`${i + 1} of ${files.length}…`);
    try {
      // ⚠️ Semnat pe bucket-ul PROPRIU al fișierului — de aceea manifestul îl trimite de la server.
      const { data, error } = await supabase.storage.from(f.bucket).createSignedUrl(f.path, SIGNED_URL_TTL_SECONDS);
      if (error || !data) throw new Error(error?.message ?? 'no signed url');
      zip.file(`${FOLDER[f.kind]}/${f.name}`, await (await fetch(data.signedUrl)).blob());
      ok++;
    } catch {
      failed.push(f.describes);
    }
  }

  /**
   * ⛔ Un manifest ÎNĂUNTRUL arhivei, ca fișierele să poată fi legate înapoi de înregistrări
   * **chiar dacă baza a dispărut** — care e tot scenariul pentru care există arhiva.
   *
   * ⚠️ Și ce NU s-a putut descărca e scris tot aici. O arhivă tăcut incompletă e mai rea decât
   * una eșuată, fiindcă arată ca un succes.
   */
  zip.file('CONTENTS.txt', [
    'ACHU file archive',
    `Generated: ${new Date().toISOString()}`,
    `Files: ${ok} of ${files.length}`,
    failed.length ? `Could not download (${failed.length}): see the list at the end` : '',
    '',
    'These files are NOT inside the database backup. Keep both.',
    '',
    ...files.map(f => `${FOLDER[f.kind]}/  ${f.describes}`),
    ...(failed.length ? ['', 'MISSING:', ...failed] : []),
  ].filter(Boolean).join('\n'));

  onProgress('Compressing…');
  return { blob: await zip.generateAsync({ type: 'blob' }), ok, total: files.length, failed };
}

