/**
 * 🔴 §7 (Sesiunea 150) — **PE CE SE POATE SORTA LISTA DE OFERTE**, scos din ecran.
 *
 * ⛔ Ieșit din `PriceCalculatorPage.tsx` fiindcă acela era **exact** pe clichetul lui de mărime, iar
 * felia de azi avea nevoie de trei rânduri: regula spune ce se face atunci — iese cod, cifra nu urcă
 * (`AGENT_RULES` §7, ACHU-571).
 *
 * ⚠️ **Și îi e locul aici:** e o descriere de DATE (ce coloană, cu ce etichetă, de ce fel), citită de
 * `sortRecords` și de `SortControl`. ⛔ Nu e randare și nu e stare de ecran — singurul motiv pentru
 * care stătea în pagină e că acolo a fost scrisă prima dată.
 */
import type { SortField } from './sorting';
import type { PriceQuoteRecord } from './billingEndpoints';

export const QUOTE_SORT_FIELDS: SortField<PriceQuoteRecord>[] = [
  { key: 'createdAt', label: 'Date', accessor: r => r.createdAt, kind: 'date' },
  { key: 'quoteNumber', label: 'Quote Number', accessor: r => r.quoteNumber, kind: 'text' },
  { key: 'customerName', label: 'Customer', accessor: r => r.customerName, kind: 'text' },
  { key: 'jobDisplayId', label: 'Job', accessor: r => r.jobDisplayId, kind: 'number' },
  { key: 'status', label: 'Status', accessor: r => r.status, kind: 'text' },
  { key: 'grandTotal', label: 'Total', accessor: r => r.grandTotal, kind: 'number' },
];

