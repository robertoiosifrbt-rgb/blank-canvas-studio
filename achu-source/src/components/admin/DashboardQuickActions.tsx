import { Users, Briefcase, CreditCard, Receipt, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QuickActions({ onScan, nav }: { onScan: () => void; nav: (path: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Button variant="default" className="h-auto py-3 flex flex-col gap-1 col-span-2 md:col-span-1" onClick={onScan}>
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
  );
}

