/**
 * ensureJobChecklist — generates/syncs persistent checklist items for a Job
 * based on the linked Quote Request's operational quantity fields.
 */
import { Jobs, QuoteRequests, JobChecklistItems } from 'zite-integrations-backend-sdk';
import { fetchAll } from './fetchAll';
import { extractId } from './validation';
import { logAuditBestEffort } from './audit';

/** Mapping from QR field → group name + singular label */
const FIELD_MAP: { field: string; group: string; label: string }[] = [
  // Regular Cleaning
  { field: 'regularCleaningBedrooms', group: 'Regular Cleaning', label: 'Bedroom' },
  { field: 'regularCleaningBathrooms', group: 'Regular Cleaning', label: 'Bathroom' },
  { field: 'regularCleaningKitchens', group: 'Regular Cleaning', label: 'Kitchen' },
  { field: 'regularCleaningLivingRooms', group: 'Regular Cleaning', label: 'Living Room' },
  { field: 'regularCleaningHallways', group: 'Regular Cleaning', label: 'Hallway' },
  // Deep Cleaning
  { field: 'deepCleaningBedrooms', group: 'Deep Cleaning', label: 'Bedroom' },
  { field: 'deepCleaningBathrooms', group: 'Deep Cleaning', label: 'Bathroom' },
  { field: 'deepCleaningKitchens', group: 'Deep Cleaning', label: 'Kitchen' },
  { field: 'deepCleaningLivingRooms', group: 'Deep Cleaning', label: 'Living Room' },
  { field: 'deepCleaningHallways', group: 'Deep Cleaning', label: 'Hallway' },
  // End of Tenancy
  { field: 'endOfTenancyBedrooms', group: 'End of Tenancy', label: 'Bedroom' },
  { field: 'endOfTenancyBathrooms', group: 'End of Tenancy', label: 'Bathroom' },
  { field: 'endOfTenancyKitchens', group: 'End of Tenancy', label: 'Kitchen' },
  { field: 'endOfTenancyLivingRooms', group: 'End of Tenancy', label: 'Living Room' },
  { field: 'endOfTenancyHallways', group: 'End of Tenancy', label: 'Hallway' },
  // Window Cleaning
  { field: 'interiorWindows', group: 'Window Cleaning', label: 'Interior Window' },
  { field: 'exteriorWindows', group: 'Window Cleaning', label: 'Exterior Window' },
  { field: 'windowsBothSides', group: 'Window Cleaning', label: 'Window (Both Sides)' },
  // Oven / Appliance Cleaning
  { field: 'standardOvens', group: 'Oven / Appliance Cleaning', label: 'Standard Oven' },
  { field: 'doubleOvens', group: 'Oven / Appliance Cleaning', label: 'Double Oven' },
  { field: 'fridges', group: 'Oven / Appliance Cleaning', label: 'Fridge' },
  { field: 'fridgeFreezers', group: 'Oven / Appliance Cleaning', label: 'Fridge Freezer' },
  // Carpet Cleaning
  { field: 'carpetedRooms', group: 'Carpet Cleaning', label: 'Carpeted Room' },
  { field: 'staircases', group: 'Carpet Cleaning', label: 'Staircase' },
  // Upholstery Cleaning
  { field: 'diningChairs', group: 'Upholstery Cleaning', label: 'Dining Chair' },
  { field: 'armchairs', group: 'Upholstery Cleaning', label: 'Armchair' },
  { field: '_2SeatSofas', group: 'Upholstery Cleaning', label: '2 Seat Sofa' },
  { field: '_3SeatSofas', group: 'Upholstery Cleaning', label: '3 Seat Sofa' },
  { field: 'cornerSofas', group: 'Upholstery Cleaning', label: 'Corner Sofa' },
  // Garden Tidy
  { field: 'lawns', group: 'Garden Tidy', label: 'Lawn' },
  { field: 'leafClearingAreas', group: 'Garden Tidy', label: 'Leaf-Clearing Area' },
  { field: 'weedingAreas', group: 'Garden Tidy', label: 'Weeding Area' },
  { field: 'hedges', group: 'Garden Tidy', label: 'Hedge' },
  { field: 'paths', group: 'Garden Tidy', label: 'Path' },
  // Steam Sanitisation
  { field: 'steamSanitisationBedrooms', group: 'Steam Sanitisation', label: 'Bedroom' },
  { field: 'steamSanitisationBathrooms', group: 'Steam Sanitisation', label: 'Bathroom' },
  { field: 'steamSanitisationKitchens', group: 'Steam Sanitisation', label: 'Kitchen' },
  { field: 'steamSanitisationLivingRooms', group: 'Steam Sanitisation', label: 'Living Room' },
];

