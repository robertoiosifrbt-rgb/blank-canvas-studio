import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getQuoteRequest, GetQuoteRequestOutputType } from 'zite-endpoints-sdk';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, User, MapPin, CalendarDays, Sparkles, Home, StickyNote, Link2, Info, AlertTriangle } from 'lucide-react';
import { fmtDate } from '@/lib/format';

type QR = NonNullable<GetQuoteRequestOutputType['quoteRequest']>;

const hasVal = (v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return true;
};

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!hasVal(value)) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm mt-0.5 whitespace-pre-wrap ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

function NumField({ label, value }: { label: string; value?: number | null }) {
  if (!hasVal(value)) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/** A service sub-section that only renders if at least one row has a value */
function ServiceSection({ title, rows }: { title: string; rows: { label: string; value?: number | null }[] }) {
  const populated = rows.filter(r => hasVal(r.value));
  if (populated.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <div className="bg-muted/40 rounded-lg px-3 py-1 divide-y divide-border/50">
        {populated.map((r, i) => <NumField key={i} label={r.label} value={r.value} />)}
      </div>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode[] }) {
  const filtered = children.filter(Boolean);
  if (filtered.length === 0) return null;
  return <div className="grid grid-cols-2 gap-4">{filtered}</div>;
}

function SectionHeading({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: any; title: string; children: React.ReactNode[] }) {
  const filtered = children.filter(Boolean);
  if (filtered.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <SectionHeading icon={icon} title={title} />
        <Separator />
        {filtered}
      </CardContent>
    </Card>
  );
}

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
};

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-primary/10 text-primary',
  Approved: 'bg-blue-100 text-blue-700',
  Processing: 'bg-amber-100 text-amber-700',
  Converted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-destructive/10 text-destructive',
  Duplicate: 'bg-muted text-muted-foreground',
  'Conversion Error': 'bg-red-100 text-red-700',
};

export default function QuoteRequestPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const id = sp.get('id');
  const returnTo = sp.get('returnTo');
  const [qr, setQr] = useState<QR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('No Quote Request ID provided.'); setLoading(false); return; }
    setLoading(true);
    getQuoteRequest({ id })
      .then(d => { setQr(d.quoteRequest ?? null); if (!d.quoteRequest) setError('Quote Request not found.'); })
      .catch(e => setError(e?.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [id]);

  const goBack = () => { if (returnTo) nav(decodeURIComponent(returnTo)); else nav(-1); };

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
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-4 w-4" /></Button>
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold">Quote Request{qr.quoteRequestId ? ` #${qr.quoteRequestId}` : ''}</h2>
          {qr.status && <Badge className={statusClass}>{qr.status}</Badge>}
        </div>
      </div>

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
          <SectionCard icon={User} title="Customer Information">
            {[
              <FieldRow key="r1">{[
                <Field key="fn" label="Full Name" value={qr.fullName} />,
                <Field key="em" label="Email" value={qr.email} />,
              ]}</FieldRow>,
              <FieldRow key="r2">{[
                <Field key="ph" label="Phone" value={qr.phone} />,
                <Field key="ct" label="Customer Type" value={qr.customerType} />,
              ]}</FieldRow>,
            ]}
          </SectionCard>

          <SectionCard icon={MapPin} title="Address">
            {[
              <Field key="addr" label="Address" value={qr.address} />,
              <Field key="pc" label="Postcode" value={qr.postcode} />,
            ]}
          </SectionCard>

          <SectionCard icon={CalendarDays} title="Scheduling Preferences">
            {[
              <FieldRow key="r1">{[
                <Field key="pd" label="Preferred Date" value={qr.preferredDate ? fmtDate(qr.preferredDate) : null} />,
                <Field key="pt" label="Preferred Time" value={qr.preferredTime} />,
              ]}</FieldRow>,
            ]}
          </SectionCard>

          <SectionCard icon={Home} title="Property Details">
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
