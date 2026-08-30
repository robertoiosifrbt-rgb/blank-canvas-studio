/**
 * §5 / detaliile cererii de ofertă, așa cum le vede CURĂȚĂTORUL — ieșite din `JobCard.tsx`.
 *
 * ─── 🔴 De ce a ieșit (Sesiunea 142) ─────────────────────────────────────────
 * `JobCard.tsx` e la clichetul lui de mărime (641 de rânduri de cod) și **nu are voie să crească**
 * (`AGENT_RULES` §7.3). §36 adaugă un card nou pe el — ce spune omul despre vizită — deci felia
 * plătește locul: aceeași mișcare făcută deja de patru ori pe acest fișier (`GettingThereCard`,
 * `PropertyRiskCard`, `PropertyAccessCard`, `ActualTimesRows`).
 *
 * ⛔ **Nimic nu s-a schimbat la ce se vede.** Blocul e mutat întreg, cu helperele lui, care nu
 * erau folosite de nimic altceva — verificat înainte de mutare, nu presupus.
 */
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, ChevronDown, Home, StickyNote } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import type { CleanerJob } from './CleanerApp';

// ─── Work Details Section ──────────────────────────────────────────

type QuoteDetails = NonNullable<CleanerJob['quoteDetails']>;

const gt0 = (v: number | null | undefined): v is number => typeof v === 'number' && v > 0;
const hasStr = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim() !== '';

interface ServiceGroup {
  title: string;
  rows: { label: string; value: number | null | undefined }[];
}

function buildServiceGroups(qd: QuoteDetails): ServiceGroup[] {
  return [
    { title: 'Regular Cleaning', rows: [
      { label: 'Bedrooms', value: qd.regularCleaningBedrooms },
      { label: 'Bathrooms', value: qd.regularCleaningBathrooms },
      { label: 'Kitchens', value: qd.regularCleaningKitchens },
      { label: 'Living Rooms', value: qd.regularCleaningLivingRooms },
      { label: 'Hallways', value: qd.regularCleaningHallways },
    ]},
    { title: 'Deep Cleaning', rows: [
      { label: 'Bedrooms', value: qd.deepCleaningBedrooms },
      { label: 'Bathrooms', value: qd.deepCleaningBathrooms },
      { label: 'Kitchens', value: qd.deepCleaningKitchens },
      { label: 'Living Rooms', value: qd.deepCleaningLivingRooms },
      { label: 'Hallways', value: qd.deepCleaningHallways },
    ]},
    { title: 'End of Tenancy', rows: [
      { label: 'Bedrooms', value: qd.endOfTenancyBedrooms },
      { label: 'Bathrooms', value: qd.endOfTenancyBathrooms },
      { label: 'Kitchens', value: qd.endOfTenancyKitchens },
      { label: 'Living Rooms', value: qd.endOfTenancyLivingRooms },
      { label: 'Hallways', value: qd.endOfTenancyHallways },
    ]},
    { title: 'Carpet Cleaning', rows: [
      { label: 'Carpeted Rooms', value: qd.carpetedRooms },
      { label: 'Staircases', value: qd.staircases },
    ]},
    { title: 'Upholstery Cleaning', rows: [
      { label: 'Dining Chairs', value: qd.diningChairs },
      { label: 'Armchairs', value: qd.armchairs },
      { label: '2 Seat Sofas', value: qd._2SeatSofas },
      { label: '3 Seat Sofas', value: qd._3SeatSofas },
      { label: 'Corner Sofas', value: qd.cornerSofas },
    ]},
    { title: 'Window Cleaning', rows: [
      { label: 'Interior Windows', value: qd.interiorWindows },
      { label: 'Exterior Windows', value: qd.exteriorWindows },
      { label: 'Both Sides', value: qd.windowsBothSides },
    ]},
    { title: 'Oven / Appliance Cleaning', rows: [
      { label: 'Standard Ovens', value: qd.standardOvens },
      { label: 'Double Ovens', value: qd.doubleOvens },
      { label: 'Fridges', value: qd.fridges },
      { label: 'Fridge Freezers', value: qd.fridgeFreezers },
    ]},
    { title: 'Garden Tidy', rows: [
      { label: 'Lawns', value: qd.lawns },
      { label: 'Leaf-Clearing Areas', value: qd.leafClearingAreas },
      { label: 'Weeding Areas', value: qd.weedingAreas },
      { label: 'Hedges', value: qd.hedges },
      { label: 'Paths', value: qd.paths },
    ]},
    { title: 'Steam Sanitisation', rows: [
      { label: 'Bedrooms', value: qd.steamSanitisationBedrooms },
      { label: 'Bathrooms', value: qd.steamSanitisationBathrooms },
      { label: 'Kitchens', value: qd.steamSanitisationKitchens },
      { label: 'Living Rooms', value: qd.steamSanitisationLivingRooms },
    ]},
    { title: 'Car Wash', rows: [
      { label: 'Cars', value: qd.carWashCars },
    ]},
  ];
}

export default function WorkDetailsSection({ job }: { job: CleanerJob }) {
  const [open, setOpen] = useState(false);
  const qd = job.quoteDetails;
  if (!qd) return null;

  const services = (qd.services?.length ?? 0) > 0 ? qd.services! : [];
  const allGroups = buildServiceGroups(qd);
  const populatedGroups = allGroups.filter(g => g.rows.some(r => gt0(r.value)));
  const hasProperty = hasStr(qd.propertyType) || gt0(qd.totalBedrooms) || gt0(qd.totalBathrooms) || hasStr(qd.propertyDetails);
  const hasNotes = hasStr(qd.additionalNotes);
  const hasPreferred = hasStr(qd.preferredDate) || hasStr(qd.preferredTime);

  if (services.length === 0 && populatedGroups.length === 0 && !hasProperty && !hasNotes && !hasPreferred) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Job Details / Work Required
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-3 text-sm">
          {services.length > 0 && (
            <DetailGroup title="Services Requested">
              <div className="flex flex-wrap gap-1.5">
                {services.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
              </div>
            </DetailGroup>
          )}

          {hasPreferred && (
            <DetailGroup title="Preferred Schedule">
              {hasStr(qd.preferredDate) && <DetailRow label="Date" value={fmtDate(qd.preferredDate!)} />}
              {hasStr(qd.preferredTime) && <DetailRow label="Time" value={qd.preferredTime!} />}
            </DetailGroup>
          )}

          {hasProperty && (
            <DetailGroup title="Property Details" icon={<Home className="h-3.5 w-3.5" />}>
              {hasStr(qd.propertyType) && <DetailRow label="Property Type" value={qd.propertyType!} />}
              {gt0(qd.totalBedrooms) && <DetailRow label="Bedrooms" value={String(qd.totalBedrooms)} />}
              {gt0(qd.totalBathrooms) && <DetailRow label="Bathrooms" value={String(qd.totalBathrooms)} />}
              {hasStr(qd.propertyDetails) && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words pt-1">{qd.propertyDetails}</p>
              )}
            </DetailGroup>
          )}

          {populatedGroups.map((g, i) => (
            <DetailGroup key={i} title={g.title}>
              {g.rows.filter(r => gt0(r.value)).map((r, j) => (
                <DetailRow key={j} label={r.label} value={String(r.value)} />
              ))}
            </DetailGroup>
          ))}

          {hasNotes && (
            <DetailGroup title="Additional Notes" icon={<StickyNote className="h-3.5 w-3.5" />}>
              <p className="text-sm whitespace-pre-wrap break-words">{qd.additionalNotes}</p>
            </DetailGroup>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DetailGroup({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {icon}{title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

