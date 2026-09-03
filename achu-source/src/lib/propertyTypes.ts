/**
 * CASELE UNUI CLIENT — forma lor, și vocabularul pe care îl împart ecranele.
 *
 * 🔴 **De ce un fișier separat, și e chiar regula, nu o preferință.** Cele 11 câmpuri ale
 * ACHU-574 au împins `src/lib/endpoints.ts` peste clichetul lui de mărime (ACHU-571). ⛔
 * Plafonul **nu se ridică** — se scoate ce a crescut. `endpoints.ts` re-exportă tipurile de
 * aici, deci niciun apelant nu trebuie să afle de mutare.
 *
 * ⚠️ **Și rezolvă o a doua problemă, în aceeași mișcare:** un fișier de componentă care
 * exportă și constante pierde fast refresh (patru avertismente de lint). Constantele partajate
 * stau aici; `PropertyFeatureFields.tsx` exportă doar componenta.
 *
 * ⛔ **Vocabularele de aici sunt COPII de citit ale celor din `backend/src/lib/propertyPolicy.ts`.**
 * Serverul e cel care refuză un cuvânt inventat; lista de aici doar umple un dropdown. Dacă
 * apare o valoare nouă, se adaugă **întâi pe server**.
 */

/**
 * ⚠️ Tip ÎNGUST, citit din ruta care îl produce (`backend/src/routes/properties.ts`), nu ghicit
 * din numele câmpurilor — `CLAUDE.md` §2.1a.
 */
export type PropertyRecord = {
  id: string;
  propertyId: number;
  label: string;
  /** Numele plus adresa, gata compus de server — vezi `propertySummary`. */
  summary: string;
  address: string | null;
  postcode: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  /**
   * ACHU-574 — ce are casa (§5, Grupul A).
   * 🔴 `null` înseamnă **„nu s-a consemnat"**, nu „nu are" — ecranul le arată ca „—", iar §7
   * (Pricing engine) va citi diferența ca să estimeze cât durează o curățenie.
   */
  floorAreaSqm: number | null;
  rooms: number | null;
  kitchens: number | null;
  hasConservatory: boolean | null;
  hasGarage: boolean | null;
  hasGarden: boolean | null;
  hasBalcony: boolean | null;
  hasLoft: boolean | null;
  hasBasement: boolean | null;
  furnishing: string | null;
  occupancy: string | null;
  /**
   * ACHU-575 — ce poate merge prost (§5, Grupul C).
   * 🔴 Singurele câmpuri ale casei care ajung și la **curățător** (`cleanerJobs.ts`).
   */
  hasPets: boolean | null;
  hasChildren: boolean | null;
  hasSmokers: boolean | null;
  fragileItems: string | null;
  restrictedRooms: string | null;
  hazardNotes: string | null;
  previousDamage: string | null;
  /**
   * ACHU-576 — CUM SE INTRĂ (§5, Grupul B).
   * 🔴 **Mutate de pe client pe casă**: un singur text pentru toate casele cuiva era greșit
   * pentru cel puțin una, iar cine îl citea greșit stătea la o ușă.
   */
  accessInstructions: string | null;
  accessInstructionsUpdatedAt: string | null;
  accessInstructionsUpdatedBy: string | null;
  keyLocation: string | null;
  alarmInstructions: string | null;
  entryCode: string | null;
  hasLift: boolean | null;
  floorNumber: number | null;
  waterAccess: string | null;
  electricityAccess: string | null;
  wasteDisposalLocation: string | null;
  /**
   * ACHU-577 — ce se face de fiecare dată la casa asta (§5, Grupul E).
   * 🔴 Îl vede și **curățătorul**, la fiecare vizită — până acum biroul îl retasta în
   * instrucțiunile fiecărei vizite, deci pe un contract săptămânal de cincizeci de ori pe an.
   */
  standardInstructions: string | null;
  /** Câte puncte proprii de checklist are casa. ⚠️ Doar numărul: lista se cere separat. */
  checklistPointCount: number;
  /**
   * ACHU-578 — DRUMUL PÂNĂ ACOLO (§5, Grupul D).
   * 🔴 **Costul îl suportă firma** (Roberto, 14/08/2026), deci sunt note de planificare, nu
   * bani: ⛔ niciun câmp de sumă, și nimic din ele nu ajunge la client. Le vede biroul și
   * **curățătorul**, care e singurul care conduce până acolo.
   */
  parkingType: string | null;
  parkingPermitRequired: boolean | null;
  parkingNotes: string | null;
  inCongestionZone: boolean | null;
  inUlezZone: boolean | null;
  drivingZoneNotes: string | null;
  /**
   * ACHU-580 — prețul obișnuit al unei curățenii AICI (Roberto, 14/08/2026).
   * 🔴 **Text, nu număr** — o zecimală de bani prin `number` e felul în care se pierde un penny.
   * 🔴 **`null` = „nu s-a consemnat", NU „gratis"**: `0` e un fapt (curățenie oferită), iar un
   * gol citit ca `0` ar factura clientul cu nimic.
   * ⛔ Nu apare în portalul clientului și nu ajunge la curățător.
   */
  pricePerVisit: string | null;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
  /** Câte vizite o pomenesc. ⚠️ Decide dacă butonul spune „Delete" sau „Switch off". */
  jobCount: number;
  updatedAt: string;
};

