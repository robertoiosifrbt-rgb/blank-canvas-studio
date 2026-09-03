/**
 * NOTA ȘI POZELE UNEI VIZITE — ce scrie clientul despre casa lui, și ce vede biroul.
 *
 * ⛔ **Fișier propriu, extras în Sesiunea 148, și silit, nu preferat:** `endpoints.ts` era EXACT pe
 * clichetul lui de mărime (263 de rânduri de cod), iar felia ACHU-760 avea nevoie de un câmp în
 * plus — plafonul de poze, trimis de server. ⚠️ Regula spune ce se face atunci: **iese cod din
 * fișier, iar cifra COBOARĂ** (`AGENT_RULES` §7). A douăzeci și una oară când o felie IESE din
 * catalog ca să încapă.
 *
 * ⚠️ **Reexportat din `endpoints.ts`** (`export * from`), deci niciun apelant nu se schimbă — la
 * fel ca `enquiryEndpoints`, `propertyEndpoints` și celelalte nouăsprezece.
 *
 * 🔴 Cele cinci funcții stau împreună fiindcă răspund la aceeași întrebare din două direcții: ce
 * știe **clientul** despre casa lui pe o vizită, și ce vede **biroul** din asta. Rutele sunt
 * diferite (poarta clientului vs. `requireFullAdmin`), iar motivul e scris la fiecare.
 */
import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient';

/**
 * Property notes and photos a customer writes about their own home, per visit
 * (Sesiunea 101 — the feature; ACHU-512 — the four calls below).
 *
 * 🔴 These went through `lib/apiClient.ts` for the first time in ACHU-512. The screen had
 * been calling `fetch('/api/customer/jobs/...')` by hand: wrong base path (the router is
 * mounted at `/api/customer-portal`) and no `Authorization` header, because the token is
 * added by `apiClient`, not by `fetch`. Two of the three reasons the feature never worked.
 *
 * ⚠️ So: no raw `fetch` for a backend call from a component. The auth header is not
 * optional and it is not visible in the component that forgets it.
 */
export function getJobPropertyInfo(params: { jobId: string }) {
  return apiGet<{
    propertyNotes: string;
    photos: { id: string; photoId: number; storagePath: string; description?: string | null; uploadedAt: string; signedUrl?: string | null }[];
    /**
     * 🔴 ACHU-517 (Sesiunea 111) — whether the SERVER can accept a photograph right now.
     *
     * Optional in the type on purpose, and the caller must treat a missing value as `false`.
     * A browser holding a bundle from before this field existed would otherwise read
     * `undefined` as "available", offer a file picker, and put the customer back in front of
     * the failure this replaced — the one shape of staleness a deploy cannot prevent.
     */
    photoUploadAvailable?: boolean;
    /** 🔴 ACHU-760 (Sesiunea 148) — câte poze încap pe o vizită. Opțional, ca vecinul: un bundle vechi îl citește `undefined`, iar apelantul îl tratează ca `0` — deci nu invită la nicio poză, în loc să invite la una refuzată. */
    maxPhotos?: number;
  }>(`/customer-portal/jobs/${params.jobId}/property-info`, {});
}

/**
 * 🔴 ACHU-518 — the ADMIN view of what the customer wrote about their home.
 *
 * A separate wrapper from `getJobPropertyInfo` above, because it is a different route with a
 * different guard: that one is scoped to the signed-in customer's own visit, this one is
 * Admin-only. ⛔ Not merged into `getJob`: minting a signed URL per photograph costs a Supabase
 * call, and the job dialog opens for every job, most of which have no photographs.
 *
 * ⚠️ No `photoUploadAvailable` here and no delete — the office reads, it does not write. Whether
 * an Admin may delete a customer's photograph is a privacy question nobody has answered yet.
 */
export function getAdminJobPropertyInfo(params: { jobId: string }) {
  return apiGet<{
    propertyNotes: string;
    photos: { id: string; photoId: number; storagePath: string; description?: string | null; uploadedAt: string; signedUrl?: string | null; uploadedBy?: string | null; category?: string | null }[];
  }>(`/jobs/${params.jobId}/property-info`, {});
}

export function updateJobPropertyNotes(params: { jobId: string; propertyNotes: string }) {
  return apiPatch<{ propertyNotes: string | null }>(
    `/customer-portal/jobs/${params.jobId}/property-notes`,
    { propertyNotes: params.propertyNotes },
  );
}

export function uploadJobPropertyPhoto(params: { jobId: string; imageData: string; description?: string }) {
  return apiPost<{ success: true; photo: { id: string; photoId: number } }>(
    `/customer-portal/jobs/${params.jobId}/photos`,
    { imageData: params.imageData, description: params.description },
  );
}

export function deleteJobPropertyPhoto(params: { jobId: string; photoId: string }) {
  return apiDelete<{ success: true }>(`/customer-portal/jobs/${params.jobId}/photos/${params.photoId}`);
}

/**
 * ─── §32 „Before photos" / „After photos" (Sesiunea 148) — DOVADA CURĂȚĂTORULUI ────────
 *
 * ⚠️ Rute proprii, sub `/cleaner-jobs`: cine scrie e curățătorul ASIGNAT (sau biroul), iar poarta e
 * altundeva decât la pozele clientului. Motivele întregi:
 * `backend/src/lib/visitPhotoPolicy.ts` și `backend/src/routes/cleanerVisitPhotos.ts`.
 */
export type VisitPhotoCategory = 'before' | 'after';

/** ⚠️ `imageData` e deja micșorat de `imageCompression` — plafonul de 10 MB e pe ce PLEACĂ. */
export function addVisitPhoto(params: {
  jobId: string; category: VisitPhotoCategory; imageData: string; description?: string;
}) {
  const { jobId, ...body } = params;
  return apiPost<{ success: true; photo: { id: string; category: string } }>(
    `/cleaner-jobs/${jobId}/photos`, body,
  );
}

/** ⛔ Numai pozele curățătorului — cele ale clientului nu se șterg de aici, nici de birou. */
export function deleteVisitPhoto(params: { jobId: string; photoId: string }) {
  return apiDelete<{ success: true }>(`/cleaner-jobs/${params.jobId}/photos/${params.photoId}`);
}

