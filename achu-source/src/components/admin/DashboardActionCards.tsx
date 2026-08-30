import { GetActionCentreOutputType } from '@/lib/endpoints';
import { Skeleton } from '@/components/ui/skeleton';
import { fmt } from '@/lib/format';
import { AlertCircle, CheckCircle, RefreshCw, ChevronRight, ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ActionCards({ actions, error, loading, stale, updatedAt, onRetry, nav }: {
  actions: GetActionCentreOutputType | null;
  error: string | null;
  loading: boolean;
  stale: boolean;
  /**
   * 🆕 §37 (Sesiunea 154) — când au fost citite CIFRELE ASTEA.
   *
   * ⚠️ **Propriul marcaj, nu cel al paginii:** numărătorile și sumele de sus vin din două cereri
   * independente (`Dashboard.tsx`), deci un singur „actualizat la" pentru tot ecranul ar fi
   * afirmat despre jumătate din el o oră care nu e a lui.
   */
  updatedAt: Date | null;
  onRetry: () => void;
  nav: (path: string) => void;
}) {
/**
   * ACHU-401 (Sesiunea 115). One Action Centre section, instead of `any`.
   *
   * `GetActionCentreOutputType` is `any` (see the `endpoints.ts` header), so
   * the two readers below were casting to reach into it. Named here are only
   * the three fields they touch; the section is looked up by a string key that
   * comes from the card definitions, so it can legitimately be absent.
   */
  type ActionSection = {
    totalCount: number;
    totalAmount?: number;
    categories: { key: string; count: number; amount?: number }[];
  };
  const sectionOf = (section: string): ActionSection | undefined =>
    (actions as Record<string, ActionSection> | null)?.[section];

  const getCount = (section: string, key: string) => {
    const s = sectionOf(section);
    if (!s) return 0;
    if (key === 'all') return s.totalCount;
    return s.categories.find(c => c.key === key)?.count ?? 0;
  };
  const getAmount = (section: string, key: string) => {
    const s = sectionOf(section);
    if (!s) return undefined;
    if (key === 'all') return s.totalAmount;
    return s.categories.find(c => c.key === key)?.amount;
  };

  /**
   * ⚠️ `amount` is optional ON PURPOSE and must stay declared: only the money
   * and expense cards carry one, and without it here TypeScript infers a union
   * in which the field is absent from some members — which is why the render
   * below used to cast `c` twice.
   */
  type ActionCard = {
    label: string; count: number; section: string; filter: string;
    urgent: boolean; amount?: number;
  };

  const groups: { title: string; cards: ActionCard[] }[] = [
    {
      title: 'Jobs',
      cards: [
        { label: 'Not Started', count: getCount('jobs', 'not-started'), section: 'jobs', filter: 'not-started', urgent: false },
        { label: 'In Progress', count: getCount('jobs', 'in-progress'), section: 'jobs', filter: 'in-progress', urgent: false },
        { label: 'Overdue', count: getCount('jobs', 'overdue'), section: 'jobs', filter: 'overdue', urgent: true },
        { label: 'Unassigned', count: getCount('jobs', 'unassigned'), section: 'jobs', filter: 'unassigned', urgent: true },
        { label: 'Enquiries', count: getCount('jobs', 'enquiry'), section: 'jobs', filter: 'enquiry', urgent: false },
      ],
    },
    {
      title: 'Money',
      cards: [
        { label: 'Unpaid', count: getCount('money', 'unpaid'), amount: getAmount('money', 'unpaid'), section: 'money', filter: 'unpaid', urgent: true },
        { label: 'Partial', count: getCount('money', 'partial'), amount: getAmount('money', 'partial'), section: 'money', filter: 'partial', urgent: false },
        { label: 'Total Outstanding', count: getCount('money', 'total'), amount: getAmount('money', 'total'), section: 'money', filter: 'total', urgent: false },
      ],
    },
    {
      title: 'Review',
      cards: [
        { label: 'Refund Review', count: getCount('refunds', 'all'), section: 'refunds', filter: '', urgent: false },
        { label: 'Cancelled w/ Payment', count: getCount('refunds', 'cancelled-paid'), section: 'refunds', filter: 'cancelled-paid', urgent: true },
        { label: 'Receipt Review', count: getCount('expenses', 'receipt-review'), section: 'expenses', filter: 'receipt-review', urgent: false },
        { label: 'Exceptions', count: getCount('cancelled', 'all'), section: 'cancelled', filter: '', urgent: false },
      ],
    },
    /**
     * 🆕 §37 (Sesiunea 154) — CELE PATRU LUCRURI DESPRE CARE ECRANUL DE DIMINEAȚĂ NU SPUNEA NIMIC.
     *
     * ⛔ Blocul ăsta e rezumatul Action Centre („View All" duce chiar acolo), dar cunoștea trei
     * grupuri: vizite, bani, revizuiri. ⚠️ Cozile construite în ultimele două săptămâni —
     * reclamațiile deschise, dosarele de incident, re-curățeniile care așteaptă o hotărâre și
     * hârtiile care expiră — **nu apăreau nicăieri pe prima pagină**, deși fiecare are pe cineva
     * la capătul ei: un client supărat, un dosar de daune, o promisiune făcută, o hârtie pe care o
     * cere cineva din afară fără preaviz.
     *
     * 🔴 **Doar cele patru, nu toate cincisprezece secțiuni.** Un rezumat care arată tot devine o
     * copie a ecranului pe care rezumă, iar atunci nu mai e nici rezumat, nici ecran.
     *
     * ⚠️ **Hârtiile sunt DOUĂ carduri, nu unul:** „expiră" și „au expirat" sunt fapte diferite, iar
     * un singur card intitulat „expiring" peste totalul secțiunii ar fi numărat și actele pe care
     * nimeni nu s-a uitat — o cifră care nu răspunde la titlul de deasupra ei.
     */
    {
      title: 'People & paperwork',
      cards: [
        { label: 'Complaints', count: getCount('customerRequests', 'customer-request-problem'), section: 'customerRequests', filter: 'customer-request-problem', urgent: true },
        { label: 'Open Incidents', count: getCount('openIncidents', 'all'), section: 'openIncidents', filter: '', urgent: false },
        { label: 'Re-cleans To Decide', count: getCount('reCleansToDecide', 'all'), section: 'reCleansToDecide', filter: '', urgent: false },
        { label: 'Documents Expired', count: getCount('cleanerDocuments', 'document_expired'), section: 'cleanerDocuments', filter: 'document_expired', urgent: true },
        { label: 'Documents Expiring', count: getCount('cleanerDocuments', 'document_expiring'), section: 'cleanerDocuments', filter: 'document_expiring', urgent: false },
      ],
    },
  ];

  const totalOutstandingItems = groups.reduce((n, g) => n + g.cards.filter(c => c.count > 0).length, 0);
  const nothingToDo = !!actions && totalOutstandingItems === 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4" /> Needs attention
          {stale && <span className="text-[10px] text-amber-600 font-normal ml-1">(stale)</span>}
          {/* ⚠️ Doar după primul răspuns reușit: „—" ar fi arătat ca o oră pierdută, nu ca „încă nimic". */}
          {updatedAt && (
            <span className="text-[10px] text-muted-foreground font-normal ml-1">
              read {updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => nav('/admin/action-centre')}>
            View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </div>

      {error && !actions && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-center space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive/60" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Retrying…' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      )}

      {stale && actions && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2 text-xs">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-amber-800 flex-1">Counts may be outdated. {error}</span>
          <Button variant="ghost" size="sm" className="text-xs h-6" onClick={onRetry} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Retry
          </Button>
        </div>
      )}

      {/* Previously the whole block just vanished when every count was zero,
          which reads as "failed to load" rather than "you're clear". */}
      {nothingToDo && (
        <Card>
          <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Nothing needs attention right now.
          </CardContent>
        </Card>
      )}

      {actions && groups.map(g => {
        const visibleCards = g.cards.filter(c => c.count > 0);
        if (visibleCards.length === 0) return null;
        return (
          <div key={g.title}>
            <p className="text-xs text-muted-foreground font-medium mb-1.5">{g.title}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {visibleCards.map(c => (
                <button
                  key={c.label}
                  onClick={() => nav(`/admin/action-centre?section=${c.section}${c.filter ? `&filter=${c.filter}` : ''}`)}
                  className={`bg-card border rounded-lg p-3 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    c.urgent ? 'border-rose-200 hover:border-rose-400' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-xl font-bold tabular-nums ${c.urgent ? 'text-rose-600' : 'text-foreground'}`}>{c.count}</p>
                  {c.amount !== undefined && (
                    <p className="text-xs font-medium mt-0.5 tabular-nums">{fmt(c.amount)}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {!actions && !error && loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      )}
    </section>
  );
}

