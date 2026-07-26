import { useEffect, useState, useCallback } from 'react';
import { getDashboard, GetDashboardOutputType, getActionCentre, GetActionCentreOutputType } from 'zite-endpoints-sdk';
import { Skeleton } from '@/components/ui/skeleton';
import { fmt } from '@/lib/format';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, TrendingUp, TrendingDown, Landmark, Wallet, AlertCircle, CalendarDays, CalendarCheck, CheckCircle, XCircle, Users, Briefcase, CreditCard, Receipt, ShieldAlert, Percent, RefreshCw, Camera, ChevronRight, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import ExpenseChart from './ExpenseChart';
import ReceiptScanner from './ReceiptScanner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { validateDateRange as sharedValidateDateRange } from '@/lib/validation';

const periods = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'taxYear', label: 'This Tax Year' },
  { value: 'allTime', label: 'All Time' },
  { value: 'custom', label: 'Custom Date Range' },
];

export default function Dashboard() {
  // ACHU-107/108/109: Two independent tracked requests — timeout + sequence protection
  const { data, loading: dashLoading, error: dashError, stale: dashStale, fire: fireDash } =
    useTrackedRequest<GetDashboardOutputType>({ timeoutMs: 30000 });
  const { data: actions, loading: actionsLoading, error: actionsError, stale: actionsStale, fire: fireActions } =
    useTrackedRequest<GetActionCentreOutputType>({ timeoutMs: 15000 });

  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [dateError, setDateError] = useState('');
  const nav = useNavigate();

  // Derived for JSX compatibility
  const retrying = dashLoading;

  // ACHU-107: Always fires — no loadingRef guard, latest-request-wins
  const loadDashboard = useCallback((p: string, sd?: string, ed?: string) => {
    fireDash(() => getDashboard({ period: p as any, startDate: sd, endDate: ed }));
  }, [fireDash]);

  // ACHU-109: No stale closure — hook manages state internally
  const refreshActions = useCallback(() => {
    fireActions(() => getActionCentre({}));
  }, [fireActions]);

  useEffect(() => { loadDashboard('month'); }, [loadDashboard]);
  useEffect(() => { refreshActions(); }, [refreshActions]);

  // Auto-refresh action centre on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') refreshActions();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refreshActions]);

  // ACHU-107: Period change always triggers — no guard blocks it
  const handlePeriodChange = (v: string) => {
    setPeriod(v);
    if (v !== 'custom') loadDashboard(v);
  };

  // ACHU-078: Shared date range validator (same rules as backend)
  const validateDateRange = (sd: string, ed: string): string | null => sharedValidateDateRange(sd, ed);

  const handleCustomApply = () => {
    const err = validateDateRange(startDate, endDate);
    if (err) { setDateError(err); return; }
    setDateError('');
    loadDashboard('custom', startDate, endDate);
  };

  const handleRetry = () => loadDashboard(period, period === 'custom' ? startDate : undefined, period === 'custom' ? endDate : undefined);

  const handleFullRefresh = () => {
    loadDashboard(period, period === 'custom' ? startDate : undefined, period === 'custom' ? endDate : undefined);
    refreshActions();
  };

  const refreshAfterOperation = () => {
    loadDashboard(period, period === 'custom' ? startDate : undefined, period === 'custom' ? endDate : undefined);
    refreshActions();
  };

  // Show skeleton when no data and no error (initial / loading)
  if (!data && !dashError) return <DashboardSkeleton />;

  // Show error card when no data available
  if (!data) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive/60" />
            <p className="text-muted-foreground">{dashError || 'Unable to load dashboard data. Please try again.'}</p>
            <Button variant="outline" onClick={handleRetry} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 mr-1 ${retrying ? 'animate-spin' : ''}`} />{retrying ? 'Retrying…' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const financials = [
    { label: 'Total Income', value: fmt(data.totalIncome), icon: PoundSterling, color: 'text-green-600' },
    { label: 'Total Expenses', value: fmt(data.totalExpenses), icon: TrendingDown, color: 'text-red-500' },
    { label: 'Net Profit', value: fmt(data.netProfit), icon: TrendingUp, color: data.netProfit >= 0 ? 'text-green-600' : 'text-red-500' },
    { label: `Tax Reserve (${(data.taxRate * 100).toFixed(0)}%)`, value: fmt(data.taxReserve), icon: Landmark, color: 'text-amber-600' },
    { label: `NI Reserve (${(data.niRate * 100).toFixed(0)}%)`, value: fmt(data.niReserve), icon: Percent, color: 'text-purple-600' },
    { label: `Emergency (${(data.emergencyRate * 100).toFixed(0)}%)`, value: fmt(data.emergencyReserve), icon: ShieldAlert, color: 'text-orange-500' },
    { label: 'Available Cash', value: fmt(data.availableCash), icon: Wallet, color: 'text-blue-600' },
    { label: 'Outstanding', value: fmt(data.outstandingBalances), icon: AlertCircle, color: 'text-orange-500' },
  ];

  const jobs = [
    { label: 'Active Jobs Today', value: data.jobsToday, icon: CalendarDays, color: 'text-blue-600' },
    { label: 'Upcoming', value: data.upcomingJobs, icon: CalendarCheck, color: 'text-sky-600' },
    { label: 'Completed', value: data.completedJobs, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Cancelled', value: data.cancelledJobs, icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" size="sm" onClick={handleFullRefresh} disabled={retrying || actionsLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${(retrying || actionsLoading) ? 'animate-spin' : ''}`} />Refresh All
          </Button>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{periods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          {period === 'custom' && (
            <>
              <Input type="date" className="w-[140px]" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="date" className="w-[140px]" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <Button size="sm" onClick={handleCustomApply}>Apply</Button>
            </>
          )}
        </div>
      </div>
      {dateError && period === 'custom' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{dateError}</p>
        </div>
      )}

      {dashError && data && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${dashStale ? 'bg-amber-50 border border-amber-200' : 'bg-destructive/10 border border-destructive/20'}`}>
          <AlertCircle className={`h-4 w-4 shrink-0 ${dashStale ? 'text-amber-600' : 'text-destructive'}`} />
          <p className={`text-sm flex-1 ${dashStale ? 'text-amber-800' : 'text-destructive'}`}>
            {dashError}{dashStale && <span className="ml-1 text-xs font-medium">(showing cached data)</span>}
          </p>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={retrying}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${retrying ? 'animate-spin' : ''}`} />{retrying ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {!data.settingsConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Financial settings not configured. <button className="underline font-medium" onClick={() => nav('/admin/financial-settings')}>Configure now</button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {financials.map(f => (
          <Card key={f.label}><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><f.icon className={`h-4 w-4 ${f.color}`} /><span className="text-xs text-muted-foreground">{f.label}</span></div>
            <p className={`text-lg font-bold ${f.color}`}>{f.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {jobs.map(j => (
          <Card key={j.label}><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><j.icon className={`h-4 w-4 ${j.color}`} /><span className="text-xs text-muted-foreground">{j.label}</span></div>
            <p className="text-2xl font-bold">{j.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Expenses for Selected Period: {fmt(data.periodExpenses)}</CardTitle></CardHeader>
        <CardContent><ExpenseChart data={data.expensesByCategory} /></CardContent>
      </Card>

      <ActionCards
        actions={actions}
        error={actionsError}
        loading={actionsLoading}
        stale={actionsStale}
        onRetry={refreshActions}
        nav={nav}
      />

      <div>
        <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Button variant="default" className="h-auto py-3 flex flex-col gap-1 col-span-2 md:col-span-1" onClick={() => setScannerOpen(true)}>
            <Camera className="h-5 w-5" /><span className="text-xs">Scan Receipt / Invoice</span>
          </Button>
          {[
            { label: 'New Customer', icon: Users, path: '/admin/customers?new=1' },
            { label: 'New Job', icon: Briefcase, path: '/admin/jobs?new=1' },
            { label: 'Record Payment', icon: CreditCard, path: '/admin/payments?new=1' },
            { label: 'Record Expense', icon: Receipt, path: '/admin/expenses?new=1' },
          ].map(a => (
            <Button key={a.label} variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => nav(a.path)}>
              <a.icon className="h-5 w-5" /><span className="text-xs">{a.label}</span>
            </Button>
          ))}
        </div>
        <ReceiptScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onSaved={() => { setScannerOpen(false); refreshAfterOperation(); }} />
      </div>
    </div>
  );
}

function ActionCards({ actions, error, loading, stale, onRetry, nav }: {
  actions: GetActionCentreOutputType | null;
  error: string | null;
  loading: boolean;
  stale: boolean;
  onRetry: () => void;
  nav: (path: string) => void;
}) {
  const getCount = (section: string, key: string) => {
    if (!actions) return 0;
    const s = (actions as any)[section];
    if (!s) return 0;
    if (key === 'all') return s.totalCount;
    const cat = s.categories.find((c: any) => c.key === key);
    return cat?.count ?? 0;
  };
  const getAmount = (section: string, key: string) => {
    if (!actions) return undefined;
    const s = (actions as any)[section];
    if (!s) return undefined;
    if (key === 'all') return s.totalAmount;
    const cat = s.categories.find((c: any) => c.key === key);
    return cat?.amount;
  };

  const groups = [
    {
      title: 'Jobs',
      cards: [
        { label: 'Not Started', count: getCount('jobs', 'not-started'), section: 'jobs', filter: 'not-started', color: 'text-blue-600' },
        { label: 'In Progress', count: getCount('jobs', 'in-progress'), section: 'jobs', filter: 'in-progress', color: 'text-orange-600' },
        { label: 'Overdue', count: getCount('jobs', 'overdue'), section: 'jobs', filter: 'overdue', color: 'text-red-600' },
        { label: 'Unassigned', count: getCount('jobs', 'unassigned'), section: 'jobs', filter: 'unassigned', color: 'text-amber-600' },
        { label: 'Enquiries', count: getCount('jobs', 'enquiry'), section: 'jobs', filter: 'enquiry', color: 'text-purple-600' },
      ],
    },
    {
      title: 'Money',
      cards: [
        { label: 'Unpaid', count: getCount('money', 'unpaid'), amount: getAmount('money', 'unpaid'), section: 'money', filter: 'unpaid', color: 'text-red-600' },
        { label: 'Partial', count: getCount('money', 'partial'), amount: getAmount('money', 'partial'), section: 'money', filter: 'partial', color: 'text-yellow-600' },
        { label: 'Total Outstanding', count: getCount('money', 'total'), amount: getAmount('money', 'total'), section: 'money', filter: 'total', color: 'text-orange-600' },
      ],
    },
    {
      title: 'Review',
      cards: [
        { label: 'Refund Review', count: getCount('refunds', 'all'), section: 'refunds', filter: '', color: 'text-purple-600' },
        { label: 'Cancelled w/ Payment', count: getCount('refunds', 'cancelled-paid'), section: 'refunds', filter: 'cancelled-paid', color: 'text-red-600' },
        { label: 'Receipt Review', count: getCount('expenses', 'receipt-review'), section: 'expenses', filter: 'receipt-review', color: 'text-sky-600' },
        { label: 'Exceptions', count: getCount('cancelled', 'all'), section: 'cancelled', filter: '', color: 'text-muted-foreground' },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4" /> Action Centre
          {stale && <span className="text-[10px] text-amber-600 font-normal ml-1">(stale)</span>}
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
                  className="bg-card border border-border rounded-lg p-3 text-left hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-xl font-bold ${c.color}`}>{c.count}</p>
                  {(c as any).amount !== undefined && (
                    <p className="text-xs font-medium mt-0.5">{fmt((c as any).amount)}</p>
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
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
    </div>
  );
}
