/**
 * §22 „Global Search" (Sesiunea 148) — **CE SECȚIUNI ARE CĂUTAREA, ca date.**
 *
 * ⛔ **Fișier propriu, nu în componentă:** un `.tsx` de componentă care exportă date pică lintul
 * (`react-refresh/only-export-components`) — aceeași lecție ca la meniul de Admin, în aceeași zi. ✅ Iar
 * de aici lista se poate CITI din test: caseta de căutare nu are voie să promită mai mult decât
 * acoperă (reproșul auditului LOW-03), și singurul fel de a păzi asta e să existe un singur loc care
 * spune ce se caută.
 */
import { Users, Briefcase, CreditCard, Receipt, FileText, Sparkles, Home, ShieldAlert, Inbox, BadgeCheck } from 'lucide-react';
import type { GlobalSearchResults as SearchResults } from './officeToolsEndpoints';

/**
 * ─── §22 (Sesiunea 148) — SECȚIUNILE, CA DATE ────────────────────────────────────────────────
 *
 * ⛔ **Nu nouă blocuri de JSX copiate.** Erau cinci, iar felia asta adăuga încă cinci — al șaselea
 * bloc copiat ar fi fost momentul în care cineva schimbă stilul într-unul și uită în celelalte
 * (același motiv pentru care rândurile de carduri din Action Centre au devenit o buclă la §18).
 *
 * 🔴 **`to` — unde duce rândul, și de ce nu peste tot un `?id=`.** Ecranul clienților îl citește și
 * deschide fișa; ecranele de incidente, reclamații și curățători **nu**, deci un `?id=` acolo ar
 * duce omul la o listă pretinzând că i-a deschis rândul — exact „No incorrect record navigation"
 * din §22. ⚠️ Deci rândul duce la **lista** lor, iar textul rândului poartă numărul, ca să fie
 * găsibil. Aceeași alegere ca la facturi (ACHU-285): cel mai apropiat ecran care există, nu unul
 * inventat.
 */
export type SearchSection = {
  key: string;
  label: string;
  icon: typeof Users;
  /** Rândurile secțiunii: text și destinație. `undefined` când ruta n-a trimis lista (pachet vechi). */
  rows: (r: NonNullable<SearchResults>) => { id: string; text: string; muted?: string; to: string }[];
};

export const SECTIONS: SearchSection[] = [
  /**
   * ─── ACHU-285 (Sesiunea 121) — facturile, PRIMELE ────────────────
   * **Decizia Archanei, 12/08/2026:** *„Merg pe recomandarea ta"*. 🔴 Înaintea clienților fiindcă un
   * număr de factură e o căutare **exactă și intenționată**, în timp ce un nume de client e
   * explorare. ⚠️ **Nu există pagină de facturi**: rândul duce la vizita ei, sau la fișa clientului
   * când n-are vizită (facturile de abonament).
   */
  {
    key: 'invoices', label: 'Invoices', icon: FileText,
    rows: r => (r.invoices ?? []).map(i => ({
      id: i.id,
      text: `${i.invoiceNumber} — ${i.customerNameSnapshot} — £${i.grossAmount.toFixed(2)}`,
      /** ⚠️ O factură ANULATĂ rămâne găsibilă, deliberat — cine caută numărul ei o caută chiar fiindcă a fost anulată. */
      muted: i.status !== 'Issued' ? `(${i.status})` : undefined,
      to: i.jobId ? `/admin/jobs?id=${i.jobId}` : `/admin/customers?id=${i.customerId}`,
    })),
  },
  {
    key: 'customers', label: 'Customers', icon: Users,
    rows: r => r.customers.map(c => ({ id: c.id, text: c.customerName, to: `/admin/customers?id=${c.id}` })),
  },
  {
    key: 'jobs', label: 'Jobs', icon: Briefcase,
    rows: r => r.jobs.map(j => ({ id: j.id, text: `#${j.jobId} — ${j.service}`, to: `/admin/jobs?id=${j.id}` })),
  },
  /**
   * §22 (Sesiunea 148) — **CASELE.** ⚠️ Duc la fișa CLIENTULUI: casa se administrează de acolo, iar
   * o pagină proprie de case nu există. 🔴 Rândul poartă adresa și codul poștal — și **nimic** din
   * nota de acces sau codul porții, care nici nu pleacă de la server (ACHU-740).
   */
  {
    key: 'properties', label: 'Properties', icon: Home,
    rows: r => (r.properties ?? []).map(p => ({
      id: p.id,
      text: [p.label, p.address, p.postcode].filter(Boolean).join(' · '),
      muted: p.customerName,
      to: `/admin/customers?id=${p.customerId}`,
    })),
  },
  /** §22 (Sesiunea 148) — ⚠️ cel INACTIV se marchează: altfel „de ce apare Ion, el a plecat?". */
  {
    key: 'cleaners', label: 'Cleaners', icon: Sparkles,
    rows: r => (r.cleaners ?? []).map(c => ({
      id: c.id,
      text: `#${c.cleanerId} — ${c.cleanerName}`,
      muted: c.active ? undefined : '(inactive)',
      to: '/admin/cleaners',
    })),
  },
  {
    key: 'incidents', label: 'Incidents', icon: ShieldAlert,
    rows: r => (r.incidents ?? []).map(i => ({
      id: i.id,
      text: `#${i.incidentId} — ${i.kind} · ${i.severity}`,
      muted: [i.customerName, i.cleanerName].filter(Boolean).join(' · ') || undefined,
      to: '/admin/incidents',
    })),
  },
  {
    key: 'complaints', label: 'Complaints', icon: Inbox,
    rows: r => (r.complaints ?? []).map(c => ({
      id: c.id,
      text: `#${c.customerRequestId} — ${c.customerName}`,
      muted: [c.complaintCategory, c.status].filter(Boolean).join(' · ') || undefined,
      to: '/admin/customer-requests',
    })),
  },
  /** §22 (Sesiunea 148) — ⚠️ felul, eticheta și starea. ⛔ Niciun număr de act, nici aici, nici la server. */
  {
    key: 'documents', label: 'Cleaner documents', icon: BadgeCheck,
    rows: r => (r.documents ?? []).map(d => ({
      id: d.id,
      text: `${d.cleanerName} — ${d.kind}${d.label ? ` (${d.label})` : ''}`,
      muted: d.status,
      to: '/admin/cleaners',
    })),
  },
  {
    key: 'payments', label: 'Payments', icon: CreditCard,
    rows: r => r.payments.map(p => ({ id: p.id, text: `#${p.paymentId}`, to: `/admin/payments?id=${p.id}` })),
  },
  {
    key: 'expenses', label: 'Expenses', icon: Receipt,
    rows: r => r.expenses.map(e => ({
      id: e.id, text: [e.supplier, e.description].filter(Boolean).join(' — '), to: `/admin/expenses?id=${e.id}`,
    })),
  },
];