interface DesiredItem {
  itemKey: string;
  groupName: string;
  itemLabel: string;
  sourceField: string;
  itemIndex: number;
}

function buildDesiredItems(qr: Record<string, any>): DesiredItem[] {
  const items: DesiredItem[] = [];
  for (const { field, group, label } of FIELD_MAP) {
    const qty = typeof qr[field] === 'number' ? qr[field] : 0;
    if (qty <= 0) continue;
    for (let i = 1; i <= qty; i++) {
      items.push({
        itemKey: `${field}-${i}`,
        groupName: group,
        itemLabel: `${label} ${i}`,
        sourceField: field,
        itemIndex: i,
      });
    }
  }
  return items;
}

/**
 * Ensure checklist items exist for the given Job.
 * - Creates missing items
 * - Marks surplus unchecked items as obsolete
 * - Never deletes completed items
 * Returns { created, obsoleted, total }
 */
export async function ensureJobChecklist(
  jobId: string,
  performedBy?: string,
): Promise<{ created: number; obsoleted: number; total: number }> {
  // 1. Load the Job
  const job = await Jobs.findOne({ id: jobId, fields: ['id', 'jobId', 'quoteRequests'] });
  if (!job) return { created: 0, obsoleted: 0, total: 0 };

  // 2. Load linked Quote Request
  const qrId = extractId(job.quoteRequests);
  if (!qrId) return { created: 0, obsoleted: 0, total: 0 };

  const qr = await QuoteRequests.findOne({ id: qrId });
  if (!qr) return { created: 0, obsoleted: 0, total: 0 };

  // 3. Build desired items from QR quantities
  const desired = buildDesiredItems(qr as Record<string, any>);

  // 4. Load existing checklist items for this Job
  const existing = await fetchAll(
    (p) => JobChecklistItems.findAll(p),
    { filters: { job: jobId } },
  );
  const existingByKey = new Map(existing.map(e => [e.itemKey ?? '', e]));

  // 5. Create missing items
  const desiredKeys = new Set(desired.map(d => d.itemKey));
  const toCreate = desired.filter(d => !existingByKey.has(d.itemKey));

  let created = 0;
  if (toCreate.length > 0) {
    // bulkCreate in batches of 100
    for (let i = 0; i < toCreate.length; i += 100) {
      const batch = toCreate.slice(i, i + 100);
      await JobChecklistItems.bulkCreate({
        records: batch.map(item => ({
          itemKey: item.itemKey,
          job: jobId,
          groupName: item.groupName,
          itemLabel: item.itemLabel,
          sourceField: item.sourceField,
          itemIndex: item.itemIndex,
          completed: false,
          notApplicable: false,
          obsolete: false,
        })),
      });
      created += batch.length;
    }
  }

  // 6. Un-obsolete items that are back in the desired set
  for (const e of existing) {
    if (e.obsolete && desiredKeys.has(e.itemKey ?? '')) {
      await JobChecklistItems.update({ id: e.id, record: { obsolete: false } });
    }
  }

  // 7. Mark surplus unchecked items as obsolete
  let obsoleted = 0;
  for (const e of existing) {
    if (!desiredKeys.has(e.itemKey ?? '') && !e.obsolete && !e.completed && !e.notApplicable) {
      await JobChecklistItems.update({ id: e.id, record: { obsolete: true } });
      obsoleted++;
    }
  }

  const total = desired.length;

  // Audit
  if (created > 0 || obsoleted > 0) {
    await logAuditBestEffort({
      entityType: 'Job',
      entityId: jobId,
      action: 'job_edited',
      performedBy: performedBy ?? 'system',
      summary: `Checklist synced for Job #${job.jobId}: ${created} created, ${obsoleted} obsoleted, ${total} total`,
      newValues: { checklistCreated: created, checklistObsoleted: obsoleted, checklistTotal: total },
    });
  }

  return { created, obsoleted, total };
}
