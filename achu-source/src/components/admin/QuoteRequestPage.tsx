import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getQuoteRequest, saveQuoteRequest, deleteQuoteRequest, GetQuoteRequestOutputType } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, FileText, User, MapPin, CalendarDays, Sparkles, Home, StickyNote, Link2, Info, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import QuoteRequestsList from './QuoteRequestsList';
import { STATUS_COLORS } from './quoteRequestStatusColors';
import QuoteRequestTriage from './QuoteRequestTriage';
// §6 (Sesiunea 159) — ce a spus clientul despre TIMP, cu corectura biroului. Fișier propriu: pagina
// e peste plafonul de 500 de rânduri, iar §9 cere oricum o capabilitate nouă în fișierul ei.
import QuoteRequestTiming from './QuoteRequestTiming';
import { Field, ServiceSection, FieldRow, SectionHeading, SectionCard } from './QuoteRequestFields';
import { hasVal } from '@/lib/hasValue';
import { fmtDate } from '@/lib/format';
import { ApiError } from '@/lib/apiClient';

/** Sesiunea 26 (ACHU-187) — the only statuses an Admin should ever pick by
 * hand. Processing/Converted/Conversion Error are set exclusively by the
 * conversion engine (quoteRequestConverter.ts) and would be misleading if
 * offered here as manual choices. */
export const MANUAL_STATUSES = ['New', 'Approved', 'Rejected', 'Duplicate'];

type QR = NonNullable<GetQuoteRequestOutputType['quoteRequest']>;

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
};

// ⚠️ Culorile stau într-un fișier al lor: le citesc AMÂNDOUĂ ecranele (lista și fișa), iar o a doua
// copie ar face ca aceeași stare să arate diferit în două locuri.


