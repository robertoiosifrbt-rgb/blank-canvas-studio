import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getQuoteRequest, getAdminQuoteRequestPhotos, GetQuoteRequestOutputType } from '@/lib/endpoints';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';
import { fmtDate } from '@/lib/format';

type QR = NonNullable<GetQuoteRequestOutputType['quoteRequest']>;

/**
 * ACHU-500 (Sesiunea 108) — reported by Roberto from his phone, with a photograph:
 * the panel had slid sideways, every label on the left clipped to "…tomer",
 * "…EANING", "…ork Checklist".
 *
 * 🔴 **Same cause as ACHU-422, in a different file** (see the note beside the time
 * fields in `JobDialog.tsx`). A grid track defaults to `min-width: auto`, so a
 * COLUMN refuses to shrink below its content — and one unbreakable string, here an
 * email address, widens the whole dialog. `whitespace-pre-wrap` does not help:
 * it wraps at spaces, and `gabrielramachandra@gmail.com` has none.
 *
 * ⚠️ **Both halves are needed and neither alone is enough.** `min-w-0` lets the
 * column shrink; `break-words` lets the text break inside a word once it has. With
 * only the first, the text still refuses to break and overflows its own cell; with
 * only the second, the column never shrinks so there is nothing to break within.
 * That is exactly what ACHU-422 recorded, and it is why this fix is two classes.
 */
function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words">{value}</p>
    </div>
  );
}

