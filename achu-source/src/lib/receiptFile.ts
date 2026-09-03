import { MAX_PDF_BYTES, MAX_IMAGE_BYTES } from '@/lib/validation';

// Use shared constants for upload limits
const MAX_PDF_SIZE = MAX_PDF_BYTES;
const MAX_IMAGE_SIZE = MAX_IMAGE_BYTES;
const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

export function validateFile(file: File): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const typeOk = SUPPORTED_TYPES.includes(file.type);
  const extOk = SUPPORTED_EXTENSIONS.includes(ext);
  if (!typeOk && !extOk) return 'Unsupported file type. Upload a JPG, PNG, WEBP, or PDF.';
  const isPdf = file.type === 'application/pdf' || ext === '.pdf';
  const limit = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
  const limitMB = Math.floor(limit / (1024 * 1024));
  if (file.size > limit) return `This ${isPdf ? 'PDF' : 'image'} is too large to process. Maximum supported size is ${limitMB} MB.`;
  return null;
}

/** Determine if a field was AI-filled vs empty — treat 0 as valid */
export function isAiFilled(v: string | number | undefined | null): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return true; // 0 is a valid extracted value
  return false;
}

