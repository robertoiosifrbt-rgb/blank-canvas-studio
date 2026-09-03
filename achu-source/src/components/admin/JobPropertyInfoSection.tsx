import { useState, useEffect } from 'react';
import { Loader2, Home } from 'lucide-react';
import { getAdminJobPropertyInfo } from '@/lib/endpoints';
import PropertyInfoPanel, { type Photo } from '../customer/PropertyInfoPanel';

/**
 * 🔴 ACHU-518 (Sesiunea 111) — WHAT THE CUSTOMER SAID ABOUT THEIR HOME, VISIBLE TO THE OFFICE.
 *
 * Asked by Archana, in four words: *„In admin nu se vede poza?"* The answer was no — and the
 * NOTE was invisible too, which is the half that matters more operationally. Measured before
 * building: `grep` over every admin route and every screen under `src/components/admin/`
 * returned **zero** references to `propertyNotes` or `JobPhoto`.
 *
 * ⚠️ The customer was already told *„Only ACHU and the cleaner coming to you can see this."*
 * ACHU is the office. So this closes a gap between what was promised at the point of collection
 * and what the software did — it is not a new use of their data, and needs no new consent.
 *
 * ✅ **Reuses `PropertyInfoPanel` rather than re-rendering the same thing differently.** Same
 * photographs, same layout, same "photo unavailable" placeholder the customer sees when a link
 * has expired. ⛔ It is passed neither `editable` nor `onPhotoDelete`, so it renders read-only
 * and shows no delete buttons — the panel already gates deletion on both, so the office cannot
 * remove a customer's photograph by accident. Whether it should be ABLE to is an open privacy
 * question (see the route comment); not building it is the answer that keeps the option.
 *
 * ⚠️ `photosAvailable` is deliberately not passed either. It controls the "add photos"
 * invitation in the empty state, and inviting the OFFICE to add a photograph of a customer's
 * home would be a different feature with a different consent question attached.
 */
export default function JobPropertyInfoSection({ jobId }: { jobId: string }) {
  const [info, setInfo] = useState<{ propertyNotes: string; photos: Photo[] } | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * Reset when the dialog is reopened on a DIFFERENT job — done during render, not in the
   * effect below. React's documented "adjusting state when a prop changes" pattern
   * (https://react.dev/learn/you-might-not-need-an-effect), and the same shape
   * `PropertyInfoEditDialog` uses after ACHU-493.
   *
   * ⚠️ Not a style preference. Clearing this inside the effect is a synchronous `setState` in an
   * effect body, which is one lint warning — and the ratchet is EXACT at 868 with zero slack, so
   * one new warning fails the build. ⛔ The rule (`CLAUDE.md` §2.1a) is to remove the warning,
   * never to raise the ceiling: the ceiling only ever falls.
   *
   * ✅ It also fixes a real flicker: resetting in an effect renders the PREVIOUS job's note once
   * before clearing it, so reopening the dialog on another visit would briefly show somebody
   * else's access instructions.
   */
  const [loadedFor, setLoadedFor] = useState(jobId);
  if (loadedFor !== jobId) {
    setLoadedFor(jobId);
    setInfo(null);
    setFailed(false);
  }

  useEffect(() => {
    let alive = true;
    getAdminJobPropertyInfo({ jobId })
      .then(d => {
        if (!alive) return;
        setInfo({ propertyNotes: d.propertyNotes ?? '', photos: (d.photos ?? []) as Photo[] });
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [jobId]);

  if (failed) {
    /**
     * 🔴 A failure says so, rather than looking like an empty panel. The two are not the same
     * thing to somebody about to send a cleaner to a house: "the customer told us nothing" and
     * "we could not load what the customer told us" lead to different actions, and only one of
     * them is safe to act on.
     */
    return (
      <div className="text-xs text-muted-foreground">
        Could not load what the customer said about this property. Refresh to try again.
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasContent = !!info.propertyNotes || info.photos.length > 0;

  /**
   * ⚠️ The empty case says the customer added nothing, instead of rendering nothing at all.
   *
   * `PropertyInfoPanel` returns `null` when read-only and empty, which is right in the portal —
   * an empty card on every past visit would be noise on the one screen the customer reads. Here
   * the reader is staff, and the absence is itself information: it tells them there is nothing
   * to brief a cleaner on, and it tells them this section exists at all. A section that appears
   * only sometimes cannot teach anybody that it is there.
   */
  if (!hasContent) {
    return (
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Home className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>The customer has not added any notes or photos about this property.</span>
      </div>
    );
  }

  /**
   * §32 „Uploaded by" (Sesiunea 148) — `showUploadedBy` e aprins DOAR aici, nu în portal: o fișă
   * de client poate avea două conturi de portal, deci „care dintre cei doi a trimis poza" e o
   * întrebare pe care doar biroul o pune. ⛔ Clientului i s-ar arăta propriul email pe fiecare
   * miniatură.
   */
  return <PropertyInfoPanel propertyNotes={info.propertyNotes} photos={info.photos} showUploadedBy />;
}

