import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
import { fmt } from '@/lib/format';
import type { GetCustomerPortalOutputType } from '@/lib/endpoints';

function SummaryItem({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${muted ? 'text-muted-foreground' : ''}`}>{value}</p>
    </div>
  );
}

export default function FinancialSummaryCard({ fs }: { fs: GetCustomerPortalOutputType['financialSummary'] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryItem label="Total Job Value" value={fmt(fs.totalJobValue)} />
          <SummaryItem label="Payments Received" value={fmt(fs.totalPaymentsReceived)} />
          <SummaryItem label="Refunds" value={fmt(fs.totalRefunds)} muted={fs.totalRefunds === 0} />
          <SummaryItem label="Net Paid" value={fmt(fs.netAmountPaid)} />
        </div>
        {fs.outstandingBalance > 0 && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Amount Due</span>
              </div>
              <span className="text-lg font-bold text-orange-700">{fmt(fs.outstandingBalance)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

