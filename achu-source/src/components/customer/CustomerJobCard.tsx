import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Info, CalendarDays, X, AlertCircle, Loader2, Sparkles, BanknoteArrowDown, PlusCircle } from 'lucide-react';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import PropertyInfoPanel, { type Photo } from './PropertyInfoPanel';
import PropertyInfoEditDialog from './PropertyInfoEditDialog';
import AccessConfirmation from './AccessConfirmation';
import JobRatingPanel, { type JobRating, type ReviewInviteState } from './JobRatingPanel';
// §16 (Sesiunea 143) — „s-a făcut tot?", în cifre. ⛔ Lista de puncte NU pleacă la client.
import ChecklistSummary from './ChecklistSummary';
import type { RequestKind } from './CustomerRequests';
// ACHU-512: through the API client, which is what carries the Bearer token and the real
// base path. The four calls below were hand-written `fetch`es to `/api/customer/...`, a
// path that does not exist, without a token — see `src/lib/endpoints.ts` for the full note.
import {
  getJobPropertyInfo, updateJobPropertyNotes, uploadJobPropertyPhoto, deleteJobPropertyPhoto,
} from '@/lib/endpoints';
import type { PortalJob } from './portalTypes';

function getRelativeDay(dateStr?: string): string | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 14) return `In ${diffDays} days`;
  const weeks = Math.round(diffDays / 7);
  return `In ${weeks} week${weeks !== 1 ? 's' : ''}`;
}