export type PropertyInputBody = {
  label: string;
  address?: string | null;
  postcode?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  notes?: string | null;
  /**
   * ACHU-574. ⚠️ **Un câmp OMIS nu se atinge pe server; `null` îl șterge.** Distincția e chiar
   * apărarea contra clasei ACHU-559 — butonul de stingere trimite doar ce știe, iar fără ea ar
   * goli tot ce a completat cineva despre casă.
   */
  floorAreaSqm?: number | null;
  rooms?: number | null;
  kitchens?: number | null;
  hasConservatory?: boolean | null;
  hasGarage?: boolean | null;
  hasGarden?: boolean | null;
  hasBalcony?: boolean | null;
  hasLoft?: boolean | null;
  hasBasement?: boolean | null;
  furnishing?: string | null;
  occupancy?: string | null;
  /** ACHU-575 — Grupul C. Aceeași regulă: un câmp OMIS nu se atinge; `null` îl șterge. */
  hasPets?: boolean | null;
  hasChildren?: boolean | null;
  hasSmokers?: boolean | null;
  fragileItems?: string | null;
  restrictedRooms?: string | null;
  hazardNotes?: string | null;
  previousDamage?: string | null;
  /** ACHU-576 — Grupul B. Aceeași regulă: un câmp OMIS nu se atinge; `null` îl șterge. */
  accessInstructions?: string | null;
  keyLocation?: string | null;
  alarmInstructions?: string | null;
  entryCode?: string | null;
  hasLift?: boolean | null;
  floorNumber?: number | null;
  waterAccess?: string | null;
  electricityAccess?: string | null;
  wasteDisposalLocation?: string | null;
  /** ACHU-577 — Grupul E. Aceeași regulă: un câmp OMIS nu se atinge; `null` îl șterge. */
  standardInstructions?: string | null;
  /** ACHU-578 — Grupul D. Aceeași regulă: un câmp OMIS nu se atinge; `null` îl șterge. */
  parkingType?: string | null;
  parkingPermitRequired?: boolean | null;
  parkingNotes?: string | null;
  inCongestionZone?: boolean | null;
  inUlezZone?: boolean | null;
  drivingZoneNotes?: string | null;
  /** ACHU-580. ⚠️ NUMĂR la trimitere (serverul primește `number`), `null` = șterge. */
  pricePerVisit?: number | null;
};

/**
 * ACHU-577 — un punct de checklist propriu unei case.
 *
 * ⛔ **E un ȘABLON, nu o bifă.** Bifarea trăiește pe checklistul VIZITEI; ștergerea de aici nu
 * atinge nicio vizită trecută (`ensureJobChecklist` marchează itemii dispăruți „obsolete" și nu
 * șterge niciodată unul bifat).
 */
export type PropertyChecklistPoint = {
  id: string;
  label: string;
  sortOrder: number;
  /**
   * §16 (Sesiunea 144) — punctul oprește încheierea vizitei („trebuie făcut"), sau nu („e bine
   * dacă se face"). ⚠️ Decis o dată pe casă, nu la fiecare vizită.
   */
  required: boolean;
  /**
   * §16 (Sesiunea 144) — la punctul ăsta se cere o poză de dovadă, la fiecare vizită aici.
   * ⚠️ `false` implicit: canalul rămâne stins până îl aprinde biroul, punct cu punct.
   */
  photoRequired: boolean;
};

/**
 * ACHU-576 — CUM SE INTRĂ (§5, Grupul B).
 *
 * 🔴 **Etichetele sunt scrise pentru omul de la UȘĂ**, fiindcă exact cuvintele astea ajung pe
 * cardul curățătorului și în portalul clientului. „Where the key is" spune ce trebuie știut;
 * „keyLocation" nu.
 *
 * ⚠️ Ordinea e cea a întrebărilor pe care le pui despre o casă în care intri: cum ajungi
 * înăuntru, apoi de unde iei apă și curent, apoi unde lași gunoiul. ⛔ Copie de citit a listei
 * din `backend/src/lib/propertyAccessPolicy.ts` — serverul e cel care refuză, ca la Grupul C.
 */
