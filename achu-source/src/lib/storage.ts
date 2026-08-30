/**
 * Replaces `zite-file-upload-sdk`. `uploadFile` keeps a similar call
 * signature to the SDK it replaces, but now returns the bare storage
 * `path` (the value to persist permanently, e.g. on Expense.receiptFileUrl)
 * plus a short-lived `previewUrl` (for immediate display/OCR right after
 * upload).
 *
 * The `receipts` bucket is private (see docs/JURNAL.md) — there is
 * no public URL for an object, only time-limited signed URLs generated on
 * demand via `getReceiptUrl`. `getReceiptUrl` also accepts a legacy full
 * public URL (rows saved before the private-bucket migration) and returns
 * it unchanged, so old and new rows both display correctly.
 */
import { supabase } from './supabaseClient';

const BUCKET = 'receipts';
const SIGNED_URL_TTL_SECONDS = 600; // plenty for an immediate OCR call + the review-step preview

export async function uploadFile(params: { data: File; filename: string }): Promise<{ path: string; previewUrl: string }> {
  const { data: file, filename } = params;
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  // Random path — not the original filename — so the object key isn't
  // guessable/enumerable by name.
  const path = `${crypto.randomUUID()}${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const previewUrl = await getReceiptUrl(path);
  return { path, previewUrl };
}

/**
 * Signed, time-limited URL for an already-uploaded receipt. `pathOrLegacyUrl`
 * is either a bare storage path (current format) or a full pre-migration
 * public URL (returned unchanged, since it's already a usable link while
 * the bucket transition is in progress).
 */
export async function getReceiptUrl(pathOrLegacyUrl: string, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
  if (/^https?:\/\//i.test(pathOrLegacyUrl)) return pathOrLegacyUrl;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pathOrLegacyUrl, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

