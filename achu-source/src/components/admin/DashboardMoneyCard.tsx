import { GetDashboardOutputType } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, ChevronRight, PiggyBank, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The eight financial figures as one flow instead of eight equal tiles.
 * Reserves are shown as slices of profit — which is what they actually are —
 * so it is visible at a glance how much of the profit is already spoken for.
 */
export default function MoneyCard({ data, periodLabel, nav }: {
  data: GetDashboardOutputType;
  periodLabel: string;
  nav: (path: string) => void;
}) {
  const reserved = data.taxReserve + data.niReserve + data.emergencyReserve;
  // Guard the divisor: an all-zero period (or a loss) must not produce NaN
  // widths or negative bar segments.
  const barBase = Math.max(data.netProfit, reserved, 0);
  const pct = (v: number) => (barBase > 0 ? Math.max(0, Math.min(100, (v / barBase) * 100)) : 0);

  const reserves = [
    { label: 'Tax', rate: data.taxRate, value: data.taxReserve },
    { label: 'NI', rate: data.niRate, value: data.niReserve },
    { label: 'Emergency', rate: data.emergencyRate, value: data.emergencyReserve },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Money</h3>
            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          </div>

          {/* income → expenses → profit */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Figure label="Income" value={fmt(data.totalIncome)} tone="in" icon={TrendingUp} big />
            <ArrowRight className="h-4 w-4 text-muted-foreground/50 mb-2 hidden sm:block" />
            <Figure label="Expenses" value={fmt(data.totalExpenses)} tone="out" icon={TrendingDown} />
            <ArrowRight className="h-4 w-4 text-muted-foreground/50 mb-2 hidden sm:block" />
            <Figure
              label="Net Profit"
              value={fmt(data.netProfit)}
              tone={data.netProfit >= 0 ? 'in' : 'out'}
              big
            />
          </div>

          {/* how much of that profit is already committed */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5 text-amber-600" />Set aside from profit
              </span>
              <span className="font-medium tabular-nums text-amber-700">{fmt(reserved)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
              {reserves.map(r => (
                <div
                  key={r.label}
                  className="h-full bg-amber-500/80 border-r border-card last:border-r-0"
                  style={{ width: `${pct(r.value)}%` }}
                  title={`${r.label}: ${fmt(r.value)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {reserves.map(r => (
                <span key={r.label} className="tabular-nums">
                  {r.label} ({(r.rate * 100).toFixed(0)}%) <span className="font-medium text-foreground">{fmt(r.value)}</span>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The number you actually open this page for, plus the one thing that is
          genuinely actionable: money someone still owes you. */}
      <div className="grid gap-3">
        <Card className="bg-primary text-primary-foreground border-primary">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-xs opacity-90">Available Cash</span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{fmt(data.availableCash)}</p>
            <p className="text-xs opacity-75 mt-1.5">Profit after everything set aside</p>
          </CardContent>
        </Card>

        <button
          onClick={() => nav('/admin/action-centre?section=money&filter=total')}
          className="text-left rounded-xl border border-border bg-card p-5 hover:border-orange-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <span className="text-xs text-muted-foreground">Outstanding</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-orange-600">{fmt(data.outstandingBalances)}</p>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            Owed to you — review <ChevronRight className="h-3 w-3" />
          </p>
        </button>
      </div>
    </div>
  );
}

function Figure({ label, value, tone, icon: Icon, big }: {
  label: string;
  value: string;
  tone: 'in' | 'out';
  icon?: React.ComponentType<{ className?: string }>;
  big?: boolean;
}) {
  const color = tone === 'in' ? 'text-emerald-600' : 'text-rose-600';
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`font-bold tabular-nums ${color} ${big ? 'text-2xl' : 'text-xl'}`}>{value}</p>
    </div>
  );
}