export const ACCESS_TEXTS = [
  { key: 'keyLocation', label: 'Where the key is', hint: 'Key safe by the back door, code 1234. Or “we hold the only key”.' },
  { key: 'alarmInstructions', label: 'Alarm', hint: 'Where the panel is and what to do — or say there is no alarm.' },
  { key: 'entryCode', label: 'Entry code', hint: 'The gate or door code on its own, so it can be found in a hurry.' },
  { key: 'waterAccess', label: 'Water', hint: 'Which tap, or whether the outside tap is turned off.' },
  { key: 'electricityAccess', label: 'Electricity', hint: 'Where a socket is if the ones inside are hard to reach.' },
  { key: 'wasteDisposalLocation', label: 'Where the bins go', hint: 'The bin store, the side alley, collection day.' },
] as const;

export type AccessTextKey = (typeof ACCESS_TEXTS)[number]['key'];

/** Ce ține formularul de acces: texte simple, etajul ca text (gol ≠ parter), liftul cu trei stări. */
export type AccessForm = { accessInstructions: string; hasLift: boolean | null; floorNumber: string }
  & { [K in AccessTextKey]: string };

export const EMPTY_ACCESS: AccessForm = {
  accessInstructions: '', hasLift: null, floorNumber: '',
  keyLocation: '', alarmInstructions: '', entryCode: '',
  waterAccess: '', electricityAccess: '', wasteDisposalLocation: '',
};

/**
 * 🔴 Ce ajunge pe cardul curățătorului — **tipul e citit din ruta care îl produce**
 * (`propertyAccessForCleaner`), nu ghicit. `null` pe tot obiectul = nu s-a consemnat nimic.
 *
 * ⚠️ `source` spune de pe CE casă vin instrucțiunile: `visit` = casa vizitei, `main` = casa
 * principală a clientului, fiindcă vizita nu e legată de niciuna. Al doilea caz **se spune pe
 * ecran** — dacă omul are două case, instrucțiunile pot fi ale celeilalte.
 */
export type PropertyAccess = {
  source: 'visit' | 'main';
  propertyLabel: string;
  accessInstructions: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  hasLift: boolean | null;
  floorNumber: number | null;
} & { [K in AccessTextKey]: string | null };

/** O casă așa cum o vede CLIENTUL în portalul lui — doar ce ține de cum se intră. */
export type MyProperty = {
  id: string;
  label: string;
  address: string | null;
  postcode: string | null;
  isPrimary: boolean;
  isActive: boolean;
  accessInstructions: string | null;
  accessInstructionsUpdatedAt: string | null;
  hasLift: boolean | null;
  floorNumber: number | null;
} & { [K in AccessTextKey]: string | null };

export const FURNISHING_OPTIONS = ['Furnished', 'Part furnished', 'Unfurnished'];
export const OCCUPANCY_OPTIONS = ['Occupied', 'Vacant'];

/**
 * ACHU-578 — DRUMUL PÂNĂ ACOLO (§5, Grupul D).
 *
 * ⛔ Copie de citit a lui `VALID_PARKING_TYPES` din `backend/src/lib/propertyTravelPolicy.ts` —
 * serverul e cel care refuză un cuvânt inventat, lista de aici doar umple un dropdown. O valoare
 * nouă se adaugă **întâi pe server**.
 *
 * ⚠️ **„No parking nearby" e o valoare, nu absența uneia:** cineva care a mers acolo și a
 * constatat că nu se poate parcheza a consemnat un fapt — probabil cel mai util din listă.
 */
export const PARKING_OPTIONS = [
  'Free on street',
  'Permit holders only',
  'Paid — meter or app',
  'Driveway or private space',
  'Car park nearby',
  'No parking nearby',
];

/**
 * Cele două texte ale grupului. ⚠️ `hint` e ce scrie sub câmp: fără el, „Charges and zones"
 * primește „ULEZ" de la cineva care nu s-a gândit că întrebarea reală e ce face șoferul cu asta.
 */
export const TRAVEL_TEXTS = [
  { key: 'parkingNotes', label: 'Where to park', hint: 'The back street after number 40. Free after 6pm. Do not use the residents’ bays.' },
  { key: 'drivingZoneNotes', label: 'Charges and zones', hint: 'Anything a driver needs to know before setting off — a low bridge, a school street, timed restrictions.' },
] as const;

