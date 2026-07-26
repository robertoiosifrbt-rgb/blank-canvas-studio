import { z } from 'zod';
import { createEndpoint, QuoteRequests, Customers, Jobs, ZiteError } from 'zite-integrations-backend-sdk';
import { computeRevision, REVISION_FIELDS } from '../lib/concurrency';

const numField = z.number().optional().nullable();

export default createEndpoint({
  authenticated: true,
  description: 'Fetch a single Quote Request by ID — returns every field',
  inputSchema: z.object({ id: z.string().min(1) }),
  outputSchema: z.object({
    quoteRequest: z.object({
      id: z.string(),
      quoteRequestId: z.union([z.string(), z.number()]).optional().nullable(),
      fullName: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      postcode: z.string().optional().nullable(),
      customerType: z.string().optional().nullable(),
      services: z.array(z.string()).optional().nullable(),
      preferredDate: z.string().optional().nullable(),
      preferredTime: z.string().optional().nullable(),
      propertyDetails: z.string().optional().nullable(),
      additionalNotes: z.string().optional().nullable(),
      serviceDetails: z.string().optional().nullable(),
      status: z.string().optional().nullable(),
      source: z.string().optional().nullable(),
      submissionId: z.string().optional().nullable(),
      submittedAt: z.string().optional().nullable(),
      updatedAt: z.string().optional().nullable(),
      customerName: z.string().optional().nullable(),
      customerId: z.string().optional().nullable(),
      jobLabel: z.string().optional().nullable(),
      jobId: z.string().optional().nullable(),
      // Property
      propertyType: z.string().optional().nullable(),
      totalBedrooms: numField,
      totalBathrooms: numField,
      // Regular Cleaning
      regularCleaningBedrooms: numField,
      regularCleaningBathrooms: numField,
      regularCleaningKitchens: numField,
      regularCleaningLivingRooms: numField,
      regularCleaningHallways: numField,
      // Deep Cleaning
      deepCleaningBedrooms: numField,
      deepCleaningBathrooms: numField,
      deepCleaningKitchens: numField,
      deepCleaningLivingRooms: numField,
      deepCleaningHallways: numField,
      // End of Tenancy
      endOfTenancyBedrooms: numField,
      endOfTenancyBathrooms: numField,
      endOfTenancyKitchens: numField,
      endOfTenancyLivingRooms: numField,
      endOfTenancyHallways: numField,
      // Window Cleaning
      interiorWindows: numField,
      exteriorWindows: numField,
      windowsBothSides: numField,
      // Oven Cleaning
      standardOvens: numField,
      doubleOvens: numField,
      // Fridge Cleaning
      fridges: numField,
      fridgeFreezers: numField,
      // Carpet Cleaning
      carpetedRooms: numField,
      staircases: numField,
      // Upholstery Cleaning
      diningChairs: numField,
      armchairs: numField,
      _2SeatSofas: numField,
      _3SeatSofas: numField,
      cornerSofas: numField,
      // Garden Tidy
      lawns: numField,
      leafClearingAreas: numField,
      weedingAreas: numField,
      hedges: numField,
      paths: numField,
      // Steam Sanitisation
      steamSanitisationBedrooms: numField,
      steamSanitisationBathrooms: numField,
      steamSanitisationKitchens: numField,
      steamSanitisationLivingRooms: numField,
      conversionToken: z.string().optional().nullable(),
      conversionError: z.string().optional().nullable(),
      _revision: z.string().optional().nullable(),
    }).nullable(),
  }),
  execute: async ({ context, input }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const qr = await QuoteRequests.findOne({ id: input.id });
    if (!qr) return { quoteRequest: null };

    // Resolve linked customer name
    let customerName: string | null = null;
    let customerId: string | null = null;
    const custLinkId = Array.isArray(qr.customer) ? qr.customer[0] : qr.customer;
    if (custLinkId) {
      customerId = custLinkId;
      const c = await Customers.findOne({ id: custLinkId, fields: ['id', 'customerName'] });
      customerName = c?.customerName ?? null;
    }

    // Resolve linked job label
    let jobLabel: string | null = null;
    let jobId: string | null = null;
    const jobLinkId = Array.isArray(qr.job) ? qr.job[0] : qr.job;
    if (jobLinkId) {
      jobId = jobLinkId;
      const j = await Jobs.findOne({ id: jobLinkId, fields: ['id', 'jobId', 'service'] });
      if (j) jobLabel = `Job #${j.jobId}${j.service ? ` – ${j.service}` : ''}`;
    }

    return {
      quoteRequest: {
        id: qr.id,
        quoteRequestId: qr.quoteRequestId,
        fullName: qr.fullName ?? null,
        email: qr.email ?? null,
        phone: qr.phone ?? null,
        address: qr.address ?? null,
        postcode: qr.postcode ?? null,
        customerType: qr.customerType ?? null,
        services: Array.isArray(qr.services) ? qr.services : null,
        preferredDate: qr.preferredDate ?? null,
        preferredTime: qr.preferredTime ?? null,
        propertyDetails: qr.propertyDetails ?? null,
        additionalNotes: qr.additionalNotes ?? null,
        serviceDetails: qr.serviceDetails ?? null,
        status: qr.status ?? null,
        source: qr.source ?? null,
        submissionId: qr.submissionId ?? null,
        submittedAt: qr.submittedAt ?? null,
        updatedAt: qr.updatedAt ?? null,
        customerName,
        customerId,
        jobLabel,
        jobId,
        // Property
        propertyType: qr.propertyType ?? null,
        totalBedrooms: qr.totalBedrooms ?? null,
        totalBathrooms: qr.totalBathrooms ?? null,
        // Regular Cleaning
        regularCleaningBedrooms: qr.regularCleaningBedrooms ?? null,
        regularCleaningBathrooms: qr.regularCleaningBathrooms ?? null,
        regularCleaningKitchens: qr.regularCleaningKitchens ?? null,
        regularCleaningLivingRooms: qr.regularCleaningLivingRooms ?? null,
        regularCleaningHallways: qr.regularCleaningHallways ?? null,
        // Deep Cleaning
        deepCleaningBedrooms: qr.deepCleaningBedrooms ?? null,
        deepCleaningBathrooms: qr.deepCleaningBathrooms ?? null,
        deepCleaningKitchens: qr.deepCleaningKitchens ?? null,
        deepCleaningLivingRooms: qr.deepCleaningLivingRooms ?? null,
        deepCleaningHallways: qr.deepCleaningHallways ?? null,
        // End of Tenancy
        endOfTenancyBedrooms: qr.endOfTenancyBedrooms ?? null,
        endOfTenancyBathrooms: qr.endOfTenancyBathrooms ?? null,
        endOfTenancyKitchens: qr.endOfTenancyKitchens ?? null,
        endOfTenancyLivingRooms: qr.endOfTenancyLivingRooms ?? null,
        endOfTenancyHallways: qr.endOfTenancyHallways ?? null,
        // Window Cleaning
        interiorWindows: qr.interiorWindows ?? null,
        exteriorWindows: qr.exteriorWindows ?? null,
        windowsBothSides: qr.windowsBothSides ?? null,
        // Oven Cleaning
        standardOvens: qr.standardOvens ?? null,
        doubleOvens: qr.doubleOvens ?? null,
        // Fridge Cleaning
        fridges: qr.fridges ?? null,
        fridgeFreezers: qr.fridgeFreezers ?? null,
        // Carpet Cleaning
        carpetedRooms: qr.carpetedRooms ?? null,
        staircases: qr.staircases ?? null,
        // Upholstery Cleaning
        diningChairs: qr.diningChairs ?? null,
        armchairs: qr.armchairs ?? null,
        _2SeatSofas: qr._2SeatSofas ?? null,
        _3SeatSofas: qr._3SeatSofas ?? null,
        cornerSofas: qr.cornerSofas ?? null,
        // Garden Tidy
        lawns: qr.lawns ?? null,
        leafClearingAreas: qr.leafClearingAreas ?? null,
        weedingAreas: qr.weedingAreas ?? null,
        hedges: qr.hedges ?? null,
        paths: qr.paths ?? null,
        // Steam Sanitisation
        steamSanitisationBedrooms: qr.steamSanitisationBedrooms ?? null,
        steamSanitisationBathrooms: qr.steamSanitisationBathrooms ?? null,
        steamSanitisationKitchens: qr.steamSanitisationKitchens ?? null,
        steamSanitisationLivingRooms: qr.steamSanitisationLivingRooms ?? null,
        conversionToken: qr.conversionToken ?? null,
        conversionError: qr.conversionError ?? null,
        _revision: computeRevision(qr, REVISION_FIELDS.quoteRequest),
      },
    };
  },
});
