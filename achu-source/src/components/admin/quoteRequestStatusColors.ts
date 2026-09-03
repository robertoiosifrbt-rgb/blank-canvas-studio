/**
 * Culorile pastilei de stare a unei cereri de ofertă.
 *
 * ⛔ **Fișier propriu (Sesiunea 159):** le citesc AMÂNDOUĂ ecranele — lista
 * (`QuoteRequestsList.tsx`) și fișa (`QuoteRequestPage.tsx`) — iar o a doua copie ar face ca
 * aceeași stare să arate diferit în două locuri. ⚠️ Nu e o constantă de componentă: un fișier de
 * componentă care exportă și constante rupe `react-refresh/only-export-components`.
 */
export const STATUS_COLORS: Record<string, string> = {
  New: 'bg-primary/10 text-primary',
  Approved: 'bg-blue-100 text-blue-700',
  Processing: 'bg-amber-100 text-amber-700',
  Converted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-destructive/10 text-destructive',
  Duplicate: 'bg-muted text-muted-foreground',
  'Conversion Error': 'bg-red-100 text-red-700',
};