export type TravelTextKey = (typeof TRAVEL_TEXTS)[number]['key'];

/** Ce ține formularul Grupului D: dropdown ca text, cele trei bife cu trei stări. */
export type TravelForm = {
  parkingType: string;
  parkingPermitRequired: boolean | null;
  inCongestionZone: boolean | null;
  inUlezZone: boolean | null;
} & { [K in TravelTextKey]: string };

export const EMPTY_TRAVEL: TravelForm = {
  parkingType: '', parkingPermitRequired: null, inCongestionZone: null, inUlezZone: null,
  parkingNotes: '', drivingZoneNotes: '',
};

/**
 * 🔴 Ce ajunge pe cardul curățătorului — **tipul e citit din ruta care îl produce**
 * (`propertyTravelForCleaner`, `backend/src/lib/propertyTravelPolicy.ts`), nu ghicit din numele
 * câmpurilor. `null` pe tot obiectul = nu s-a consemnat nimic.
 *
 * ⛔ **Nimic despre bani**, deliberat: costul îl suportă firma, deci curățătorul nu are nicio
 * conversație de purtat despre el — ca la `serviceExtras`, unde prețul e reținut din același motiv.
 */
export type PropertyTravel = {
  parkingType: string | null;
  parkingPermitRequired: boolean | null;
  inCongestionZone: boolean | null;
  inUlezZone: boolean | null;
} & { [K in TravelTextKey]: string | null };

/**
 * Cele șase dotări, cu eticheta pe care o citește biroul. ⚠️ Ordinea e cea în care se umple un
 * formular vorbind cu clientul — de afară înăuntru — nu ordinea alfabetică.
 */
export const FEATURES = [
  { key: 'hasGarden', label: 'Garden' },
  { key: 'hasGarage', label: 'Garage' },
  { key: 'hasConservatory', label: 'Conservatory' },
  { key: 'hasBalcony', label: 'Balcony' },
  { key: 'hasLoft', label: 'Loft' },
  { key: 'hasBasement', label: 'Basement' },
] as const;

export type FeatureKey = (typeof FEATURES)[number]['key'];

/**
 * ACHU-575 — CE POATE MERGE PROST (§5, Grupul C).
 *
 * 🔴 **Etichetele sunt scrise pentru CURĂȚĂTOR, nu pentru birou**, fiindcă exact aceste cuvinte
 * ajung pe cardul lui. „Pets in the home" spune ce trebuie știut la ușă; „hasPets" nu.
 *
 * ⚠️ Ordinea e cea a întrebărilor pe care le pui despre o casă în care intri: cine e înăuntru,
 * apoi de ce să ai grijă.
 */
export const RISK_FLAGS = [
  { key: 'hasPets', label: 'Pets in the home' },
  { key: 'hasChildren', label: 'Children in the home' },
  { key: 'hasSmokers', label: 'Someone smokes indoors' },
] as const;

export type RiskFlagKey = (typeof RISK_FLAGS)[number]['key'];

/**
 * Cele patru texte. ⚠️ `hint` e ce scrie sub câmp în formularul de birou: fără el, „Hazards"
 * primește „nimic" de la cineva care nu s-a gândit că treapta ruptă de la intrare se pune acolo.
 */
export const RISK_TEXTS = [
  { key: 'fragileItems', label: 'Fragile or valuable items', hint: 'The vase in the hall, the glass table — what would be a disaster to break.' },
  { key: 'restrictedRooms', label: 'Rooms not to go into', hint: 'A room the customer asked us to leave alone.' },
  { key: 'hazardNotes', label: 'Hazards', hint: 'A loose step, a dog that bites, a broken lock.' },
  { key: 'previousDamage', label: 'Damage that was already there', hint: 'Protects both sides: nobody gets blamed for an old scratch.' },
] as const;

export type RiskTextKey = (typeof RISK_TEXTS)[number]['key'];

/** Ce ține formularul pentru Grupul C: trei stări pe bife, text simplu pe restul. */
export type RiskForm =
  & { [K in RiskFlagKey]: boolean | null }
  & { [K in RiskTextKey]: string };

export const EMPTY_RISK: RiskForm = {
  hasPets: null, hasChildren: null, hasSmokers: null,
  fragileItems: '', restrictedRooms: '', hazardNotes: '', previousDamage: '',
};

