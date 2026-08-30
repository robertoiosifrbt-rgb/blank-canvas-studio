import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { fmt } from '@/lib/format';

export default function SicknessTotalsCard({ totals }) {
  if (!totals) return null;
  return (
    <Card>
      <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Spells</p>
          <p className="text-2xl font-semibold">{totals.spells}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Still off</p>
          <p className={`text-2xl font-semibold ${totals.open > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
            {totals.open}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">SSP days paid</p>
          <p className="text-2xl font-semibold">{totals.sspDaysPaid}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">SSP total</p>
          <p className="text-2xl font-semibold">{fmt(totals.sspTotalPence / 100)}</p>
          {totals.companySickPayPence > 0 && (
            <p className="text-xs text-muted-foreground">
              plus {fmt(totals.companySickPayPence / 100)} company sick pay
            </p>
          )}
        </div>
        {totals.returnToWorkOutstanding > 0 && (
          <p className="sm:col-span-4 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {totals.returnToWorkOutstanding} {totals.returnToWorkOutstanding === 1 ? 'person came' : 'people came'}{' '}
              back with no return-to-work conversation recorded. Not a legal requirement — but it is the
              record that shows somebody asked how they were.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