export default function QuoteRequestSection({ quoteRequestId }: { quoteRequestId: string }) {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [qr, setQr] = useState<QR | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * ACHU-561 — pozele pe care clientul le-a trimis CU cererea.
   *
   * 🔴 Pe acelasi ecran de pe care biroul stabileste pretul, fiindca de asta au fost
   * trimise. ⚠️ Incarcate separat de cerere: semnarea fiecarui link costa un apel la
   * Supabase, iar sectiunea se deschide si pentru cereri fara nicio poza.
   */
  const [photos, setPhotos] = useState<{ id: string; description: string | null; signedUrl: string | null }[]>([]);

  useEffect(() => {
    setLoading(true);
    getQuoteRequest({ id: quoteRequestId })
      .then(d => setQr(d.quoteRequest ?? null))
      .catch(() => setQr(null))
      .finally(() => setLoading(false));
    // ⛔ Esecul nu strica sectiunea: fara poze, restul cererii ramane citibil.
    getAdminQuoteRequestPhotos({ id: quoteRequestId })
      .then(d => setPhotos(d.photos ?? []))
      .catch(() => setPhotos([]));
  }, [quoteRequestId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!qr) return null;

  const services = qr.services?.length ? qr.services.join(', ') : null;

  const openFullPage = () => {
    const returnTo = encodeURIComponent(`/admin/jobs?${sp.toString()}`);
    nav(`/admin/quote-requests?id=${quoteRequestId}&returnTo=${returnTo}`);
  };

  const fmtDT = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Original Quote Request</h4>
          {qr.quoteRequestId && (
            <Badge variant="outline" className="text-[10px]">#{qr.quoteRequestId}</Badge>
          )}
          {qr.status && <Badge variant="secondary" className="text-[10px]">{qr.status}</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={openFullPage} className="text-xs gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          Open Full Quote Request
        </Button>
      </div>

      <div className="bg-muted/40 rounded-lg p-3 space-y-3 text-sm">
        {/* Customer */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" value={qr.fullName} />
          <Field label="Email" value={qr.email} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" value={qr.phone} />
          <Field label="Customer Type" value={qr.customerType} />
        </div>

        {/* Address */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Address" value={qr.address} />
          <Field label="Postcode" value={qr.postcode} />
        </div>

        {/* Services */}
        <Field label="Services" value={services} />
        <ServiceBreakdown qr={qr} />

        {/* Scheduling */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preferred Date" value={qr.preferredDate ? fmtDate(qr.preferredDate) : null} />
          <Field label="Preferred Time" value={qr.preferredTime} />
        </div>

        {/* Property */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Property Type" value={qr.propertyType} />
          {qr.totalBedrooms != null && qr.totalBedrooms !== 0 && <Field label="Total Bedrooms" value={String(qr.totalBedrooms)} />}
          {qr.totalBathrooms != null && qr.totalBathrooms !== 0 && <Field label="Total Bathrooms" value={String(qr.totalBathrooms)} />}
        </div>
        <Field label="Property Details" value={qr.propertyDetails} />
        <Field label="Additional Notes" value={qr.additionalNotes} />

        {/*
          ACHU-561 — ce a fotografiat clientul. 🔴 Aici, langa detaliile din care se
          stabileste pretul, fiindca de asta le-a trimis. Construita in ACEEASI felie cu
          incarcarea: o poza pe care clientul o trimite si pe care nu o vede nimeni e mai rea
          decat lipsa functionalitatii — el crede ca biroul stie ce e de curatat (ACHU-536).
        */}
        {photos.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Photos from the customer ({photos.length})</p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map(ph => (
                <div key={ph.id} className="space-y-1">
                  {ph.signedUrl ? (
                    /* Marimea intreaga intr-un tab nou: o miniatura ajunge sa recunosti „bucataria",
                       si e inutila la „cat de murdar e cuptorul". Linkul e semnat si expira. */
                    <a href={ph.signedUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={ph.signedUrl} alt={ph.description || 'Photo from the customer'} className="aspect-square w-full rounded-md object-cover" />
                    </a>
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-center">
                      <span className="px-1 text-[10px] text-muted-foreground">Photo unavailable</span>
                    </div>
                  )}
                  {ph.description && <p className="line-clamp-2 text-[10px] text-muted-foreground">{ph.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source" value={qr.source} />
          <Field label="Submitted" value={fmtDT(qr.submittedAt)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Submission ID" value={qr.submissionId} />
          <Field label="Last Updated" value={fmtDT(qr.updatedAt)} />
        </div>

        {/* Linked records */}
        {qr.customerName && <Field label="Linked Customer" value={qr.customerName} />}
        {qr.jobLabel && <Field label="Linked Job" value={qr.jobLabel} />}
      </div>
    </div>
  );
}

function ServiceBreakdown({ qr }: { qr: QR }) {
  const gt0 = (v: number | null | undefined): v is number => typeof v === 'number' && v > 0;
  const sections = [
    { title: 'Regular Cleaning', rows: [
      { label: 'Bedrooms', value: qr.regularCleaningBedrooms },
      { label: 'Bathrooms', value: qr.regularCleaningBathrooms },
      { label: 'Kitchens', value: qr.regularCleaningKitchens },
      { label: 'Living Rooms', value: qr.regularCleaningLivingRooms },
      { label: 'Hallways', value: qr.regularCleaningHallways },
    ]},
    { title: 'Deep Cleaning', rows: [
      { label: 'Bedrooms', value: qr.deepCleaningBedrooms },
      { label: 'Bathrooms', value: qr.deepCleaningBathrooms },
      { label: 'Kitchens', value: qr.deepCleaningKitchens },
      { label: 'Living Rooms', value: qr.deepCleaningLivingRooms },
      { label: 'Hallways', value: qr.deepCleaningHallways },
    ]},
    { title: 'End of Tenancy', rows: [
      { label: 'Bedrooms', value: qr.endOfTenancyBedrooms },
      { label: 'Bathrooms', value: qr.endOfTenancyBathrooms },
      { label: 'Kitchens', value: qr.endOfTenancyKitchens },
      { label: 'Living Rooms', value: qr.endOfTenancyLivingRooms },
      { label: 'Hallways', value: qr.endOfTenancyHallways },
    ]},
    { title: 'Window Cleaning', rows: [
      { label: 'Interior Windows', value: qr.interiorWindows },
      { label: 'Exterior Windows', value: qr.exteriorWindows },
      { label: 'Both Sides', value: qr.windowsBothSides },
    ]},
    { title: 'Oven Cleaning', rows: [
      { label: 'Standard Ovens', value: qr.standardOvens },
      { label: 'Double Ovens', value: qr.doubleOvens },
    ]},
    { title: 'Fridge Cleaning', rows: [
      { label: 'Fridges', value: qr.fridges },
      { label: 'Fridge Freezers', value: qr.fridgeFreezers },
    ]},
    { title: 'Carpet Cleaning', rows: [
      { label: 'Carpeted Rooms', value: qr.carpetedRooms },
      { label: 'Staircases', value: qr.staircases },
    ]},
    { title: 'Upholstery Cleaning', rows: [
      { label: 'Dining Chairs', value: qr.diningChairs },
      { label: 'Armchairs', value: qr.armchairs },
      { label: '2 Seat Sofas', value: qr._2SeatSofas },
      { label: '3 Seat Sofas', value: qr._3SeatSofas },
      { label: 'Corner Sofas', value: qr.cornerSofas },
    ]},
    { title: 'Garden Tidy', rows: [
      { label: 'Lawns', value: qr.lawns },
      { label: 'Leaf-Clearing Areas', value: qr.leafClearingAreas },
      { label: 'Weeding Areas', value: qr.weedingAreas },
      { label: 'Hedges', value: qr.hedges },
      { label: 'Paths', value: qr.paths },
    ]},
    { title: 'Steam Sanitisation', rows: [
      { label: 'Bedrooms', value: qr.steamSanitisationBedrooms },
      { label: 'Bathrooms', value: qr.steamSanitisationBathrooms },
      { label: 'Kitchens', value: qr.steamSanitisationKitchens },
      { label: 'Living Rooms', value: qr.steamSanitisationLivingRooms },
    ]},
    { title: 'Car Wash', rows: [
      { label: 'Cars', value: qr.carWashCars },
    ]},
  ];

  const populated = sections.filter(s => s.rows.some(r => gt0(r.value)));
  if (populated.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Service Details</p>
      {populated.map((s, i) => (
        <div key={i}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{s.title}</p>
          <div className="bg-background rounded px-2 py-0.5 divide-y divide-border/50">
            {s.rows.filter(r => gt0(r.value)).map((r, j) => (
              <div key={j} className="flex items-center justify-between py-0.5">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="text-sm font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