/**
 * 🔴 Ce se arată pe cardul curățătorului — **tipul e citit din ruta care îl produce**
 * (`propertyRiskForCleaner`, `backend/src/lib/propertyPolicy.ts`), nu ghicit din numele
 * câmpurilor (`CLAUDE.md` §2.1a). `null` pe tot obiectul = nu s-a consemnat nimic.
 */
export type PropertyRisk =
  & { [K in RiskFlagKey]: boolean | null }
  & { [K in RiskTextKey]: string | null };

/** Ce ține formularul: numerele ca text (un câmp gol nu e 0), dotările ca trei stări. */
export type FeatureForm = {
  floorAreaSqm: string;
  rooms: string;
  kitchens: string;
  furnishing: string;
  occupancy: string;
} & { [K in FeatureKey]: boolean | null };

export const EMPTY_FEATURES: FeatureForm = {
  floorAreaSqm: '', rooms: '', kitchens: '', furnishing: '', occupancy: '',
  hasGarden: null, hasGarage: null, hasConservatory: null, hasBalcony: null, hasLoft: null, hasBasement: null,
};

/**
 * ACHU-579 — ISTORICUL ACESTEI CASE (§5.2).
 *
 * 🔴 Tipurile sunt citite din ruta care le produce (`backend/src/routes/propertyHistory.ts`),
 * nu ghicite din numele câmpurilor.
 */
export type PropertyHistoryVisit = {
  id: string;
  /** Numărul de afaceri al vizitei — ce caută biroul, nu `id`-ul intern. */
  reference: number;
  jobDate: string;
  service: string;
  status: string | null;
  /** Text, nu număr: o zecimală de bani trecută prin `number` e felul în care se pierde un penny. */
  amountCharged: string | null;
  /**
   * 🔴 Adresa vizitei **doar dacă diferă** de cea a casei de azi. `Job.address` e un
   * INSTANTANEU, deci o vizită veche poate purta adresa de dinainte de mutare — iar aceea e
   * chiar informația. `null` = aceeași adresă, deci nimic de spus.
   */
  addressThen: string | null;
  cleaners: string[];
};

/**
 * 🔴 **Vizitele clientului care nu sunt legate de nicio casă** — partea fără de care ecranul ar
 * minți. Toate cele de dinainte de ACHU-570 au `propertyId` NULL, deliberat: nu se poate ști la
 * care casă au fost.
 *
 * ⛔ `hidesEverything` = casa n-are **nicio** vizită legată, dar clientul are dintre astea. În
 * cazul ăsta ecranul **nu** are voie să spună „nu s-a curățat niciodată aici": faptul e despre
 * tabelul nostru, nu despre casă. **Necunoscut nu e „nu".**
 */
export type PropertyHistoryUnlinked = { count: number; hidesEverything: boolean } | null;

export type PropertyHistory = {
  property: { id: string; label: string };
  summary: {
    total: number;
    firstVisit: string | null;
    lastVisit: string | null;
    byStatus: Record<string, number>;
  };
  unlinked: PropertyHistoryUnlinked;
  /** ⚠️ Lista e plafonată. Ce se taie SE SPUNE — un plafon tăcut prezintă o felie drept tot. */
  hasMore: boolean;
  records: PropertyHistoryVisit[];
};

/**
 * ACHU-581 — POZE ȘI DOCUMENTE PE CASĂ (§5, Grupul F).
 *
 * 🔴 **Deciziile lui Roberto, 14/08/2026:** se construiește · **le vede DOAR biroul** · aceeași
 * regulă pentru documente ca pentru poze. ⛔ Tipurile astea nu apar în niciun ecran de curățător
 * și în niciunul de client — dacă vreodată apar, decizia s-a schimbat fără să întrebe nimeni.
 */
export type PropertyFileKind = 'Photo' | 'Document';

export type PropertyFileRecord = {
  id: string;
  /** Numărul de afaceri al fișierului — ce caută biroul, nu `id`-ul intern. */
  reference: number;
  kind: PropertyFileKind;
  label: string | null;
  originalName: string | null;
  uploadedAt: string;
  /** ⚠️ Un ANGAJAT. Ecranul e admin-only; ⛔ nu intră în exportul GDPR al clientului. */
  uploadedBy: string | null;
  /**
   * Link semnat, cu termen. ⚠️ `null` când semnarea a eșuat — ecranul desenează numele fără
   * link, în loc să se albească. ⛔ Nu există URL public: bucket-ul e privat.
   */
  signedUrl: string | null;
};

export type PropertyFileList = {
  records: PropertyFileRecord[];
  /** Câte fișiere încap pe o casă — spus pe ecran, nu descoperit la ultimul. */
  limit: number;
};