export default function JobCard({ job, showInstructions, showRelativeTime, onRequest, reviewInvite, onRated }: { job: PortalJob; showInstructions?: boolean; showRelativeTime?: boolean; onRequest?: (kind: RequestKind, job: PortalJob) => void;
  /**
   * ACHU-566 — reincarca portalul dupa ce clientul a notat.
   *
   * Toate celelalte scrieri din portal fac asta (`onResponded`, `onSubmitted`); nota era
   * SINGURA care nu, deci payload-ul ramanea cu `rating: null` iar prima remontare a
   * cardului cerea din nou o nota pentru o vizita deja notata.
   */
  onRated?: () => void;
  /**
   * ACHU-553 — invitația la o recenzie publică, dacă serverul o permite pentru acest client.
   *
   * ⚠️ Omisă pe lista de vizite VIITOARE, deliberat: nota există doar pe o vizită `Completed`,
   * deci acolo nu are ce invita.
   */
  reviewInvite?: ReviewInviteState }) {
  const [expanded, setExpanded] = useState(false);
  // ACHU-513: seeded from the portal payload, then owned here so the panel reflects the
  // answer without waiting for a refetch of the whole portal.
  const [accessConfirmedAt, setAccessConfirmedAt] = useState<string | null>(job.accessConfirmedAt ?? null);
  /**
   * ACHU-537: nota vine din payload-ul portalului și e ținută aici după salvare, exact ca
   * `accessConfirmedAt` deasupra — altfel ecranul ar continua să invite la notare până la o
   * reîncărcare a întregului portal, adică ar arăta că răspunsul nu a fost înregistrat.
   *
   * ⚠️ `?? null`, nu `?? undefined`: `null` e „n-a notat", iar componenta deosebește cele două
   * stări. Un bundle mai vechi decât câmpul citește `undefined` și trebuie să ajungă în
   * aceeași stare ca „n-a notat", nu într-una nedefinită.
   */
  const [justSaved, setJustSaved] = useState<JobRating | null>(null);
  /**
   * 🔴 ACHU-566 (Sesiunea 123) — **DEFECT RAPORTAT DIN PRODUCȚIE de Roberto:**
   * *„după ce trimit feedback… asta se resetează și cere iar feedback."*
   *
   * ⛔ **Nota NU se mai ține în stare locală.** Adevărul e `job.rating`, din payload-ul
   * portalului; `justSaved` acoperă doar fereastra dintre salvare și reîncărcare, ca ecranul
   * să nu clipească înapoi în formular.
   *
   * ⚠️ **`job.rating` are PRECEDENȚĂ**, nu invers: o valoare locală care ar învinge props-urile
   * e chiar defectul reparat aici. `useState` își citește valoarea inițială **o singură dată**,
   * iar `CustomerApp` randează tabul cu `activeTab === 'history' && <JobHistory …>` — deci o
   * schimbare de tab **demontează** lista, iar la revenire cardul se reconstruia din payload.
   * Cum payload-ul **nu era niciodată reîncărcat după notare** (nota era singura scriere din
   * portal fără `load()`), ecranul cerea din nou o notă pentru o vizită deja notată.
   *
   * ✅ Reparat în trei locuri: aici (adevărul vine din props), `onRated` (payload-ul se
   * reîncarcă, ca la toate celelalte scrieri), și cheia listei (`key={j.id}`, nu indexul).
   */
  const rating = job.rating ?? justSaved;
  /**
   * 🔴 ACHU-517 (Sesiunea 111) — `photosAvailable` comes from the SERVER, in this response.
   *
   * It replaced a `PHOTOS_DISABLED` constant compiled into the bundle. Held here rather than
   * imported, the screen cannot contradict the route, and re-enabling photographs needs no
   * deploy at all — the server answers differently the moment the Railway key is set.
   *
   * ⚠️ `?? false` on every path, including the failure path below: a bundle older than the
   * field, or a fetch that failed, must read as "no photographs" and not as "go ahead".
   */
  const [propertyInfo, setPropertyInfo] = useState<{ propertyNotes: string; photos: Photo[]; photosAvailable: boolean; maxPhotos: number } | null>(null);
  const [editPropertyDialogOpen, setEditPropertyDialogOpen] = useState(false);
  const relTime = showRelativeTime ? getRelativeDay(job.jobDate) : null;

  // ACHU-493: declared BEFORE the effect that calls it, and wrapped in useCallback.
  // As a plain `const` declared after, it was read out of the temporal dead zone —
  // harmless at runtime here (the effect body runs after render) but it left the
  // effect with a dependency it could not list, so a changed `job.id` would have
  // kept calling the first render's version.
  const loadPropertyInfo = useCallback(async () => {
    try {
      const data = await getJobPropertyInfo({ jobId: job.id });
      setPropertyInfo({
        propertyNotes: data.propertyNotes ?? '',
        photos: data.photos ?? [],
        photosAvailable: data.photoUploadAvailable ?? false,
        /** ACHU-760 (Sesiunea 148) — plafonul vine de la server; `0` = nu am aflat, deci nu invităm. */
        maxPhotos: data.maxPhotos ?? 0,
      });
    } catch (e) {
      console.error('Failed to load property info:', e);
      // Still allow editing even if load failed
      // ACHU-517: notes stay editable when the fetch fails, but photographs do NOT get
      // offered on a guess — we did not hear back, so we do not know the server can take one.
      setPropertyInfo({ propertyNotes: '', photos: [], photosAvailable: false, maxPhotos: 0 });
    }
  }, [job.id]);

  // ACHU-493: DERIVED, not stored. It was a second useState set to true at the top of
  // the fetch and false in its `finally` — which is precisely the window in which
  // `propertyInfo` is still null, so the flag never carried information the render did
  // not already have. A failed fetch still ends here: the catch above writes an empty
  // object rather than leaving null, so this goes false either way.
  const loadingPropertyInfo = expanded && !propertyInfo && !!job.id;

  // ACHU-493: loading is kicked off HERE, from the click, not from an effect watching
  // `expanded`. React's own guidance — an effect is for synchronising with something
  // outside React, and "user opened the details" is an event, not external state
  // (https://react.dev/learn/you-might-not-need-an-effect). Same trigger condition as
  // the effect had, minus the render round-trip it needed to notice the flag flipped.
  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !propertyInfo && job.id) {
      void loadPropertyInfo();
    }
  };

  const handlePropertyInfoSave = async (notes: string, photos?: { imageData: string; description?: string }[]) => {
    const jobId = job.id;

    // Update notes if changed
    if (propertyInfo && notes !== propertyInfo.propertyNotes) {
      await updateJobPropertyNotes({ jobId, propertyNotes: notes });
    }

    /**
     * §32 „Multiple-file upload" (Sesiunea 148) — pozele se trimit **una câte una, în ordine**.
     *
     * ⚠️ **NU în paralel**, deliberat: ruta impune plafonul de 8 recitindu-l în tranzacție
     * (ACHU-760), iar cinci cereri simultane ar face ca refuzul să cadă pe o poză la întâmplare
     * din mijlocul lotului. În ordine, refuzul cade pe prima care nu mai încape, iar mesajul
     * serverului e cel pe care omul îl citește.
     *
     * ⛔ Și se OPREȘTE la prima eroare, în loc să continue: notele sunt deja salvate, pozele
     * de dinainte sunt atașate, iar mesajul spune ce s-a întâmplat. A înghiți eroarea și a merge
     * înainte ar lăsa omul să creadă că toate au ajuns.
     */
    for (const photo of photos ?? []) {
      await uploadJobPropertyPhoto({ jobId, ...photo });
    }

    // Reload property info to reflect changes
    await loadPropertyInfo();
  };

  const handlePhotoDelete = async (photoId: string) => {
    await deleteJobPropertyPhoto({ jobId: job.id, photoId });
    // Reload to update photo list
    await loadPropertyInfo();
  };

  return (
    <>
      <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{job.service || 'Cleaning Service'}</p>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {job.jobId && <span className="font-mono">#{job.jobId} • </span>}
              {fmtDate(job.jobDate)}
              {relTime && <span className="ml-1.5 font-medium text-primary">({relTime})</span>}
              {job.startTime && <> • {job.startTime}</>}
              {job.finishTime && <> – {job.finishTime}</>}
            </p>
            {/* ACHU-236: who is coming, on the face of the card rather than behind
                "View Details". After the date it is the thing customers ring up to
                ask, so hiding it behind a tap defeats the point. Said explicitly
                when nobody is assigned yet — a blank line reads as "nobody is
                coming", which is a worse message than "not yet allocated". */}
            {Array.isArray(job.cleaners) && (
              <p className="text-xs mt-0.5">
                {job.cleaners.length > 0
                  ? <><span className="text-muted-foreground">Your cleaner: </span><span className="font-medium">{job.cleaners.join(', ')}</span></>
                  : <span className="text-muted-foreground italic">Cleaner not allocated yet</span>}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <StatusBadge status={job.paymentStatus} />
          </div>
        </div>

        {/**
          * 🆕 ACHU-537 (Sesiunea 119) — nota vizitei, PE FAȚA cardului, deasupra „View Details".
          *
          * ⚠️ **Abatere deliberată** de la regula scrisă mai jos pentru butoanele de cerere
          * („ascunse ca un mis-tap să nu ajungă la birou ca o cerere reală"). Aici nu ajunge o
          * cerere: nota **se poate schimba** de cel care a dat-o, iar singura consecință e o
          * notificare. Iar o notă ascunsă la două atingeri nu se dă niciodată — funcționalitatea
          * ar măsura satisfacția clienților care caută unde s-o măsoare.
          *
          * ⛔ Doar pe `Completed`: motivul e în `backend/src/lib/jobRatingPolicy.ts` — pe o
          * vizită anulată sau la care nu s-a putut intra nu s-a curățat nimic de notat, iar
          * serverul refuză aceeași combinație.
          */}
        {/**
          * §16 — sumarul de checklist, DEASUPRA notei: omul citește ce s-a făcut, apoi notează.
          * ⛔ Doar pe `Completed`, ca nota: pe o vizită viitoare „0 din 12" e o cifră adevărată
          * care sperie fără motiv, iar serverul o refuză oricum.
          */}
        {job.id && job.status === 'Completed' && <ChecklistSummary jobId={job.id} />}

        {job.id && job.status === 'Completed' && (
          <JobRatingPanel key={rating ? 'rated' : 'unrated'} jobId={job.id} rating={rating} onSaved={r => { setJustSaved(r); onRated?.(); }} reviewInvite={reviewInvite} />
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={toggleExpanded}
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          {expanded ? 'Hide Details' : 'View Details'}
        </Button>

        {expanded && (
          <>
            {job.address && <p className="text-xs text-muted-foreground">{job.address}</p>}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Charged</span><p className="font-medium">{fmt(job.amountCharged)}</p></div>
              <div><span className="text-muted-foreground">Paid</span><p className="font-medium">{fmt(job.amountPaid)}</p></div>
              <div><span className="text-muted-foreground">Balance</span><p className={`font-medium ${job.outstandingBalance > 0 ? 'text-orange-600' : ''}`}>{fmt(job.outstandingBalance)}</p></div>
            </div>

            {/**
              * ACHU-556 — DE CE vizita asta costă atât.
              *
              * 🔴 Pusă imediat sub cifre, nu mai jos printre detalii: rândul „Charged" de
              * deasupra e exact locul unde apare o sumă mai mare decât se aștepta clientul, iar
              * explicația la trei ecrane distanță de întrebare nu e o explicație. Fără ea,
              * singura cale prin care ar afla e factura, la două săptămâni.
              */}
            {job.serviceExtras && job.serviceExtras.length > 0 && (
              <div className="text-xs bg-muted/30 rounded-lg p-2 space-y-1">
                <p className="text-muted-foreground">Extra work on this job</p>
                {job.serviceExtras.map(e => (
                  <div key={e.id} className="flex items-start justify-between gap-2">
                    <span>{e.description}</span>
                    <span className="tabular-nums shrink-0">{fmt(e.price)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-border pt-1 text-muted-foreground">
                  <span>Included in the total above</span>
                  <span className="tabular-nums">{fmt(job.extrasTotal ?? 0)}</span>
                </div>
              </div>
            )}
            {showInstructions && job.customerInstructions && (
              <p className="text-xs bg-muted/30 rounded-lg p-2 text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />{job.customerInstructions}
              </p>
            )}

            {/* ACHU-513: "Confirm access" — per visit, and only while the visit is still
                open. Placed above the property panel because it is the thing that is
                actionable TODAY; the notes and photos are longer-lived. */}
            {job.id && !['Completed', 'Cancelled', 'No Access'].includes(job.status) && (
              <div className="pt-1">
                <AccessConfirmation
                  jobId={job.id}
                  confirmedAt={accessConfirmedAt}
                  onChanged={setAccessConfirmedAt}
                />
              </div>
            )}

            {/* Property Information */}
            {loadingPropertyInfo && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loadingPropertyInfo && propertyInfo && (
              <div className="pt-2">
                <PropertyInfoPanel
                  propertyNotes={propertyInfo.propertyNotes}
                  photos={propertyInfo.photos}
                  editable={job.status !== 'Completed' && job.status !== 'Cancelled'}
                  photosAvailable={propertyInfo.photosAvailable}
                  /**
                   * ACHU-520 — deletable even after the visit closes, which is what the server
                   * has always allowed and what Archana's retention decision depends on: photos
                   * go when the customer removes them, or on a data-erasure request. Nothing
                   * else deletes them, so the button must not disappear when the visit does.
                   */
                  canDeletePhotos
                  onEdit={() => setEditPropertyDialogOpen(true)}
                  onPhotoDelete={handlePhotoDelete}
                />
              </div>
            )}
          </>
        )}

        {/*
          ACHU-238. Behind "View Details" on purpose: these are occasional actions, and
          putting a "cancel" button on the face of every card invites mis-taps on the one
          screen where a mis-tap reaches the office as a real request.

          The labels all say "Request" / "Report". Nothing here changes the visit — the
          office decides — so a button reading "Cancel job" would be a promise the system
          does not keep.
        */}
        {/**
          * 🆕 ACHU-532 (Sesiunea 118) — butoanele se aleg după STAREA vizitei.
          *
          * Înainte se ofereau toate trei oricând cardul primea `onRequest`, ceea ce era în
          * regulă doar fiindcă `onRequest` ajungea numai la vizitele **viitoare**
          * (`JobHistory` nu-l pasa deloc). Acum ajunge și la istoric, deci alegerea trebuie
          * făcută aici — altfel clientul ar vedea „Request new date" pe o curățenie de
          * săptămâna trecută, iar serverul l-ar refuza după ce completează formularul.
          *
          * ⛔ „Ask us to re-clean" apare DOAR pe `Completed`: pe `Cancelled` sau `No Access`
          * nu s-a curățat nimic de refăcut. Serverul impune aceeași regulă — ecranul doar
          * nu-i mai cere clientului să afle de la el.
          */}
        {expanded && onRequest && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!['Completed', 'Cancelled', 'No Access'].includes(job.status) && (
              <>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => onRequest('Reschedule', job)}>
                  <CalendarDays className="h-3.5 w-3.5 mr-1.5" />Request new date
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => onRequest('Cancellation', job)}>
                  <X className="h-3.5 w-3.5 mr-1.5" />Request cancellation
                </Button>
              </>
            )}
            {job.status === 'Completed' && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onRequest('Reclean', job)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />Ask us to re-clean
              </Button>
            )}
            {/**
              * 🆕 ACHU-533 (Sesiunea 118) — rambursarea, pe o vizită PLĂTITĂ.
              *
              * ⚠️ Poarta e pe BANI, nu pe starea vizitei: o vizită **anulată dar plătită** e
              * cazul principal de rambursare, deci o condiție pe `Completed` (ca la
              * re-curățare) ar fi ascuns exact ce trebuie oferit.
              *
              * `paymentStatus` e derivat de server (`customerPortalAggregation.ts`), iar
              * serverul re-verifică din rândurile de plată — ecranul doar nu-i mai cere
              * clientului să afle de la el.
              */}
            {['Paid', 'Partial'].includes(job.paymentStatus) && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onRequest('RefundRequest', job)}>
                <BanknoteArrowDown className="h-3.5 w-3.5 mr-1.5" />Ask for a refund
              </Button>
            )}
            {/**
              * 🆕 ACHU-556 (Sesiunea 122) — „mai puteți face și…", pe o vizită care nu s-a
              * întâmplat încă.
              *
              * ⛔ **CERERE, nu comandă, și fără niciun preț** — decizia Archanei din 11/08 pe
              * rezervarea directă: *„clientul cere… biroul o accepta… Preturile sunt subiect de
              * modificare… clientul nu trebuie sa vada asta."* Un formular care ar cere o sumă
              * ar fi aceeași rezervare directă sub alt nume.
              *
              * ⚠️ Aceeași poartă ca „Request new date": pe o vizită încheiată nu se mai poate
              * adăuga nimic, iar pentru „nu a fost bine" există re-curățarea de mai sus.
              */}
            {!['Completed', 'Cancelled', 'No Access'].includes(job.status) && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onRequest('ServiceExtra', job)}>
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />Ask for extra work
              </Button>
            )}
            {/* „Report a problem" rămâne pe ORICE vizită — un client poate avea de spus ceva
                despre una anulată sau la care nu s-a putut intra, la fel de bine. */}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onRequest('Problem', job)}>
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" />Report a problem
            </Button>
          </div>
        )}
      </CardContent>
      </Card>

      <PropertyInfoEditDialog
        open={editPropertyDialogOpen}
        onClose={() => setEditPropertyDialogOpen(false)}
        initialNotes={propertyInfo?.propertyNotes || ''}
        photosAvailable={propertyInfo?.photosAvailable ?? false}
        // ACHU-760 (Sesiunea 148) — plafonul și câte are deja, amândouă de la SERVER.
        maxPhotos={propertyInfo?.maxPhotos ?? 0}
        existingPhotoCount={propertyInfo?.photos.length ?? 0}
        onSave={handlePropertyInfoSave}
      />
    </>
  );
}

