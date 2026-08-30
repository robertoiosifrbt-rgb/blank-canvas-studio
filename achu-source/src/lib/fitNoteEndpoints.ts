/**
 * ACHU-392 — certificatele medicale, capătul de client.
 *
 * ⛔ **Fișier propriu, nu încă trei funcții în `endpoints.ts`** — acela are 1422 de rânduri, e
 * peste plafonul de 500 și **nu are voie să crească** (`AGENT_RULES` §7). Aceeași alegere ca la
 * `payrollEndpoints.ts`, extras în aceeași zi.
 *
 * ⚠️ `attachFitNote` din `endpoints.ts` **rămâne** și e altceva: leagă o cale deja existentă de
 * o absență. Aici fișierul ajunge efectiv în bucket-ul privat.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

/** Ce acceptă serverul (`FIT_NOTE_EXTENSIONS`) — scris o dată, folosit de `accept` pe input. */
export const FIT_NOTE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.webp';

/**
 * ⚠️ **Aceeași cifră ca pe server** (`FIT_NOTE_MAX_BYTES`) și ca limita pusă pe bucket în
 * Supabase. Verificată și aici ca omul să afle **înainte** de a aștepta o încărcare care va fi
 * refuzată. ⛔ Nu înlocuiește verificarea serverului; o dublează.
 */
export const FIT_NOTE_MAX_BYTES = 10 * 1024 * 1024;

export function uploadFitNote(input: {
  absenceId: string;
  filename: string;
  fileData: string;
  from?: string | null;
  to?: string | null;
}) {
  return apiPost<{ success: true; auditWarning?: string | null }>(`/fit-notes/${input.absenceId}`, {
    filename: input.filename,
    fileData: input.fileData,
    from: input.from ?? null,
    to: input.to ?? null,
  });
}

/**
 * ⚠️ Întoarce un URL **semnat, cu termen de o oră** — nu calea. Se deschide, nu se salvează
 * nicăieri: un link salvat ar deveni o scurgere permanentă a unei date de sănătate.
 */
export function fitNoteLink(absenceId: string) {
  return apiGet<{ signedUrl: string }>(`/fit-notes/${absenceId}`);
}

export function removeFitNote(absenceId: string) {
  return apiDelete<{ success: true; auditWarning?: string | null }>(`/fit-notes/${absenceId}`);
}

