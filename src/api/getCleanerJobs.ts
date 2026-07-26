import { z } from 'zod';
import { createEndpoint, Jobs, Customers, JobAssignments, Cleaners, QuoteRequests, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { ukToday } from '../lib/ukDate';
import { cleanerJobSchema } from '../lib/zodSchemas';
import { isClosedStatus } from '../lib/jobOperationalPolicy';
import { extractId } from '../lib/validation';

/** Fields to fetch from the linked QuoteRequest — operational only, no financials/admin */
const QR_FIELDS = [
  'id', 'services', 'preferredDate', 'preferredTime', 'propertyDetails', 'additionalNotes',
  'propertyType', 'totalBedrooms', 'totalBathrooms',
  'regularCleaningBedrooms', 'regularCleaningBathrooms', 'regularCleaningKitchens', 'regularCleaningLivingRooms', 'regularCleaningHallways',
  'deepCleaningBedrooms', 'deepCleaningBathrooms', 'deepCleaningKitchens', 'deepCleaningLivingRooms', 'deepCleaningHallways',
  'endOfTenancyBedrooms', 'endOfTenancyBathrooms', 'endOfTenancyKitchens', 'endOfTenancyLivingRooms', 'endOfTenancyHallways',
  'interiorWindows', 'exteriorWindows', 'windowsBothSides',
  'standardOvens', 'doubleOvens',
  'fridges', 'fridgeFreezers',
  'carpetedRooms', 'staircases',
  'diningChairs', 'armchairs', '_2SeatSofas', '_3SeatSofas', 'cornerSofas',
  'lawns', 'leafClearingAreas', 'weedingAreas', 'hedges', 'paths',
  'steamSanitisationBedrooms', 'steamSanitisationBathrooms', 'steamSanitisationKitchens', 'steamSanitisationLivingRooms',
];

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    today: z.array(cleanerJobSchema),
    upcoming: z.array(cleanerJobSchema),
    history: z.array(cleanerJobSchema),
  }),
  execute: async ({ context }) => {
    if (context.user.role !== 'Cleaner' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }
    const cleanerId = extractId(context.user.cleaner);
    if (!cleanerId) return { today: [], upcoming: [], history: [] };

    const cleaner = await Cleaners.findOne({ id: cleanerId, fields: ['id', 'active'] });
    if (!cleaner || !cleaner.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your cleaner account is not active' });
    }

    const allAssignments = await fetchAll((p) => JobAssignments.findAll(p), { filters: { cleaner: cleanerId }, fields: ['id', 'job'] });
    const assignedJobIds = allAssignments
      .map(a => extractId(a.job))
      .filter(Boolean) as string[];
    if (assignedJobIds.length === 0) return { today: [], upcoming: [], history: [] };

    const JOB_FIELDS = ['id', 'jobId', 'jobDate', 'startTime', 'finishTime', 'service', 'address', 'status', 'customer', 'customerInstructions', 'cleanerCompletionNotes', 'actualStartTime', 'actualFinishTime', 'quoteRequests'];

    const BATCH_SIZE = 100;
    const allJobs: any[] = [];
    for (let i = 0; i < assignedJobIds.length; i += BATCH_SIZE) {
      const batch = assignedJobIds.slice(i, i + BATCH_SIZE);
      const res = await fetchAll((p) => Jobs.findAll(p), { filters: { id: { in: batch } }, fields: JOB_FIELDS });
      allJobs.push(...res);
    }

    // Collect customer IDs and quote request IDs
    const customerIds = new Set<string>();
    const qrIds = new Set<string>();
    const jobQrMap: Record<string, string> = {}; // jobId -> qrId
    for (const j of allJobs) {
      const cid = extractId(j.customer);
      if (cid) customerIds.add(cid);
      const qrId = extractId(j.quoteRequests);
      if (qrId) {
        qrIds.add(qrId);
        jobQrMap[j.id] = qrId;
      }
    }

    // Fetch customers
    const custMap: Record<string, { name: string; phone: string }> = {};
    if (customerIds.size > 0) {
      const custIdArr = Array.from(customerIds);
      for (let i = 0; i < custIdArr.length; i += BATCH_SIZE) {
        const batch = custIdArr.slice(i, i + BATCH_SIZE);
        const custs = await fetchAll((p) => Customers.findAll(p), { filters: { id: { in: batch } }, fields: ['id', 'customerName', 'phone'] });
        custs.forEach(c => { custMap[c.id] = { name: c.customerName ?? '', phone: c.phone ?? '' }; });
      }
    }

    // Fetch linked QuoteRequests — operational fields only
    const qrMap: Record<string, any> = {};
    if (qrIds.size > 0) {
      const qrIdArr = Array.from(qrIds);
      for (let i = 0; i < qrIdArr.length; i += BATCH_SIZE) {
        const batch = qrIdArr.slice(i, i + BATCH_SIZE);
        const qrs = await fetchAll((p) => QuoteRequests.findAll(p), { filters: { id: { in: batch } }, fields: QR_FIELDS });
        qrs.forEach(qr => { qrMap[qr.id] = qr; });
      }
    }

    const today = ukToday();

    const mapped = allJobs.map(j => {
      const custId = extractId(j.customer);
      const cust = custMap[custId ?? ''];
      const qrId = jobQrMap[j.id];
      const qr = qrId ? qrMap[qrId] : null;

      return {
        id: j.id,
        jobId: j.jobId,
        jobDate: j.jobDate,
        startTime: j.startTime,
        finishTime: j.finishTime,
        service: j.service,
        customerName: cust?.name ?? '',
        customerPhone: cust?.phone ?? '',
        address: j.address,
        status: j.status,
        customerInstructions: j.customerInstructions,
        cleanerCompletionNotes: j.cleanerCompletionNotes,
        actualStartTime: j.actualStartTime,
        actualFinishTime: j.actualFinishTime,
        quoteDetails: qr ? {
          services: Array.isArray(qr.services) ? qr.services : null,
          preferredDate: qr.preferredDate ?? null,
          preferredTime: qr.preferredTime ?? null,
          propertyDetails: qr.propertyDetails ?? null,
          additionalNotes: qr.additionalNotes ?? null,
          propertyType: qr.propertyType ?? null,
          totalBedrooms: qr.totalBedrooms ?? null,
          totalBathrooms: qr.totalBathrooms ?? null,
          regularCleaningBedrooms: qr.regularCleaningBedrooms ?? null,
          regularCleaningBathrooms: qr.regularCleaningBathrooms ?? null,
          regularCleaningKitchens: qr.regularCleaningKitchens ?? null,
          regularCleaningLivingRooms: qr.regularCleaningLivingRooms ?? null,
          regularCleaningHallways: qr.regularCleaningHallways ?? null,
          deepCleaningBedrooms: qr.deepCleaningBedrooms ?? null,
          deepCleaningBathrooms: qr.deepCleaningBathrooms ?? null,
          deepCleaningKitchens: qr.deepCleaningKitchens ?? null,
          deepCleaningLivingRooms: qr.deepCleaningLivingRooms ?? null,
          deepCleaningHallways: qr.deepCleaningHallways ?? null,
          endOfTenancyBedrooms: qr.endOfTenancyBedrooms ?? null,
          endOfTenancyBathrooms: qr.endOfTenancyBathrooms ?? null,
          endOfTenancyKitchens: qr.endOfTenancyKitchens ?? null,
          endOfTenancyLivingRooms: qr.endOfTenancyLivingRooms ?? null,
          endOfTenancyHallways: qr.endOfTenancyHallways ?? null,
          interiorWindows: qr.interiorWindows ?? null,
          exteriorWindows: qr.exteriorWindows ?? null,
          windowsBothSides: qr.windowsBothSides ?? null,
          standardOvens: qr.standardOvens ?? null,
          doubleOvens: qr.doubleOvens ?? null,
          fridges: qr.fridges ?? null,
          fridgeFreezers: qr.fridgeFreezers ?? null,
          carpetedRooms: qr.carpetedRooms ?? null,
          staircases: qr.staircases ?? null,
          diningChairs: qr.diningChairs ?? null,
          armchairs: qr.armchairs ?? null,
          _2SeatSofas: qr._2SeatSofas ?? null,
          _3SeatSofas: qr._3SeatSofas ?? null,
          cornerSofas: qr.cornerSofas ?? null,
          lawns: qr.lawns ?? null,
          leafClearingAreas: qr.leafClearingAreas ?? null,
          weedingAreas: qr.weedingAreas ?? null,
          hedges: qr.hedges ?? null,
          paths: qr.paths ?? null,
          steamSanitisationBedrooms: qr.steamSanitisationBedrooms ?? null,
          steamSanitisationBathrooms: qr.steamSanitisationBathrooms ?? null,
          steamSanitisationKitchens: qr.steamSanitisationKitchens ?? null,
          steamSanitisationLivingRooms: qr.steamSanitisationLivingRooms ?? null,
        } : null,
      };
    });

    const todayJobs: typeof mapped = [];
    const upcomingJobs: typeof mapped = [];
    const historyJobs: typeof mapped = [];

    for (const j of mapped) {
      const d = j.jobDate ?? '';
      const closed = isClosedStatus(j.status);

      if (closed) {
        historyJobs.push(j);
      } else if (j.status === 'In Progress' || d === today) {
        todayJobs.push(j);
      } else if (d > today) {
        upcomingJobs.push(j);
      } else {
        historyJobs.push(j);
      }
    }

    todayJobs.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || ((b.jobId ?? 0) - (a.jobId ?? 0)) || b.id.localeCompare(a.id));
    upcomingJobs.sort((a, b) => (a.jobDate ?? '').localeCompare(b.jobDate ?? '') || (a.startTime ?? '').localeCompare(b.startTime ?? '') || ((b.jobId ?? 0) - (a.jobId ?? 0)) || b.id.localeCompare(a.id));
    historyJobs.sort((a, b) => (b.jobDate ?? '').localeCompare(a.jobDate ?? '') || ((b.jobId ?? 0) - (a.jobId ?? 0)) || b.id.localeCompare(a.id));

    return { today: todayJobs, upcoming: upcomingJobs, history: historyJobs };
  },
});
