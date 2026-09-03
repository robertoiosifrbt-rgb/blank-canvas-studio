/**
 * ACHU-396 — which kind of backup file the browser is holding, and what to do
 * with it.
 *
 * The page went from one shape of file to two: plain JSON it can parse and show
 * counts for, and an encrypted file it can only save and hand back. Keeping that
 * fork here rather than in `BackupPage.tsx` means the page asks a question and
 * gets an answer, instead of growing a second branch through every handler.
 *
 * ⛔ NOTHING HERE DECRYPTS ANYTHING, and that is the design rather than a gap.
 * The password lives on the server and is never sent to the browser, so the
 * browser's whole job is to carry ciphertext from a file to the restore route.
 */

/** First line the server writes into an encrypted file; see backend backupEncryption.ts. */
const ENCRYPTED_MAGIC = 'ACHU-BACKUP-ENCRYPTED-1';

/**
 * ⚠️ Kept in step with the backend constant by a test on each side rather than
 * by a shared module: the frontend and backend build separately and importing
 * across them is not something this project does.
 */
export function isEncryptedBackupText(text: string): boolean {
  return text.trimStart().startsWith(ENCRYPTED_MAGIC);
}

/**
 * `.achubak` rather than `.json`, and the extension is doing real work: it tells
 * the person which of their downloads is the protected kind, and stops a
 * double-click from opening a text editor full of ciphertext that looks broken.
 */
export function backupFilename(stamp: string, encrypted: boolean): string {
  return encrypted ? `ACHU-backup-${stamp}.achubak` : `ACHU-backup-${stamp}.json`;
}

/** The readable part of an unencrypted backup — what the page shows about a chosen file. */
export type PlainBackup = {
  data: unknown;
  counts: Record<string, number>;
  generatedAt?: string;
  generatedBy?: string;
};

/** What a chosen file turned out to be, ready for the restore routes. */
export type ChosenBackup =
  /** Plain JSON: the page can read counts out of it and preview locally. */
  | { kind: 'plain'; name: string; parsed: PlainBackup }
  /** Encrypted: opaque until the server opens it. */
  | { kind: 'encrypted'; name: string; text: string };

/**
 * Reads a file the person picked. Throws with a message for THEM — not a parse
 * error — when it is neither kind.
 */
export async function readBackupFile(file: File): Promise<ChosenBackup> {
  const text = await file.text();

  if (isEncryptedBackupText(text)) {
    return { kind: 'encrypted', name: file.name, text };
  }

  let parsed: Partial<PlainBackup>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file does not look like an ACHU data backup.');
  }
  if (!parsed?.data || !parsed?.counts) {
    throw new Error('That file does not look like an ACHU data backup.');
  }

  return { kind: 'plain', name: file.name, parsed: parsed as PlainBackup };
}

/**
 * The request body for `/backup/restore` and `/backup/restore/preview`.
 *
 * ⚠️ An encrypted file goes in `encryptedFile`, never in `backup` — the backend
 * accepts it in either field, but sending it as `backup` relies on a fallback
 * that exists to catch a mistake, not as an interface.
 */
export function restoreBody(chosen: ChosenBackup): { backup?: unknown; encryptedFile?: string } {
  return chosen.kind === 'encrypted'
    ? { encryptedFile: chosen.text }
    : { backup: chosen.parsed };
}

