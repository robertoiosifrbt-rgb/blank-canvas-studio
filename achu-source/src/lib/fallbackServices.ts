/**
 * PLASA FORMULARULUI PUBLIC — cele 11 servicii și cantitățile lor, scrise în cod.
 *
 * ─── 🔴 DE CE S-A ÎNTORS FIȘIERUL ĂSTA ──────────────────────────────────────
 * A fost șters pe **21/08/2026** (`ef7537a5`, §8 felia a doua), când lista de servicii a trecut de
 * la o constantă la un apel către server. ⛔ Mutarea era corectă — owner-ul trebuie să poată adăuga
 * un serviciu din ecran — dar a lăsat **singura pagină publică a aplicației** atârnând de o cerere
 * care, când pică, nu spunea nimic: secțiunea „Select Services" rămânea goală.
 *
 * 🔴 **Măsurat pe 29/08/2026: opt zile.** Roberto a deschis formularul de pe telefon și l-a găsit
 * gol. ⚠️ Nimeni nu raportase, fiindcă nimeni nu raportează un formular pe care nu l-a putut
 * completa — un vizitator pleacă. ⛔ **Zona cu cel mai mic zgomot de defect era cea care aducea
 * venit** (aceeași propoziție ca la ACHU-399, 08/08 — a doua oară aceeași lecție).
 *
 * ─── ⛔ CE ESTE ȘI CE NU ESTE ────────────────────────────────────────────────
 * ⚠️ **Se folosește NUMAI când catalogul nu vine** — nu în paralel cu el, niciodată ca sursă
 * obișnuită. Catalogul din bază rămâne adevărul: acolo owner-ul adaugă, redenumește și stinge.
 *
 * ⛔ **Deci lista de aici ÎMBĂTRÂNEȘTE, deliberat acceptat.** Un serviciu adăugat mâine din ecran nu
 * apare aici. 🔴 Alegerea e între o listă veche de câteva nume și o **pagină moartă** — iar a doua a
 * costat opt zile de cereri pierdute.
 *
 * ⛔ **PREȚUL NU SE CALCULEAZĂ NICIODATĂ DE AICI.** Cheile sunt aceleași cu ale catalogului, deci
 * cererea ajunge la birou în forma obișnuită; cât costă hotărăște serverul, din catalog, ca întot-
 * deauna. ⚠️ Dacă o cheie de aici nu mai există în catalog, ruta publică o refuză cu numele ei —
 * mai bine un refuz numit decât o cantitate care intră într-un preț greșit.
 */
export const SERVICE_QUANTITY_FIELDS: Record<string, { key: string; label: string }[]> = {
  'Regular Cleaning': [
    { key: 'regularCleaningBedrooms', label: 'Bedrooms' },
    { key: 'regularCleaningBathrooms', label: 'Bathrooms' },
    { key: 'regularCleaningKitchens', label: 'Kitchens' },
    { key: 'regularCleaningLivingRooms', label: 'Living Rooms' },
    { key: 'regularCleaningHallways', label: 'Hallways' },
  ],
  'Deep Cleaning': [
    { key: 'deepCleaningBedrooms', label: 'Bedrooms' },
    { key: 'deepCleaningBathrooms', label: 'Bathrooms' },
    { key: 'deepCleaningKitchens', label: 'Kitchens' },
    { key: 'deepCleaningLivingRooms', label: 'Living Rooms' },
    { key: 'deepCleaningHallways', label: 'Hallways' },
  ],
  'End of Tenancy Cleaning': [
    { key: 'endOfTenancyBedrooms', label: 'Bedrooms' },
    { key: 'endOfTenancyBathrooms', label: 'Bathrooms' },
    { key: 'endOfTenancyKitchens', label: 'Kitchens' },
    { key: 'endOfTenancyLivingRooms', label: 'Living Rooms' },
    { key: 'endOfTenancyHallways', label: 'Hallways' },
  ],
  'Window Cleaning': [
    { key: 'interiorWindows', label: 'Interior Windows' },
    { key: 'exteriorWindows', label: 'Exterior Windows' },
    { key: 'windowsBothSides', label: 'Windows (Both Sides)' },
  ],
  'Oven Cleaning': [
    { key: 'standardOvens', label: 'Standard Ovens' },
    { key: 'doubleOvens', label: 'Double Ovens' },
  ],
  'Fridge Cleaning': [
    { key: 'fridges', label: 'Fridges' },
    { key: 'fridgeFreezers', label: 'Fridge Freezers' },
  ],
  'Carpet Cleaning': [
    { key: 'carpetedRooms', label: 'Carpeted Rooms' },
    { key: 'staircases', label: 'Staircases' },
  ],
  'Upholstery Cleaning': [
    { key: 'diningChairs', label: 'Dining Chairs' },
    { key: 'armchairs', label: 'Armchairs' },
    { key: 'twoSeatSofas', label: '2 Seat Sofas' },
    { key: 'threeSeatSofas', label: '3 Seat Sofas' },
    { key: 'cornerSofas', label: 'Corner Sofas' },
  ],
  'Garden Tidy': [
    { key: 'lawns', label: 'Lawns' },
    { key: 'leafClearingAreas', label: 'Leaf-Clearing Areas' },
    { key: 'weedingAreas', label: 'Weeding Areas' },
    { key: 'hedges', label: 'Hedges' },
    { key: 'paths', label: 'Paths' },
  ],
  'Steam Sanitisation': [
    { key: 'steamSanitisationBedrooms', label: 'Bedrooms' },
    { key: 'steamSanitisationBathrooms', label: 'Bathrooms' },
    { key: 'steamSanitisationKitchens', label: 'Kitchens' },
    { key: 'steamSanitisationLivingRooms', label: 'Living Rooms' },
  ],
  'Car Wash': [
    { key: 'carWashCars', label: 'Number of Cars' },
  ],
};

export const SERVICES = Object.keys(SERVICE_QUANTITY_FIELDS);