export default function QuoteRequestPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const id = sp.get('id');
  const returnTo = sp.get('returnTo');
  const [qr, setQr] = useState<QR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingStatus, setEditingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  /**
   * ACHU-546 (Sesiunea 120) — the button that makes the public page's promise true.
   *
   * The quote form tells a visitor: *"If you do not [become a customer], we delete your
   * enquiry once it is clearly no longer live."* Nothing in the application could do it —
   * no route, no button, no scheduler — so the sentence described nothing for as long as
   * it had been on the page. Roberto's decision, asked directly: build the deletion.
   *
   * ⚠️ **Deliberately a person's judgement, not a timer.** "Clearly no longer live" is not
   * a date: an enquiry from March still being discussed is live, one from last week that
   * got a polite no is not. A "delete after N days" rule needs an N nobody has decided,
   * and a wrong N either deletes a live lead or keeps a dead one.
   *
   * ⛔ The server refuses (409) any enquiry that became a customer or a visit — those are
   * covered by the customer's own erasure, which is stricter. This screen shows that
   * refusal as it comes, rather than hiding the button and leaving the office guessing why.
   */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    getQuoteRequest({ id })
      .then(d => { setQr(d.quoteRequest ?? null); if (!d.quoteRequest) setError('Quote Request not found.'); })
      .catch(e => setError(e?.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [id]);

  const goBack = () => { if (returnTo) nav(decodeURIComponent(returnTo)); else nav(-1); };

  const handleDelete = async () => {
    if (!qr) return;
    setDeleting(true);
    try {
      await deleteQuoteRequest({ id: qr.id });
      toast.success(`Enquiry #${qr.quoteRequestId} deleted.`);
      setConfirmingDelete(false);
      // Back to the list: the record this page is about no longer exists, and staying
      // would leave the office looking at something that has gone.
      nav('/admin/quote-requests');
    } catch (e) {
      // The server's sentence, not a generic one — it names what to use instead.
      toast.error(e instanceof ApiError ? e.message : 'Could not delete this enquiry. Please try again.');
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const startEditingStatus = () => {
    setPendingStatus(qr?.status ?? 'New');
    setStatusError(null);
    setEditingStatus(true);
  };

  const saveStatus = async () => {
    if (!qr) return;
    setSavingStatus(true);
    setStatusError(null);
    try {
      const res = await saveQuoteRequest({ id: qr.id, status: pendingStatus, _revision: qr._revision });
      setQr({ ...qr, status: pendingStatus, _revision: res._revision });
      setEditingStatus(false);
    } catch (e) {
      setStatusError(e instanceof ApiError ? e.message : 'Failed to save. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };

  if (!id) return <QuoteRequestsList />;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3"><Skeleton className="h-9 w-9" /><Skeleton className="h-7 w-64" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-xl" /><Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !qr) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" />Back</Button>
        <Card><CardContent className="p-8 text-center text-muted-foreground">{error || 'Not found.'}</CardContent></Card>
      </div>
    );
  }

  const services = qr.services?.length ? qr.services : [];
  const statusClass = STATUS_COLORS[qr.status ?? ''] ?? 'bg-muted text-muted-foreground';
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" title="Back" onClick={goBack}><ArrowLeft className="h-4 w-4" /></Button>
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold">Quote Request{qr.quoteRequestId ? ` #${qr.quoteRequestId}` : ''}</h2>
          {qr.status && <Badge className={statusClass}>{qr.status}</Badge>}
        </div>

        {editingStatus ? (
          <div className="flex items-center gap-2">
            <Select value={pendingStatus} onValueChange={setPendingStatus}>
              <SelectTrigger className="w-40" aria-label="Quote request status"><SelectValue /></SelectTrigger>
              <SelectContent>{MANUAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={saveStatus} disabled={savingStatus}>
              {savingStatus && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingStatus(false)} disabled={savingStatus}>Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={startEditingStatus}>Change Status</Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete enquiry
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={v => !v && setConfirmingDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete enquiry #{qr.quoteRequestId}?</AlertDialogTitle>
            {/* ⚠️ Says what is destroyed and that it cannot be undone. This is the only
                screen in the app that removes somebody's contact details outright, and it
                exists because we promised to. */}
            <AlertDialogDescription>
              This permanently removes {qr.fullName || 'this person'}&apos;s name, contact details and everything
              they wrote about the property. It cannot be undone. We tell people on the quote form that we do
              this once an enquiry is no longer live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {statusError && <p className="text-sm text-destructive">{statusError}</p>}

      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {qr.source && <span>Source: <strong className="text-foreground">{qr.source}</strong></span>}
        {qr.submittedAt && <span>Submitted: <strong className="text-foreground">{fmtDateTime(qr.submittedAt)}</strong></span>}
        {qr.updatedAt && <span>Updated: <strong className="text-foreground">{fmtDateTime(qr.updatedAt)}</strong></span>}
        {hasVal(qr.submissionId) && <span>Submission ID: <strong className="text-foreground font-mono text-xs">{qr.submissionId}</strong></span>}
      </div>

      {/* Conversion error banner */}
      {qr.status === 'Conversion Error' && qr.conversionError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive text-sm">Conversion Failed</p>
            <p className="text-sm text-destructive/80 mt-1">{qr.conversionError}</p>
          </div>
        </div>
      )}

      {/* Linked records */}
      {(qr.customerName || qr.jobLabel) && (
        <div className="flex flex-wrap gap-3">
          {qr.customerName && (
            <Badge variant="outline" className="gap-1.5 text-sm py-1 px-3">
              <User className="h-3.5 w-3.5" />Linked Customer: {qr.customerName}
            </Badge>
          )}
          {qr.jobLabel && (
            <Badge variant="outline" className="gap-1.5 text-sm py-1 px-3">
              <Link2 className="h-3.5 w-3.5" />Linked Job: {qr.jobLabel}
            </Badge>
          )}
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <SectionCard icon={User} title="Customer Information"
            when={[qr.fullName, qr.email, qr.phone, qr.customerType].some(hasVal)}>
            {[
              <FieldRow key="r1" when={[qr.fullName, qr.email].some(hasVal)}>{[
                <Field key="fn" label="Full Name" value={qr.fullName} />,
                <Field key="em" label="Email" value={qr.email} />,
              ]}</FieldRow>,
              <FieldRow key="r2" when={[qr.phone, qr.customerType].some(hasVal)}>{[
                <Field key="ph" label="Phone" value={qr.phone} />,
                <Field key="ct" label="Customer Type" value={qr.customerType} />,
              ]}</FieldRow>,
            ]}
          </SectionCard>

          <SectionCard icon={MapPin} title="Address" when={[qr.address, qr.postcode].some(hasVal)}>
            {[
              <Field key="addr" label="Address" value={qr.address} />,
              <Field key="pc" label="Postcode" value={qr.postcode} />,
            ]}
          </SectionCard>

          <SectionCard icon={CalendarDays} title="Scheduling Preferences"
            when={[qr.preferredDate, qr.preferredTime].some(hasVal)}>
            {[
              <FieldRow key="r1" when={[qr.preferredDate, qr.preferredTime].some(hasVal)}>{[
                <Field key="pd" label="Preferred Date" value={qr.preferredDate ? fmtDate(qr.preferredDate) : null} />,
                <Field key="pt" label="Preferred Time" value={qr.preferredTime} />,
              ]}</FieldRow>,
            ]}
          </SectionCard>

          {/*
            §6 (Sesiunea 159) — imediat sub data preferată, fiindcă răspunde la aceeași întrebare:
            CÂND. ⛔ Cardul de deasupra se ascunde când nu e nici dată, nici oră; ăsta **rămâne**,
            fiindcă „cât de repede îi trebuie" se notează și pe o cerere fără nicio dată.
          */}
          <QuoteRequestTiming
            key="timing" id={qr.id} revision={qr._revision}
            urgency={qr.urgency} dateFlexible={qr.dateFlexible}
            hasPreferredDate={hasVal(qr.preferredDate)}
            onSaved={patch => setQr({ ...qr, ...patch })}
          />

          <SectionCard icon={Home} title="Property Details"
            when={[qr.propertyType, qr.totalBedrooms, qr.totalBathrooms, qr.propertyDetails].some(hasVal)}>
            {[
              <Field key="pt" label="Property Type" value={qr.propertyType} />,
              <FieldRow key="r1">{[
                hasVal(qr.totalBedrooms) ? <Field key="tb" label="Total Bedrooms" value={String(qr.totalBedrooms)} /> : null,
                hasVal(qr.totalBathrooms) ? <Field key="tba" label="Total Bathrooms" value={String(qr.totalBathrooms)} /> : null,
              ]}</FieldRow>,
              <Field key="pd" label="Property Details" value={qr.propertyDetails} />,
            ]}
          </SectionCard>

          {hasVal(qr.additionalNotes) && (
            <Card key="notes">
              <CardContent className="p-5 space-y-4">
                <SectionHeading icon={StickyNote} title="Additional Notes" />
                <Separator />
                <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-3">{qr.additionalNotes}</p>
              </CardContent>
            </Card>
          )}
          {/*
            §6 (Sesiunea 158) — ce crede BIROUL, imediat sub ce a scris clientul: cele două se
            citesc împreună, iar ordinea spune care e a cui. ⛔ Logica stă în fișierul ei
            (`QuoteRequestTriage`), fiindcă pagina asta e deja peste plafonul de 500 de rânduri.
          */}
          <QuoteRequestTriage
            key="triage" id={qr.id} revision={qr._revision}
            internalAssessment={qr.internalAssessment} siteVisitRequired={qr.siteVisitRequired} infoNeededNote={qr.infoNeededNote}
            onSaved={patch => setQr({ ...qr, ...patch })}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Services Requested + Quantities */}
          <ServiceDetailsCard qr={qr} services={services} />

          {/* Record Metadata */}
          <SectionCard icon={Info} title="Record Metadata">
            {[
              <FieldRow key="r1">{[
                <Field key="rid" label="Record ID" value={qr.id} mono />,
                <Field key="qid" label="Quote Request ID" value={qr.quoteRequestId != null ? String(qr.quoteRequestId) : null} />,
              ]}</FieldRow>,
              <FieldRow key="r2">{[
                <Field key="st" label="Status" value={qr.status} />,
                <Field key="src" label="Source" value={qr.source} />,
              ]}</FieldRow>,
              <FieldRow key="r3">{[
                hasVal(qr.submissionId) ? <Field key="sid" label="Submission ID" value={qr.submissionId} mono /> : null,
                <Field key="sat" label="Submitted At" value={fmtDateTime(qr.submittedAt)} />,
              ]}</FieldRow>,
              <Field key="upd" label="Last Updated" value={fmtDateTime(qr.updatedAt)} />,
            ]}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/** Combined services + quantities card — built entirely from individual numeric DB fields */
function ServiceDetailsCard({ qr, services }: { qr: QR; services: string[] }) {
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

  const populatedSections = sections.filter(s => s.rows.some(r => hasVal(r.value)));
  const hasAnything = services.length > 0 || populatedSections.length > 0;
  if (!hasAnything) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <SectionHeading icon={Sparkles} title="Services Requested" />
        <Separator />
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {services.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
          </div>
        )}
        {populatedSections.length > 0 && (
          <div className="space-y-4">
            {populatedSections.map((s, i) => (
              <ServiceSection key={i} title={s.title} rows={s.rows} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

