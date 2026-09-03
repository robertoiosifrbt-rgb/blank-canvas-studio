import { HAS_ZONE, ukParts } from './ukClock';

export const fmt = (amount?: number) =>
  `£${(amount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * 🔴 ACHU-787 (Sesiunea 156) — datele se **traduc** în ora Marii Britanii, nu se mai taie din text.
 * Motivul întreg, și de ce NU se convertește tot, în `src/lib/ukClock.ts`.
 */

/**
 * „DD/MM/YYYY”.
 *
 * 🔴 **Și ZIUA se putea schimba, nu doar ora:** un instant la `23:30Z` pe 25 august e, în Marea
 * Britanie, `00:30` pe **26**. Tăierea din șir arăta ziua de dinainte.
 */
export const fmtDate = (d?: string) => {
  if (!d) return '—';
  if (HAS_ZONE.test(d)) return ukParts(d)?.date ?? d;
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};

/**
 * „DD/MM/YYYY HH:MM”.
 *
 * ⚠️ Ora de perete fără marcaj de fus (`"YYYY-MM-DD HH:MM:SS"`, rândurile dinainte de ACHU-141) se
 * citește **ca atare**, nu se convertește — altfel defectul s-ar muta pe alt ecran.
 */
export const fmtDateTime = (d?: string | null) => {
  if (!d) return '—';
  if (HAS_ZONE.test(d)) {
    const uk = ukParts(d);
    return uk ? `${uk.date} ${uk.time}` : d;
  }
  const [datePart, timePart] = d.includes('T') ? d.split('T') : d.split(' ');
  if (!datePart || !timePart) return d;
  const [y, m, day] = datePart.split('-');
  return `${day}/${m}/${y} ${timePart.slice(0, 5)}`;
};

export const statusColor: Record<string, string> = {
  Lead: 'bg-yellow-100 text-yellow-800',
  Active: 'bg-green-100 text-green-800',
  Inactive: 'bg-muted text-muted-foreground',
  Blocked: 'bg-red-100 text-red-800',
  Enquiry: 'bg-yellow-100 text-yellow-800',
  Booked: 'bg-blue-100 text-blue-800',
  Confirmed: 'bg-sky-100 text-sky-800',
  'In Progress': 'bg-orange-100 text-orange-800',
  'Completion Review': 'bg-purple-100 text-purple-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  'No Access': 'bg-muted text-muted-foreground',
  Pending: 'bg-yellow-100 text-yellow-800',
  Received: 'bg-green-100 text-green-800',
  Failed: 'bg-red-100 text-red-800',
  Refunded: 'bg-orange-100 text-orange-800',
  Paid: 'bg-green-100 text-green-800',
  Partial: 'bg-yellow-100 text-yellow-800',
  Unpaid: 'bg-red-100 text-red-800',
};

export const StatusBadge = ({ status }: { status?: string }) => {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
};

