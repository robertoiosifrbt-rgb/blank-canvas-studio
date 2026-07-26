import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '@/lib/format';

const statuses = [
  { status: 'Enquiry', description: 'Request received and awaiting review' },
  { status: 'Booked', description: 'Provisional booking created' },
  { status: 'Confirmed', description: 'Booking confirmed by ACHU' },
  { status: 'In Progress', description: 'Service currently underway' },
  { status: 'Completed', description: 'Service finished' },
  { status: 'Cancelled', description: 'Booking cancelled' },
  { status: 'No Access', description: 'Team could not access the property' },
];

export default function StatusLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-1.5"><Info className="h-3 w-3" />What do the statuses mean?</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="border-t border-border p-3 space-y-2">
          {statuses.map(s => (
            <div key={s.status} className="flex items-start gap-2">
              <div className="shrink-0 mt-0.5"><StatusBadge status={s.status} /></div>
              <span className="text-xs text-muted-foreground">{s.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
