/**
 * §21 Action Centre — VIZITELE INCHEIATE, ca fisier propriu.
 *
 * Iesit din `ActionCentrePage.tsx` in Sesiunea 154 (§48). Nu dintr-o dorinta de curatenie: felia de
 * accesibilitate a atins 54 de randuri de cod din acel fisier (cate o celula de antet), iar poarta
 * `marime-diff` cere ca la o modificare semnificativa a unui fisier de peste 500 de randuri
 * responsabilitatea atinsa sa se extraga (`AGENT_RULES` §7.4). Regula spune si ca o exceptie cere
 * aprobarea unui owner, nu o linie scrisa de mine in propriul commit. Deci: extragere.
 *
 * Alegerea bucatii nu e arbitrara: vizitele incheiate sunt o sectiune intreaga a ecranului — cardul
 * de rezumat plus vederea ei, cu propria cautare si propriul tabel. Nu imparte nimic la mijloc: nu
 * are stare comuna cu restul paginii, iar tot ce-i trebuie vine ca parametru.
 */
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import { Search, RefreshCw, AlertCircle, ChevronRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GetActionCentreOutputType } from '@/lib/endpoints';
import { SECTION_COLORS } from './actionCentreSections';
import HistoryCapNote from '@/components/shared/HistoryCapNote';

type ActionData = GetActionCentreOutputType;

export function CompletedJobsSummaryCard({ data, onClick }: {
  data: ActionData['completedJobs']; onClick: () => void;
}) {
  const colors = SECTION_COLORS.completedJobs;
  const count = data.totalCount;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all min-h-[80px] ${
        count > 0
          ? `${colors.bg} ${colors.border} hover:shadow-sm`
          : 'border-border/50 bg-muted/30 hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 shrink-0 ${count > 0 ? colors.icon : 'bg-muted text-muted-foreground'}`}>
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight">Completed Jobs</h3>
            <span className={`text-lg font-bold tabular-nums shrink-0 rounded-full px-2 min-w-[2rem] text-center ${count > 0 ? colors.badge : 'text-muted-foreground'}`}>
              {count > 999 ? '999+' : count}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">All jobs with Completed status</p>
        </div>
      </div>
    </button>
  );
}

// ─── Completed Jobs Detail View (ACHU-135) ──────────────────────────


export function CompletedJobsView({ data, search, setSearch, onBack, onRefresh, refreshing, openJob, error }: {
  data: ActionData['completedJobs'];
  search: string;
  setSearch: (s: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  openJob: (id: string) => void;
  error: string | null;
}) {
  const colors = SECTION_COLORS.completedJobs;

  const filtered = useMemo(() => {
    let items = data.items;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(j =>
        String(j.jobId).toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        (j.service ?? '').toLowerCase().includes(q) ||
        (j.address ?? '').toLowerCase().includes(q) ||
        j.assignedCleanerNames.some(n => n.toLowerCase().includes(q))
      );
    }
    return items;
  }, [data.items, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" aria-label="Back" title="Back" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold flex items-center gap-2 flex-wrap">
              <CheckCircle2 className={`h-5 w-5 shrink-0 ${colors.text}`} />
              <span className="truncate">Completed Jobs</span>
              <Badge variant="secondary">{data.totalCount}</Badge>
            </h2>
            <p className="text-xs text-muted-foreground">All jobs with Completed status</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="shrink-0">
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Search jobs, customers, cleaners" placeholder="Search jobs, customers, cleaners…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {data.totalCount} completed job{data.totalCount !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {search ? 'No completed jobs match your search.' : 'No completed jobs found.'}
        </CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <div tabIndex={0} className="hidden md:block rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Job</th>
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Customer</th>
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Service</th>
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Address</th>
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Assigned</th>
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Job Date</th>
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Finish Time</th>
                  <th scope="col" className="text-right p-2.5 font-medium text-xs">Charged</th>
                  <th scope="col" className="text-left p-2.5 font-medium text-xs">Payment</th>
                  <th scope="col" className="p-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => (
                  <tr
                    key={j.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => openJob(j.id)}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && openJob(j.id)}
                  >
                    <td className="p-2.5 font-medium text-xs whitespace-nowrap">Job #{j.jobId}</td>
                    <td className="p-2.5 text-xs">{j.customerName}</td>
                    <td className="p-2.5 text-xs">{j.service ?? '—'}</td>
                    <td className="p-2.5 text-xs max-w-[160px] truncate">{j.address ?? '—'}</td>
                    <td className="p-2.5 text-xs">
                      {j.assignedCleanerNames.length > 0
                        ? <span className="truncate max-w-[120px] block">{j.assignedCleanerNames.join(', ')}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="p-2.5 text-xs whitespace-nowrap">{fmtDate(j.jobDate)}</td>
                    <td className="p-2.5 text-xs whitespace-nowrap">{j.actualFinishTime ?? '—'}</td>
                    <td className="p-2.5 text-xs text-right whitespace-nowrap">{j.amountCharged != null ? fmt(j.amountCharged) : '—'}</td>
                    <td className="p-2.5"><StatusBadge status={j.paymentStatus ?? undefined} /></td>
                    <td className="p-2.5"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(j => (
              <Card key={j.id} className="cursor-pointer active:shadow-md transition-shadow" onClick={() => openJob(j.id)}>
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">Job #{j.jobId}{j.service ? ` – ${j.service}` : ''}</p>
                      <p className="text-xs text-muted-foreground truncate">{j.customerName}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status="Completed" />
                    <StatusBadge status={j.paymentStatus ?? undefined} />
                    {j.amountCharged != null && j.amountCharged > 0 && (
                      <Badge variant="outline" className="text-[10px]">{fmt(j.amountCharged)}</Badge>
                    )}
                  </div>
                  {j.assignedCleanerNames.length > 0 && (
                    <p className="text-xs text-muted-foreground">{j.assignedCleanerNames.join(', ')}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fmtDate(j.jobDate)}{j.actualFinishTime ? ` · Finished ${j.actualFinishTime}` : ''}</span>
                    <span className="font-medium text-primary">Open Job</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/*
        🔴 ACHU-781 (Sesiunea 156) — **cea mai grea listă de pe prima pagină, și cea care nu cerea
        nimic.** ⛔ Duceam spre browser fiecare vizită terminată vreodată; acum doar cele mai recente,
        iar propoziția spune câte sunt de fapt și unde se văd toate.

        ⚠️ **În afara lui `filtered`, dinadins:** nota e despre ce a trimis SERVERUL, nu despre ce a
        rămas după căutarea de pe ecran — două tăieri diferite, iar amestecate n-ar mai spune nimic.
      */}
      <HistoryCapNote note={data.historyNote} />
    </div>
  );
}

// ─── Future Jobs Summary Card ───────────────────────────────────────


